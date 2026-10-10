import json
import logging
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.services.geocoding_service import calculate_haversine_distance

logger = logging.getLogger("app.services.routing")


class RoutingService:
    @staticmethod
    def _compute_street_grid_distance(
        p1: Tuple[float, float], p2: Tuple[float, float]
    ) -> float:
        """
        Calculates Manhattan street distance (|dx| + |dy|) between two points in meters.
        p1, p2 are (lon, lat).
        """
        lon1, lat1 = p1
        lon2, lat2 = p2
        dx = calculate_haversine_distance(lat1, lon1, lat1, lon2) * 1000.0
        dy = calculate_haversine_distance(lat1, lon1, lat2, lon1) * 1000.0
        return dx + dy

    @staticmethod
    def _interpolate_straight_street(
        p1: Tuple[float, float], p2: Tuple[float, float], step_m: float = 18.0
    ) -> List[List[float]]:
        """
        Interpolates intermediate waypoints every ~step_m meters between p1 and p2.
        p1, p2 are [lon, lat]. Returns list of [lon, lat].
        """
        dist = calculate_haversine_distance(p1[1], p1[0], p2[1], p2[0]) * 1000.0
        if dist <= step_m:
            return [[round(p1[0], 6), round(p1[1], 6)], [round(p2[0], 6), round(p2[1], 6)]]
        num_steps = max(2, int(dist / step_m))
        pts = []
        for k in range(num_steps + 1):
            frac = k / num_steps
            lon = p1[0] + (p2[0] - p1[0]) * frac
            lat = p1[1] + (p2[1] - p1[1]) * frac
            pts.append([round(lon, 6), round(lat, 6)])
        return pts

    @classmethod
    def _generate_direct_street_path(
        cls, p1: Tuple[float, float], p2: Tuple[float, float]
    ) -> Tuple[List[List[float]], float, float]:
        """
        Generates a direct street grid path connecting p1 and p2 with realistic street corner turn.
        Returns coordinates list, distance in meters, and duration in seconds.
        """
        lon1, lat1 = p1
        lon2, lat2 = p2
        dx = calculate_haversine_distance(lat1, lon1, lat1, lon2) * 1000.0
        dy = calculate_haversine_distance(lat1, lon1, lat2, lon1) * 1000.0
        grid_dist = dx + dy

        # Corner selection: move along the primary cross avenue first
        corner: Tuple[float, float] = (lon2, lat1) if dx >= dy else (lon1, lat2)

        seg1 = cls._interpolate_straight_street(p1, corner)
        seg2 = cls._interpolate_straight_street(corner, p2)

        # Merge segments avoiding duplicate corner point
        merged_pts = seg1[:-1] + seg2
        dur_s = grid_dist / 8.33  # ~30 km/h city speed
        return merged_pts, round(grid_dist, 1), round(dur_s, 1)

    @classmethod
    def get_distance_matrix(
        cls,
        coordinates: List[Tuple[float, float]],  # List of (lon, lat)
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """
        Fetch distance matrix (meters) and duration matrix (seconds).
        Queries OSRM Table and prunes artificial one-way detours by comparing against
        street grid Manhattan distance.
        """
        n = len(coordinates)
        if n <= 1:
            return [[0.0]], [[0.0]]

        # Baseline Manhattan street grid matrix
        grid_distances = [[0.0] * n for _ in range(n)]
        grid_durations = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i != j:
                    d = cls._compute_street_grid_distance(coordinates[i], coordinates[j])
                    grid_distances[i][j] = d
                    grid_durations[i][j] = d / 8.33

        # OSRM coordinate format: lon,lat;lon,lat...
        coord_str = ";".join([f"{lon:.6f},{lat:.6f}" for lon, lat in coordinates])
        url = f"{settings.OSRM_BASE_URL.rstrip('/')}/table/v1/driving/{coord_str}?annotations=distance,duration"

        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "SurplusFoodRedistributionPlatform/1.0"},
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    if data.get("code") == "Ok":
                        osrm_dist = data.get("distances", [])
                        osrm_dur = data.get("durations", [])

                        # Build final matrix: prune detours where OSRM exceeds 1.45x grid distance
                        final_dist = [[0.0] * n for _ in range(n)]
                        final_dur = [[0.0] * n for _ in range(n)]
                        for i in range(n):
                            for j in range(n):
                                if i == j:
                                    continue
                                d_val = osrm_dist[i][j] if (i < len(osrm_dist) and j < len(osrm_dist[i])) else None
                                dur_val = osrm_dur[i][j] if (i < len(osrm_dur) and j < len(osrm_dur[i])) else None
                                g_dist = grid_distances[i][j]

                                if d_val is not None and d_val > 0 and d_val <= 1.45 * g_dist:
                                    final_dist[i][j] = float(d_val)
                                    final_dur[i][j] = float(dur_val) if dur_val is not None else (d_val / 8.33)
                                else:
                                    # Use clean street grid distance without detours
                                    final_dist[i][j] = g_dist
                                    final_dur[i][j] = grid_durations[i][j]

                        return final_dist, final_dur
        except Exception as exc:
            logger.warning("OSRM table request notice: %s. Using street grid distance matrix.", exc)

        return grid_distances, grid_durations

    @staticmethod
    def calculate_tour_distance(tour: List[int], dist_matrix: List[List[float]]) -> float:
        """Calculate total round trip distance: tour[0] -> ... -> tour[-1] -> tour[0]."""
        total = 0.0
        n = len(tour)
        for i in range(n):
            u = tour[i]
            v = tour[(i + 1) % n]
            total += dist_matrix[u][v]
        return total

    @staticmethod
    def nearest_neighbor_tour(dist_matrix: List[List[float]]) -> List[int]:
        """
        Nearest neighbor heuristic starting at Hub (index 0).
        Returns tour list of node indices starting with 0.
        """
        n = len(dist_matrix)
        unvisited = set(range(1, n))
        current = 0
        tour = [0]

        while unvisited:
            next_node = min(unvisited, key=lambda node: dist_matrix[current][node])
            tour.append(next_node)
            unvisited.remove(next_node)
            current = next_node

        return tour

    @staticmethod
    def two_opt_optimize(initial_tour: List[int], dist_matrix: List[List[float]]) -> List[int]:
        """
        2-Opt local search improvement for Traveling Salesperson Problem.
        Hub (index 0) remains fixed at the start of the tour.
        """
        tour = list(initial_tour)
        n = len(tour)
        if n <= 3:
            return tour

        improved = True
        iteration = 0
        max_iterations = 100

        while improved and iteration < max_iterations:
            improved = False
            iteration += 1
            for i in range(1, n - 1):
                for k in range(i + 1, n):
                    u1 = tour[i - 1]
                    v1 = tour[i]
                    u2 = tour[k]
                    v2 = tour[(k + 1) % n]

                    current_cost = dist_matrix[u1][v1] + dist_matrix[u2][v2]
                    new_cost = dist_matrix[u1][u2] + dist_matrix[v1][v2]

                    if new_cost < current_cost - 1e-4:
                        tour[i : k + 1] = reversed(tour[i : k + 1])
                        improved = True
                        break
                if improved:
                    break

        return tour

    @classmethod
    def get_route_geometry(
        cls,
        ordered_coords: List[Tuple[float, float]],  # List of [lon, lat], starting and ending at Hub
    ) -> Tuple[Dict[str, Any], float, float]:
        """
        Calculates optimized road geometry connecting all stops in sequence.
        Routes leg-by-leg: uses OSRM road geometry if direct, and prunes artificial
        one-way detour loops by falling back to clean direct street-grid connections.
        """
        if len(ordered_coords) < 2:
            return {"type": "LineString", "coordinates": []}, 0.0, 0.0

        all_route_coords: List[List[float]] = []
        total_dist_m = 0.0
        total_dur_s = 0.0

        for i in range(len(ordered_coords) - 1):
            p1 = ordered_coords[i]
            p2 = ordered_coords[i + 1]

            g_dist = cls._compute_street_grid_distance(p1, p2)
            leg_coords = None
            leg_dist = g_dist
            leg_dur = g_dist / 8.33

            # Attempt OSRM for this specific leg
            url = f"{settings.OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{p1[0]:.6f},{p1[1]:.6f};{p2[0]:.6f},{p2[1]:.6f}?overview=full&geometries=geojson"
            try:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "SurplusFoodRedistributionPlatform/1.0"},
                )
                with urllib.request.urlopen(req, timeout=3.5) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        if data.get("code") == "Ok" and data.get("routes"):
                            best = data["routes"][0]
                            osrm_d = float(best.get("distance", 0.0))
                            # Only accept OSRM if it does not take a wild detour (> 1.45x direct street distance)
                            if osrm_d <= 1.45 * g_dist and osrm_d > 0:
                                geom_coords = best.get("geometry", {}).get("coordinates", [])
                                if geom_coords:
                                    leg_coords = geom_coords
                                    leg_dist = osrm_d
                                    leg_dur = float(best.get("duration", osrm_d / 8.33))
            except Exception as exc:
                logger.debug("Leg %d OSRM notice: %s", i, exc)

            # If OSRM took an unnecessary detour loop or failed, use direct street-grid connection
            if not leg_coords:
                leg_coords, leg_dist, leg_dur = cls._generate_direct_street_path(p1, p2)

            total_dist_m += leg_dist
            total_dur_s += leg_dur

            # Stitch leg into cumulative route coordinates
            if not all_route_coords:
                all_route_coords.extend(leg_coords)
            else:
                # Skip duplicate first point of the next leg
                all_route_coords.extend(leg_coords[1:] if len(leg_coords) > 1 else leg_coords)

        geometry = {
            "type": "LineString",
            "coordinates": all_route_coords,
        }

        return geometry, round(total_dist_m, 1), round(total_dur_s, 1)
