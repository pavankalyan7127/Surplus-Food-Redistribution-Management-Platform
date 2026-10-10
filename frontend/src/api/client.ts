import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Interceptor to inject bearer token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle responses and global 401s
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If token expired or invalid, clear token
      const isAuthRequest = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/signup');
      if (!isAuthRequest) {
        localStorage.removeItem('access_token');
        // Let application state handle redirection gracefully
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Unable to reach backend server. Please verify the API is running and check network connectivity.';
    }
    const detail = error.response.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (typeof detail === 'object' && detail !== null) {
      return (detail as { message?: string }).message || JSON.stringify(detail);
    }
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg || 'Validation error').join(', ');
    }
    return error.response.data?.message || `Request failed with status ${error.response.status}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}
