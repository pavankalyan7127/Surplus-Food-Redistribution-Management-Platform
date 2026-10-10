export type DonationStatus =
  | 'READY_FOR_PICKUP'
  | 'RESERVED_FOR_PICKUP'
  | 'PICKED_UP'
  | 'RECEIVED_AT_HUB'
  | 'ARRIVED_AT_HUB'
  | 'FOOD_TESTING_IN_PROGRESS'
  | 'AT_INVENTORY'
  | 'CANCELLED'
  | 'EXPIRED';

export type FoodCategory =
  | 'Cooked Meals'
  | 'Bakery & Bread'
  | 'Fresh Produce'
  | 'Dairy & Eggs'
  | 'Packaged / Dry Goods'
  | 'Beverages'
  | 'Other';

export type DietaryType = 'Vegetarian' | 'Non-Vegetarian' | 'Vegan';

export type StorageRequirement =
  | 'Room Temperature'
  | 'Refrigerated (Cold Chain)'
  | 'Frozen'
  | 'Hot Holding';

export interface IncomingDonation {
  id: string;
  provider_id: string;
  hub_id?: string;
  provider_name?: string;
  provider_address?: string;
  provider_coordinates?: [number, number]; // [lon, lat]
  food_name: string;
  description?: string;
  food_category: FoodCategory;
  dietary_type: DietaryType;
  preparation_date_time: string;
  people_served: number;
  storage_requirements: StorageRequirement;
  pickup_notes?: string;
  status: DonationStatus;
  pickup_run_id?: string;
  safety_deadline?: string;
  created_at: string;
  updated_at: string;
  picked_up_at?: string;
  received_at_hub_at?: string;
}

export interface CreateDonationPayload {
  food_name: string;
  food_category: FoodCategory;
  dietary_type: DietaryType;
  preparation_date_time: string;
  people_served: number;
  storage_requirements: StorageRequirement;
  description?: string;
  pickup_notes?: string;
}

export interface HubSummary {
  hub_id: string;
  total_people_served: number;
  pending_donations_count: number;
  eligible_restaurants_count: number;
  auto_threshold_met: boolean;
  has_active_run: boolean;
  active_run_id?: string;
}

export interface Vehicle {
  id: string;
  owned_by_hub_ID: string;
  type: 'Bike' | 'Auto' | 'Tempo traveller' | string;
  capacity: number;
  isFree: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderedStop {
  stop_index: number;
  provider_id: string;
  provider_name: string;
  address: string;
  coordinates: [number, number]; // [lon, lat]
  donation_ids: string[];
  people_served: number;
  status: 'PENDING' | 'PICKED_UP';
  picked_up_at?: string;
}

export interface PickupRun {
  id: string;
  hub_id: string;
  donation_ids: string[];
  assigned_vehicle: {
    id: string;
    type: string;
    capacity: number;
  };
  total_people_served: number;
  ordered_stops: OrderedStop[];
  route_geometry?: {
    type: string;
    coordinates: [number, number][];
  };
  total_distance_meters: number;
  total_duration_seconds: number;
  baseline_distance_meters: number;
  optimized_distance_meters: number;
  distance_saved_meters: number;
  percentage_saved: number;
  simulation_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  current_stop_index: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}
