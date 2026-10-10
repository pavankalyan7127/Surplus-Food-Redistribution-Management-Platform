import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Utensils,
  Truck,
  Leaf,
  ShieldCheck,
  Clock,
  BarChart3,
  CheckCircle2,
  Building2,
  HeartHandshake,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Card } from '../../components/common/Card';

export const ProviderLoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const successMessage = (location.state as { registered?: boolean })?.registered
    ? 'Provider account created successfully! Please log in.'
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login({
        email,
        password,
        expected_role: 'provider',
      });
      navigate('/provider/dashboard', { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials.');
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
              to="/signup/provider"
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              Register Establishment
            </Link>
          </div>
        </div>
      </header>

      {/* Main Landing & Login Split Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Landing Page & Value Proposition */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
            <Leaf className="w-3.5 h-3.5 text-emerald-600" />
            <span>Dedicated Food Provider Hub</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Divert Surplus Food. <br />
            <span className="text-emerald-600">Feed Communities,</span> Not Landfills.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
            Connect your restaurant, bakery, or hostel mess directly with smart collection hubs. List excess edible meals in seconds, schedule hassle-free vehicle pickups, and track your sustainable community impact.
          </p>

          {/* Key Provider Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Trip Type 1 Pickups</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Smart cluster routing dispatches hub vehicles straight to your kitchen door.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Flexible Shift Windows</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Post surplus whenever shifts end—breakfast, lunch, or late-night closing.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Verified Hub Handover</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  All donations are temperature-logged and safely transferred to cold storage.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Sustainability Metrics</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Track total meals saved, weight diverted, and CO₂ emissions prevented.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-2">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Restaurants & Bistros
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Bakeries & Cafes
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Hostel & College Messes
            </span>
          </div>
        </div>

        {/* Right Column: Embedded Provider Login Card */}
        <div className="lg:col-span-5">
          <Card className="shadow-lg border-emerald-100 max-w-md mx-auto w-full">
            <div className="mb-6">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center mb-3">
                <Utensils className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Provider Sign In</h2>
              <p className="text-xs text-slate-500 mt-1">
                Access your dashboard to post food surplus and track pickups.
              </p>
            </div>

            {successMessage && (
              <Alert type="success" message={successMessage} className="mb-5" />
            )}
            {error && <Alert type="error" message={error} className="mb-5" />}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Registered Email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chef@restaurant.com"
              />

              <Input
                label="Password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={isLoading}
              >
                Sign In to Provider Portal
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-3">
              <p className="text-xs text-slate-600">
                New food establishment?{' '}
                <Link
                  to="/signup/provider"
                  className="font-bold text-emerald-600 hover:text-emerald-700 underline"
                >
                  Create Provider Account
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
