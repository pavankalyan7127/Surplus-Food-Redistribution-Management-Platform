import React, { useEffect, useState } from 'react';
import {
  History,
  CheckCircle2,
  Users,
  Truck,
  Building2,
  MapPin,
  Calendar,
  Package,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { trip2Api } from '../../api/trip2';
import { DeliveryHistoryItem } from '../../types/trip2';
import { getErrorMessage } from '../../api/client';

export const DeliveryHistoryPage: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<DeliveryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await trip2Api.getHubDeliveryHistory();
      setHistoryItems(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredItems = historyItems.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.order_number.toLowerCase().includes(q) ||
      item.ngo_name.toLowerCase().includes(q) ||
      item.ngo_address.toLowerCase().includes(q) ||
      item.vehicle_type.toLowerCase().includes(q)
    );
  });

  const totalPortions = historyItems.reduce((acc, curr) => acc + curr.total_people_served, 0);
  const totalDeliveries = historyItems.length;
  const uniqueNgos = new Set(historyItems.map((h) => h.ngo_id)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Delivery History</h1>
            <Badge variant="blue">MongoDB History Log</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Permanent audit trail of completed surplus food deliveries dispatched from this Central Hub to partner NGOs.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchHistory} isLoading={isLoading}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh History
        </Button>
      </div>

      {error && (
        <Alert type="error" title="Error" message={error} />
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Meals Delivered
            </span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {totalPortions.toLocaleString()} portions
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed Trips
            </span>
            <p className="text-2xl font-black text-blue-600 mt-1">
              {totalDeliveries} runs
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Partner NGOs Reached
            </span>
            <p className="text-2xl font-black text-purple-600 mt-1">
              {uniqueNgos} NGOs
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* History Log Table */}
      <Card
        title="Archived Delivery Records"
        subtitle="Delivered packages atomically moved from staging inventory into persistent history"
      >
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order number, NGO name, vehicle, or address..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-sm">Fetching archived delivery records...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <History className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No delivery history records found.</p>
              <p className="text-xs text-slate-500 mt-1">
                Completed deliveries from Trip Type 2 will automatically appear here once dispatched and finished.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isExpanded = expandedId === item.id;
                const formattedDate = new Date(item.delivered_at).toLocaleString();

                return (
                  <div key={item.id} className="py-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {item.order_number}
                          </span>
                          <Badge variant="emerald">Delivered & Archived</Badge>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formattedDate}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 mt-1">
                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-purple-600" />
                            NGO: {item.ngo_name}
                          </span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {item.ngo_address}
                          </span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            Vehicle: {item.vehicle_type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-base font-bold text-emerald-700">
                            {item.total_people_served} portions
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {item.packages.length} package(s)
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          {isExpanded ? 'Hide Details' : 'View Packages'}
                        </Button>
                      </div>
                    </div>

                    {/* Expandable Package Details */}
                    {isExpanded && (
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/90 space-y-2 text-xs">
                        <p className="font-bold text-slate-700 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-blue-600" />
                          Consignment Package Breakdown (Permanently Archived)
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                          {item.packages.map((pkg, idx) => (
                            <div
                              key={pkg.id || idx}
                              className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between"
                            >
                              <div>
                                <p className="font-semibold text-slate-800">{pkg.food_name}</p>
                                <p className="text-slate-500 text-[11px]">{pkg.provider_name || 'Restaurant'}</p>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-emerald-700">
                                  {pkg.people_served} people
                                </span>
                                {pkg.predicted_remaining_hours !== undefined && (
                                  <span className="text-[10px] text-slate-400 block">
                                    {pkg.predicted_remaining_hours.toFixed(1)}h shelf life
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
