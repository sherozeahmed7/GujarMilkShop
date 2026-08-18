/**
 * Central API Client configuration for the POS system.
 * Connects to the Express backend running on localhost:5000.
 */

export const API_BASE_URL = 'http://localhost:5000/api';

export const apiClient = {
  get: async (endpoint: string, params?: Record<string, any>) => {
    try {
      const url = new URL(`${API_BASE_URL}${endpoint}`);
      if (params) {
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
      }
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[API GET ERROR] ${endpoint}:`, error);
      throw error;
    }
  },
  post: async (endpoint: string, data?: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[API POST ERROR] ${endpoint}:`, error);
      throw error;
    }
  }
};
