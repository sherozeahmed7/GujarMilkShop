export type SyncStatus = 'Online' | 'Offline' | 'Connecting' | 'Syncing' | 'Error' | 'Disconnected';

export interface SyncItem {
  id: string;
  record: string;
  module: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  createdAt: string;
  status: 'Pending' | 'Failed';
}

export interface CloudStatusData {
  status: SyncStatus;
  vpsUrl: string;
  deviceId: string;
  shopName: string;
  lastChecked: string | null;
  lastSuccessfulSync: string | null;
  pendingCount: number;
  failedCount: number;
}

// Internal mock state
let currentStatus: SyncStatus = 'Disconnected';
let mockQueue: SyncItem[] = [
  { id: '1', record: 'Sale #BILL-1025', module: 'POS', action: 'CREATE', createdAt: '15 Aug 2026 07:32 PM', status: 'Pending' },
  { id: '2', record: 'Customer #C-102', module: 'Customers', action: 'UPDATE', createdAt: '15 Aug 2026 07:30 PM', status: 'Pending' },
  { id: '3', record: 'Expense #EXP-221', module: 'Expenses', action: 'CREATE', createdAt: '15 Aug 2026 07:25 PM', status: 'Failed' },
  { id: '4', record: 'Product #P-05', module: 'Inventory', action: 'UPDATE', createdAt: '15 Aug 2026 06:15 PM', status: 'Failed' },
];

let lastChecked = '15 Aug 2026, 07:40 PM';
let lastSuccessfulSync = '15 Aug 2026, 07:38 PM';
const vpsUrl = 'https://api.gujarmilkshop.com/sync';
const deviceId = 'LOCAL-DEVICE-01';
const shopName = 'Gujar Milk Shop';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const cloudSyncService = {
  getStatus: async (): Promise<CloudStatusData> => {
    await delay(300);
    const pendingCount = mockQueue.filter(i => i.status === 'Pending').length;
    const failedCount = mockQueue.filter(i => i.status === 'Failed').length;
    
    return {
      status: currentStatus,
      vpsUrl,
      deviceId,
      shopName,
      lastChecked,
      lastSuccessfulSync,
      pendingCount,
      failedCount,
    };
  },

  checkRegistration: async (): Promise<boolean> => {
    await delay(800);
    currentStatus = 'Online';
    lastChecked = new Date().toLocaleString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
    return true; // Successfully registered
  },

  disconnect: async (): Promise<void> => {
    await delay(500);
    currentStatus = 'Disconnected';
  },

  getPendingItems: async (): Promise<SyncItem[]> => {
    await delay(200);
    return [...mockQueue];
  },

  syncNow: async (): Promise<{ success: boolean, message: string }> => {
    await delay(1500);
    
    if (currentStatus === 'Disconnected' || currentStatus === 'Offline') {
      return { success: false, message: 'Cannot sync while offline or disconnected.' };
    }

    const pending = mockQueue.filter(i => i.status === 'Pending');
    
    if (pending.length === 0) {
      return { success: true, message: 'No pending items to sync.' };
    }

    // Process all pending items (mock logic: 90% chance of success per item)
    mockQueue = mockQueue.map(item => {
      if (item.status === 'Pending') {
        const success = Math.random() > 0.1;
        if (!success) {
          return { ...item, status: 'Failed' };
        }
        return { ...item, status: 'Synced' as any }; // Will be filtered out
      }
      return item;
    }).filter(item => item.status !== ('Synced' as any));

    lastSuccessfulSync = new Date().toLocaleString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });

    const newFailedCount = mockQueue.filter(i => i.status === 'Failed').length;
    
    if (newFailedCount > 0) {
       return { success: false, message: 'Sync completed with some errors.' };
    }
    
    return { success: true, message: 'Sync completed successfully.' };
  },

  retryItem: async (id: string): Promise<void> => {
    await delay(400);
    mockQueue = mockQueue.map(item => {
      if (item.id === id && item.status === 'Failed') {
        return { ...item, status: 'Pending' }; // Move back to pending
      }
      return item;
    });
  },

  retryAll: async (): Promise<void> => {
    await delay(500);
    mockQueue = mockQueue.map(item => {
      if (item.status === 'Failed') {
        return { ...item, status: 'Pending' };
      }
      return item;
    });
  },

  restoreCloudData: async (): Promise<{ success: boolean, records: number }> => {
    await delay(2000);
    return { success: true, records: 14025 };
  }
};
