export type CheckStatus = 'EMPTY' | 'DEFICIT' | 'EXCEEDS_GRACE' | 'MATCH';

export interface HubItem {
  id: string;
  organization_name: string;
  address: string;
  phone_number?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number | null;
  available_portions: number;
  package_count: number;
}

export interface AllocatedPackageInfo {
  id: string;
  original_donation_id?: string;
  food_name: string;
  provider_name?: string;
  people_served: number;
  predicted_remaining_hours: number;
  feasibility_score: number;
  storage_requirements?: string;
  food_category?: string;
}

export interface FoodRequestCheckPayload {
  hub_id: string;
  requested_portions: number;
}

export interface FoodRequestCheckResponse {
  status: CheckStatus;
  hub_id: string;
  requested_portions: number;
  available_portions: number;
  matched_portions: number;
  packages: AllocatedPackageInfo[];
  package_ids: string[];
  message: string;
}

export interface CreateNgoOrderPayload {
  hub_id: string;
  requested_portions: number;
  confirmed_portions: number;
  package_ids: string[];
}

export interface NgoOrderResponse {
  id: string;
  order_number: string;
  hub_id: string;
  hub_name: string;
  hub_address: string;
  hub_coordinates: [number, number];
  ngo_id: string;
  ngo_name: string;
  ngo_address: string;
  ngo_coordinates: [number, number];
  total_people_served: number;
  package_ids: string[];
  packages: Array<{
    id: string;
    original_donation_id?: string;
    food_name: string;
    provider_name?: string;
    people_served: number;
    predicted_remaining_hours?: number;
    feasibility_score?: number;
    sensor_temperature?: number;
    sensor_humidity?: number;
    mq_raw?: number;
    fsr_raw?: number;
  }>;
  assigned_vehicle?: {
    id: string;
    type: string;
    capacity: number;
  };
  route_geometry?: {
    type: string;
    coordinates: number[][];
  };
  total_distance_meters?: number;
  total_duration_seconds?: number;
  status: string;
  simulation_status: string;
  created_at: string;
  dispatched_at?: string;
  delivered_at?: string;
}

export interface DeliveryHistoryItem {
  id: string;
  order_id: string;
  order_number: string;
  hub_id: string;
  hub_name: string;
  hub_address: string;
  ngo_id: string;
  ngo_name: string;
  ngo_address: string;
  total_people_served: number;
  vehicle_type: string;
  packages: Array<{
    id: string;
    original_donation_id?: string;
    food_name: string;
    provider_name?: string;
    people_served: number;
    predicted_remaining_hours?: number;
    feasibility_score?: number;
  }>;
  delivered_at: string;
  created_at: string;
}
