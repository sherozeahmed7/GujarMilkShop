/**
 * Central API Client configuration for the POS system.
 * Connects to the Express backend running on localhost:5000.
 */

export const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Helper to get default headers including Authorization token if present in localStorage.
 */
const getHeaders = (customHeaders: Record<string, string> = {}) => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  };
};

export const apiClient = {
  get: async (endpoint: string, params?: Record<string, any>) => {
    try {
      const url = new URL(`${API_BASE_URL}${endpoint}`);
      if (params) {
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
      }
      const response = await fetch(url.toString(), {
        headers: getHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (error: any) {
      console.error(`[API GET ERROR] ${endpoint}:`, error);
      throw error;
    }
  },

  post: async (endpoint: string, payload?: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (error: any) {
      console.error(`[API POST ERROR] ${endpoint}:`, error);
      throw error;
    }
  }
};
