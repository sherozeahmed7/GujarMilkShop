import { create } from 'zustand';
import { BackupRecord } from '../types';
import { initialMockBackups } from '../data/backupMockData';
import { createBackup as svcCreateBackup } from '../services/backupService';

interface BackupStore {
  backups: BackupRecord[];
  isCreating: boolean;
  createBackup: () => Promise<BackupRecord>;
  addBackup: (record: BackupRecord) => void;
}

export const useBackupStore = create<BackupStore>((set, get) => ({
  backups: initialMockBackups,
  isCreating: false,

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
}));
