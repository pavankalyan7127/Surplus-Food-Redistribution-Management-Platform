import React from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Layers,
  Truck,
  Activity,
  Thermometer,
  ShieldAlert,
  MapPin,
  UserCheck,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export const HubDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 rounded-2xl p-6 md:p-8 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/40 text-blue-200 text-xs font-medium mb-3">
              <Building2 className="w-3.5 h-3.5" />
              <span>Smart Hub Command Center</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {user?.organization_name || 'Central Distribution Hub'}
            </h1>
            <p className="mt-1 text-blue-100 text-sm max-w-xl">
              Consolidated command for surplus aggregation, inventory staging, cold-chain telemetry, and NGO dispatch.
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-start md:items-end gap-1">
            <Badge variant="blue">HUB ADMIN CONSOLE</Badge>
            <span className="text-xs text-blue-200 font-mono">
              Admin: {user?.contact_name}
            </span>
          </div>
        </div>
      </div>

      {/* Hub Identification Summary */}
      <Card title="Hub Identity & Facilities" subtitle="Operational center coordinates">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Supervising Admin</span>
            </div>
            <p className="mt-1 font-semibold text-slate-800">{user?.contact_name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <MapPin className="w-3.5 h-3.5" />
              <span>Hub Facility Address</span>
            </div>
            <p className="mt-1 font-medium text-slate-700 text-xs leading-snug">
              {user?.address || '100 Logistics Way, Hub District, City'}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              <span>Hub Telemetry Link</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-700">Gateway Online</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 4 Workstream Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 1: Inbound Collections (Trip Type 1) */}
        <Card
          title="Inbound Collections"
          subtitle="Trip Type 1: Provider &rarr; Hub"
          action={<Badge variant="blue">Trip Type 1 Active</Badge>}
        >
          <div className="py-6 px-4 text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <Truck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              Inbound Collection Routing & Staging
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Real-time aggregation of provider surplus postings, automated threshold triggers, and interactive MapLibre fleet simulation.
            </p>
            <div className="mt-4">
              <Link to="/hub/incoming-collections">
                <Button variant="primary" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  Open Incoming Collections Command
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-blue-700 font-medium">
              Trip Type 1 Active &bull; Multi-Stop 2-Opt Road Routing
            </div>
          </div>
        </Card>

        {/* Module 2: Hub Inventory Staging */}
        <Card
          title="Inventory Staging & Quality Verification"
          subtitle="Categorized food lots & shelf-life tracking"
          action={<Badge variant="emerald">Live Testing Active</Badge>}
        >
          <div className="py-6 px-4 text-center">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-100">
              <Layers className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              Sensor Testing & AI Expiration Staging
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Arrived surplus batches undergo multi-sensor compliance verification, feasibility scoring, and Gemini AI shelf-life prediction before entering inventory.
            </p>
            <div className="mt-4">
              <Link to="/hub/inventory-staging">
                <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  Open Inventory Staging
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-medium">
              IoT Telemetry &bull; Feasibility Scoring &bull; Gemini AI Prediction
            </div>
          </div>
        </Card>

        {/* Module 3: Outbound Distribution (Trip Type 2) */}
        <Card
          title="Outbound Distribution"
          subtitle="Trip Type 2: Hub &rarr; NGO"
          action={<Badge variant="purple">Trip Type 2 Active</Badge>}
        >
          <div className="py-6 px-4 text-center">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-purple-100">
              <Truck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              NGO Order Allocation & Dispatch
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Process incoming NGO requests, review indivisible package allocations by Gemini shelf-life, and run live road transit simulations.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Link to="/hub/ngo-orders">
                <Button variant="primary" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                  View NGO Orders
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
              <Link to="/hub/history">
                <Button variant="outline" size="sm">
                  History Log
                </Button>
              </Link>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-purple-700 font-medium">
              Trip Type 2 &bull; Indivisible Stock Matching &bull; Persistent Map
            </div>
          </div>
        </Card>

        {/* Module 4: IoT Monitoring */}
        <Card
          title="Cold-Chain & Environmental IoT"
          subtitle="Smart sensor telemetry & threshold alerts"
          action={<Badge variant="blue">Team Member 3</Badge>}
        >
          <div className="py-6 px-4 text-center">
            <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-sky-100">
              <Activity className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              IoT Telemetry Ingestion Initialized
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Live temperature probes, humidity sensors, and spoilage gas detection data streams will render charts here.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 max-w-xs mx-auto text-left text-xs">
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] block">Cold Storage</span>
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-sky-500" /> Standby
                </span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] block">Spoilage Gas</span>
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-500" /> Normal
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              Assigned to Team Member 3 &bull; MQTT/REST ingestion
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
