import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  MapPin,
  Building2,
  Users,
  CheckCircle2,
  Package,
  ThermometerSnowflake,
  Info,
  Store,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Alert } from '../../components/common/Alert';
import { trip1Api } from '../../api/trip1';
import {
  DietaryType,
  FoodCategory,
  IncomingDonation,
  StorageRequirement,
} from '../../types/trip1';

const FOOD_CATEGORIES: { value: FoodCategory; label: string }[] = [
  { value: 'Cooked Meals', label: 'Cooked Meals (Prepared)' },
  { value: 'Bakery & Bread', label: 'Bakery & Bread' },
  { value: 'Fresh Produce', label: 'Fresh Produce (Fruits/Veg)' },
  { value: 'Dairy & Eggs', label: 'Dairy & Eggs' },
  { value: 'Packaged / Dry Goods', label: 'Packaged / Dry Goods' },
  { value: 'Beverages', label: 'Beverages' },
  { value: 'Other', label: 'Other Food Items' },
];

const DIETARY_TYPES: { value: DietaryType; label: string }[] = [
  { value: 'Vegetarian', label: 'Vegetarian' },
  { value: 'Non-Vegetarian', label: 'Non-Vegetarian' },
  { value: 'Vegan', label: 'Vegan' },
];

const STORAGE_OPTIONS: { value: StorageRequirement; label: string }[] = [
  { value: 'Room Temperature', label: 'Room Temperature' },
  { value: 'Refrigerated (Cold Chain)', label: 'Refrigerated (Cold Chain)' },
  { value: 'Frozen', label: 'Frozen Storage' },
  { value: 'Hot Holding', label: 'Hot Holding (Insulated)' },
];

const PROVIDER_TYPES = [
  { value: 'restaurant', label: 'Restaurant / Eatery' },
  { value: 'bakery', label: 'Bakery & Confectionery' },
  { value: 'mess', label: 'Hostel Mess / Cafeteria' },
];

export const SurplusDonationsPage: React.FC = () => {
  // Provider Identity & Location State (saved locally for ease of use)
  const [providerName, setProviderName] = useState(() => localStorage.getItem('sf_prov_name') || '');
  const [providerType, setProviderType] = useState<'restaurant' | 'bakery' | 'mess'>(
    () => (localStorage.getItem('sf_prov_type') as 'restaurant' | 'bakery' | 'mess') || 'restaurant'
  );
  const [pickupAddress, setPickupAddress] = useState(() => localStorage.getItem('sf_prov_addr') || '');

  // Food Batch Form State
  const [foodName, setFoodName] = useState('');
  const [foodCategory, setFoodCategory] = useState<FoodCategory>('Cooked Meals');
  const [dietaryType, setDietaryType] = useState<DietaryType>('Vegetarian');
  const [prepDateTime, setPrepDateTime] = useState('');
  const [peopleServed, setPeopleServed] = useState<number | ''>('');
  const [storageReq, setStorageReq] = useState<StorageRequirement>('Room Temperature');
  const [description, setDescription] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');

  // Status & List State
  const [donations, setDonations] = useState<IncomingDonation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default prep date/time to now (local datetime-local format)
  useEffect(() => {
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setPrepDateTime(localIso);
  }, []);

  // Save provider details in localStorage
  useEffect(() => {
    if (providerName) localStorage.setItem('sf_prov_name', providerName);
    if (providerType) localStorage.setItem('sf_prov_type', providerType);
    if (pickupAddress) localStorage.setItem('sf_prov_addr', pickupAddress);
  }, [providerName, providerType, pickupAddress]);

  // Fetch recent donations
  const loadDonations = async () => {
    setIsLoading(true);
    try {
      const data = await trip1Api.getProviderDonations();
      setDonations(data);
    } catch (err: unknown) {
      console.error('Failed to load donations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDonations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validation
    if (!providerName.trim()) {
      setErrorMessage('Please enter the Restaurant / Bakery / Establishment Name.');
      return;
    }
    if (!pickupAddress.trim()) {
      setErrorMessage('Please enter the physical pickup location address.');
      return;
    }
    if (!foodName.trim()) {
      setErrorMessage('Please enter the food item name.');
      return;
    }
    if (!prepDateTime) {
      setErrorMessage('Please specify the food preparation date and time.');
      return;
    }
    const servings = Number(peopleServed);
    if (!servings || servings <= 0) {
      setErrorMessage('Number of people served must be a positive number greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await trip1Api.createDonation({
        provider_name: providerName.trim(),
        provider_type: providerType,
        pickup_address: pickupAddress.trim(),
        food_name: foodName.trim(),
        food_category: foodCategory,
        dietary_type: dietaryType,
        preparation_date_time: new Date(prepDateTime).toISOString(),
        people_served: servings,
        storage_requirements: storageReq,
        description: description.trim() || undefined,
        pickup_notes: pickupNotes.trim() || undefined,
      });

      setSuccessMessage(
        `Surplus batch "${res.food_name}" (${res.people_served} servings) declared successfully for ${providerName}! Address geocoded & linked to Central Hub. Status: READY_FOR_PICKUP.`
      );

      // Reset food fields
      setFoodName('');
      setPeopleServed('');
      setDescription('');
      setPickupNotes('');
      // Reload list
      loadDonations();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail =
        errorObj.response?.data?.detail || errorObj.message || 'Failed to submit donation batch.';
      setErrorMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'READY_FOR_PICKUP':
        return 'emerald';
      case 'RESERVED_FOR_PICKUP':
        return 'blue';
      case 'PICKED_UP':
        return 'purple';
      case 'RECEIVED_AT_HUB':
        return 'slate';
      case 'AT_INVENTORY':
        return 'emerald';
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-950 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/40 text-emerald-200 text-xs font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Access Surplus Redistribution Portal</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Declare Surplus Food Donation</h1>
          <p className="mt-1 text-emerald-100 text-xs sm:text-sm max-w-xl">
            No registration or login needed. Enter your establishment name and address below — our system
            dynamically geocodes coordinates, assigns the nearest Central Hub, and routes pickup vehicles.
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-start md:items-end gap-1.5 text-xs text-emerald-200">
          <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dynamic Nearest Hub Assignment</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate max-w-xs">{pickupAddress || 'Direct Address Geocoding Active'}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Form on Left/Top, Donation History on Right/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-7">
          <Card
            title="Declare Surplus Food Batch"
            subtitle="Enter restaurant & meal details for automated collection"
          >
            {successMessage && (
              <Alert type="success" message={successMessage} className="mb-4" />
            )}
            {errorMessage && (
              <Alert type="error" message={errorMessage} className="mb-4" />
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Section 1: Provider Identity & Pickup Location */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Store className="w-4 h-4 text-emerald-600" />
                  <span>Establishment & Pickup Location Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Restaurant / Bakery / Mess Name"
                      name="provider_name"
                      required
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      placeholder="e.g. Sree Annapoorna / City Bakers"
                    />
                  </div>

                  <Select
                    label="Establishment Type"
                    name="provider_type"
                    value={providerType}
                    onChange={(e) => setProviderType(e.target.value as 'restaurant' | 'bakery' | 'mess')}
                    options={PROVIDER_TYPES}
                  />
                </div>

                <div>
                  <Input
                    label="Physical Pickup Address"
                    name="pickup_address"
                    required
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="e.g. 75 East Arokiasamy Road, R.S. Puram, Coimbatore, Tamil Nadu"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Our platform automatically converts this address to latitude & longitude coordinates.
                  </span>
                </div>
              </div>

              {/* Section 2: Food & Portions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Food Item / Batch Name"
                    name="food_name"
                    required
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    placeholder="e.g. Mixed Curry & Steamed Rice / Assorted Sandwiches"
                  />
                </div>

                <Select
                  label="Food Category"
                  name="food_category"
                  value={foodCategory}
                  onChange={(e) => setFoodCategory(e.target.value as FoodCategory)}
                  options={FOOD_CATEGORIES}
                />

                <Select
                  label="Dietary Classification"
                  name="dietary_type"
                  value={dietaryType}
                  onChange={(e) => setDietaryType(e.target.value as DietaryType)}
                  options={DIETARY_TYPES}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Preparation Date & Time"
                  name="prep_date_time"
                  type="datetime-local"
                  required
                  value={prepDateTime}
                  onChange={(e) => setPrepDateTime(e.target.value)}
                />

                <Input
                  label="People Served (Portion Count)"
                  name="people_served"
                  type="number"
                  min="1"
                  required
                  value={peopleServed}
                  onChange={(e) => setPeopleServed(e.target.value ? Number(e.target.value) : '')}
                  placeholder="e.g. 25"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Storage & Handling Requirement"
                  name="storage_requirements"
                  value={storageReq}
                  onChange={(e) => setStorageReq(e.target.value as StorageRequirement)}
                  options={STORAGE_OPTIONS}
                />

                <Input
                  label="Pickup Instructions / Notes"
                  name="pickup_notes"
                  value={pickupNotes}
                  onChange={(e) => setPickupNotes(e.target.value)}
                  placeholder="e.g. Rear kitchen entrance / loading bay"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Food Description / Packaging Details (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Cleanly portioned in 5 sealed thermal containers, prepared for evening shift."
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Safety notice */}
              <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-xs text-emerald-800">
                <Info className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>
                  Clicking <strong>READY FOR DONATION</strong> indicates the surplus food is packed, hygienically stored, and awaiting collection. Status initializes as <code>READY_FOR_PICKUP</code>.
                </span>
              </div>

              {/* Prominent Action Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                className="w-full py-3 text-sm font-bold shadow-md hover:shadow-lg uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                READY FOR DONATION
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Active & Recent Submissions */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            title="Surplus Postings"
            subtitle={`Declared Batches (${donations.length})`}
            action={
              <button
                onClick={loadDonations}
                disabled={isLoading}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
              >
                Refresh
              </button>
            }
          >
            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading postings...</div>
            ) : donations.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p>No surplus food donations recorded yet.</p>
                <p className="mt-1">Submit your first batch using the form.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {donations.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-colors shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          {d.food_name}
                        </h4>
                        <span className="text-[11px] text-emerald-700 font-medium">
                          {d.provider_name || 'Food Provider'} &bull; {d.food_category}
                        </span>
                      </div>
                      <Badge variant={getStatusBadgeVariant(d.status)}>
                        {d.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    {d.pickup_address && (
                      <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{d.pickup_address}</span>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span><strong>{d.people_served}</strong> Portions</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <ThermometerSnowflake className="w-3.5 h-3.5 text-blue-500" />
                        <span className="truncate">{d.storage_requirements}</span>
                      </div>
                    </div>

                    {d.pickup_notes && (
                      <p className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                        Note: {d.pickup_notes}
                      </p>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Declared: {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
                      {d.pickup_run_id ? (
                        <span className="font-mono text-emerald-700 font-semibold">Trip Assigned</span>
                      ) : (
                        <span className="text-amber-600">Awaiting Aggregation</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
