import React from 'react';
import {
  HeartHandshake,
  Truck,
  MapPin,
  Phone,
  Mail,
  UtensilsCrossed,
  ClipboardList,
  History,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';

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
        {/* Card 1: Food Allocation Requests */}
        <Card
          title="Food Requests"
          subtitle="Request surplus rations from nearest Central Hubs"
          action={<Badge variant="purple">Trip Type 2</Badge>}
        >
          <div className="py-6 px-2 text-center">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-purple-100">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">
              Request Food Rations
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Linear hub finder with automated stock evaluation, indivisible packaging allocation, and Gemini AI shelf-life priority.
            </p>
            <div className="mt-5">
              <a
                href="/ngo/food-requests"
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-sm w-full"
              >
                Open Food Requests &rarr;
              </a>
            </div>
          </div>
        </Card>

        {/* Card 2: Outbound Delivery Tracking */}
        <Card
          title="Dispatch Tracking"
          subtitle="Hub &rarr; NGO live transit"
          action={<Badge variant="emerald">Live Map</Badge>}
        >
          <div className="py-6 px-2 text-center">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-emerald-100">
              <Truck className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">
              Active Transit Tracking
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Real-time MapLibre road simulation from Central Hubs to your delivery facility along OSRM road geometry.
            </p>
            <div className="mt-5">
              <a
                href="/ngo/dispatch-tracking"
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors w-full"
              >
                Track Outbound Dispatch &rarr;
              </a>
            </div>
          </div>
        </Card>

        {/* Card 3: Order History */}
        <Card
          title="Order History"
          subtitle="Fulfilled food deliveries"
          action={<Badge variant="blue">History</Badge>}
        >
          <div className="py-6 px-2 text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <History className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">
              Delivery Audit Trail
            </h4>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Comprehensive log of all received surplus food rations from various Central Hubs, portion counts, and package breakdowns.
            </p>
            <div className="mt-5">
              <a
                href="/ngo/history"
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors w-full border border-blue-200"
              >
                View Order History &rarr;
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
