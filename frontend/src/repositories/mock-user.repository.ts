import { UserRepository } from './user.repository';
import { User, CreateUserPayload, UpdateUserPayload } from '../types/user';
import { ALL_SCREENS } from '../config/screenPermissions';

const STORAGE_KEY = 'gujar_mock_users';

export class MockUserRepository implements UserRepository {
  private getUsersFromStorage(): User[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      // Initialize with a Primary Admin
      const initialAdmin: User = {
        id: 'primary-admin',
        name: 'System Admin',
        email: 'admin@example.com',
        role: 'Admin',
        assignedRole: 'Admin',
        assignedScreens: [...ALL_SCREENS],
        status: 'Active',
        createdAt: new Date().toISOString(),
        isPrimaryAdmin: true,
      };
      // We will also store the mock passwords in another key just for simulation
      localStorage.setItem('gujar_mock_passwords', JSON.stringify({ 'primary-admin': 'admin123' }));
      const initialUsers = [initialAdmin];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialUsers));
      return initialUsers;
    }
    return JSON.parse(data);
  }

  private saveUsersToStorage(users: User[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  private async simulateDelay() {
    return new Promise(resolve => setTimeout(resolve, 300));
  }

  async getUsers(): Promise<User[]> {
    await this.simulateDelay();
    return this.getUsersFromStorage();
  }

  async getUserById(id: string): Promise<User | null> {
    await this.simulateDelay();
    const users = this.getUsersFromStorage();
    return users.find(u => u.id === id) || null;
  }

  async createUser(payload: CreateUserPayload): Promise<User> {
    await this.simulateDelay();
    const users = this.getUsersFromStorage();
    
    if (users.some(u => u.email === payload.email)) {
      throw new Error('Email is already in use.');
    }

    const newUser: User = {
      id: `usr_${Date.now()}`,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      assignedRole: payload.assignedRole,
      assignedScreens: payload.assignedScreens,
      status: 'Active',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsersToStorage(users);

    // Save password
    if (payload.password) {
      const passwords = JSON.parse(localStorage.getItem('gujar_mock_passwords') || '{}');
      passwords[newUser.id] = payload.password; // Plaintext for mock purposes only
      localStorage.setItem('gujar_mock_passwords', JSON.stringify(passwords));
    }

    return newUser;
  }

  async updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
    await this.simulateDelay();
    const users = this.getUsersFromStorage();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');

    const user = users[index];

    // Primary admin protections
    if (user.isPrimaryAdmin) {
      if (payload.status === 'Inactive') throw new Error('Cannot disable Primary Admin');
      if (payload.role && payload.role !== 'Admin') throw new Error('Cannot change Primary Admin role');
    }

    const updatedUser = { ...user, ...payload };
    users[index] = updatedUser;
    this.saveUsersToStorage(users);
    
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await this.simulateDelay();
    let users = this.getUsersFromStorage();
    const user = users.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    if (user.isPrimaryAdmin) throw new Error('Cannot delete Primary Admin');

    users = users.filter(u => u.id !== id);
    this.saveUsersToStorage(users);

    // Remove password
    const passwords = JSON.parse(localStorage.getItem('gujar_mock_passwords') || '{}');
    delete passwords[id];
    localStorage.setItem('gujar_mock_passwords', JSON.stringify(passwords));
  }

  async changePassword(id: string, newPasswordHash: string): Promise<void> {
    await this.simulateDelay();
    const users = this.getUsersFromStorage();
    if (!users.some(u => u.id === id)) throw new Error('User not found');

    const passwords = JSON.parse(localStorage.getItem('gujar_mock_passwords') || '{}');
    passwords[id] = newPasswordHash;
    localStorage.setItem('gujar_mock_passwords', JSON.stringify(passwords));
  }

  async updateStatus(id: string, status: 'Active' | 'Inactive'): Promise<void> {
    await this.simulateDelay();
    const users = this.getUsersFromStorage();
    const user = users.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    if (user.isPrimaryAdmin && status === 'Inactive') throw new Error('Cannot disable Primary Admin');

    user.status = status;
    this.saveUsersToStorage(users);
  }
}

export const mockUserRepository = new MockUserRepository();
