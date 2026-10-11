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
import { TrackOrderPage } from '../pages/provider/TrackOrderPage';
import { IncomingCollectionsPage } from '../pages/hub/IncomingCollectionsPage';
import { InventoryStagingPage } from '../pages/hub/InventoryStagingPage';
import { ViewNgoOrdersPage } from '../pages/hub/ViewNgoOrdersPage';
import { DeliveryHistoryPage } from '../pages/hub/DeliveryHistoryPage';
import { FoodRequestsPage } from '../pages/ngo/FoodRequestsPage';
import { DispatchTrackingPage } from '../pages/ngo/DispatchTrackingPage';
import { NgoHistoryPage } from '../pages/ngo/NgoHistoryPage';
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
        {/* Open-Access Food Provider Routes */}
        <Route path="/provider/surplus-donations" element={<SurplusDonationsPage />} />
        <Route path="/provider/track-order" element={<TrackOrderPage />} />

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
          path="/hub/ngo-orders"
          element={
            <ProtectedRoute allowedRole="hub">
              <ViewNgoOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hub/history"
          element={
            <ProtectedRoute allowedRole="hub">
              <DeliveryHistoryPage />
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
        <Route
          path="/ngo/food-requests"
          element={
            <ProtectedRoute allowedRole="ngo">
              <FoodRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ngo/dispatch-tracking"
          element={
            <ProtectedRoute allowedRole="ngo">
              <DispatchTrackingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ngo/history"
          element={
            <ProtectedRoute allowedRole="ngo">
              <NgoHistoryPage />
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
