import React, { useState, useEffect } from 'react';
import {
  Layers,
  Thermometer,
  Droplets,
  Activity,
  Gauge,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Building2,
  UtensilsCrossed,
  Info,
  XCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { inventoryApi, InventoryItem } from '../../api/inventory';
import { IncomingDonation } from '../../types/trip1';
import { getErrorMessage } from '../../api/client';

export const InventoryStagingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'staging' | 'inventory'>('staging');
  const [stagingDonations, setStagingDonations] = useState<IncomingDonation[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Testing workflow state
  const [testingDonationId, setTestingDonationId] = useState<string | null>(null);
  const [testingStage, setTestingStage] = useState<number>(1);
  const [testError, setTestError] = useState<{ id: string; message: string } | null>(null);
  const [lastTestedResult, setLastTestedResult] = useState<InventoryItem | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  const testStages = [
    'Connecting to food sensors...',
    'Fetching temperature and humidity...',
    'Reading MQ gas and FSR load sensor values...',
    'Calculating multi-sensor feasibility score...',
    'Sending food context to Gemini AI...',
    'Predicting remaining safe usable shelf-life...',
    'Saving food record to persistent Inventory...',
  ];

  const loadData = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const [stagingData, invData] = await Promise.all([
        inventoryApi.getInventoryStaging(),
        inventoryApi.getInventoryList(),
      ]);
      setStagingDonations(stagingData);
      setInventoryList(invData);
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format decimal hours to hours and minutes
  const formatDecimalHours = (hours: number): string => {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m} mins`;
    if (m === 0) return `${h} hrs`;
    return `${h} hrs ${m} mins`;
  };

  const handleStartFoodTest = async (donation: IncomingDonation) => {
    setTestingDonationId(donation.id);
    setTestError(null);
    setTestingStage(1);

    // Visual progression of pipeline steps during server request
    const interval = setInterval(() => {
      setTestingStage((prev) => (prev < 6 ? prev + 1 : prev));
    }, 600);

    try {
      const result = await inventoryApi.runFoodTest(donation.id);
      clearInterval(interval);
      setTestingStage(7);

      // Successfully processed: update UI
      setLastTestedResult(result);
      setShowResultModal(true);

      // Remove from staging state immediately
      setStagingDonations((prev) => prev.filter((d) => d.id !== donation.id));
      // Prepend to active inventory list
      setInventoryList((prev) => [result, ...prev.filter((i) => i.id !== result.id)]);
    } catch (err) {
      clearInterval(interval);
      const errorMsg = getErrorMessage(err);
      setTestError({ id: donation.id, message: errorMsg });
    } finally {
      setTestingDonationId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Inventory Staging & Quality Verification
              </h1>
              <p className="text-sm text-slate-500">
                Verify incoming food arriving at hub with IoT sensors, feasibility scoring, and Gemini AI.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading || testingDonationId !== null}
            className="flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {/* Navigation view toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs font-medium">
            <button
              onClick={() => setActiveTab('staging')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'staging'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Staging Queue ({stagingDonations.length})
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'inventory'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hub Inventory ({inventoryList.length})
            </button>
          </div>
        </div>
      </div>

      {pageError && (
        <Alert type="error" title="Failed to Load Inventory Data" message={pageError} />
      )}

      {/* TAB 1: STAGING QUEUE */}
      {activeTab === 'staging' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 leading-relaxed">
              <span className="font-semibold">Workflow Requirement:</span> Donations arriving via Trip Type 1
              are staged here. Clicking <span className="font-semibold">DO FOOD TEST</span> samples real-time IoT sensors (Temperature, Humidity, Gas, Load), evaluates compliance, queries Gemini AI for expiration estimation, and securely transfers the batch into inventory.
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <Spinner size="lg" className="mx-auto mb-3 text-emerald-600" />
              <p className="text-sm text-slate-500 font-medium">Loading arrived donations for testing...</p>
            </div>
          ) : stagingDonations.length === 0 ? (
            <Card className="text-center py-12">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">Staging Queue is Clear</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                All donations that have reached the hub have undergone sensor testing and are stored in Hub Inventory.
              </p>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveTab('inventory')}>
                  View Active Inventory ({inventoryList.length})
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {stagingDonations.map((donation) => {
                const isTestingThis = testingDonationId === donation.id;
                const hasError = testError && testError.id === donation.id;

                return (
                  <div
                    key={donation.id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow overflow-hidden"
                  >
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left Side: Provider & Food Details */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>{donation.provider_name || 'Food Provider'}</span>
                          </span>
                          <Badge variant="blue" size="sm">
                            ARRIVED AT HUB
                          </Badge>
                          <span className="text-xs text-slate-400 font-mono">
                            ID: {donation.id.slice(-6)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-bold text-slate-900 truncate">
                            {donation.food_name}
                          </h3>
                        </div>

                        {donation.description && (
                          <p className="text-xs text-slate-600 line-clamp-1">
                            {donation.description}
                          </p>
                        )}

                        {/* Metadata Pills */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-medium">
                            <UtensilsCrossed className="w-3 h-3 text-emerald-600" />
                            {donation.people_served} people served
                          </span>
                          <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                            {donation.food_category}
                          </span>
                          <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                            {donation.dietary_type}
                          </span>
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-medium">
                            {donation.storage_requirements}
                          </span>
                          {donation.received_at_hub_at && (
                            <span className="text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Arrived {new Date(donation.received_at_hub_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Prominent DO FOOD TEST Button */}
                      <div className="shrink-0 flex flex-col items-end justify-center">
                        <Button
                          variant="primary"
                          size="md"
                          disabled={testingDonationId !== null}
                          isLoading={isTestingThis}
                          onClick={() => handleStartFoodTest(donation)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 shadow-sm text-sm tracking-wide"
                        >
                          <Activity className="w-4 h-4 mr-2" />
                          <span>DO FOOD TEST</span>
                        </Button>
                      </div>
                    </div>

                    {/* Active Testing Pipeline Indicator */}
                    {isTestingThis && (
                      <div className="bg-emerald-50/70 border-t border-emerald-100 p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                          <span className="flex items-center space-x-1.5">
                            <Spinner size="sm" className="text-emerald-600" />
                            <span>Step {testingStage} of {testStages.length}: {testStages[testingStage - 1]}</span>
                          </span>
                          <span>{Math.round((testingStage / testStages.length) * 100)}%</span>
                        </div>
                        <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${(testingStage / testStages.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error Banner with Retry */}
                    {hasError && (
                      <div className="bg-rose-50 border-t border-rose-200 p-4 flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-2 text-xs text-rose-800">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold block">Food Testing Encountered an Error:</span>
                            <span className="mt-0.5 block">{testError.message}</span>
                          </div>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleStartFoodTest(donation)}
                          className="shrink-0 text-xs"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Retry Test
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE HUB INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Displaying all verified batches safely persisted in the <code className="font-mono font-semibold">Inventory</code> collection.
            </p>
          </div>

          {inventoryList.length === 0 ? (
            <Card className="text-center py-12">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-slate-700">No Inventory Records Yet</h3>
              <p className="text-xs text-slate-400 mt-1">
                Completed food tests will transition incoming batches into this inventory table.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {inventoryList.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-emerald-200 transition-colors"
                >
                  {/* Red Indicator if Feasibility Score < 60% */}
                  {item.feasibility_score < 0.6 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-rose-900">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Feasibility score below 60% &bull; Human review required before distribution.</span>
                      </div>
                      <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300 font-bold">
                        {(item.feasibility_score * 100).toFixed(1)}% Score
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {item.provider_name || 'Food Provider'}
                        </span>
                        <Badge variant="emerald" size="sm">
                          AT_INVENTORY
                        </Badge>
                        {item.feasibility_score < 0.6 ? (
                          <Badge variant="rose" size="sm">
                            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
                            Human Review Required
                          </Badge>
                        ) : (
                          <Badge variant="emerald" size="sm">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Quality Verified
                          </Badge>
                        )}
                        <span className="text-xs text-slate-400 font-mono">
                          ID: {item.id.slice(-6)}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">
                        {item.food_name}
                      </h3>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">Tested & Verified</div>
                      <div className="text-xs font-semibold text-slate-700">
                        {new Date(item.food_tested_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* 4 Sensor Gauges & Quality Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                        Temperature
                      </div>
                      <div className="text-base font-bold text-slate-900">
                        {item.sensor_temperature.toFixed(1)}°C
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ST: {item.feasibility_breakdown?.temperature_score ?? '—'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-blue-500" />
                        Humidity
                      </div>
                      <div className="text-base font-bold text-slate-900">
                        {item.sensor_humidity.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        SH: {item.feasibility_breakdown?.humidity_score ?? '—'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-amber-500" />
                        MQ Gas Raw
                      </div>
                      <div className="text-base font-bold text-slate-900">
                        {item.mq_raw}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        SM: {item.feasibility_breakdown?.mq_score ?? '—'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5 text-purple-500" />
                        FSR Load Raw
                      </div>
                      <div className="text-base font-bold text-slate-900">
                        {item.fsr_raw}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        SF: {item.feasibility_breakdown?.fsr_score ?? '—'}
                      </div>
                    </div>
                  </div>

                  {/* Summary Bar: Feasibility Score & Gemini AI Expiration */}
                  <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg p-3 border ${
                    item.feasibility_score < 0.6
                      ? 'bg-rose-50/80 border-rose-300'
                      : 'bg-emerald-50/70 border-emerald-200/80'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg text-white ${
                        item.feasibility_score < 0.6 ? 'bg-rose-600' : 'bg-emerald-600'
                      }`}>
                        {item.feasibility_score < 0.6 ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : (
                          <ShieldCheck className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${
                            item.feasibility_score < 0.6 ? 'text-rose-950 font-bold' : 'text-emerald-900'
                          }`}>
                            Composite Feasibility Score
                          </span>
                          {item.feasibility_score < 0.6 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-300 animate-pulse">
                              Human Review Required
                            </span>
                          )}
                        </div>
                        <div className={`text-lg font-black ${
                          item.feasibility_score < 0.6 ? 'text-rose-800' : 'text-emerald-800'
                        }`}>
                          {(item.feasibility_score * 100).toFixed(1)}% ({item.feasibility_score})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 sm:border-l sm:border-emerald-200 sm:pl-4">
                      <div className="p-2 bg-indigo-600 text-white rounded-lg">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-indigo-950 flex items-center gap-1">
                          Gemini AI Shelf-Life Estimate
                        </div>
                        <div className="text-lg font-black text-indigo-900">
                          {formatDecimalHours(item.predicted_remaining_hours)}
                          <span className="text-xs font-normal text-indigo-600 ml-1.5">
                            ({item.predicted_remaining_hours}h decimal)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUCCESS MODAL FOR FOOD TEST RESULTS */}
      {showResultModal && lastTestedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  lastTestedResult.feasibility_score < 0.6
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {lastTestedResult.feasibility_score < 0.6 ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Food Test Successfully Completed!
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500">
                      Transferred to inventory with complete sensor and AI records.
                    </p>
                    {lastTestedResult.feasibility_score < 0.6 && (
                      <Badge variant="rose" size="sm">
                        <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
                        Human Review Required
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Red Alert Banner in Popup if Feasibility Score < 60% */}
            {lastTestedResult.feasibility_score < 0.6 && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between text-rose-900 text-xs shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Human Review Required (Feasibility Score &lt; 60%)</span>
                </div>
                <span className="text-[11px] font-bold bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded border border-rose-300">
                  {(lastTestedResult.feasibility_score * 100).toFixed(1)}%
                </span>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
              <div className="text-xs font-semibold text-slate-800">
                {lastTestedResult.food_name} &bull; {lastTestedResult.provider_name}
              </div>
              <div className="text-xs text-slate-500">
                {lastTestedResult.people_served} people served &bull; {lastTestedResult.storage_requirements}
              </div>
            </div>

            {/* Sensor & Score Highlights */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium">Sensor Temperature</span>
                <p className="text-base font-bold text-slate-800">
                  {lastTestedResult.sensor_temperature.toFixed(1)}°C
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium">Sensor Humidity</span>
                <p className="text-base font-bold text-slate-800">
                  {lastTestedResult.sensor_humidity.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium">Gas Reading (MQ)</span>
                <p className="text-base font-bold text-slate-800">
                  {lastTestedResult.mq_raw}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="text-slate-500 font-medium">Load Reading (FSR)</span>
                <p className="text-base font-bold text-slate-800">
                  {lastTestedResult.fsr_raw}
                </p>
              </div>
            </div>

            {/* Feasibility & AI Highlights */}
            <div className="space-y-2 pt-1">
              <div className={`p-3 rounded-lg border flex items-center justify-between ${
                lastTestedResult.feasibility_score < 0.6
                  ? 'bg-rose-50/80 border-rose-300'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold block ${
                      lastTestedResult.feasibility_score < 0.6 ? 'text-rose-950 font-bold' : 'text-emerald-900'
                    }`}>
                      Feasibility Score (S)
                    </span>
                    {lastTestedResult.feasibility_score < 0.6 && (
                      <span className="text-[10px] bg-rose-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">
                        Review Needed
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] ${
                    lastTestedResult.feasibility_score < 0.6 ? 'text-rose-700' : 'text-emerald-700'
                  }`}>
                    0.45*ST + 0.20*SH + 0.20*SM + 0.15*SF
                  </span>
                </div>
                <div className={`text-xl font-black ${
                  lastTestedResult.feasibility_score < 0.6 ? 'text-rose-700' : 'text-emerald-800'
                }`}>
                  {(lastTestedResult.feasibility_score * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-indigo-950 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Gemini AI Remaining Usable Time
                  </span>
                  <span className="text-[10px] text-indigo-700">Experimental prototype estimate</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-indigo-950 block">
                    {formatDecimalHours(lastTestedResult.predicted_remaining_hours)}
                  </span>
                  <span className="text-[10px] text-indigo-600 font-medium">
                    {lastTestedResult.predicted_remaining_hours} hours
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => {
                  setShowResultModal(false);
                  setActiveTab('inventory');
                }}
              >
                <span>View in Hub Inventory</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
