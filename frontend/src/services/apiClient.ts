/**
 * Central API Client configuration for the POS system.
 * Connects to the Express backend running on localhost:5000.
 */

const resolveApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/api') ? envUrl : (envUrl.replace(/\/+$/, '') + '/api');
  }
  return 'http://127.0.0.1:5000/api';
};

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Called whenever any API response returns 401 Unauthorized (except login).
 * Clears the stored session and notifies the app to show a session-expired modal.
 */
const handleUnauthorized = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('role');
  localStorage.removeItem('assignedScreens');
  window.dispatchEvent(new CustomEvent('session-expired'));
};

/** Login 401 = wrong email/password — do not treat as session expiry */
const isAuthLoginEndpoint = (endpoint: string) =>
  endpoint === '/auth/login' || endpoint.endsWith('/auth/login');

const handle401 = (endpoint: string, data: any) => {
  if (isAuthLoginEndpoint(endpoint)) {
    throw new Error(data?.message || 'Invalid email or password');
  }
  handleUnauthorized();
  throw new Error('Session expired. Please log in again.');
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

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 60000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection or retry.');
    }
    throw err;
  }
};

export const apiClient = {
  get: async (endpoint: string, params?: Record<string, any>) => {
    try {
      const url = new URL(`${API_BASE_URL}${endpoint}`);
      if (params) {
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
      }
      const response = await fetchWithTimeout(url.toString(), {
        headers: getHeaders(),
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.status === 401) handle401(endpoint, data);
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
      const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.status === 401) handle401(endpoint, data);
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
      const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.status === 401) handle401(endpoint, data);
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
      const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.status === 401) handle401(endpoint, data);
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
      const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await response.json();
      if (response.status === 401) handle401(endpoint, data);
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
