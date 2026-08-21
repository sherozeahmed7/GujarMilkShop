import { User, CreateUserPayload, UpdateUserPayload } from '../types/user';

export interface UserRepository {
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  createUser(payload: CreateUserPayload): Promise<User>;
  updateUser(id: string, payload: UpdateUserPayload): Promise<User>;
  deleteUser(id: string): Promise<void>;
  changePassword(id: string, newPasswordHash: string): Promise<void>;
  updateStatus(id: string, status: 'Active' | 'Inactive'): Promise<void>;
}
