import React from 'react';
import {
  HeartHandshake,
  Truck,
  MapPin,
  Phone,
  Mail,
  UtensilsCrossed,
  PackageSearch,
  Clock,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export const NgoDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-900 rounded-2xl p-6 md:p-8 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-600/40 text-purple-200 text-xs font-medium mb-3">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>NGO Relief Partner Portal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome, {user?.organization_name || 'Partner NGO'}!
            </h1>
            <p className="mt-1 text-purple-100 text-sm max-w-xl">
              Connecting your community dining, shelter, and relief operations with centralized surplus inventory from verified local food providers.
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-block px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-xs text-white font-medium border border-white/20">
              Role: <strong className="uppercase">NGO Partner</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Organization Profile Card */}
      <Card title="Organization Profile & Daily Demand" subtitle="Community distribution metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-100">
            <div className="flex items-center gap-1 text-xs text-purple-700 font-medium">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Daily Meal Demand</span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {user?.estimated_daily_meal_demand
                ? `${user.estimated_daily_meal_demand.toLocaleString()} meals/day`
                : 'Not specified'}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Mail className="w-3.5 h-3.5" />
              <span>Contact Person</span>
            </div>
            <p className="mt-1 font-semibold text-slate-800">{user?.contact_name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Phone className="w-3.5 h-3.5" />
              <span>Phone</span>
            </div>
            <p className="mt-1 font-semibold text-slate-800">{user?.phone}</p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <MapPin className="w-3.5 h-3.5" />
              <span>Delivery Point</span>
            </div>
            <p className="mt-1 font-medium text-slate-700 text-xs leading-snug">
              {user?.address}
            </p>
          </div>
        </div>
      </Card>

      {/* Feature Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Placeholder Card 1: Available Hub Inventory */}
        <Card
          title="Hub Inventory"
          subtitle="Surplus ready for allocation"
          action={<Badge variant="purple">Phase 2</Badge>}
        >
          <div className="py-6 px-2 text-center">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-purple-100">
              <PackageSearch className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              Browse Hub Inventory
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Real-time catalog of packaged foods, produce, and grains staged at regional collection hubs.
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="opacity-70 cursor-not-allowed w-full"
              >
                Browse Catalog (Phase 2)
              </Button>
            </div>
            <div className="mt-3 text-[11px] text-slate-400">
              Assigned to Team Member 2
            </div>
          </div>
        </Card>

        {/* Placeholder Card 2: Food Allocation Requests */}
        <Card
          title="Food Requests"
          subtitle="Requisitions & quotas"
          action={<Badge variant="slate">Empty State</Badge>}
        >
          <div className="py-6 px-2 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-200">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              No Active Requisitions
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Submit requests according to your community's meal distribution schedule and capacity.
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="opacity-70 cursor-not-allowed w-full"
              >
                Create Request (Phase 2)
              </Button>
            </div>
            <div className="mt-3 text-[11px] text-slate-400">
              Assigned to Team Member 2
            </div>
          </div>
        </Card>

        {/* Placeholder Card 3: Outbound Delivery Tracking */}
        <Card
          title="Trip Type 2 Delivery"
          subtitle="Hub &rarr; NGO transit"
          action={<Badge variant="slate">Trip 2</Badge>}
        >
          <div className="py-6 px-2 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-200">
              <Truck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              No Deliveries Scheduled
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              When a dispatch is triggered, the transport vehicle, driver contact, and ETA will track here.
            </p>
            <div className="mt-4 flex items-center justify-center gap-1 text-[11px] text-slate-400 py-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Awaiting dispatch activation</span>
            </div>
            <div className="mt-3 text-[11px] text-slate-400">
              Assigned to Team Member 2
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
