import { apiClient } from './apiClient';

export interface ActivityLogEntry {
  id: string;
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

const LOGS_STORAGE_KEY = 'gujar_pos_activity_logs';

function localFallbackLog(params: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'user' | 'userRole'>) {
  try {
    const existingLogs = JSON.parse(localStorage.getItem(LOGS_STORAGE_KEY) || '[]');
    const newLog: ActivityLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      user: localStorage.getItem('userName') || localStorage.getItem('role') || 'User',
      userRole: localStorage.getItem('role') || '',
      ...params,
    };
    existingLogs.unshift(newLog);
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(existingLogs.slice(0, 200)));
  } catch (e) {
    console.error('Failed to write to activity log', e);
  }
}

export const activityLogger = {
  log: (params: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'user' | 'userRole'>) => {
    // Fire-and-forget to backend; keep a local copy if offline
    apiClient
      .post('/activity-logs', {
        action: params.action,
        module: params.module,
        description: params.description,
        entityId: params.entityId,
        status: params.status,
      })
      .catch(() => localFallbackLog(params));
  },

  getLogs: async (): Promise<ActivityLogEntry[]> => {
    try {
      const response = await apiClient.get('/activity-logs', { limit: 200 });
      return (response.data || []) as ActivityLogEntry[];
    } catch {
      return JSON.parse(localStorage.getItem(LOGS_STORAGE_KEY) || '[]');
    }
  },

  clearLogs: async (): Promise<void> => {
    localStorage.removeItem(LOGS_STORAGE_KEY);
  },
};
