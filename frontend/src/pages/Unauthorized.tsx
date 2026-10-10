import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldX, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/common/Button';

export const UnauthorizedPage: React.FC = () => {
  const { user, role } = useAuth();
  const location = useLocation();
  const state = location.state as { expectedRole?: string; actualRole?: string } | null;

  const getDashboardPath = () => {
    switch (role) {
      case 'provider':
        return '/provider/dashboard';
      case 'hub':
        return '/hub/dashboard';
      case 'ngo':
        return '/ngo/dashboard';
      default:
        return '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <ShieldX className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Access Restricted (403)</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Your current account does not have permission to view this section of the platform.
        </p>

        {state?.expectedRole && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
            <p>
              Required Role: <strong className="uppercase">{state.expectedRole}</strong>
            </p>
            <p className="mt-1">
              Your Role: <strong className="uppercase">{user?.role || 'Guest'}</strong>
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {user && (
            <Link to={getDashboardPath()}>
              <Button variant="primary" className="w-full">
                Go to Your {role ? role.toUpperCase() : ''} Dashboard
              </Button>
            </Link>
          )}
          <Link to="/">
            <Button variant="outline" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Return to Platform Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
