import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage';
import { ProviderLoginPage } from '../pages/auth/ProviderLoginPage';
import { ProviderSignupPage } from '../pages/auth/ProviderSignupPage';
import { HubLoginPage } from '../pages/auth/HubLoginPage';
import { NgoLoginPage } from '../pages/auth/NgoLoginPage';
import { NgoSignupPage } from '../pages/auth/NgoSignupPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProviderDashboard } from '../pages/provider/ProviderDashboard';
import { HubDashboard } from '../pages/hub/HubDashboard';
import { NgoDashboard } from '../pages/ngo/NgoDashboard';
import { ProtectedRoute } from './ProtectedRoute';
import { UnauthorizedPage } from '../pages/Unauthorized';
import { NotFoundPage } from '../pages/NotFound';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />

      {/* Role-Specific Login & Signup Entry Points */}
      <Route path="/login/provider" element={<ProviderLoginPage />} />
      <Route path="/signup/provider" element={<ProviderSignupPage />} />

      <Route path="/login/hub" element={<HubLoginPage />} />

      <Route path="/login/ngo" element={<NgoLoginPage />} />
      <Route path="/signup/ngo" element={<NgoSignupPage />} />

      {/* Protected Dashboards wrapped with DashboardLayout */}
      <Route element={<DashboardLayout />}>
        <Route
          path="/provider/dashboard"
          element={
            <ProtectedRoute allowedRole="provider">
              <ProviderDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hub/dashboard"
          element={
            <ProtectedRoute allowedRole="hub">
              <HubDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ngo/dashboard"
          element={
            <ProtectedRoute allowedRole="ngo">
              <NgoDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Access Errors & 404 */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
