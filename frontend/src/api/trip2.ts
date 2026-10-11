import { apiClient } from './client';
import {
  HubItem,
  FoodRequestCheckPayload,
  FoodRequestCheckResponse,
  CreateNgoOrderPayload,
  NgoOrderResponse,
  DeliveryHistoryItem,
} from '../types/trip2';

export const trip2Api = {
  // NGO endpoints
  getNgoHubs: async (): Promise<HubItem[]> => {
    const response = await apiClient.get<HubItem[]>('/ngos/hubs');
    return response.data;
  },

  checkFoodRequest: async (
    payload: FoodRequestCheckPayload
  ): Promise<FoodRequestCheckResponse> => {
    const response = await apiClient.post<FoodRequestCheckResponse>(
      '/ngos/request-check',
      payload
    );
    return response.data;
  },

  createOrder: async (
    payload: CreateNgoOrderPayload
  ): Promise<NgoOrderResponse> => {
    const response = await apiClient.post<NgoOrderResponse>(
      '/ngos/orders',
      payload
    );
    return response.data;
  },

  getActiveNgoOrder: async (): Promise<NgoOrderResponse | null> => {
    const response = await apiClient.get<NgoOrderResponse | null>(
      '/ngos/orders/active'
    );
    return response.data;
  },

  startNgoSimulation: async (orderId: string): Promise<NgoOrderResponse> => {
    const response = await apiClient.post<NgoOrderResponse>(
      `/ngos/orders/${orderId}/start`
    );
    return response.data;
  },

  completeNgoOrder: async (orderId: string): Promise<NgoOrderResponse> => {
    const response = await apiClient.post<NgoOrderResponse>(
      `/ngos/orders/${orderId}/complete`
    );
    return response.data;
  },

  getNgoDeliveryHistory: async (): Promise<DeliveryHistoryItem[]> => {
    const response = await apiClient.get<DeliveryHistoryItem[]>('/ngos/history');
    return response.data;
  },

  // Hub endpoints
  getHubOrders: async (): Promise<NgoOrderResponse[]> => {
    const response = await apiClient.get<NgoOrderResponse[]>('/hubs/orders');
    return response.data;
  },

  getActiveHubOrder: async (): Promise<NgoOrderResponse | null> => {
    const response = await apiClient.get<NgoOrderResponse | null>(
      '/hubs/orders/active'
    );
    return response.data;
  },

  startHubDelivery: async (orderId: string): Promise<NgoOrderResponse> => {
    const response = await apiClient.post<NgoOrderResponse>(
      `/hubs/orders/${orderId}/start`
    );
    return response.data;
  },

  completeHubDelivery: async (orderId: string): Promise<NgoOrderResponse> => {
    const response = await apiClient.post<NgoOrderResponse>(
      `/hubs/orders/${orderId}/complete`
    );
    return response.data;
  },

  getHubDeliveryHistory: async (): Promise<DeliveryHistoryItem[]> => {
    const response = await apiClient.get<DeliveryHistoryItem[]>('/hubs/history');
    return response.data;
  },
};
