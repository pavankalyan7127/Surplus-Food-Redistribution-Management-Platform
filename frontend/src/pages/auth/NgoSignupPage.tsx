import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HeartHandshake,
  Truck,
  UtensilsCrossed,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Utensils,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Card } from '../../components/common/Card';

export const NgoSignupPage: React.FC = () => {
  const { signupNgo } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    organization_name: '',
    contact_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    address: '',
    estimated_daily_meal_demand: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

    const demandNum = formData.estimated_daily_meal_demand
      ? parseInt(formData.estimated_daily_meal_demand, 10)
      : undefined;

    if (demandNum !== undefined && (isNaN(demandNum) || demandNum <= 0)) {
      setError('Estimated daily meal demand must be a positive number.');
      return;
    }

    setIsLoading(true);
    try {
      await signupNgo({
        organization_name: formData.organization_name,
        contact_name: formData.contact_name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        estimated_daily_meal_demand: demandNum,
      });

      navigate('/login/ngo', { state: { registered: true } });
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
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg leading-tight block">
                NGO Relief Portal
              </span>
              <span className="text-xs text-purple-700 font-medium">
                Surplus Food Redistribution Network
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <Link
              to="/login/provider"
              className="hidden sm:inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Utensils className="w-3.5 h-3.5 mr-1" />
              Provider Login
            </Link>
            <span className="hidden sm:inline text-slate-300">|</span>
            <Link
              to="/login/hub"
              className="hidden sm:inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 mr-1" />
              Hub Login
            </Link>
            <Link
              to="/login/ngo"
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors shadow-sm"
            >
              NGO Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Landing & Signup Split Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Landing Content */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">
            <UtensilsCrossed className="w-3.5 h-3.5 text-purple-600" />
            <span>Zero Cost Relief Partnership</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Register Your NGO. <br />
            <span className="text-purple-600">Access Free Surplus</span> Meals For All.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Join the hunger relief alliance. Registering your organization gives your volunteers access to centralized hub inventory, scheduled meal deliveries, and emergency food rations.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-slate-900 block font-semibold">100% Free Food Allocations</strong>
                <span className="text-slate-500">All surplus food is provided free of charge to verified charitable institutions.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <Truck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-slate-900 block font-semibold">Trip Type 2 Delivery to Your Facility</strong>
                <span className="text-slate-500">Scheduled vehicle dispatches bring food right to your distribution gates.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="text-slate-900 block font-semibold">Quality & Temperature Inspected</strong>
                <span className="text-slate-500">Cold chain verified through IoT monitoring to guarantee edible safety.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Embedded NGO Signup Form */}
        <div className="lg:col-span-7">
          <Card className="shadow-lg border-purple-100 max-w-xl mx-auto w-full">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">NGO Partner Registration</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register your relief organization to start receiving food allocations.
              </p>
            </div>

            {error && <Alert type="error" message={error} className="mb-4" />}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="Organization / NGO Name"
                  name="organization_name"
                  required
                  value={formData.organization_name}
                  onChange={handleChange}
                  placeholder="e.g. Hope Relief Kitchen"
                />

                <Input
                  label="Contact Person Name"
                  name="contact_name"
                  required
                  value={formData.contact_name}
                  onChange={handleChange}
                  placeholder="e.g. David Chen"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="david@hoperelief.org"
                />

                <Input
                  label="Contact Phone"
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 555-0202"
                />
              </div>

              <Input
                label="Delivery Address (Drop-off Location)"
                name="address"
                required
                value={formData.address}
                onChange={handleChange}
                placeholder="88 Shelter Ave, Downtown, City"
              />

              <Input
                label="Estimated Daily Meal Demand (Optional)"
                name="estimated_daily_meal_demand"
                type="number"
                min="1"
                value={formData.estimated_daily_meal_demand}
                onChange={handleChange}
                placeholder="e.g. 250 meals/day"
                helperText="Helps smart hubs balance surplus allocations across local community partners"
              />

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
                className="w-full mt-2 bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
                isLoading={isLoading}
              >
                Complete NGO Registration
              </Button>
            </form>

            <div className="mt-5 pt-3 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                Already registered?{' '}
                <Link
                  to="/login/ngo"
                  className="font-bold text-purple-600 hover:text-purple-700 underline"
                >
                  Sign in to NGO Portal
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Surplus Food Redistribution & Smart Hub Platform &bull; NGO Relief Network
      </footer>
    </div>
  );
};
