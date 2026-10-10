import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Utensils,
  Truck,
  Leaf,
  ShieldCheck,
  CheckCircle2,
  Building2,
  HeartHandshake,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Card } from '../../components/common/Card';
import { ProviderType } from '../../types/auth';
import { trip1Api } from '../../api/trip1';

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant / Eatery' },
  { value: 'bakery', label: 'Bakery / Pastry Shop' },
  { value: 'hostel_mess', label: 'Hostel Mess / College Dining' },
  { value: 'other', label: 'Other Food Establishment' },
];

export const ProviderSignupPage: React.FC = () => {
  const { signupProvider } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    organization_name: '',
    contact_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    address: '',
    provider_type: 'restaurant' as ProviderType,
  });

  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);
  const [showManualPin, setShowManualPin] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleVerifyLocation = async () => {
    if (!formData.address.trim()) {
      setError('Please enter an address before verifying location.');
      return;
    }
    setIsGeocoding(true);
    setGeocodeMessage(null);
    try {
      const res = await trip1Api.geocodePreview(formData.address.trim());
      if (res.found && res.latitude !== null && res.longitude !== null) {
        setLatitude(res.latitude);
        setLongitude(res.longitude);
        setShowManualPin(true);
        setGeocodeMessage(
          `Location successfully resolved: Latitude ${res.latitude.toFixed(6)}, Longitude ${res.longitude.toFixed(6)}`
        );
      } else {
        setGeocodeMessage(
          'Address could not be automatically pinpointed. You can enter precise coordinates manually below.'
        );
        setShowManualPin(true);
      }
    } catch {
      setGeocodeMessage(
        'Geocoding lookup unavailable. Please specify coordinates manually.'
      );
      setShowManualPin(true);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await signupProvider({
        organization_name: formData.organization_name,
        contact_name: formData.contact_name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        provider_type: formData.provider_type,
        latitude: latitude !== '' ? Number(latitude) : undefined,
        longitude: longitude !== '' ? Number(longitude) : undefined,
      });

      navigate('/login/provider', { state: { registered: true } });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed. Please check the provided information.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg leading-tight block">
                Food Provider Portal
              </span>
              <span className="text-xs text-emerald-700 font-medium">
                Surplus Food Redistribution Network
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <Link
              to="/login/hub"
              className="hidden sm:inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 mr-1" />
              Hub Login
            </Link>
            <span className="hidden sm:inline text-slate-300">|</span>
            <Link
              to="/login/ngo"
              className="hidden sm:inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <HeartHandshake className="w-3.5 h-3.5 mr-1" />
              NGO Login
            </Link>
            <Link
              to="/login/provider"
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Provider Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Landing & Signup Split Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Landing Content */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
            <Leaf className="w-3.5 h-3.5 text-emerald-600" />
            <span>Join 100+ Commercial Kitchens</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Register Your Establishment. <br />
            <span className="text-emerald-600">Zero Waste</span> Starts in Your Kitchen.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Registering takes under 2 minutes. Once joined, your kitchen can list surplus cooked meals or fresh perishables for automated collection to regional hubs.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-slate-900 block font-semibold">Zero Cost, Full Transparency</strong>
                <span className="text-slate-500">Free to join. Hub vehicles handle collection and distribution logistics.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <Truck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-slate-900 block font-semibold">Trip Type 1 Inbound Logistics</strong>
                <span className="text-slate-500">Pickups scheduled promptly based on your kitchen's closing or shift hours.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-slate-900 block font-semibold">Strict Food Quality Assurance</strong>
                <span className="text-slate-500">Cold-chain handling ensures food safety standards are respected at every stage.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Embedded Provider Signup Form */}
        <div className="lg:col-span-7">
          <Card className="shadow-lg border-emerald-100 max-w-xl mx-auto w-full">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">Establishment Registration</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter your business details to start listing surplus food donations.
              </p>
            </div>

            {error && <Alert type="error" message={error} className="mb-4" />}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="Establishment Name"
                  name="organization_name"
                  required
                  value={formData.organization_name}
                  onChange={handleChange}
                  placeholder="e.g. Green Tree Cafe"
                />

                <Select
                  label="Provider Type"
                  name="provider_type"
                  required
                  value={formData.provider_type}
                  onChange={handleChange}
                  options={PROVIDER_TYPES}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="Contact Person Name"
                  name="contact_name"
                  required
                  value={formData.contact_name}
                  onChange={handleChange}
                  placeholder="e.g. Maria Rossi"
                />

                <Input
                  label="Contact Phone"
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 555-0101"
                />
              </div>

              <Input
                label="Email Address"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@greentreecafe.com"
              />

              <div>
                <Input
                  label="Physical Address (Pickup Location)"
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="123 Market Square, Suite 4B, City"
                />

                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleVerifyLocation}
                    disabled={isGeocoding || !formData.address.trim()}
                    className="text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{isGeocoding ? 'Resolving Coordinates...' : 'Verify & Geocode Address'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManualPin(!showManualPin)}
                    className="text-slate-500 hover:text-slate-700 underline text-[11px]"
                  >
                    {showManualPin ? 'Hide Coordinate Controls' : 'Adjust Pin / Coordinates'}
                  </button>
                </div>

                {geocodeMessage && (
                  <p
                    className={`mt-1.5 text-xs p-2 rounded border ${
                      latitude !== ''
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {geocodeMessage}
                  </p>
                )}

                {showManualPin && (
                  <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={latitude}
                        onChange={(e) =>
                          setLatitude(e.target.value ? Number(e.target.value) : '')
                        }
                        placeholder="e.g. 13.0827"
                        className="w-full text-xs rounded border border-slate-300 px-2 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={longitude}
                        onChange={(e) =>
                          setLongitude(e.target.value ? Number(e.target.value) : '')
                        }
                        placeholder="e.g. 80.2707"
                        className="w-full text-xs rounded border border-slate-300 px-2 py-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="Password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min 6 characters"
                />

                <Input
                  label="Confirm Password"
                  name="confirm_password"
                  type="password"
                  required
                  value={formData.confirm_password}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
              >
                Complete Provider Registration
              </Button>
            </form>

            <div className="mt-5 pt-3 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                Already registered?{' '}
                <Link
                  to="/login/provider"
                  className="font-bold text-emerald-600 hover:text-emerald-700 underline"
                >
                  Sign in to Provider Portal
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Surplus Food Redistribution & Smart Hub Platform &bull; Provider Network
      </footer>
    </div>
  );
};
