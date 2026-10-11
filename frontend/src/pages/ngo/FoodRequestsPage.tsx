import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Phone,
  Package,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { trip2Api } from '../../api/trip2';
import {
  HubItem,
  FoodRequestCheckResponse,
  AllocatedPackageInfo,
} from '../../types/trip2';
import { getErrorMessage } from '../../api/client';

export const FoodRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [hubs, setHubs] = useState<HubItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Hub & Modal State
  const [selectedHub, setSelectedHub] = useState<HubItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [portionInput, setPortionInput] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<FoodRequestCheckResponse | null>(null);
  const [isOrdering, setIsOrdering] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const fetchHubs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await trip2Api.getNgoHubs();
      setHubs(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHubs();
  }, []);

  const handleOpenRequestModal = (hub: HubItem) => {
    setSelectedHub(hub);
    setPortionInput('');
    setCheckResult(null);
    setOrderSuccess(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedHub(null);
    setCheckResult(null);
    setOrderSuccess(null);
  };

  const handleCheckStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHub) return;

    const count = parseInt(portionInput, 10);
    if (isNaN(count) || count <= 0) {
      setError('Please enter a valid number of people needing food.');
      return;
    }

    try {
      setIsChecking(true);
      setError(null);
      const response = await trip2Api.checkFoodRequest({
        hub_id: selectedHub.id,
        requested_portions: count,
      });
      setCheckResult(response);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsChecking(false);
    }
  };

  const handleConfirmOrder = async (confirmedPortions: number, packageIds: string[]) => {
    if (!selectedHub || !checkResult) return;

    try {
      setIsOrdering(true);
      setError(null);
      const order = await trip2Api.createOrder({
        hub_id: selectedHub.id,
        requested_portions: checkResult.requested_portions,
        confirmed_portions: confirmedPortions,
        package_ids: packageIds,
      });

      setOrderSuccess(`Order ${order.order_number} confirmed! Vehicle dispatch initiated.`);
      // Refresh hubs stock
      fetchHubs();

      // Navigate to dispatch tracking after short confirmation
      setTimeout(() => {
        handleCloseModal();
        navigate('/ngo/dispatch-tracking');
      }, 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Food Requests</h1>
            <Badge variant="purple">Trip Type 2</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Request surplus food rations directly from nearest Central Hubs with AI-optimized shelf life allocation.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHubs} isLoading={isLoading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Hubs
        </Button>
      </div>

      {error && (
        <Alert type="error" title="Error" message={error} />
      )}

      {/* Linear List of Nearest Central Hubs */}
      <Card
        title="Available Central Hubs"
        subtitle="Showing Central Hubs within 12 km proximity radius of your registered NGO premises"
      >
        {isLoading ? (
          <div className="py-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
            <p className="text-sm">Locating nearest Central Hubs within 12 km radius...</p>
          </div>
        ) : hubs.filter((h) => h.distance_km == null || h.distance_km <= 12).length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Building2 className="w-10 h-10 mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No Central Hubs found within 12 km.</p>
            <p className="text-xs text-slate-500 mt-1">
              Central Hubs are restricted to a local 10–12 km delivery perimeter to guarantee food freshness and rapid transit.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {hubs
              .filter((h) => h.distance_km == null || h.distance_km <= 12)
              .map((hub, index) => (
              <div
                key={hub.id}
                className="py-4 px-2 first:pt-1 last:pb-1 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 rounded-xl transition-colors"
              >
                {/* Left Side: Hub Name and Logistics Info */}
                <div className="flex items-start space-x-3.5">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700 font-bold text-base shrink-0 shadow-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {hub.organization_name}
                      </h3>
                      {hub.distance_km !== null && hub.distance_km !== undefined ? (
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {hub.distance_km} km away
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Central Depot
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {hub.address}
                      </span>
                      {hub.phone_number && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {hub.phone_number}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        Available Stock: <strong className="text-emerald-700">{hub.available_portions}</strong> portions
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        {hub.package_count} sealed packages
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Request Food Button */}
                <div className="flex items-center shrink-0 self-end md:self-center">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleOpenRequestModal(hub)}
                    disabled={hub.available_portions <= 0}
                    className="shadow-sm whitespace-nowrap"
                  >
                    Request Food
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Request Food Modal Popup */}
      {isModalOpen && selectedHub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase text-purple-700 tracking-wider">
                  Surplus Redistribution Request
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  Request Food from {selectedHub.organization_name}
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {orderSuccess && (
              <Alert type="success" title="Success" message={orderSuccess} />
            )}

            {/* Input Form if not yet evaluated or re-entering */}
            {!checkResult && (
              <form onSubmit={handleCheckStock} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    How many people do you need food for?
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Enter the count of individuals or beneficiaries currently needing meals at your NGO.
                  </p>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="5000"
                      value={portionInput}
                      onChange={(e) => setPortionInput(e.target.value)}
                      placeholder="e.g. 25"
                      required
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
                    />
                    <div className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                      people
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Indivisible Packaging & AI Shelf-Life Policy
                  </div>
                  <p>
                    • Restaurant packages are sealed and cannot be split.
                  </p>
                  <p>
                    • Packages are automatically matched by Gemini AI remaining shelf-life (shortest time prioritized).
                  </p>
                  <p>
                    • Up to 20% grace portion is automatically approved.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={handleCloseModal}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" isLoading={isChecking}>
                    Check Stock Availability
                  </Button>
                </div>
              </form>
            )}

            {/* Evaluation Results and Prompts */}
            {checkResult && (
              <div className="space-y-4">
                {/* CASE 1: EMPTY */}
                {checkResult.status === 'EMPTY' && (
                  <div className="space-y-4">
                    <Alert type="warning" title="No Stock Available" message={checkResult.message} />
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={() => setCheckResult(null)}>
                        Try Another Hub or Quantity
                      </Button>
                    </div>
                  </div>
                )}

                {/* CASE 2: DEFICIT */}
                {checkResult.status === 'DEFICIT' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        Stock Deficit Notice
                      </div>
                      <p className="text-sm text-amber-900 leading-relaxed font-medium">
                        "{checkResult.message}"
                      </p>
                      <div className="text-xs text-amber-700 pt-1">
                        Requested: <strong>{checkResult.requested_portions}</strong> &bull; Total Hub Inventory Available: <strong>{checkResult.available_portions}</strong>
                      </div>
                    </div>

                    {/* Package list */}
                    <PackageBreakdownList packages={checkResult.packages} />

                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCheckResult(null)}
                        disabled={isOrdering}
                      >
                        Cancel / Change Quantity
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        isLoading={isOrdering}
                        onClick={() =>
                          handleConfirmOrder(
                            checkResult.matched_portions,
                            checkResult.package_ids
                          )
                        }
                      >
                        Accept {checkResult.matched_portions} Portions & Dispatch
                      </Button>
                    </div>
                  </div>
                )}

                {/* CASE 3: EXCEEDS 20% GRACE */}
                {checkResult.status === 'EXCEEDS_GRACE' && (
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-purple-800 font-semibold text-sm">
                        <Package className="w-4 h-4 text-purple-600 shrink-0" />
                        Indivisible Package Allocation Exceeds 20%
                      </div>
                      <p className="text-sm text-purple-900 leading-relaxed font-medium">
                        "We have a <strong>{checkResult.matched_portions}</strong> count food available, do you want or not?"
                      </p>
                      <p className="text-xs text-purple-700">
                        Because restaurant donations cannot be split, this selection contains {checkResult.packages.length} indivisible package(s) totaling {checkResult.matched_portions} portions (requested {checkResult.requested_portions}).
                      </p>
                    </div>

                    <PackageBreakdownList packages={checkResult.packages} />

                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCheckResult(null)}
                        disabled={isOrdering}
                      >
                        Decline / Change Quantity
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        isLoading={isOrdering}
                        onClick={() =>
                          handleConfirmOrder(
                            checkResult.matched_portions,
                            checkResult.package_ids
                          )
                        }
                      >
                        Yes, Accept All {checkResult.matched_portions} Portions
                      </Button>
                    </div>
                  </div>
                )}

                {/* CASE 4: PERFECT MATCH (Within 20% Grace) */}
                {checkResult.status === 'MATCH' && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        Optimal Food Allocation Matched
                      </div>
                      <p className="text-sm text-emerald-900 leading-relaxed">
                        {checkResult.message}
                      </p>
                    </div>

                    <PackageBreakdownList packages={checkResult.packages} />

                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCheckResult(null)}
                        disabled={isOrdering}
                      >
                        Modify Count
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        isLoading={isOrdering}
                        onClick={() =>
                          handleConfirmOrder(
                            checkResult.matched_portions,
                            checkResult.package_ids
                          )
                        }
                      >
                        Confirm & Dispatch ({checkResult.matched_portions} Portions)
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface PackageBreakdownProps {
  packages: AllocatedPackageInfo[];
}

const PackageBreakdownList: React.FC<PackageBreakdownProps> = ({ packages }) => {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
      <div className="bg-slate-100/80 px-3 py-2 font-semibold text-slate-700 flex justify-between items-center">
        <span>Allocated Indivisible Packages ({packages.length})</span>
        <span className="text-[10px] text-purple-700 font-medium">Sorted by Gemini AI Shelf Life</span>
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
        {packages.map((pkg, idx) => (
          <div key={pkg.id || idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
            <div>
              <p className="font-semibold text-slate-800">{pkg.food_name}</p>
              <p className="text-slate-500 text-[11px]">{pkg.provider_name || 'Restaurant'}</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-emerald-700 block">
                {pkg.people_served} people
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3 text-amber-500" />
                {pkg.predicted_remaining_hours.toFixed(1)} hrs left
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
