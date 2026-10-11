import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage';
import { HubLoginPage } from '../pages/auth/HubLoginPage';
import { NgoLoginPage } from '../pages/auth/NgoLoginPage';
import { NgoSignupPage } from '../pages/auth/NgoSignupPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { HubDashboard } from '../pages/hub/HubDashboard';
import { NgoDashboard } from '../pages/ngo/NgoDashboard';
import { SurplusDonationsPage } from '../pages/provider/SurplusDonationsPage';
import { IncomingCollectionsPage } from '../pages/hub/IncomingCollectionsPage';
import { InventoryStagingPage } from '../pages/hub/InventoryStagingPage';
import { ProtectedRoute } from './ProtectedRoute';
import { UnauthorizedPage } from '../pages/Unauthorized';
import { NotFoundPage } from '../pages/NotFound';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />

      {/* Food Provider Open-Access Redirects (Login / Signup completely removed) */}
      <Route path="/login/provider" element={<Navigate to="/provider/surplus-donations" replace />} />
      <Route path="/signup/provider" element={<Navigate to="/provider/surplus-donations" replace />} />
      <Route path="/provider/dashboard" element={<Navigate to="/provider/surplus-donations" replace />} />

      {/* Role-Specific Login & Signup Entry Points for Hub & NGO */}
      <Route path="/login/hub" element={<HubLoginPage />} />

      <Route path="/login/ngo" element={<NgoLoginPage />} />
      <Route path="/signup/ngo" element={<NgoSignupPage />} />

      {/* Dashboards wrapped with DashboardLayout */}
      <Route element={<DashboardLayout />}>
        {/* Open-Access Food Provider Donation Route */}
        <Route path="/provider/surplus-donations" element={<SurplusDonationsPage />} />

        <Route
          path="/hub/dashboard"
          element={
            <ProtectedRoute allowedRole="hub">
              <HubDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hub/incoming-collections"
          element={
            <ProtectedRoute allowedRole="hub">
              <IncomingCollectionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hub/inventory-staging"
          element={
            <ProtectedRoute allowedRole="hub">
              <InventoryStagingPage />
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
