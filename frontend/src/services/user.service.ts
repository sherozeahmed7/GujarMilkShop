import { mockUserRepository } from '../repositories/mock-user.repository';
import { apiClient } from './apiClient';
import { User, CreateUserPayload, UpdateUserPayload } from '../types/user';
import { activityLogger } from './activityLogger';

// For now, hardcode mock repository.
// Later, this can switch to apiUserRepository.
const repository = mockUserRepository;

export const userService = {
  getUsers: async (filters?: { name?: string; role?: string; status?: string }): Promise<User[]> => {
    const params: Record<string, string> = {};
    if (filters?.name?.trim())   params.name   = filters.name.trim();
    if (filters?.role?.trim())   params.role   = filters.role.trim();
    if (filters?.status?.trim()) params.status = filters.status.trim().toLowerCase();

    const response = await apiClient.get('/users', Object.keys(params).length ? params : undefined);
    return response.data as User[];
  },

  getUserById: async (id: string): Promise<User | null> => {
    return repository.getUserById(id);
  },

  /**
   * Fetches all unique role names from the backend.
   * Used to populate the role filter dropdown dynamically.
   * GET /api/users/roles
   */
  getRoles: async (): Promise<string[]> => {
    const response = await apiClient.get('/users/roles');
    return response.data as string[];
  },

  createUser: async (payload: CreateUserPayload): Promise<User> => {
    const apiPayload: any = {
      email: payload.email,
      password: payload.password,
      assignedRole: payload.assignedRole || payload.role,
      assignedScreens: payload.assignedScreens
    };
    
    if (payload.name && payload.name.trim() !== '') {
      apiPayload.name = payload.name;
    }

    const response = await apiClient.post('/users', apiPayload);
    const user = response.data;
    
    activityLogger.log({
      action: 'USER_CREATED',
      module: 'Users & Roles',
      description: `Created user ${user.name} (${user.email}) with role ${user.role}`,
      status: 'Success'
    });
    return user;
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<User> => {
    // Build only the fields the backend expects
    const apiPayload: any = {
      email: payload.email,
      role: payload.role,
      assignedScreens: payload.assignedScreens,
    };
    if (payload.name && payload.name.trim() !== '') {
      apiPayload.name = payload.name;
    }

    const response = await apiClient.put(`/users/${id}`, apiPayload);
    const user = response.data;

    activityLogger.log({
      action: 'USER_UPDATED',
      module: 'Users & Roles',
      description: `Updated user ${user.name} (${user.email})`,
      status: 'Success'
    });
    return user;
  },

  deleteUser: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
    activityLogger.log({
      action: 'USER_DELETED',
      module: 'Users & Roles',
      description: `Deleted user ID ${id}`,
      status: 'Success'
    });
  },

  changeUserStatus: async (id: string, status: 'active' | 'inactive' | 'Active' | 'Inactive'): Promise<void> => {
    const backendStatus = status.toLowerCase(); // Ensure lowercase 'active' or 'inactive'
    await apiClient.patch(`/users/${id}/status`, { status: backendStatus });
    
    activityLogger.log({
      action: backendStatus === 'active' ? 'USER_ENABLED' : 'USER_DISABLED',
      module: 'Users & Roles',
      description: `Changed user status to ${backendStatus}`,
      status: 'Success'
    });
  },

  /**
   * Admin resets another user's password.
   * PATCH /api/users/admin-reset-password
   * adminPassword = the super_admin's own password (verification).
   * targetUserId  = the user whose password is being reset.
   */
  changeUserPassword: async (adminPassword: string, targetUserId: string, newPassword: string): Promise<void> => {
    await apiClient.patch('/users/admin-reset-password', {
      userId: Number(targetUserId),
      adminPassword,
      newPassword,
    });
    activityLogger.log({
      action: 'USER_PASSWORD_CHANGED',
      module: 'Users & Roles',
      description: `Admin reset password for user ID ${targetUserId}`,
      status: 'Warning'
    });
  },

  /**
   * Admin changes their own password.
   * PATCH /api/users/change-password
   * userId is read from localStorage (set at login).
   */
  changeOwnPassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const userId = Number(localStorage.getItem('userId'));
    if (!userId) throw new Error('User session not found. Please log in again.');

    await apiClient.patch('/users/change-password', {
      userId,
      currentPassword,
      newPassword,
    });
    activityLogger.log({
      action: 'ADMIN_PASSWORD_CHANGED',
      module: 'Users & Roles',
      description: `Admin changed their own password`,
      status: 'Warning'
    });
  }
};
