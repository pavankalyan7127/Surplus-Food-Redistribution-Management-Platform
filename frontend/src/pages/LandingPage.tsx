import React from 'react';
import { Link } from 'react-router-dom';
import {
  Utensils,
  Building2,
  HeartHandshake,
  ArrowRight,
  ShieldCheck,
  Truck,
  Leaf,
} from 'lucide-react';
import { Card } from '../components/common/Card';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-sm">
              SF
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg leading-tight block">
                Surplus Food Platform
              </span>
              <span className="text-xs text-slate-500">
                Redistribution & Smart Hub Management
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <Leaf className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero Food Waste Initiative</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium mb-6">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>HackFest 2026 Foundation Commit</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto">
          Connecting <span className="text-emerald-600">Surplus Food</span> with Hubs & Communities
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          An automated redistribution network uniting food providers, centralized collection hubs, and NGOs with IoT-enabled cold-chain monitoring.
        </p>

        {/* 3 Prominent Login Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
          {/* Card 1: Food Provider */}
          <Card className="hover:border-emerald-400 hover:shadow-md transition-all border-2 border-transparent group">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Utensils className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Food Provider</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed min-h-[50px]">
              Restaurants, bakeries, hostels, and caterers posting excess quality food for prompt collection.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/login/provider"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors shadow-sm group-hover:shadow"
              >
                <span>Provider Login</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/signup/provider"
                className="text-center text-xs text-emerald-700 hover:text-emerald-800 hover:underline py-1 font-medium"
              >
                Register New Provider
              </Link>
            </div>
          </Card>

          {/* Card 2: Hub Admin */}
          <Card className="hover:border-blue-400 hover:shadow-md transition-all border-2 border-transparent group">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Hub Admin</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed min-h-[50px]">
              Collection hub managers coordinating inbound pickups, cold inventory staging, and IoT telemetry.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/login/hub"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm group-hover:shadow"
              >
                <span>Hub Admin Portal</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </Card>

          {/* Card 3: NGO Partner */}
          <Card className="hover:border-purple-400 hover:shadow-md transition-all border-2 border-transparent group">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">NGO Partner</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed min-h-[50px]">
              Charitable organizations and relief kitchens requesting and receiving food distributions.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/login/ngo"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 transition-colors shadow-sm group-hover:shadow"
              >
                <span>NGO Login</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/signup/ngo"
                className="text-center text-xs text-purple-700 hover:text-purple-800 hover:underline py-1 font-medium"
              >
                Register New NGO
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Two Transport Workflows Overview */}
      <section className="bg-white border-y border-slate-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 text-center mb-8">
            Two-Tier Smart Redistribution Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Trip Type 1: Inbound Collection</h4>
                  <p className="text-xs text-slate-500 font-medium">Food Provider &rarr; Smart Hub</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Aggregates surplus food posts from restaurants, bakeries, and messes using location clustering to optimize collection routes into the central hub.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Trip Type 2: Outbound Distribution</h4>
                  <p className="text-xs text-slate-500 font-medium">Smart Hub &rarr; NGO Partner</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Fulfills verified meal requests from NGOs from hub inventory, scheduling timely dispatched deliveries with freshness monitoring.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-xs text-slate-500 border-t border-slate-200">
        <p>Surplus Food Redistribution & Smart Hub Management Platform &bull; HackFest 2026</p>
      </footer>
    </div>
  );
};
