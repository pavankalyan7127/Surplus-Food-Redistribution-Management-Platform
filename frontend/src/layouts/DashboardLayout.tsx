import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Sparkles,
  Building2,
  Layers,
  Truck,
  HeartHandshake,
  UserCheck,
  History,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/common/Badge';

export const DashboardLayout: React.FC = () => {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getRoleConfig = () => {
    switch (role) {
      case 'provider':
        return {
          title: 'Food Provider Portal',
          badgeVariant: 'emerald' as const,
          label: 'Food Provider',
          homePath: '/provider/surplus-donations',
          navItems: [
            { label: 'Surplus Donations', path: '/provider/surplus-donations', icon: Sparkles, badge: 'Trip 1' },
            { label: 'Track Order', path: '/provider/track-order', icon: Navigation, badge: 'Live' },
          ],
        };
      case 'hub':
        return {
          title: 'Smart Hub Command',
          badgeVariant: 'blue' as const,
          label: 'Hub Admin',
          homePath: '/hub/dashboard',
          navItems: [
            { label: 'Overview', path: '/hub/dashboard', icon: LayoutDashboard },
            { label: 'Incoming Collections', path: '/hub/incoming-collections', icon: Truck, badge: 'Trip 1' },
            { label: 'Inventory', path: '/hub/inventory-staging', icon: Layers },
            { label: 'View NGO Orders', path: '/hub/ngo-orders', icon: HeartHandshake, badge: 'Trip 2' },
            { label: 'Delivery History', path: '/hub/history', icon: History },
          ],
        };
      case 'ngo':
        return {
          title: 'NGO Relief Portal',
          badgeVariant: 'purple' as const,
          label: 'NGO Partner',
          homePath: '/ngo/dashboard',
          navItems: [
            { label: 'Overview', path: '/ngo/dashboard', icon: LayoutDashboard },
            { label: 'Food Requests', path: '/ngo/food-requests', icon: HeartHandshake, badge: 'Trip 2' },
            { label: 'Dispatch Tracking', path: '/ngo/dispatch-tracking', icon: Truck, badge: 'Live' },
            { label: 'Order History', path: '/ngo/history', icon: History },
          ],
        };
      default:
        if (location.pathname.startsWith('/provider')) {
          return {
            title: 'Food Provider Portal',
            badgeVariant: 'emerald' as const,
            label: 'Food Provider (Open Access)',
            homePath: '/provider/surplus-donations',
            navItems: [
              { label: 'Surplus Donations', path: '/provider/surplus-donations', icon: Sparkles, badge: 'Trip 1' },
              { label: 'Track Order', path: '/provider/track-order', icon: Navigation, badge: 'Live' },
            ],
          };
        }
        return {
          title: 'Surplus Food Platform',
          badgeVariant: 'slate' as const,
          label: 'User',
          homePath: '/',
          navItems: [],
        };
    }
  };

  const roleConfig = getRoleConfig();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to={roleConfig.homePath} className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-sm">
                SF
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base leading-tight block">
                  Surplus Food Platform
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {roleConfig.title}
                </span>
              </div>
            </Link>
            <div className="hidden sm:block ml-3 pl-3 border-l border-slate-200">
              <Badge variant={roleConfig.badgeVariant}>{roleConfig.label}</Badge>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="hidden md:flex items-center space-x-2 text-right">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 leading-none">
                      {user.organization_name || user.contact_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{user.email}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                to="/"
                className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
              >
                <span>&larr; Platform Home</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-60 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Navigation
            </div>
            {roleConfig.navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-100 px-3">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">
                  {location.pathname.startsWith('/provider')
                    ? 'Food Provider (Open Access)'
                    : user?.organization_name || 'Portal'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Dashboard Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Surplus Food Redistribution & Smart Hub Platform &bull; 24-Hour HackFest 2026
      </footer>
    </div>
  );
};
