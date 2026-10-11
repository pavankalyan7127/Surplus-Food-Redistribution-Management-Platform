import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// @ts-ignore
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Configure Web Worker URL for MapLibre GL JS in Vite
maplibregl.setWorkerUrl(maplibreWorkerUrl);

import {
  Truck,
  Building2,
  Utensils,
  CheckCircle2,
  Clock,
  Sparkles,
  Play,
  Pause,
  Zap,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { trip1Api } from '../../api/trip1';
import { DonationTrackingResponse } from '../../types/trip1';

// Reliable OpenStreetMap raster tiles (no API key required)
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

interface RecentDonationItem {
  id: string;
  food_name: string;
  people_served: number;
  created_at: string;
}

export const TrackOrderPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active donation ID from query param or localStorage
  const searchParams = new URLSearchParams(location.search);
  const queryId = searchParams.get('id');
  const storedId = localStorage.getItem('sf_active_tracking_id');
  const activeDonationId = queryId || storedId || '';

  // Data states
  const [trackingData, setTrackingData] = useState<DonationTrackingResponse | null>(null);
  const [recentDonations, setRecentDonations] = useState<RecentDonationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isRequestingDispatch, setIsRequestingDispatch] = useState<boolean>(false);

  // Simulation execution states
  const [simSpeed, setSimSpeed] = useState<number>(2);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simProgressPercent, setSimProgressPercent] = useState<number>(0);
  const [simStatusMessage, setSimStatusMessage] = useState<string>('Ready for vehicle dispatch');
  const [isArrivedAtRestaurant, setIsArrivedAtRestaurant] = useState<boolean>(false);

  // Simulation execution tracking refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const simFloatIndexRef = useRef<number>(0);
  const isSimulatingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const simSpeedRef = useRef<number>(2);
  const lastTimeRef = useRef<number>(0);
  const hasAutoStartedSimulationRef = useRef<string | null>(null);

  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  // Load recent donations list from localStorage
  useEffect(() => {
    try {
      const storedRecent = localStorage.getItem('sf_recent_donations');
      if (storedRecent) {
        setRecentDonations(JSON.parse(storedRecent));
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch tracking data for the active donation
  const fetchTracking = async (showLoadingSpinner = false) => {
    if (!activeDonationId) {
      setIsLoading(false);
      return;
    }

    if (showLoadingSpinner) setIsLoading(true);
    setError(null);

    try {
      const data = await trip1Api.trackDonation(activeDonationId);
      setTrackingData(data);

      // Check if stop was already completed / arrived
      if (
        data.pickup_run?.stop_status === 'PICKED_UP' ||
        data.donation.status === 'PICKED_UP' ||
        data.donation.status === 'ARRIVED_AT_HUB' ||
        data.donation.status === 'RECEIVED_AT_HUB'
      ) {
        setIsArrivedAtRestaurant(true);
        setSimProgressPercent(100);
        setSimStatusMessage(
          `Vehicle arrived at Central Hub! Surplus food batch (${data.donation.people_served} portions) safely received.`
        );
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail =
        errorObj.response?.data?.detail || errorObj.message || 'Failed to load tracking data.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchTracking(true);
  }, [activeDonationId]);

  // Periodic polling every 3 seconds to synchronize with Central Hub status
  useEffect(() => {
    if (!activeDonationId) return;

    const interval = setInterval(() => {
      // Do not interrupt while actively interpolating the animation loop
      if (!isSimulatingRef.current) {
        fetchTracking(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeDonationId]);

  // Initialize MapLibre GL Map whenever route coordinates are available
  useEffect(() => {
    if (
      !mapContainerRef.current ||
      !trackingData?.pickup_run?.route_geometry?.coordinates ||
      trackingData.pickup_run.route_geometry.coordinates.length < 2
    ) {
      return;
    }

    const coords = trackingData.pickup_run.route_geometry.coordinates;
    const hubCoords = trackingData.hub.coordinates;
    const restaurantCoords = coords[coords.length - 1]; // Exact sliced termination point!

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: hubCoords,
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('error', (err) => {
      console.warn('MapLibre runtime notification:', err);
    });

    map.on('load', () => {
      map.resize();
      setTimeout(() => {
        try {
          map.resize();
        } catch {
          // ignore
        }
      }, 250);

      // Add Selective Route Line Layer (Hub to this restaurant ONLY)
      map.addSource('provider-route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: trackingData.pickup_run!.route_geometry as GeoJSON.Geometry,
          properties: {},
        },
      });

      map.addLayer({
        id: 'provider-route-layer',
        type: 'line',
        source: 'provider-route-line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#059669', // Emerald transit corridor to this provider
          'line-width': 5,
          'line-opacity': 0.85,
        },
      });

      // 1. Origin: Central Hub Marker
      const hubEl = document.createElement('div');
      hubEl.className =
        'w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg border-2 border-white text-xs cursor-pointer';
      hubEl.innerHTML = 'HUB';
      new maplibregl.Marker({ element: hubEl })
        .setLngLat(hubCoords)
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
            `<strong>${trackingData.hub.organization_name}</strong><br/>` +
              `<span style="font-size:11px;">Origin Dispatch Facility</span><br/>` +
              `<span style="font-size:11px;color:#2563eb;">${trackingData.hub.address}</span>`
          )
        )
        .addTo(map);

      // 2. Destination: This Restaurant Marker
      const restEl = document.createElement('div');
      restEl.className =
        'w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-lg border-2 border-white text-xs cursor-pointer';
      restEl.innerHTML = 'YOU';
      new maplibregl.Marker({ element: restEl })
        .setLngLat(restaurantCoords)
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(
            `<strong>${trackingData.donation.provider_name} (Pickup Location)</strong><br/>` +
              `<span style="font-size:11px;">${trackingData.donation.pickup_address}</span><br/>` +
              `<span style="font-size:11px;color:#059669;">Serves: ${trackingData.donation.people_served} people</span>`
          )
        )
        .addTo(map);

      // 3. Vehicle Marker
      const vehicleEl = document.createElement('div');
      vehicleEl.className =
        'w-10 h-10 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center shadow-2xl border-2 border-white text-sm font-bold cursor-pointer';
      vehicleEl.innerHTML = '<span class="inline-block text-base">🚚</span>';

      const initialVehicleCoord = isArrivedAtRestaurant ? restaurantCoords : coords[0];
      const vehicleMarker = new maplibregl.Marker({ element: vehicleEl })
        .setLngLat(initialVehicleCoord)
        .addTo(map);

      vehicleMarkerRef.current = vehicleMarker;

      // Fit map bounds specifically to this sub-route
      const bounds = coords.reduce(
        (acc, coord) => acc.extend(coord as [number, number]),
        new maplibregl.LngLatBounds(coords[0], coords[0])
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
  }, [trackingData?.pickup_run?.id]);

  // Run the Vehicle Movement Simulation strictly along the sub-route from Hub to Restaurant
  const runSimulation = async () => {
    if (
      !trackingData?.pickup_run?.route_geometry?.coordinates ||
      !mapRef.current ||
      !vehicleMarkerRef.current
    ) {
      return;
    }

    const coords = trackingData.pickup_run.route_geometry.coordinates;
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
    setIsArrivedAtRestaurant(false);

    // Synchronize simulation start with backend
    try {
      await trip1Api.startDonationSimulation(activeDonationId);
    } catch {
      // continue simulation locally
    }

    setSimStatusMessage(
      `Vehicle dispatched from Central Hub along optimized road route to ${trackingData.donation.provider_name}...`
    );

    const destinationCoord = coords[totalPoints - 1];

    const step = async () => {
      if (!isSimulatingRef.current || isPausedRef.current) return;

      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      // Base speed: 8 points per second at 1x
      const pointsPerSecond = 8.0 * simSpeedRef.current;
      simFloatIndexRef.current += pointsPerSecond * dt;

      if (simFloatIndexRef.current >= totalPoints - 1) {
        simFloatIndexRef.current = totalPoints - 1;
      }

      const floatIdx = simFloatIndexRef.current;
      const baseIdx = Math.floor(floatIdx);
      const nextIdx = Math.min(baseIdx + 1, totalPoints - 1);
      const fraction = floatIdx - baseIdx;

      // Smooth interpolation
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
        // VEHICLE HAS ARRIVED AT THIS PARTICULAR RESTAURANT!
        // TERMINATE SIMULATION: Do NOT proceed further, do NOT show subsequent stops or return to hub.
        vehicleMarkerRef.current?.setLngLat(destinationCoord);

        isSimulatingRef.current = false;
        isPausedRef.current = false;
        setIsSimulating(false);
        setIsPaused(false);
        setIsArrivedAtRestaurant(true);
        setSimProgressPercent(100);

        setSimStatusMessage(
          `Vehicle simulation complete! Surplus batch arrived at Central Hub (Status: ARRIVED_AT_HUB).`
        );

        // Notify backend that this specific stop is completed and arrived at hub
        try {
          await trip1Api.completeDonationStop(activeDonationId);
          fetchTracking(false);
        } catch (e) {
          console.warn('Complete stop notification:', e);
        }
        return;
      }

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  // Automatically start simulation once the vehicle starts from the hub in the Hub Dashboard
  useEffect(() => {
    if (
      trackingData?.pickup_run &&
      trackingData.pickup_run.simulation_status === 'IN_PROGRESS' &&
      !isArrivedAtRestaurant &&
      !isSimulating &&
      !isPaused &&
      hasAutoStartedSimulationRef.current !== trackingData.pickup_run.id
    ) {
      let cancelled = false;
      const attemptStart = () => {
        if (cancelled) return;
        if (vehicleMarkerRef.current && mapRef.current) {
          hasAutoStartedSimulationRef.current = trackingData.pickup_run!.id;
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
  }, [trackingData?.pickup_run?.simulation_status, isArrivedAtRestaurant]);

  const handlePauseSimulation = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    isPausedRef.current = true;
    isSimulatingRef.current = false;
    setIsPaused(true);
    setIsSimulating(false);
  };

  const handleResumeSimulation = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    lastTimeRef.current = performance.now();
    runSimulation();
  };

  const handleReplaySimulation = () => {
    simFloatIndexRef.current = 0;
    setIsArrivedAtRestaurant(false);
    setSimProgressPercent(0);
    runSimulation();
  };

  const handleRequestImmediateDispatch = async () => {
    if (!activeDonationId) return;
    setIsRequestingDispatch(true);
    setActionNotice(null);
    try {
      const data = await trip1Api.requestDonationDispatch(activeDonationId);
      setTrackingData(data);
      setActionNotice(
        `Pickup vehicle successfully scheduled! Smallest available fleet allocated (${data.pickup_run?.assigned_vehicle.type}). Ready for live transit simulation.`
      );
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail =
        errorObj.response?.data?.detail || errorObj.message || 'Failed to dispatch pickup vehicle.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setIsRequestingDispatch(false);
    }
  };

  // 1. OPEN ACCESS RESTRICTION GATE
  // If the user has not submitted a surplus batch and clicked 'Ready for Pickup'
  if (!activeDonationId) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-950 rounded-2xl p-6 text-white shadow-sm flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/40 text-emerald-200 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Food Provider Portal</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Track Surplus Pickup</h1>
            <p className="mt-1 text-emerald-100 text-xs sm:text-sm">
              Real-time vehicle transit monitoring from Central Hub to your establishment.
            </p>
          </div>
        </div>

        <Card title="Order Tracking Verification Required" subtitle="Open Access Gate">
          <div className="py-10 px-4 text-center space-y-4">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-800">No Active Donation to Track</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Since our platform is open access with no login required, order tracking is
                exclusively unlocked for providers who have submitted surplus food details and clicked
                <strong> READY FOR PICKUP</strong>.
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                onClick={() => navigate('/provider/surplus-donations')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 text-xs shadow-md"
              >
                <Utensils className="w-4 h-4 mr-2" />
                Declare Surplus Food Batch Now &rarr;
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 2. LOADING STATE
  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
        <p className="text-sm font-semibold">Loading donation tracking & route geometry...</p>
      </div>
    );
  }

  // 3. ERROR OR NOT FOUND STATE
  if (error || !trackingData) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
        <Card title="Unable to Load Tracking Information">
          <div className="py-8 px-4 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Donation Record Not Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {error || 'No active donation matches this reference ID.'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/provider/surplus-donations')}
            >
              Back to Surplus Donations Form
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { donation, hub, has_pickup_run, pickup_run } = trackingData;

  // Determine active step index (1-based)
  let currentStep = 1;
  if (has_pickup_run) {
    currentStep = 2;
    if (pickup_run?.simulation_status === 'IN_PROGRESS') {
      currentStep = 3;
    }
    if (
      isArrivedAtRestaurant ||
      pickup_run?.stop_status === 'PICKED_UP' ||
      donation.status === 'PICKED_UP' ||
      donation.status === 'ARRIVED_AT_HUB' ||
      donation.status === 'RECEIVED_AT_HUB'
    ) {
      currentStep = 5;
    }
  }

  const STEPS = [
    { title: 'Surplus Declared', subtitle: 'Status: READY_FOR_PICKUP' },
    { title: 'Hub Assigned', subtitle: 'Fleet & 2-Opt TSP' },
    { title: 'Vehicle En Route', subtitle: 'Transit Simulation' },
    { title: 'Picked Up', subtitle: 'Driver Arrived at Restaurant' },
    { title: 'Arrived at Hub', subtitle: 'Status: ARRIVED_AT_HUB' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-950 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/40 text-emerald-200 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Access Surplus Tracking</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Tracking Pickup for &ldquo;{donation.food_name}&rdquo;
          </h1>
          <p className="mt-1 text-emerald-100 text-xs sm:text-sm max-w-xl">
            Donor: <strong>{donation.provider_name}</strong> &bull; {donation.people_served} people
            served &bull; Assigned to <strong>{hub.organization_name}</strong>
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
          <Badge
            variant={
              currentStep === 5 || isArrivedAtRestaurant || donation.status === 'ARRIVED_AT_HUB' || donation.status === 'RECEIVED_AT_HUB'
                ? 'emerald'
                : has_pickup_run
                ? 'blue'
                : 'amber'
            }
          >
            {currentStep === 5 || isArrivedAtRestaurant || donation.status === 'ARRIVED_AT_HUB' || donation.status === 'RECEIVED_AT_HUB'
              ? 'ARRIVED AT HUB'
              : has_pickup_run
              ? `RUN ACTIVE: ${pickup_run?.simulation_status}`
              : 'AWAITING PICKUP RUN'}
          </Badge>
          <button
            onClick={() => fetchTracking(true)}
            className="text-xs text-emerald-200 hover:text-white flex items-center gap-1 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
          </button>
        </div>
      </div>

      {actionNotice && <Alert type="success" message={actionNotice} className="mb-2" />}

      {/* Lifecycle Progress Stepper */}
      <Card title="Live Pickup Lifecycle" subtitle="Automated workflow tracking">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          {STEPS.map((s, idx) => {
            const stepNum = idx + 1;
            const isAllCompleted = currentStep === 5;
            const isDone = isAllCompleted ? true : currentStep > stepNum;
            const isCurrent = !isAllCompleted && currentStep === stepNum;
            return (
              <div
                key={s.title}
                className={`p-3 rounded-xl border flex flex-col justify-between text-xs transition-all ${
                  isDone
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : isCurrent
                    ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-sm ring-1 ring-blue-300'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-[11px] uppercase tracking-wider">
                    Step {stepNum}
                  </span>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : isCurrent ? (
                    <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                  )}
                </div>
                <div>
                  <p className="font-bold">{s.title}</p>
                  <p className="text-[10px] opacity-80 mt-0.5">{s.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main Map & Selective Simulation Section */}
      <Card
        title="Selective Vehicle Transit Simulation"
        subtitle="Visualizing vehicle route strictly from Central Hub to your establishment"
        action={
          pickup_run ? (
            <div className="flex items-center gap-2">
              <Badge variant="blue">
                Stop #{pickup_run.stop_index} of {pickup_run.total_stops}
              </Badge>
              <Badge variant="emerald">
                {(pickup_run.distance_meters / 1000).toFixed(2)} km to your doorstep
              </Badge>
            </div>
          ) : undefined
        }
      >
        {!has_pickup_run ? (
          <div className="p-8 text-center space-y-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Awaiting Automated Central Hub Vehicle Dispatch
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Your donation of <strong>{donation.people_served} portions</strong> is staged as{' '}
                <code>READY_FOR_PICKUP</code>. The Central Hub automatically dispatches vehicles
                once aggregate nearby portions exceed 20, or via supervisor manual dispatch.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                isLoading={isRequestingDispatch}
                onClick={handleRequestImmediateDispatch}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 text-xs uppercase tracking-wider"
              >
                <Zap className="w-3.5 h-3.5 mr-1 text-slate-950" />
                Request Immediate Vehicle Dispatch
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Simulation Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 rounded-xl text-white">
              <div className="flex items-center gap-2">
                {!isSimulating ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={isPaused ? handleResumeSimulation : runSimulation}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    {isPaused
                      ? 'RESUME TRANSIT'
                      : isArrivedAtRestaurant
                      ? 'REPLAY TRANSIT'
                      : 'START VEHICLE TRANSIT'}
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

                {isArrivedAtRestaurant && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReplaySimulation}
                    className="border-slate-700 text-slate-200 hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Replay
                  </Button>
                )}

                {/* Speed Controls */}
                <div className="flex items-center gap-1 ml-3 text-xs">
                  <span className="text-slate-400">Speed:</span>
                  {[1, 2, 3, 5].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setSimSpeed(speed)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        simSpeed === speed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress and status indicator */}
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-amber-300">{simStatusMessage}</span>
                <div className="w-28 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-150"
                    style={{ width: `${simProgressPercent}%` }}
                  />
                </div>
                <span className="text-slate-300 font-mono text-[11px]">
                  {simProgressPercent}%
                </span>
              </div>
            </div>

            {/* MapLibre Map Container */}
            <div
              ref={mapContainerRef}
              className="w-full h-[400px] rounded-xl border border-slate-300 relative shadow-inner overflow-hidden"
            />

            {/* Crucial Verification Banner: Privacy & Selective Route Confirmation */}
            <div className="p-3 bg-emerald-50 border border-emerald-200/70 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Confidential Route Boundary &bull; Privacy Protected
                </p>
                <p className="text-emerald-700 text-[11px] mt-0.5 leading-relaxed">
                  The map above displays the exact road trajectory determined by the Central Hub
                  up to <strong>{donation.provider_name}</strong> only. Subsequent restaurant
                  pickups and the vehicle&apos;s return route to the Hub are never revealed to external
                  providers.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Details Grid: Batch Data & Assigned Hub Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Batch & Location Information */}
        <Card title="Donation Batch Details" subtitle="Declared food characteristics">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Food Item:</span>
              <span className="font-bold text-slate-800">{donation.food_name}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">People Served (Portions):</span>
              <span className="font-bold text-emerald-700 text-sm">
                {donation.people_served} people
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Category & Classification:</span>
              <span className="font-medium text-slate-700">
                {donation.food_category} &bull; {donation.dietary_type}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Storage Requirement:</span>
              <span className="font-medium text-slate-700">
                {donation.storage_requirements}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500 block mb-1">Pickup Address:</span>
              <p className="font-medium text-slate-800 leading-snug">
                {donation.pickup_address}
              </p>
            </div>

            {donation.pickup_notes && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Pickup Instructions:</span>
                <p className="text-slate-700 italic">{donation.pickup_notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Card 2: Assigned Central Hub Facility */}
        <Card title="Assigned Central Hub" subtitle="Designated aggregation depot">
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>{hub.organization_name}</span>
              </div>
              <p className="text-blue-700 text-[11px] leading-snug">{hub.address}</p>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Supervising Contact:</span>
              <span className="font-semibold text-slate-800">{hub.contact_name}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Assigned Fleet Vehicle:</span>
              <span className="font-bold text-slate-800">
                {pickup_run?.assigned_vehicle.type || 'Electric Cargo Van'} (
                {pickup_run?.assigned_vehicle.capacity || 40} pax)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Routing Algorithm:</span>
              <span className="font-semibold text-slate-700">Multi-Stop 2-Opt TSP</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Depot Geocode Coordinates:</span>
              <span className="font-mono text-slate-600 text-[11px]">
                {hub.coordinates[1].toFixed(4)}°N, {hub.coordinates[0].toFixed(4)}°E
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Submissions Switcher (if provider submitted multiple batches) */}
      {recentDonations.length > 1 && (
        <Card title="Your Recent Donations" subtitle="Switch tracking view">
          <div className="divide-y divide-slate-100">
            {recentDonations.map((item) => {
              const isSelected = item.id === activeDonationId;
              return (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Store className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="font-semibold text-slate-800">{item.food_name}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.people_served} people &bull; ID: {item.id.slice(-6)}
                      </p>
                    </div>
                  </div>

                  {isSelected ? (
                    <Badge variant="emerald">CURRENTLY TRACKING</Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        localStorage.setItem('sf_active_tracking_id', item.id);
                        navigate(`/provider/track-order?id=${item.id}`);
                      }}
                    >
                      Track This Order &rarr;
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
