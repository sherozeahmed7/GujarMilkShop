import { apiClient, API_BASE_URL } from './apiClient';

export type SyncStatus = 'Online' | 'Offline' | 'Syncing' | 'Error' | 'Disconnected';

export interface SyncItem {
  id: string;          // eventUuid
  record: string;      // entityType + localId label
  module: string;      // entityType
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  createdAt: string;
  status: 'Pending' | 'Syncing' | 'Failed';
  retryCount: number;
  error?: string | null;
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
  syncingCount: number;
  syncEnabled: boolean;
  downstreamEnabled: boolean;
  cloudConnected: boolean;
}

function deriveStatus(data: {
  cloudConnected: boolean;
  syncEnabled: boolean;
  syncingCount: number;
  pendingCount: number;
  failedCount: number;
}): SyncStatus {
  if (!data.syncEnabled) return 'Disconnected';
  if (!data.cloudConnected) return 'Offline';
  if (data.syncingCount > 0) return 'Syncing';
  if (data.failedCount > 0) return 'Error';
  return 'Online';
}

function entityTypeToModule(entityType: string): string {
  const map: Record<string, string> = {
    Customer: 'Customers',
    Supplier: 'Suppliers',
    Sale: 'POS',
    SaleItem: 'POS',
    Payment: 'Payments',
    SupplierCollection: 'Suppliers',
    SupplierPayment: 'Suppliers',
    Expense: 'Expenses',
    Return: 'Returns',
    InventoryProduct: 'Inventory',
    InventoryMovement: 'Inventory',
    MilkProductTransaction: 'F2',
    ButterGheeConversion: 'F2',
    User: 'Users',
  };
  return map[entityType] || entityType;
}

export const cloudSyncService = {
  getStatus: async (): Promise<CloudStatusData> => {
    const data = await apiClient.get('/sync/status');
    return {
      status: deriveStatus({
        cloudConnected: data.cloudConnected,
        syncEnabled: data.syncEnabled,
        syncingCount: data.syncing,
        pendingCount: data.pending,
        failedCount: data.failed,
      }),
      vpsUrl: API_BASE_URL,
      deviceId: data.deviceId,
      shopName: 'Gujar Milk Shop',
      lastChecked: data.lastChecked,
      lastSuccessfulSync: data.lastSuccessfulSync,
      pendingCount: data.pending,
      failedCount: data.failed,
      syncingCount: data.syncing,
      syncEnabled: data.syncEnabled,
      downstreamEnabled: data.downstreamEnabled,
      cloudConnected: data.cloudConnected,
    };
  },

  getPendingItems: async (): Promise<SyncItem[]> => {
    const data = await apiClient.get('/sync/queue');
    return (data.items || []).map((item: any): SyncItem => ({
      id: item.eventUuid,
      record: `${item.entityType} #${item.localId}`,
      module: entityTypeToModule(item.entityType),
      action: item.operation as 'CREATE' | 'UPDATE' | 'DELETE',
      createdAt: item.createdAt,
      status: item.status === 'PENDING' ? 'Pending' : item.status === 'SYNCING' ? 'Syncing' : 'Failed',
      retryCount: item.retryCount,
      error: item.error,
    }));
  },

  checkRegistration: async (): Promise<boolean> => {
    await apiClient.post('/sync/check-connection');
    return true;
  },

  disconnect: async (): Promise<void> => {
    await apiClient.post('/sync/toggle', { syncEnabled: false, downstreamEnabled: false });
  },

  reconnect: async (): Promise<void> => {
    await apiClient.post('/sync/toggle', { syncEnabled: true, downstreamEnabled: true });
  },

  syncNow: async (): Promise<{ success: boolean; message: string }> => {
    const data = await apiClient.post('/sync/trigger');
    return { success: data.success, message: data.message };
  },

  retryItem: async (eventUuid: string): Promise<void> => {
    // Reset a single failed event to pending
    await apiClient.post('/sync/retry-failed');
  },

  retryAll: async (): Promise<void> => {
    await apiClient.post('/sync/retry-failed');
  },

  restoreCloudData: async (): Promise<{
    success: boolean;
    message: string;
    backupPath: string;
    totalRestored: number;
    restoredCounts: Record<string, number>;
  }> => {
    return await apiClient.post('/sync/restore');
  },
};
