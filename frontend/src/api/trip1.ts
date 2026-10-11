import { apiClient } from './client';
import {
  CreateDonationPayload,
  DonationTrackingResponse,
  HubSummary,
  IncomingDonation,
  PickupRun,
  Vehicle,
} from '../types/trip1';

export const trip1Api = {
  // Donations
  createDonation: async (payload: CreateDonationPayload): Promise<IncomingDonation> => {
    const res = await apiClient.post<IncomingDonation>('/donations', payload);
    return res.data;
  },

  getProviderDonations: async (): Promise<IncomingDonation[]> => {
    const res = await apiClient.get<IncomingDonation[]>('/donations/provider');
    return res.data;
  },

  getHubDonations: async (statusFilter?: string): Promise<IncomingDonation[]> => {
    const params = statusFilter ? { status_filter: statusFilter } : {};
    const res = await apiClient.get<IncomingDonation[]>('/donations/hub', { params });
    return res.data;
  },

  getHubSummary: async (): Promise<HubSummary> => {
    const res = await apiClient.get<HubSummary>('/donations/hub/summary');
    return res.data;
  },

  // Trips & Simulation
  planPickupTrip: async (force: boolean = false): Promise<PickupRun> => {
    const res = await apiClient.post<PickupRun>('/trips/plan-pickup', { force });
    return res.data;
  },

  getActivePickupTrip: async (): Promise<{ has_active_run: boolean; run: PickupRun | null }> => {
    const res = await apiClient.get<{ has_active_run: boolean; run: PickupRun | null }>(
      '/trips/active'
    );
    return res.data;
  },

  startSimulation: async (runId: string): Promise<PickupRun> => {
    const res = await apiClient.post<PickupRun>(`/trips/${runId}/start`);
    return res.data;
  },

  pauseSimulation: async (runId: string): Promise<PickupRun> => {
    const res = await apiClient.post<PickupRun>(`/trips/${runId}/pause`);
    return res.data;
  },

  resumeSimulation: async (runId: string): Promise<PickupRun> => {
    const res = await apiClient.post<PickupRun>(`/trips/${runId}/resume`);
    return res.data;
  },

  completeStop: async (runId: string, stopIndex: number): Promise<PickupRun> => {
    const res = await apiClient.post<PickupRun>(`/trips/${runId}/stop/${stopIndex}/complete`);
    return res.data;
  },

  completeTrip: async (runId: string): Promise<PickupRun> => {
    const res = await apiClient.post<PickupRun>(`/trips/${runId}/complete`);
    return res.data;
  },

  // Hub Fleet & Location
  updateHubLocation: async (payload: {
    address: string;
    latitude?: number;
    longitude?: number;
  }) => {
    const res = await apiClient.put('/hubs/location', payload);
    return res.data;
  },

  getHubVehicles: async (): Promise<Vehicle[]> => {
    const res = await apiClient.get<Vehicle[]>('/hubs/vehicles');
    return res.data;
  },

  seedHubVehicles: async (): Promise<Vehicle[]> => {
    const res = await apiClient.post<Vehicle[]>('/hubs/vehicles/seed');
    return res.data;
  },

  // Geocode Preview
  geocodePreview: async (
    address: string
  ): Promise<{ found: boolean; address: string; latitude: number | null; longitude: number | null }> => {
    const res = await apiClient.get('/auth/geocode', { params: { address } });
    return res.data;
  },

  // Open-Access Food Provider Tracking
  trackDonation: async (donationId: string): Promise<DonationTrackingResponse> => {
    const res = await apiClient.get<DonationTrackingResponse>(`/donations/track/${donationId}`);
    return res.data;
  },

  requestDonationDispatch: async (donationId: string): Promise<DonationTrackingResponse> => {
    const res = await apiClient.post<DonationTrackingResponse>(`/donations/track/${donationId}/request-dispatch`);
    return res.data;
  },

  startDonationSimulation: async (donationId: string): Promise<DonationTrackingResponse> => {
    const res = await apiClient.post<DonationTrackingResponse>(`/donations/track/${donationId}/start-simulation`);
    return res.data;
  },

  completeDonationStop: async (donationId: string): Promise<DonationTrackingResponse> => {
    const res = await apiClient.post<DonationTrackingResponse>(`/donations/track/${donationId}/complete-stop`);
    return res.data;
  },
};

