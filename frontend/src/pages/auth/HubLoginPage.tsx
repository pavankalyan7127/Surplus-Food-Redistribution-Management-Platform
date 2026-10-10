import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Activity,
  Layers,
  Truck,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  Utensils,
  HeartHandshake,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Card } from '../../components/common/Card';

export const HubLoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        expected_role: 'hub',
      });
      navigate('/hub/dashboard', { replace: true });
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
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg leading-tight block">
                Smart Hub Operations
              </span>
              <span className="text-xs text-blue-700 font-medium">
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
              to="/login/ngo"
              className="hidden sm:inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <HeartHandshake className="w-3.5 h-3.5 mr-1" />
              NGO Login
            </Link>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              Admin Access Only
            </span>
          </div>
        </div>
      </header>

      {/* Main Landing & Login Split Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left Column: Hub Operations Landing Page & Infrastructure Features */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Centralized Storage & IoT Monitoring Command</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Intelligent Logistics. <br />
            <span className="text-blue-600">Cold Chain IoT,</span> Controlled Inventory.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
            The neural center of the surplus food redistribution ecosystem. Monitor inbound provider collection batches, oversee cold room temperature telemetry, stage sorted inventory, and orchestrate outbound NGO relief dispatches.
          </p>

          {/* Key Hub Infrastructure Capabilities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Dual-Tier Fleet Tracking</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Real-time status for Trip 1 (Inbound Collections) & Trip 2 (Outbound Dispatches).
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Real-Time IoT Telemetry</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Live sensor streaming for storage temperature, humidity, and volatile gas detection.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">FIFO Inventory Staging</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Perishable shelf-life monitoring ensures oldest quality batches are dispatched first.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Quality Compliance Audit</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Cryptographically verified custody handoffs between food donors, hub, and NGOs.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-2">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> Multi-Chamber Cold Storage
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> Live MQTT Sensor Feeds
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> Automated Fleet Dispatch
            </span>
          </div>
        </div>

        {/* Right Column: Embedded Hub Admin Login Card */}
        <div className="lg:col-span-5">
          <Card className="shadow-lg border-blue-100 max-w-md mx-auto w-full">
            <div className="mb-6">
              <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center mb-3">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Hub Admin Sign In</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your administrative credentials to access hub command and telemetry.
              </p>
            </div>

            {error && <Alert type="error" message={error} className="mb-5" />}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Admin Email Address"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hub.admin@surplusfood.org"
              />

              <Input
                label="Admin Password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
              />

              <Button
                type="submit"
                variant="secondary"
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white"
                isLoading={isLoading}
              >
                Authenticate Hub Admin
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Hub Facility Operations &bull; Restricted Access
              </p>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Surplus Food Redistribution & Smart Hub Platform &bull; Smart Hub Operations
      </footer>
    </div>
  );
};
