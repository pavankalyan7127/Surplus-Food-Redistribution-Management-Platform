import { apiClient } from './client';
import {
  AuthResponse,
  LoginPayload,
  NgoSignupPayload,
  ProviderSignupPayload,
  User,
} from '../types/auth';

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', payload);
    return res.data;
  },

  signupProvider: async (payload: ProviderSignupPayload): Promise<User> => {
    const res = await apiClient.post<User>('/auth/signup/provider', payload);
    return res.data;
  },

  signupNgo: async (payload: NgoSignupPayload): Promise<User> => {
    const res = await apiClient.post<User>('/auth/signup/ngo', payload);
    return res.data;
  },

  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  getProviderProfile: async (): Promise<User> => {
    const res = await apiClient.get<User>('/providers/me');
    return res.data;
  },

  getHubProfile: async (): Promise<User> => {
    const res = await apiClient.get<User>('/hubs/me');
    return res.data;
  },

  getNgoProfile: async (): Promise<User> => {
    const res = await apiClient.get<User>('/ngos/me');
    return res.data;
  },

  checkHealth: async (): Promise<{ status: string; service: string }> => {
    const res = await apiClient.get('/health');
    return res.data;
  },

  checkDbHealth: async (): Promise<{ status: string; database: string; connected: boolean }> => {
    const res = await apiClient.get('/health/db');
    return res.data;
  },
};
