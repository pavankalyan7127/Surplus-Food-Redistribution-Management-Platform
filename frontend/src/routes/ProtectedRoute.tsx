import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/auth';
import { Spinner } from '../components/common/Spinner';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRole,
}) => {
  const { user, role, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" label="Authenticating session..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Redirect unauthenticated user to their specific login page
    const loginTarget = allowedRole ? `/login/${allowedRole}` : '/';
    return <Navigate to={loginTarget} state={{ from: location }} replace />;
  }

  if (allowedRole && role !== allowedRole) {
    // Authenticated, but role does not match the route requirement
    return <Navigate to="/unauthorized" replace state={{ expectedRole: allowedRole, actualRole: role }} />;
  }

  return children;
};
