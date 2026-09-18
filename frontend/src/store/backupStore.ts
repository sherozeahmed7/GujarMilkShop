import { create } from 'zustand';
import { BackupRecord, AutoBackupSettings } from '../types';
import {
  createBackup as svcCreateBackup,
  deleteBackup as svcDeleteBackup,
  listBackups as svcListBackups,
  getBackupSettings,
  getBackupFolderConfig,
} from '../services/backupService';

interface BackupSummary {
  totalBackups: number;
  latestBackup: string | null;
  totalStorageKb: number;
  status: string;
}

interface BackupStore {
  backups: BackupRecord[];
  summary: BackupSummary;
  isCreating: boolean;
  isLoading: boolean;
  backupFolder: string;
  autoBackupSettings: AutoBackupSettings;
  createBackup: () => Promise<BackupRecord>;
  deleteBackup: (filename: string) => Promise<void>;
  loadInitialData: () => Promise<void>;
  setBackupFolder: (folder: string) => void;
  setAutoBackupSettings: (settings: AutoBackupSettings) => void;
}

const defaultSummary: BackupSummary = {
  totalBackups: 0,
  latestBackup: null,
  totalStorageKb: 0,
  status: 'Loading...',
};

export const useBackupStore = create<BackupStore>((set, get) => ({
  backups: [],
  summary: defaultSummary,
  isCreating: false,
  isLoading: true,
  backupFolder: 'Loading...',
  autoBackupSettings: {
    enabled: true,
    schedule: 'Daily',
    time: '02:00',
    retention: '30'
  },

  createBackup: async () => {
    set({ isCreating: true });
    try {
      const newBackup = await svcCreateBackup();
      // Refresh all cards and table
      await get().loadInitialData();
      return newBackup;
    } catch (e) {
      // Let error bubble up to UI for toast
      throw e;
    } finally {
      set({ isCreating: false });
    }
  },

  deleteBackup: async (filename: string) => {
    try {
      await svcDeleteBackup(filename);
      // Refresh all cards and table
      await get().loadInitialData();
    } catch (e) {
      // Let error bubble up to UI for toast
      throw e;
    }
  },

  loadInitialData: async () => {
    set({ isLoading: true });
    try {
      const [{ backups, summary }, settings, folderConfig] = await Promise.all([
        svcListBackups(),
        getBackupSettings(),
        getBackupFolderConfig(),
      ]);

      let folderPath = folderConfig.backupFolder;
      if (!folderPath && backups.length > 0) {
        const lastSlash = Math.max(
          backups[0].path.lastIndexOf('\\'),
          backups[0].path.lastIndexOf('/')
        );
        folderPath = lastSlash > 0 ? backups[0].path.substring(0, lastSlash) : backups[0].path;
      }

      set({
        backups,
        summary,
        autoBackupSettings: settings,
        backupFolder: folderPath || 'Local AppData / Backups',
      });
    } catch (err: any) {
      console.error('[BackupStore] Failed to load backup data:', err.message);
      set({
        summary: {
          ...get().summary,
          status: 'Error: ' + (err.message || 'Could not load backups'),
        },
      });
    } finally {
      // Always reset loading, regardless of success or failure
      set({ isLoading: false });
    }
  },

  setBackupFolder: (folder: string) => {
    set({ backupFolder: folder });
  },

  setAutoBackupSettings: (settings: AutoBackupSettings) => {
    set({ autoBackupSettings: settings });
  }
}));
