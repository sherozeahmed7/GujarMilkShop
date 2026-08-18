/**
 * Central API Client configuration for the POS system.
 * When the backend is ready, this file will be updated to use actual fetch/axios.
 */

export const API_BASE_URL = 'http://localhost:8080/api'; // Placeholder

export const apiClient = {
  get: async (endpoint: string, params?: Record<string, any>) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log(`[MOCK GET] ${API_BASE_URL}${endpoint}`, params);
    return { success: true, data: null }; // Base structure
  },
  post: async (endpoint: string, data?: any) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log(`[MOCK POST] ${API_BASE_URL}${endpoint}`, data);
    return { success: true, data: null };
  }
};
