import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// @ts-ignore
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Configure Web Worker URL for MapLibre GL JS in Vite
maplibregl.setWorkerUrl(maplibreWorkerUrl);
import {
  Truck,
  Users,
  Building2,
  Play,
  Pause,
  Zap,
  TrendingDown,
  Navigation,
  MapPin,
  Utensils,
  ThermometerSnowflake,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { trip1Api } from '../../api/trip1';
import {
  HubSummary,
  IncomingDonation,
  PickupRun,
} from '../../types/trip1';

// Reliable OpenStreetMap public street raster tiles (no API key, no watermark)
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export const IncomingCollectionsPage: React.FC = () => {
  const navigate = useNavigate();

  // Data States
  const [summary, setSummary] = useState<HubSummary | null>(null);
  const [donations, setDonations] = useState<IncomingDonation[]>([]);
  const [activeRun, setActiveRun] = useState<PickupRun | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planningStage, setPlanningStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Simulation Controls (Default 2x for smooth, clear presentation)
  const [simSpeed, setSimSpeed] = useState<number>(2);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [simProgressText, setSimProgressText] = useState<string>('Ready for dispatch');

  // Simulation execution tracking refs
  const simFloatIndexRef = useRef<number>(0);
  const isSimulatingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const simSpeedRef = useRef<number>(2);
  const lastTimeRef = useRef<number>(0);
  const hasAutoStartedRef = useRef<string | null>(null);
  const hasAutoPlannedRef = useRef<boolean>(false);

  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  // MapLibre references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Handle Plan Pickup (Threshold auto trigger or Manual Override)
  const handlePlanPickup = async (force: boolean) => {
    setError(null);
    setIsPlanning(true);
    setPlanningStage('Checking eligible pending donations...');

    try {
      await new Promise((r) => setTimeout(r, 300));
      setPlanningStage('Calculating total people served & demand aggregation...');

      await new Promise((r) => setTimeout(r, 350));
      setPlanningStage('Selecting smallest available vehicle from Hub inventory...');

      await new Promise((r) => setTimeout(r, 350));
      setPlanningStage('Fetching OSRM distance matrix & running 2-Opt road optimization...');

      const run = await trip1Api.planPickupTrip(force);

      setPlanningStage('Generating road geometry & dispatching simulation...');
      await new Promise((r) => setTimeout(r, 300));

      setActiveRun(run);
      hasAutoPlannedRef.current = false;
      loadHubData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail =
        errorObj.response?.data?.detail || errorObj.message || 'Failed to initiate pickup planning.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setIsPlanning(false);
      setPlanningStage(null);
    }
  };

  // Load hub summary & donations list
  const loadHubData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumData, donList, runData] = await Promise.all([
        trip1Api.getHubSummary(),
        trip1Api.getHubDonations(),
        trip1Api.getActivePickupTrip(),
      ]);
      setSummary(sumData);
      setDonations(donList);
      if (runData.has_active_run && runData.run) {
        setActiveRun(runData.run);
      } else {
        setActiveRun(null);
        hasAutoStartedRef.current = null;
        // Automatic Dispatch Trigger: If total people served > 20 and no active run
        if (sumData.total_people_served > 20 && !isPlanning && !hasAutoPlannedRef.current) {
          hasAutoPlannedRef.current = true;
          handlePlanPickup(false);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load hub data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load and periodic polling every 3.5s (when not actively simulating)
  useEffect(() => {
    loadHubData();
    const interval = setInterval(() => {
      if (!isSimulatingRef.current && !isPlanning) {
        loadHubData();
      }
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Initialize MapLibre GL Map whenever activeRun has route_geometry
  useEffect(() => {
    if (!mapContainerRef.current || !activeRun?.route_geometry?.coordinates) return;

    const coords = activeRun.route_geometry.coordinates;
    if (coords.length === 0) return;

    // Center on hub or first coordinate
    const initialCenter = coords[0] as [number, number];

    // Cleanly remove any existing map instance before creating a fresh one
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: initialCenter,
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('error', (err) => {
      console.warn('MapLibre runtime notification:', err);
    });

    map.on('load', () => {
      // Force correct canvas sizing to container dimensions
      map.resize();
      setTimeout(() => {
        try {
          map.resize();
        } catch {
          // ignore
        }
      }, 250);

      // Add Route Line Source & Layer
      map.addSource('route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: activeRun.route_geometry as GeoJSON.Geometry,
          properties: {},
        },
      });

      map.addLayer({
        id: 'route-line-layer',
        type: 'line',
        source: 'route-line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#0284c7', // Sky-blue primary route
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });

      // Add Hub Marker (index 0)
      const hubEl = document.createElement('div');
      hubEl.className =
        'w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg border-2 border-white text-xs cursor-pointer';
      hubEl.innerHTML = 'HUB';
      new maplibregl.Marker({ element: hubEl })
        .setLngLat(initialCenter)
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
            `<strong>Central Collection Hub</strong><br/><span style="font-size:11px;">Origin & Staging Depot</span>`
          )
        )
        .addTo(map);

      // Add Restaurant Stop Markers
      activeRun.ordered_stops.forEach((stop) => {
        const stopEl = document.createElement('div');
        stopEl.className = `w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md border-2 border-white text-xs cursor-pointer ${
          stop.status === 'PICKED_UP'
            ? 'bg-purple-600 text-white'
            : 'bg-emerald-600 text-white'
        }`;
        stopEl.innerHTML = `#${stop.stop_index}`;

        new maplibregl.Marker({ element: stopEl })
          .setLngLat(stop.coordinates)
          .setPopup(
            new maplibregl.Popup({ offset: 15 }).setHTML(
              `<strong>Stop ${stop.stop_index}: ${stop.provider_name}</strong><br/>` +
                `<span style="font-size:11px;">${stop.address}</span><br/>` +
                `<span style="font-size:11px;color:#059669;">Serves: ${stop.people_served} people</span>`
            )
          )
          .addTo(map);
      });

      // Add Vehicle Marker (without transform keyframes on container to preserve MapLibre translate)
      const vehicleEl = document.createElement('div');
      vehicleEl.className =
        'w-10 h-10 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center shadow-2xl border-2 border-white text-sm font-bold cursor-pointer';
      vehicleEl.innerHTML = '<span class="inline-block animate-bounce text-base">🚚</span>';

      const vehicleMarker = new maplibregl.Marker({ element: vehicleEl })
        .setLngLat(initialCenter)
        .addTo(map);

      vehicleMarkerRef.current = vehicleMarker;

      // Fit map bounds to encompass all route coordinates
      const bounds = coords.reduce(
        (acc, coord) => acc.extend(coord as [number, number]),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 50, maxZoom: 16 });
    });

    mapRef.current = map;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeRun?.id]);

  // Run the Vehicle Movement Simulation along OSRM Road Geometry
  const runSimulation = async () => {
    if (!activeRun?.route_geometry?.coordinates || !mapRef.current || !vehicleMarkerRef.current)
      return;

    const coords = activeRun.route_geometry.coordinates;
    const totalPoints = coords.length;
    if (totalPoints < 2) return;

    if (simFloatIndexRef.current >= totalPoints - 1) {
      simFloatIndexRef.current = 0;
    }

    isSimulatingRef.current = true;
    isPausedRef.current = false;
    lastTimeRef.current = performance.now();
    setIsSimulating(true);
    setIsPaused(false);

    try {
      await trip1Api.startSimulation(activeRun.id);
    } catch (e) {
      console.warn('Simulation start sync warning:', e);
    }

    setSimProgressText('Vehicle dispatched from Central Hub along optimized route...');

    const stops = activeRun.ordered_stops;
    const stopsVisited = new Set<number>(
      stops.filter((s) => s.status === 'PICKED_UP').map((s) => s.stop_index)
    );

    // Precalculate closest waypoint index for each stop along the route
    const stopWaypoints = stops.map((stop) => {
      let closestIdx = 0;
      let minDistance = Infinity;
      coords.forEach((c, idx) => {
        const d = Math.hypot(c[0] - stop.coordinates[0], c[1] - stop.coordinates[1]);
        if (d < minDistance) {
          minDistance = d;
          closestIdx = idx;
        }
      });
      return { stop, waypointIdx: closestIdx };
    });

    const step = async () => {
      if (!isSimulatingRef.current || isPausedRef.current) return;

      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1); // in seconds, cap to 100ms
      lastTimeRef.current = now;

      // Base speed: 8.5 coordinates per second at 1x for smooth, visible presentation
      const pointsPerSecond = 8.5 * simSpeedRef.current;
      simFloatIndexRef.current += pointsPerSecond * dt;

      if (simFloatIndexRef.current >= totalPoints - 1) {
        simFloatIndexRef.current = totalPoints - 1;
      }

      const floatIdx = simFloatIndexRef.current;
      const baseIdx = Math.floor(floatIdx);
      const nextIdx = Math.min(baseIdx + 1, totalPoints - 1);
      const fraction = floatIdx - baseIdx;

      // Smoothly interpolate position between coordinates
      const p1 = coords[baseIdx] as [number, number];
      const p2 = coords[nextIdx] as [number, number];
      const currentPoint: [number, number] = [
        p1[0] + (p2[0] - p1[0]) * fraction,
        p1[1] + (p2[1] - p1[1]) * fraction,
      ];

      vehicleMarkerRef.current?.setLngLat(currentPoint);

      // Check if arriving at any unvisited stop
      for (const item of stopWaypoints) {
        const { stop, waypointIdx } = item;
        if (!stopsVisited.has(stop.stop_index)) {
          // Trigger when reached waypoint index
          if (baseIdx >= waypointIdx && floatIdx < totalPoints - 1) {
            stopsVisited.add(stop.stop_index);
            vehicleMarkerRef.current?.setLngLat(stop.coordinates);

            setSimProgressText(
              `Vehicle arrived at Stop #${stop.stop_index}: ${stop.provider_name}. Collecting ${stop.people_served} meals...`
            );

            // Update badge locally in activeRun
            setActiveRun((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                ordered_stops: prev.ordered_stops.map((s) =>
                  s.stop_index === stop.stop_index ? { ...s, status: 'PICKED_UP' } : s
                ),
              };
            });

            // Sync with backend API
            trip1Api.completeStop(activeRun.id, stop.stop_index).catch((err) => {
              console.warn(`Stop ${stop.stop_index} complete warning:`, err);
            });

            // Calm pause at restaurant stop to simulate collection (1.5s at 1x)
            const dwellDelay = Math.max(500, Math.round(1500 / simSpeedRef.current));
            await new Promise((resolve) => setTimeout(resolve, dwellDelay));

            // Reset time baseline after dwell pause
            lastTimeRef.current = performance.now();

            if (!isSimulatingRef.current || isPausedRef.current) return;

            const remaining = stopWaypoints.filter((s) => !stopsVisited.has(s.stop.stop_index));
            if (remaining.length > 0) {
              setSimProgressText(
                `En route to Stop #${remaining[0].stop.stop_index}: ${remaining[0].stop.provider_name}...`
              );
            } else {
              setSimProgressText('All donations collected! Vehicle returning to Central Collection Hub...');
            }
            break;
          }
        }
      }

      if (simFloatIndexRef.current < totalPoints - 1) {
        if (stopsVisited.size === stops.length) {
          setSimProgressText('All donations collected! Vehicle returning to Central Collection Hub...');
        }
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        // Vehicle safely arrived back at Central Hub!
        const hubCoords = coords[totalPoints - 1] as [number, number];
        vehicleMarkerRef.current?.setLngLat(hubCoords);
        setSimProgressText('Vehicle safely returned to Central Hub! All surplus meals arrived. Transferring to Inventory Staging...');

        isSimulatingRef.current = false;
        isPausedRef.current = false;
        setIsSimulating(false);
        setIsPaused(false);
        simFloatIndexRef.current = 0;

        try {
          await trip1Api.completeTrip(activeRun.id);
          // Auto-continue to Inventory Staging Page
          setTimeout(() => {
            navigate('/hub/inventory-staging');
          }, 1800);
        } catch (err) {
          console.error('Complete trip error:', err);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  // Automatically trigger simulation when activeRun is NOT_STARTED
  useEffect(() => {
    if (
      activeRun &&
      activeRun.route_geometry?.coordinates &&
      activeRun.route_geometry.coordinates.length > 0 &&
      activeRun.simulation_status === 'NOT_STARTED' &&
      !isSimulating &&
      !isPaused &&
      hasAutoStartedRef.current !== activeRun.id
    ) {
      let cancelled = false;
      const attemptStart = () => {
        if (cancelled) return;
        if (vehicleMarkerRef.current && mapRef.current) {
          hasAutoStartedRef.current = activeRun.id;
          runSimulation();
        } else {
          setTimeout(attemptStart, 300);
        }
      };
      const timer = setTimeout(attemptStart, 800);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [activeRun?.id, activeRun?.simulation_status]);

  const handlePauseSimulation = async () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    isPausedRef.current = true;
    isSimulatingRef.current = false;
    setIsPaused(true);
    setIsSimulating(false);
    if (activeRun) {
      try {
        await trip1Api.pauseSimulation(activeRun.id);
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const handleResumeSimulation = async () => {
    if (activeRun) {
      try {
        await trip1Api.resumeSimulation(activeRun.id);
        runSimulation();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Operational Counts & Force Action */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-7 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/30 text-blue-200 text-xs font-semibold">
              <Truck className="w-3.5 h-3.5" />
              <span>Trip Type 1: Inbound Central Collection Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Incoming Collections Command
            </h1>
            <p className="text-xs sm:text-sm text-blue-200 max-w-xl">
              Consolidated real-time aggregation of provider donations. Automatic dispatch
              triggers at <strong>&gt; 20 people</strong>, with manual override option.
            </p>
          </div>

          {/* Action Trigger Button */}
          <div className="shrink-0 flex flex-col items-start lg:items-end gap-2">
            <Button
              variant="primary"
              size="lg"
              isLoading={isPlanning}
              onClick={() => handlePlanPickup(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-3 shadow-lg uppercase tracking-wider text-xs sm:text-sm"
            >
              <Zap className="w-4 h-4 mr-2 text-slate-950" />
              FORCEFULLY START PICKUPS
            </Button>
            <span className="text-[11px] text-slate-300">
              Manual override: plan routes even when total &le; 20
            </span>
          </div>
        </div>

        {/* Aggregate Counters */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
            <span className="text-[11px] text-blue-200 uppercase font-semibold block tracking-wider">
              TOTAL PEOPLE THAT CAN BE SERVED
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400">
                {summary?.total_people_served ?? 0}
              </span>
              <span className="text-xs text-blue-200">Portions</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
            <span className="text-[11px] text-blue-200 uppercase font-semibold block tracking-wider">
              Pending Surplus Batches
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">
                {summary?.pending_donations_count ?? 0}
              </span>
              <span className="text-xs text-blue-200">Batches</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
            <span className="text-[11px] text-blue-200 uppercase font-semibold block tracking-wider">
              Eligible Restaurants
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">
                {summary?.eligible_restaurants_count ?? 0}
              </span>
              <span className="text-xs text-blue-200">Providers</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
            <span className="text-[11px] text-blue-200 uppercase font-semibold block tracking-wider">
              Auto Dispatch Threshold
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              {summary && summary.total_people_served > 20 ? (
                <Badge variant="emerald">THRESHOLD MET (&gt;20)</Badge>
              ) : (
                <Badge variant="amber">BELOW THRESHOLD (&le;20)</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} className="mb-2" />}

      {/* Planning Loading Overlay / Status */}
      {isPlanning && (
        <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-200 animate-pulse text-indigo-900 flex items-center gap-4">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 shrink-0" />
          <div>
            <h4 className="text-sm font-bold">Optimization Engine Active</h4>
            <p className="text-xs text-indigo-700 mt-0.5">{planningStage}</p>
          </div>
        </div>
      )}

      {/* Active Run Map & Simulation Dashboard Section */}
      {activeRun && (
        <div className="space-y-4">
          <Card
            title="Interactive Route Optimization & Vehicle Simulation"
            subtitle="MapLibre Street Map & Real OSRM Road Geometry (HackFest Demonstration)"
            action={
              <div className="flex items-center gap-2">
                <Badge variant="blue">Run ID: {activeRun.id.slice(-6)}</Badge>
                <button
                  onClick={loadHubData}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            }
          >
            {/* Efficiency Metrics Card */}
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Fleet</span>
                <span className="font-bold text-slate-800 text-sm">
                  {activeRun.assigned_vehicle.type} ({activeRun.assigned_vehicle.capacity} pax)
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Stops Count</span>
                <span className="font-bold text-slate-800 text-sm">
                  {activeRun.ordered_stops.length} Stops
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Baseline Dist</span>
                <span className="font-semibold text-slate-600">
                  {(activeRun.baseline_distance_meters / 1000).toFixed(2)} km
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">2-Opt Optimized</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {(activeRun.optimized_distance_meters / 1000).toFixed(2)} km
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Distance Saved</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {(activeRun.distance_saved_meters / 1000).toFixed(2)} km
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Optimization Gain</span>
                <span className="font-black text-emerald-600 text-sm">
                  {activeRun.percentage_saved.toFixed(1)}% Saved
                </span>
              </div>
            </div>

            {/* Simulation Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 rounded-xl text-white mb-4">
              <div className="flex items-center gap-2">
                {!isSimulating ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={isPaused ? handleResumeSimulation : runSimulation}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    {isPaused ? 'RESUME SIMULATION' : 'START SIMULATION'}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePauseSimulation}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold"
                  >
                    <Pause className="w-3.5 h-3.5 mr-1" />
                    PAUSE
                  </Button>
                )}

                <div className="flex items-center gap-1 ml-3 text-xs">
                  <span className="text-slate-400">Speed:</span>
                  {[1, 2, 3, 5].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setSimSpeed(speed)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        simSpeed === speed
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Text */}
              <div className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>{simProgressText}</span>
              </div>
            </div>

            {/* MapLibre Map Container */}
            <div
              ref={mapContainerRef}
              className="w-full h-[420px] rounded-xl border border-slate-300 relative shadow-inner overflow-hidden"
            />

            {/* Ordered Stops Progress Bar */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                Multi-Stop Sequence (Round Trip: Hub &rarr; Restaurants &rarr; Hub)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {activeRun.ordered_stops.map((stop) => (
                  <div
                    key={stop.stop_index}
                    className={`p-2.5 rounded-lg border text-xs ${
                      stop.status === 'PICKED_UP'
                        ? 'bg-purple-50 border-purple-200 text-purple-900'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Stop #{stop.stop_index}</span>
                      <Badge variant={stop.status === 'PICKED_UP' ? 'purple' : 'slate'}>
                        {stop.status}
                      </Badge>
                    </div>
                    <p className="mt-1 font-semibold truncate">{stop.provider_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{stop.address}</p>
                    <p className="mt-1 text-[11px] text-emerald-600 font-semibold">
                      {stop.people_served} people served
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Eligible Incoming Donations Grid */}
      <Card
        title="Incoming Surplus Donation Batches"
        subtitle={`Live Database Records (${donations.length} total)`}
        action={
          <button
            onClick={loadHubData}
            disabled={isLoading}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh List
          </button>
        }
      >
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading incoming collections...</div>
        ) : donations.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <Utensils className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p>No incoming donations currently assigned to this Hub.</p>
            <p className="mt-1">Providers will submit surplus batches from their portal.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {donations.map((d) => (
              <div
                key={d.id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {d.food_name}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {d.food_category} &bull; {d.dietary_type}
                      </span>
                    </div>
                    <Badge
                      variant={
                        d.status === 'READY_FOR_PICKUP'
                          ? 'emerald'
                          : d.status === 'RESERVED_FOR_PICKUP'
                          ? 'blue'
                          : d.status === 'PICKED_UP'
                          ? 'purple'
                          : 'slate'
                      }
                    >
                      {d.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>{d.provider_name || 'Partner Kitchen'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{d.provider_address || 'Address registered'}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Users className="w-3.5 h-3.5 text-amber-600" />
                      <span><strong>{d.people_served}</strong> Portions</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <ThermometerSnowflake className="w-3.5 h-3.5 text-blue-500" />
                      <span className="truncate">{d.storage_requirements}</span>
                    </div>
                  </div>

                  {d.pickup_notes && (
                    <p className="mt-2 text-[11px] text-slate-600 bg-amber-50/60 p-2 rounded border border-amber-100">
                      <strong>Notes:</strong> {d.pickup_notes}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    Prep: {new Date(d.preparation_date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>
                    Declared: {new Date(d.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
