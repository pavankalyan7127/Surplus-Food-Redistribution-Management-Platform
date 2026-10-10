import React from 'react';
import { Link } from 'react-router-dom';
import {
  Utensils,
  PlusCircle,
  Truck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export const ProviderDashboard: React.FC = () => {
  const { user } = useAuth();

  const formatProviderType = (type?: string) => {
    switch (type) {
      case 'restaurant':
        return 'Restaurant / Eatery';
      case 'bakery':
        return 'Bakery';
      case 'hostel_mess':
        return 'Hostel Mess';
      default:
        return 'Food Establishment';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 rounded-2xl p-6 md:p-8 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/40 text-emerald-200 text-xs font-medium mb-3">
              <Utensils className="w-3.5 h-3.5" />
              <span>Food Provider Portal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Welcome back, {user?.organization_name || 'Partner'}!
            </h1>
            <p className="mt-1 text-emerald-100 text-sm max-w-xl">
              Thank you for keeping edible surplus food in circulation. Your contributions support community distribution hubs across the city.
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-block px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-xs text-white font-medium border border-white/20">
              Role: <strong className="uppercase">Food Provider</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Profile Overview Card */}
      <Card title="Establishment Profile" subtitle="Registered business details and pickup coordinate">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Provider Type</p>
            <p className="mt-1 font-semibold text-slate-800">
              {formatProviderType(user?.provider_type)}
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
              <span>Pickup Address</span>
            </div>
            <p className="mt-1 font-medium text-slate-700 text-xs leading-snug">
              {user?.address}
            </p>
          </div>
        </div>
      </Card>

      {/* Feature Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Placeholder Card 1: Post Surplus Food */}
        <Card
          title="Surplus Food Listings"
          subtitle="Trip Type 1: Provider &rarr; Collection Hub"
          action={<Badge variant="emerald">Trip Type 1 Active</Badge>}
        >
          <div className="py-8 px-4 text-center">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <Sparkles className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">
              Post Surplus Food Donation
            </h4>
            <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Declare excess cooked meals, baked items, or perishable produce with storage requirements and portion count.
            </p>
            <div className="mt-5">
              <Link to="/provider/surplus-donations">
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                >
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  Go to Surplus Donations Portal
                </Button>
              </Link>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Trip Type 1 Active &bull; Automated Hub Route Clustering</span>
            </div>
          </div>
        </Card>

        {/* Placeholder Card 2: Collection Trip Status */}
        <Card
          title="Inbound Collection Status"
          subtitle="Real-time pickup coordination & route tracking"
          action={<Badge variant="slate">Empty State</Badge>}
        >
          <div className="py-8 px-4 text-center">
            <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
              <Truck className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">
              No Active Collection Trips
            </h4>
            <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              When a surplus listing is matched, the collection vehicle and expected arrival window will display here with live status updates.
            </p>
            <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-center gap-2 text-xs text-amber-700 bg-amber-50 py-2 px-3 rounded-lg border border-amber-200/60 max-w-sm mx-auto">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Collection routing engine will be connected in Phase 2</span>
            </div>
          </div>
        </Card>
      </div>

      {/* System Status info */}
      <div className="rounded-xl bg-slate-100/80 border border-slate-200/80 p-4 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Platform Status: Initial Foundation Commit Active</span>
        </div>
        <span className="font-mono text-slate-500 text-[11px]">User ID: {user?.id}</span>
      </div>
    </div>
  );
};
