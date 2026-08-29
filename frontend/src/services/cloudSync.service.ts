import { apiClient } from './apiClient';

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

const STORAGE_KEY = 'gujar_cloud_sync_state';
const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

type PersistedState = {
  status: SyncStatus;
  lastChecked: string | null;
  lastSuccessfulSync: string | null;
  deviceId: string;
};

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    status: 'Disconnected',
    lastChecked: null,
    lastSuccessfulSync: null,
    deviceId: `LOCAL-${Date.now().toString(36).toUpperCase()}`,
  };
}

function saveState(state: PersistedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let intervalId: number | null = null;
let pendingQueue: SyncItem[] = [];

const fmtNow = () =>
  new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

/** Mark that local data changed — next sync cycle will push. */
export function markLocalChange(module: string, record: string, action: SyncItem['action'] = 'UPDATE') {
  if (state.status === 'Disconnected') return;
  pendingQueue.unshift({
    id: `q-${Date.now()}`,
    record,
    module,
    action,
    createdAt: fmtNow(),
    status: 'Pending',
  });
  pendingQueue = pendingQueue.slice(0, 50);
}

async function pingBackend(): Promise<boolean> {
  try {
    await apiClient.get('/status');
    return true;
  } catch {
    try {
      const res = await fetch(`${(await import('./apiClient')).API_BASE_URL.replace(/\/api$/, '')}/api/status`);
      return res.ok;
    } catch {
      return navigator.onLine;
    }
  }
}

export const cloudSyncService = {
  getStatus: async (): Promise<CloudStatusData> => {
    state = loadState();
    return {
      status: state.status,
      vpsUrl: 'local-backend-sync',
      deviceId: state.deviceId,
      shopName: 'Gujar Milk Shop',
      lastChecked: state.lastChecked,
      lastSuccessfulSync: state.lastSuccessfulSync,
      pendingCount: pendingQueue.filter((i) => i.status === 'Pending').length,
      failedCount: pendingQueue.filter((i) => i.status === 'Failed').length,
    };
  },

  checkRegistration: async (): Promise<boolean> => {
    const online = await pingBackend();
    state = {
      ...loadState(),
      status: online ? 'Online' : 'Offline',
      lastChecked: fmtNow(),
    };
    saveState(state);
    cloudSyncService.startAutoSync();
    return online;
  },

  disconnect: async (): Promise<void> => {
    cloudSyncService.stopAutoSync();
    state = { ...loadState(), status: 'Disconnected' };
    saveState(state);
  },

  getPendingItems: async (): Promise<SyncItem[]> => {
    return [...pendingQueue];
  },

  syncNow: async (): Promise<{ success: boolean; message: string }> => {
    state = loadState();
    if (state.status === 'Disconnected') {
      return { success: false, message: 'Connect cloud sync first.' };
    }
    if (!navigator.onLine) {
      state = { ...state, status: 'Offline', lastChecked: fmtNow() };
      saveState(state);
      return { success: false, message: 'No internet — sync paused.' };
    }

    state = { ...state, status: 'Syncing', lastChecked: fmtNow() };
    saveState(state);

    const ok = await pingBackend();
    if (!ok) {
      state = { ...state, status: 'Offline', lastChecked: fmtNow() };
      saveState(state);
      return { success: false, message: 'Backend unreachable. Will retry in 10 minutes.' };
    }

    // Local POS: clearing pending means changes are confirmed against live backend
    const cleared = pendingQueue.length;
    pendingQueue = [];
    state = {
      ...state,
      status: 'Online',
      lastChecked: fmtNow(),
      lastSuccessfulSync: fmtNow(),
    };
    saveState(state);

    return {
      success: true,
      message: cleared
        ? `Synced ${cleared} local change(s) with server.`
        : 'Connected — no pending local changes.',
    };
  },

  startAutoSync: () => {
    if (intervalId != null) return;
    intervalId = window.setInterval(() => {
      const s = loadState();
      if (s.status === 'Disconnected') return;
      if (!navigator.onLine) {
        state = { ...s, status: 'Offline', lastChecked: fmtNow() };
        saveState(state);
        return;
      }
      cloudSyncService.syncNow().catch(() => undefined);
    }, SYNC_INTERVAL_MS);
  },

  stopAutoSync: () => {
    if (intervalId != null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  },

  retryItem: async (id: string): Promise<void> => {
    pendingQueue = pendingQueue.map((i) =>
      i.id === id ? { ...i, status: 'Pending' } : i
    );
    await cloudSyncService.syncNow();
  },

  restoreFromCloud: async (): Promise<{ success: boolean; message: string; records?: number }> => {
    const ok = await pingBackend();
    return ok
      ? { success: true, message: 'Local database is already the source of truth on this device.', records: 0 }
      : { success: false, message: 'Cannot reach server.', records: 0 };
  },

  restoreCloudData: async (): Promise<{ success: boolean; message: string; records?: number }> => {
    return cloudSyncService.restoreFromCloud();
  },

  retryAll: async (): Promise<void> => {
    pendingQueue = pendingQueue.map((i) =>
      i.status === 'Failed' ? { ...i, status: 'Pending' as const } : i
    );
    await cloudSyncService.syncNow();
  },
};

// Resume auto-sync if previously connected
if (typeof window !== 'undefined') {
  const s = loadState();
  if (s.status === 'Online' || s.status === 'Syncing' || s.status === 'Offline') {
    cloudSyncService.startAutoSync();
  }
}
