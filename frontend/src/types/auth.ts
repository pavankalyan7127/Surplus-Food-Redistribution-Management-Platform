export type UserRole = 'provider' | 'hub' | 'ngo';

export type ProviderType = 'restaurant' | 'bakery' | 'hostel_mess' | 'other';

export interface User {
  id: string;
  organization_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  provider_type?: ProviderType;
  estimated_daily_meal_demand?: number;
  location?: { type: string; coordinates: [number, number] };
  latitude?: number;
  longitude?: number;
  nearest_hub_id?: string;
  nearest_hub_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  expected_role: UserRole;
}

export interface ProviderSignupPayload {
  organization_name: string;
  contact_name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  provider_type: ProviderType;
  latitude?: number;
  longitude?: number;
}

export interface NgoSignupPayload {
  organization_name: string;
  contact_name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  estimated_daily_meal_demand?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface ApiError {
  detail: string | { message?: string; [key: string]: unknown };
}
