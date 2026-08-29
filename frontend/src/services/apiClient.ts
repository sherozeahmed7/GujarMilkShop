/**
 * Central API Client configuration for the POS system.
 * Connects to the Express backend running on localhost:5000.
 */

export const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Called whenever any API response returns 401 Unauthorized.
 * Clears the stored session and notifies the app to show a session-expired modal.
 */
const handleUnauthorized = () => {
  // Clear all auth state
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('role');
  localStorage.removeItem('assignedScreens');
  // Fire a global event — the SessionExpiredModal in App.tsx listens for this
  window.dispatchEvent(new CustomEvent('session-expired'));
};

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
      if (response.status === 401) { handleUnauthorized(); throw new Error('Session expired. Please log in again.'); }
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
      if (response.status === 401) { handleUnauthorized(); throw new Error('Session expired. Please log in again.'); }
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (error: any) {
      console.error(`[API POST ERROR] ${endpoint}:`, error);
      throw error;
    }
  },

  put: async (endpoint: string, payload?: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.status === 401) { handleUnauthorized(); throw new Error('Session expired. Please log in again.'); }
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (error: any) {
      console.error(`[API PUT ERROR] ${endpoint}:`, error);
      throw error;
    }
  },

  patch: async (endpoint: string, payload?: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.status === 401) { handleUnauthorized(); throw new Error('Session expired. Please log in again.'); }
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (error: any) {
      console.error(`[API PATCH ERROR] ${endpoint}:`, error);
      throw error;
    }
  },

  delete: async (endpoint: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await response.json();
      if (response.status === 401) { handleUnauthorized(); throw new Error('Session expired. Please log in again.'); }
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (error: any) {
      console.error(`[API DELETE ERROR] ${endpoint}:`, error);
      throw error;
    }
  }
};
