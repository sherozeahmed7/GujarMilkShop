import { create } from 'zustand';
import { User, CreateUserPayload, UpdateUserPayload } from '../types/user';
import { userService } from '../services/user.service';

interface UserState {
  users: User[];
  roles: string[];   // plain role name strings from GET /api/users/roles
  isLoading: boolean;
  error: string | null;
  
  fetchUsers: (filters?: { name?: string; role?: string; status?: string }) => Promise<void>;
  fetchRoles: () => Promise<void>;
  createUser: (payload: CreateUserPayload) => Promise<void>;
  updateUser: (id: string, payload: UpdateUserPayload) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  changeStatus: (id: string, status: 'active' | 'inactive' | 'Active' | 'Inactive') => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  roles: [],
  isLoading: false,
  error: null,

  fetchUsers: async (filters?: { name?: string; role?: string; status?: string }) => {
    set({ isLoading: true, error: null });
    try {
      const users = await userService.getUsers(filters);
      set({ users, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchRoles: async () => {
    try {
      const roles = await userService.getRoles();
      set({ roles });
    } catch (error: any) {
      console.error('Failed to fetch roles', error);
    }
  },

  createUser: async (payload: CreateUserPayload) => {
    set({ isLoading: true, error: null });
    try {
      const newUser = await userService.createUser(payload);
      set((state) => ({ users: [...state.users, newUser], isLoading: false }));

      // Refresh role list so the new role appears in the dropdown
      await get().fetchRoles();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateUser: async (id: string, payload: UpdateUserPayload) => {
    set({ isLoading: true, error: null });
    try {
      const updatedUser = await userService.updateUser(id, payload);
      // Patch the updated user in-place — backend response is source of truth
      set((state) => ({
        users: state.users.map(u => u.id === id ? updatedUser : u),
        isLoading: false,
      }));
      // Refresh roles in case the role name changed
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
      // Remove the deleted user from state in-place — no full refetch needed
      set((state) => ({
        users: state.users.filter(u => u.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  changeStatus: async (id: string, status: 'active' | 'inactive' | 'Active' | 'Inactive') => {
    set({ isLoading: true, error: null });
    try {
      const backendStatus = status.toLowerCase() as 'active' | 'inactive';
      await userService.changeUserStatus(id, backendStatus);
      // Patch the user status in-place — no full refetch needed
      set((state) => ({
        users: state.users.map(u => u.id === id ? { ...u, status: backendStatus as any } : u),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  }
}));
