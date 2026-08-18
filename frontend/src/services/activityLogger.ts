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

export const activityLogger = {
  log: (params: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'user' | 'userRole'>) => {
    try {
      const existingLogs = JSON.parse(localStorage.getItem(LOGS_STORAGE_KEY) || '[]');
      
      const newLog: ActivityLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        user: 'System Admin', // Mock active user
        userRole: 'ADMIN',
        ...params
      };

      existingLogs.unshift(newLog); // Add to beginning
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(existingLogs));
      
      console.log(`[ACTIVITY LOG] [${params.module}] ${params.action}: ${params.description}`);
    } catch (e) {
      console.error("Failed to write to activity log", e);
    }
  },

  getLogs: async (): Promise<ActivityLogEntry[]> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return JSON.parse(localStorage.getItem(LOGS_STORAGE_KEY) || '[]');
  },
  
  clearLogs: async (): Promise<void> => {
    localStorage.removeItem(LOGS_STORAGE_KEY);
  }
};
