import { apiClient } from './apiClient';

export interface ActivityLogEntry {
  id: number;
  timestamp: string;
  user: string;
  userRole: string;
  action: string;
  module: string;
  description: string;
  entityId?: string;
  ip?: string;
  status: 'Success' | 'Warning' | 'Error';
}

export interface PaginatedActivityLogs {
  data: ActivityLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const activityLogger = {
  log: async (params: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'user' | 'userRole'>) => {
    try {
      const payload = {
        user: localStorage.getItem('userName') || 'Unknown User',
        userRole: (localStorage.getItem('role') || 'user').toUpperCase(),
        ...params
      };
      
      await apiClient.post('/activity-logs', payload);
      
      console.log(`[ACTIVITY LOG] [${params.module}] ${params.action}: ${params.description}`);
    } catch (e) {
      console.error("Failed to write to activity log", e);
    }
  },

  getLogs: async (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    module?: string;
    status?: string;
  } = {}): Promise<PaginatedActivityLogs> => {
    try {
      const query = new URLSearchParams();
      if (params.page)     query.set('page', String(params.page));
      if (params.pageSize) query.set('pageSize', String(params.pageSize));
      if (params.search)   query.set('search', params.search);
      if (params.module)   query.set('module', params.module);
      if (params.status)   query.set('status', params.status);

      const response = await apiClient.get(`/activity-logs?${query.toString()}`);
      return response;
    } catch (e) {
      console.error("Failed to fetch activity logs", e);
      return { data: [], total: 0, page: 1, pageSize: 25, totalPages: 1 };
    }
  }
};
