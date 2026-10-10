import { apiClient } from './client';
import { IncomingDonation } from '../types/trip1';

export interface FeasibilityBreakdown {
  temperature_score: number;
  humidity_score: number;
  mq_score: number;
  fsr_score: number;
  composite_score: number;
}

export interface InventoryItem {
  id: string;
  original_donation_id: string;
  provider_id: string;
  hub_id: string;
  provider_name?: string;
  provider_address?: string;
  provider_coordinates?: [number, number];
  food_name: string;
  description?: string;
  food_category: string;
  dietary_type: string;
  preparation_date_time: string;
  people_served: number;
  storage_requirements: string;
  pickup_notes?: string;
  safety_deadline?: string;
  pickup_run_id?: string;
  picked_up_at?: string;
  received_at_hub_at?: string;
  original_created_at?: string;
  original_updated_at?: string;
  sensor_temperature: number;
  sensor_humidity: number;
  mq_raw: number;
  fsr_raw: number;
  uptime_seconds?: number;
  feasibility_score: number;
  feasibility_breakdown?: FeasibilityBreakdown;
  predicted_remaining_hours: number;
  food_tested_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const inventoryApi = {
  // Get all arrived donations pending food testing at the hub
  getInventoryStaging: async (): Promise<IncomingDonation[]> => {
    const response = await apiClient.get<IncomingDonation[]>('/inventory/staging');
    return response.data;
  },

  // Run full food testing workflow: sensors -> feasibility score -> Gemini AI -> inventory
  runFoodTest: async (donationId: string): Promise<InventoryItem> => {
    const response = await apiClient.post<InventoryItem>(`/inventory/test/${donationId}`);
    return response.data;
  },

  // Get persisted inventory items for this hub
  getInventoryList: async (): Promise<InventoryItem[]> => {
    const response = await apiClient.get<InventoryItem[]>('/inventory');
    return response.data;
  },

  // Get details of a single inventory item
  getInventoryDetail: async (inventoryId: string): Promise<InventoryItem> => {
    const response = await apiClient.get<InventoryItem>(`/inventory/${inventoryId}`);
    return response.data;
  },
};
