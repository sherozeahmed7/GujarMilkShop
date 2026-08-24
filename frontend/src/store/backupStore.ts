import { create } from 'zustand';
import { BackupRecord, AutoBackupSettings } from '../types';
import { initialMockBackups } from '../data/backupMockData';
import {
  createBackup as svcCreateBackup,
  deleteBackup as svcDeleteBackup,
  getBackupFolder,
  changeBackupFolder,
  resetBackupFolder,
  getBackupSettings,
  updateBackupSettings
} from '../services/backupService';

interface BackupStore {
  backups: BackupRecord[];
  isCreating: boolean;
  backupFolder: string;
  autoBackupSettings: AutoBackupSettings;
  createBackup: () => Promise<BackupRecord>;
  addBackup: (record: BackupRecord) => void;
  deleteBackup: (id: string) => Promise<void>;
  loadInitialData: () => Promise<void>;
  setBackupFolder: (folder: string) => void;
  setAutoBackupSettings: (settings: AutoBackupSettings) => void;
}

export const useBackupStore = create<BackupStore>((set) => ({
  backups: initialMockBackups,
  isCreating: false,
  backupFolder: 'C:\\Users\\HP\\OneDrive\\Documents\\RetailPOSBackup\\',
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
      set((state) => ({
        backups: [newBackup, ...state.backups],
        isCreating: false,
      }));
      return newBackup;
    } catch (e) {
      set({ isCreating: false });
      throw e;
    }
  },

  addBackup: (record) => {
    set((state) => ({ backups: [record, ...state.backups] }));
  },

  deleteBackup: async (id: string) => {
    await svcDeleteBackup(id);
    set((state) => ({ backups: state.backups.filter(b => b.id !== id) }));
  },

  loadInitialData: async () => {
    const folder = await getBackupFolder();
    const settings = await getBackupSettings();
    set({ backupFolder: folder, autoBackupSettings: settings });
  },

  setBackupFolder: (folder: string) => {
    set({ backupFolder: folder });
  },

  setAutoBackupSettings: (settings: AutoBackupSettings) => {
    set({ autoBackupSettings: settings });
  }
}));
