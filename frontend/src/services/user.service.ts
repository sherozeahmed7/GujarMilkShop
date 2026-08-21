import { mockUserRepository } from '../repositories/mock-user.repository';
import { User, CreateUserPayload, UpdateUserPayload } from '../types/user';
import { activityLogger } from './activityLogger';

// For now, hardcode mock repository.
// Later, this can switch to apiUserRepository.
const repository = mockUserRepository;

export const userService = {
  getUsers: async (): Promise<User[]> => {
    return repository.getUsers();
  },

  getUserById: async (id: string): Promise<User | null> => {
    return repository.getUserById(id);
  },

  createUser: async (payload: CreateUserPayload): Promise<User> => {
    const user = await repository.createUser(payload);
    activityLogger.log({
      action: 'USER_CREATED',
      module: 'Users & Roles',
      description: `Created user ${user.name} (${user.email}) with role ${user.role}`,
      status: 'Success'
    });
    return user;
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<User> => {
    const user = await repository.updateUser(id, payload);
    activityLogger.log({
      action: 'USER_UPDATED',
      module: 'Users & Roles',
      description: `Updated user ${user.name}`,
      status: 'Success'
    });
    return user;
  },

  deleteUser: async (id: string): Promise<void> => {
    const user = await repository.getUserById(id);
    if (!user) throw new Error('User not found');
    
    await repository.deleteUser(id);
    activityLogger.log({
      action: 'USER_DELETED',
      module: 'Users & Roles',
      description: `Deleted user ${user.name}`,
      status: 'Success'
    });
  },

  changeUserStatus: async (id: string, status: 'Active' | 'Inactive'): Promise<void> => {
    await repository.updateStatus(id, status);
    activityLogger.log({
      action: status === 'Active' ? 'USER_ENABLED' : 'USER_DISABLED',
      module: 'Users & Roles',
      description: `Changed user status to ${status}`,
      status: 'Success'
    });
  },

  verifyAdminPassword: async (password: string): Promise<boolean> => {
    // Mock implementation for checking admin password
    const passwords = JSON.parse(localStorage.getItem('gujar_mock_passwords') || '{}');
    const adminPass = passwords['primary-admin'];
    return password === adminPass;
  },

  changeUserPassword: async (adminPassword: string, targetUserId: string, newPassword: string): Promise<void> => {
    const isVerified = await userService.verifyAdminPassword(adminPassword);
    if (!isVerified) throw new Error('Admin password is incorrect.');
    
    await repository.changePassword(targetUserId, newPassword);
    activityLogger.log({
      action: 'USER_PASSWORD_CHANGED',
      module: 'Users & Roles',
      description: `Admin changed password for a user`,
      status: 'Warning'
    });
  },

  changeOwnPassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const passwords = JSON.parse(localStorage.getItem('gujar_mock_passwords') || '{}');
    // Using primary-admin for this mock scenario since the logged-in user is an admin
    if (currentPassword !== passwords['primary-admin']) {
      throw new Error('Current password is incorrect.');
    }
    
    await repository.changePassword('primary-admin', newPassword);
    activityLogger.log({
      action: 'ADMIN_PASSWORD_CHANGED',
      module: 'Users & Roles',
      description: `Admin changed their own password`,
      status: 'Warning'
    });
  }
};
