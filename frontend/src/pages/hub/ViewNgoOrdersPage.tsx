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

export const ViewNgoOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<NgoOrderResponse[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<NgoOrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Simulation states
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [simProgressPercent, setSimProgressPercent] = useState<number>(0);
  const [isDelivered, setIsDelivered] = useState<boolean>(false);
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);

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

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await trip2Api.getHubOrders();
      // Only incoming / active orders awaiting or in transit
      const incomingOrders = data.filter((o) => o.status !== 'DELIVERED');
      setOrders(incomingOrders);
      if (incomingOrders.length > 0) {
        setSelectedOrder(incomingOrders[0]);
        setIsDelivered(false);
        setSimProgressPercent(0);
      } else {
        setSelectedOrder(null);
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
    fetchOrders();
  }, []);

  const selectOrder = (order: NgoOrderResponse) => {
    setSelectedOrder(order);
    simFloatIndexRef.current = 0;
    setSimProgressPercent(order.status === 'DELIVERED' ? 100 : 0);
    setIsDelivered(order.status === 'DELIVERED');
    setIsSimulating(false);
    setIsPaused(false);
  };

  // Initialize MapLibre GL Map whenever selectedOrder has route_geometry
  useEffect(() => {
    if (!mapContainerRef.current || !selectedOrder?.route_geometry?.coordinates) return;

    const coords = selectedOrder.route_geometry.coordinates;
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
      console.warn('MapLibre error notification:', err);
    });

    map.on('load', () => {
      map.resize();

      // Add Route Line Layer
      map.addSource('route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: selectedOrder.route_geometry as GeoJSON.Geometry,
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
          'line-color': '#2563eb', // Blue Hub Corridor
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
        .setLngLat(selectedOrder.hub_coordinates)
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
            `<strong>${selectedOrder.hub_name}</strong><br/><span style="font-size:11px;">Origin Hub Depot</span>`
          )
        )
        .addTo(map);

      // 2. NGO Marker (Destination)
      const ngoEl = document.createElement('div');
      ngoEl.className =
        'w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-lg border-2 border-white text-xs cursor-pointer';
      ngoEl.innerHTML = 'NGO';
      new maplibregl.Marker({ element: ngoEl })
        .setLngLat(selectedOrder.ngo_coordinates)
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
            `<strong>${selectedOrder.ngo_name}</strong><br/><span style="font-size:11px;">${selectedOrder.ngo_address}</span>`
          )
        )
        .addTo(map);

      // 3. Vehicle Marker
      const vehicleEl = document.createElement('div');
      vehicleEl.className =
        'w-10 h-10 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center shadow-2xl border-2 border-white text-sm font-bold cursor-pointer';
      vehicleEl.innerHTML = '<span class="inline-block text-base">🚚</span>';

      const isOrderDelivered = selectedOrder.status === 'DELIVERED';
      const startCoord = isOrderDelivered ? (coords[coords.length - 1] as [number, number]) : (coords[0] as [number, number]);
      const vehicleMarker = new maplibregl.Marker({ element: vehicleEl })
        .setLngLat(startCoord)
        .addTo(map);

      vehicleMarkerRef.current = vehicleMarker;

      // Fit map bounds
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
  }, [selectedOrder?.id]);

  // Handle Simulation
  const runSimulation = async () => {
    if (!selectedOrder?.route_geometry?.coordinates || !mapRef.current || !vehicleMarkerRef.current)
      return;

    const coords = selectedOrder.route_geometry.coordinates;
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
      await trip2Api.startHubDelivery(selectedOrder.id);
    } catch (e) {
      console.warn('Simulation start sync:', e);
    }

    const step = async () => {
      if (!isSimulatingRef.current || isPausedRef.current) return;

      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

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
        // FINISHED! Complete delivery, archive, and remove from active page
        isSimulatingRef.current = false;
        setIsSimulating(false);
        setIsDelivered(true);

        const currentFinishedOrder = selectedOrder;

        try {
          await trip2Api.completeHubDelivery(currentFinishedOrder.id);
          setCompletionNotice(
            `Delivery to ${currentFinishedOrder.ngo_name} completed! Archived to Delivery History and removed from incoming queue.`
          );

          // Remove the order from this page after 2 seconds so the vehicle arriving at the NGO is briefly seen
          setTimeout(() => {
            setOrders((prev) => {
              const remaining = prev.filter((o) => o.id !== currentFinishedOrder.id);
              if (remaining.length > 0) {
                selectOrder(remaining[0]);
              } else {
                setSelectedOrder(null);
              }
              return remaining;
            });
            setIsDelivered(false);
            setSimProgressPercent(0);
            setTimeout(() => setCompletionNotice(null), 4000);
          }, 2000);
        } catch (e) {
          console.error('Failed to complete delivery on hub side:', e);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">NGO Orders & Dispatch</h1>
            <Badge variant="blue">Trip Type 2</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage NGO food requests, review allocated packages, and monitor real-time vehicle dispatch to NGO relief facilities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrders} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh Orders
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/hub/history')}>
            <History className="w-3.5 h-3.5 mr-1.5" />
            Delivery History
          </Button>
        </div>
      </div>

      {error && (
        <Alert type="error" title="Notice" message={error} />
      )}

      {completionNotice && (
        <Alert type="success" title="Delivery Completed & Archived" message={completionNotice} />
      )}

      {/* Main Grid: Orders List & Map Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: NGO Orders Queue */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Incoming NGO Orders" subtitle={`${orders.length} order(s) awaiting dispatch`}>
            {isLoading ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                Loading orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm space-y-2">
                <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500 mb-1" />
                <p className="font-bold text-slate-800">No Pending NGO Orders</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  All incoming NGO orders have been dispatched and moved to Delivery History.
                </p>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/hub/history')}>
                    View Delivery History &rarr;
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
                {orders.map((ord) => {
                  const isSelected = selectedOrder?.id === ord.id;
                  return (
                    <div
                      key={ord.id}
                      onClick={() => selectOrder(ord)}
                      className={`p-3.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-200 shadow-sm'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">
                          {ord.order_number}
                        </span>
                        <Badge
                          variant={
                            ord.status === 'DELIVERED'
                              ? 'emerald'
                              : ord.status === 'IN_TRANSIT'
                              ? 'purple'
                              : 'blue'
                          }
                        >
                          {ord.status}
                        </Badge>
                      </div>

                      <p className="text-sm font-semibold text-slate-800 mt-1 truncate">
                        {ord.ngo_name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{ord.ngo_address}</p>

                      <div className="flex items-center justify-between text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100">
                        <span>{ord.total_people_served} portions</span>
                        <span className="font-medium text-slate-700">
                          {ord.assigned_vehicle?.type || 'Auto / Van'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Live Route Simulator */}
        <div className="lg:col-span-2 space-y-4">
          {selectedOrder ? (
            <>
              {/* Delivery Complete Banner */}
              {isDelivered && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">
                        Delivery Completed to {selectedOrder.ngo_name}!
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Packages removed from inventory and permanently archived in History. Map view retained.
                      </p>
                    </div>
                  </div>
                  <Badge variant="emerald">ARCHIVED</Badge>
                </div>
              )}

              {/* Map & Controls Card */}
              <Card
                title={`Live Dispatch Transit: ${selectedOrder.order_number}`}
                subtitle={`From Hub Depot to ${selectedOrder.ngo_name} (${selectedOrder.total_people_served} Portions)`}
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
                          className="bg-blue-600 h-full transition-all duration-150"
                          style={{ width: `${simProgressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Persistent Map Container */}
                  <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                    <div ref={mapContainerRef} className="w-full h-full" />
                    <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      Hub Dispatch Corridor
                    </div>
                  </div>

                  {/* Allocated Package Details */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-100/80 px-3 py-2 font-semibold text-slate-700 flex justify-between items-center">
                      <span>Allocated Inventory Packages ({selectedOrder.packages.length})</span>
                      <span className="text-[10px] text-blue-700 font-medium">
                        Vehicle: {selectedOrder.assigned_vehicle?.type || 'Van'} (Cap: {selectedOrder.assigned_vehicle?.capacity})
                      </span>
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
                      {selectedOrder.packages.map((pkg, idx) => (
                        <div key={pkg.id || idx} className="p-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-800">{pkg.food_name}</span>
                            <span className="text-slate-500 text-[11px] ml-2">({pkg.provider_name || 'Restaurant'})</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-700">{pkg.people_served} people</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <div className="py-20 text-center text-slate-500 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                  <Truck className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-800">No Incoming Order in Queue</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Only incoming orders and active transit simulations are displayed here. Once a delivery simulation completes, the order is safely archived to Delivery History.
                  </p>
                </div>
                <div className="pt-1">
                  <Button variant="outline" size="sm" onClick={() => navigate('/hub/history')}>
                    Open Delivery History &rarr;
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
