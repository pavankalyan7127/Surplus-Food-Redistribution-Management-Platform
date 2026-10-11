import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// @ts-ignore
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

import {
  Truck,
  Navigation,
  Play,
  Pause,
  Zap,
  CheckCircle2,
  RefreshCw,
  History,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { trip2Api } from '../../api/trip2';
import { NgoOrderResponse } from '../../types/trip2';
import { getErrorMessage } from '../../api/client';

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

export const DispatchTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const [order, setOrder] = useState<NgoOrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);

  // Simulation states
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [simProgressPercent, setSimProgressPercent] = useState<number>(0);
  const [isDelivered, setIsDelivered] = useState<boolean>(false);

  // MapLibre references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Animation refs
  const animFrameRef = useRef<number | null>(null);
  const simFloatIndexRef = useRef<number>(0);
  const isSimulatingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const simSpeedRef = useRef<number>(1);
  const lastTimeRef = useRef<number>(0);

  const fetchActiveOrder = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await trip2Api.getActiveNgoOrder();
      if (!data || data.status === 'DELIVERED') {
        setOrder(null);
        setIsDelivered(false);
        setSimProgressPercent(0);
      } else {
        setOrder(data);
        setIsDelivered(false);
        setSimProgressPercent(0);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveOrder();
  }, []);

  // Initialize MapLibre GL Map whenever order has route_geometry
  useEffect(() => {
    if (!mapContainerRef.current || !order?.route_geometry?.coordinates) return;

    const coords = order.route_geometry.coordinates;
    if (coords.length === 0) return;

    const initialCenter = coords[0] as [number, number];

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
      console.warn('MapLibre notification:', err);
    });

    map.on('load', () => {
      map.resize();

      // Add Route Line Layer
      map.addSource('route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: order.route_geometry as GeoJSON.Geometry,
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
          'line-color': '#8b5cf6', // Purple dispatch corridor
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });

      // 1. Hub Marker (Origin)
      const hubEl = document.createElement('div');
      hubEl.className =
        'w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg border-2 border-white text-xs cursor-pointer';
      hubEl.innerHTML = 'HUB';
      new maplibregl.Marker({ element: hubEl })
        .setLngLat(order.hub_coordinates)
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
            `<strong>${order.hub_name}</strong><br/><span style="font-size:11px;">${order.hub_address}</span>`
          )
        )
        .addTo(map);

      // 2. NGO Marker (Destination)
      const ngoEl = document.createElement('div');
      ngoEl.className =
        'w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-lg border-2 border-white text-xs cursor-pointer';
      ngoEl.innerHTML = 'NGO';
      new maplibregl.Marker({ element: ngoEl })
        .setLngLat(order.ngo_coordinates)
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
            `<strong>${order.ngo_name}</strong><br/><span style="font-size:11px;">${order.ngo_address}</span>`
          )
        )
        .addTo(map);

      // 3. Vehicle Marker
      const vehicleEl = document.createElement('div');
      vehicleEl.className =
        'w-10 h-10 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center shadow-2xl border-2 border-white text-sm font-bold cursor-pointer';
      vehicleEl.innerHTML = '<span class="inline-block text-base">🚚</span>';

      const startCoord = isDelivered ? (coords[coords.length - 1] as [number, number]) : (coords[0] as [number, number]);
      const vehicleMarker = new maplibregl.Marker({ element: vehicleEl })
        .setLngLat(startCoord)
        .addTo(map);

      vehicleMarkerRef.current = vehicleMarker;

      // Fit map bounds to route
      const bounds = coords.reduce(
        (acc, coord) => acc.extend(coord as [number, number]),
        new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    });

    mapRef.current = map;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [order?.id]);

  // Handle Simulation Run
  const runSimulation = async () => {
    if (!order?.route_geometry?.coordinates || !mapRef.current || !vehicleMarkerRef.current)
      return;

    const coords = order.route_geometry.coordinates;
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
    setIsDelivered(false);

    try {
      await trip2Api.startNgoSimulation(order.id);
    } catch (e) {
      console.warn('Simulation start sync:', e);
    }

    const step = async () => {
      if (!isSimulatingRef.current || isPausedRef.current) return;

      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      // Base speed: 9 points per sec at 1x
      const pointsPerSecond = 9 * simSpeedRef.current;
      simFloatIndexRef.current += pointsPerSecond * dt;

      if (simFloatIndexRef.current >= totalPoints - 1) {
        simFloatIndexRef.current = totalPoints - 1;
      }

      const floatIdx = simFloatIndexRef.current;
      const baseIdx = Math.floor(floatIdx);
      const nextIdx = Math.min(baseIdx + 1, totalPoints - 1);
      const fraction = floatIdx - baseIdx;

      const p1 = coords[baseIdx] as [number, number];
      const p2 = coords[nextIdx] as [number, number];
      const currentPoint: [number, number] = [
        p1[0] + (p2[0] - p1[0]) * fraction,
        p1[1] + (p2[1] - p1[1]) * fraction,
      ];

      vehicleMarkerRef.current?.setLngLat(currentPoint);

      const percent = Math.min(100, Math.round((floatIdx / (totalPoints - 1)) * 100));
      setSimProgressPercent(percent);

      if (floatIdx >= totalPoints - 1) {
        // FINISHED! Complete delivery, archive to history, and remove from active dispatch tracking page
        isSimulatingRef.current = false;
        setIsSimulating(false);
        setIsDelivered(true);

        const currentFinishedOrder = order;

        try {
          await trip2Api.completeNgoOrder(currentFinishedOrder.id);
          setCompletionNotice(
            `Delivery completed! ${currentFinishedOrder.total_people_served} portions safely received from ${currentFinishedOrder.hub_name}. Archived to Order History.`
          );

          // Once simulation is done and vehicle arrives, remove it from this tracking page after 2 seconds
          setTimeout(() => {
            setOrder(null);
            setIsDelivered(false);
            setSimProgressPercent(0);
          }, 2000);
        } catch (e) {
          console.error('Failed to complete order:', e);
        }
        return;
      }

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  const handlePause = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const handleResume = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    lastTimeRef.current = performance.now();
    runSimulation();
  };

  const handleToggleSpeed = () => {
    const next = simSpeed === 1 ? 2 : simSpeed === 2 ? 4 : 1;
    setSimSpeed(next);
    simSpeedRef.current = next;
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-2" />
        <p className="text-sm">Fetching active dispatch order & road geometry...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dispatch Tracking</h1>
            <p className="text-sm text-slate-500 mt-1">
              Real-time multi-stop vehicle navigation from Central Hub to your NGO.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/ngo/history')}>
            <History className="w-3.5 h-3.5 mr-1.5" />
            Order History
          </Button>
        </div>

        {completionNotice && (
          <Alert type="success" title="Delivery Received & Completed" message={completionNotice} />
        )}

        <Card>
          <div className="py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">No Active Food Dispatch in Transit</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                You do not have a food delivery currently in transit. Active dispatches appear here as soon as an order is placed from a Central Hub.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Button variant="primary" onClick={() => navigate('/ngo/food-requests')}>
                Request Food from Nearest Hubs
              </Button>
              <Button variant="outline" onClick={() => navigate('/ngo/history')}>
                View Order History &rarr;
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              Order {order.order_number}
            </h1>
            <Badge variant={isDelivered ? 'emerald' : 'purple'}>
              {isDelivered ? 'Delivered' : order.status}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Origin: <strong>{order.hub_name}</strong> &rarr; Destination: <strong>{order.ngo_name}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchActiveOrder}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/ngo/history')}>
            <History className="w-3.5 h-3.5 mr-1.5" />
            Order History
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/ngo/food-requests')}>
            Request More Food
          </Button>
        </div>
      </div>

      {error && (
        <Alert type="error" title="Notice" message={error} />
      )}

      {/* Completed Banner if delivered - Map stays open below! */}
      {isDelivered && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-900">
                Delivery Completed & Verified!
              </h3>
              <p className="text-xs text-emerald-700">
                {order.total_people_served} portions safely received at your NGO facility. Packages removed from inventory and archived.
              </p>
            </div>
          </div>
          <Badge variant="emerald">COMPLETED</Badge>
        </div>
      )}

      {/* Key Order Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Portions Received</span>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {order.total_people_served} people
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Assigned Vehicle</span>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {order.assigned_vehicle?.type || 'Standard Van'}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Estimated Distance</span>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {order.total_distance_meters ? `${(order.total_distance_meters / 1000).toFixed(1)} km` : '6.4 km'}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Transit Time</span>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {order.total_duration_seconds ? `${Math.round(order.total_duration_seconds / 60)} min` : '14 min'}
          </p>
        </div>
      </div>

      {/* MapLibre Simulation View */}
      <Card
        title="Live Hub-to-NGO Road Transit Simulation"
        subtitle="MapLibre Street Map & Real OSRM Road Geometry (Map remains visible upon completion)"
      >
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              {!isSimulating ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={runSimulation}
                  disabled={isDelivered && simProgressPercent === 100}
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  {simProgressPercent === 100 ? 'Replay Simulation' : 'Start Simulation'}
                </Button>
              ) : isPaused ? (
                <Button variant="primary" size="sm" onClick={handleResume}>
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Resume
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handlePause}>
                  <Pause className="w-3.5 h-3.5 mr-1" />
                  Pause
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={handleToggleSpeed}>
                <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
                {simSpeed}x Speed
              </Button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="font-semibold">Transit Progress: {simProgressPercent}%</span>
              <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-full transition-all duration-150"
                  style={{ width: `${simProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Map Container */}
          <div className="relative w-full h-[450px] rounded-xl overflow-hidden border border-slate-200 shadow-inner">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Map Overlay Badge */}
            <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-purple-600" />
              Direct Route: Hub &rarr; NGO
            </div>
          </div>
        </div>
      </Card>

      {/* Package Breakdown */}
      <Card title="Dispatched Food Package Rations" subtitle="Verified Indivisible Food Batches in this Consignment">
        <div className="divide-y divide-slate-100">
          {order.packages.map((pkg, idx) => (
            <div key={pkg.id || idx} className="py-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
                  #{idx + 1}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{pkg.food_name}</p>
                  <p className="text-xs text-slate-500">{pkg.provider_name || 'Restaurant Donor'}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-emerald-700">{pkg.people_served} people</span>
                {pkg.predicted_remaining_hours !== undefined && (
                  <span className="text-xs text-slate-500 block">
                    {pkg.predicted_remaining_hours.toFixed(1)} hrs shelf-life
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
