import { create } from 'zustand';
import { User, CreateUserPayload, UpdateUserPayload } from '../types/user';
import { userService } from '../services/user.service';
import { Role } from '../types/role';
import { roleService } from '../services/role.service';

interface UserState {
  users: User[];
  roles: Role[];
  isLoading: boolean;
  error: string | null;
  
  fetchUsers: () => Promise<void>;
  fetchRoles: () => Promise<void>;
  createUser: (payload: CreateUserPayload) => Promise<void>;
  updateUser: (id: string, payload: UpdateUserPayload) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  changeStatus: (id: string, status: 'Active' | 'Inactive') => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  roles: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const users = await userService.getUsers();
      set({ users, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchRoles: async () => {
    try {
      const roles = await roleService.getRoles();
      set({ roles });
    } catch (error: any) {
      console.error("Failed to fetch roles", error);
    }
  },

  createUser: async (payload: CreateUserPayload) => {
    set({ isLoading: true, error: null });
    try {
      // Optimistically create role if needed
      await roleService.createRole({ name: payload.role, assignedScreens: payload.assignedScreens });
      
      await userService.createUser(payload);
      await get().fetchUsers();
      await get().fetchRoles();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateUser: async (id: string, payload: UpdateUserPayload) => {
    set({ isLoading: true, error: null });
    try {
      if (payload.role && payload.assignedScreens) {
        await roleService.createRole({ name: payload.role, assignedScreens: payload.assignedScreens });
      }

      await userService.updateUser(id, payload);
      await get().fetchUsers();
      await get().fetchRoles();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteUser: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await userService.deleteUser(id);
      await get().fetchUsers();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  changeStatus: async (id: string, status: 'Active' | 'Inactive') => {
    set({ isLoading: true, error: null });
    try {
      await userService.changeUserStatus(id, status);
      await get().fetchUsers();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  }
}));
