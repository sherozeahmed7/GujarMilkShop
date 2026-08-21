import { RoleRepository } from './role.repository';
import { Role, CreateRolePayload, UpdateRolePayload } from '../types/role';
import { ALL_SCREENS } from '../config/screenPermissions';

const STORAGE_KEY = 'gujar_mock_roles';

export class MockRoleRepository implements RoleRepository {
  private getRolesFromStorage(): Role[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      const initialRoles: Role[] = [
        {
          id: 'role_admin',
          name: 'Admin',
          assignedScreens: [...ALL_SCREENS],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'role_cashier',
          name: 'Cashier',
          assignedScreens: ['Dashboard', 'Point of Sale', 'Customers', 'Returns', 'Cash Register'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialRoles));
      return initialRoles;
    }
    return JSON.parse(data);
  }

  private saveRolesToStorage(roles: Role[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
  }

  private async simulateDelay() {
    return new Promise(resolve => setTimeout(resolve, 300));
  }

  async getRoles(): Promise<Role[]> {
    await this.simulateDelay();
    return this.getRolesFromStorage();
  }

  async getRoleById(id: string): Promise<Role | null> {
    await this.simulateDelay();
    const roles = this.getRolesFromStorage();
    return roles.find(r => r.id === id) || null;
  }

  async createRole(payload: CreateRolePayload): Promise<Role> {
    await this.simulateDelay();
    const roles = this.getRolesFromStorage();
    
    // Check if role name already exists (case insensitive)
    const existingRole = roles.find(r => r.name.toLowerCase() === payload.name.toLowerCase());
    if (existingRole) {
      return existingRole; // Return existing if name matches, simulating reusing roles
    }

    const newRole: Role = {
      id: `role_${Date.now()}`,
      name: payload.name,
      assignedScreens: payload.assignedScreens,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    roles.push(newRole);
    this.saveRolesToStorage(roles);
    return newRole;
  }

  async updateRole(id: string, payload: UpdateRolePayload): Promise<Role> {
    await this.simulateDelay();
    const roles = this.getRolesFromStorage();
    const index = roles.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Role not found');

    if (roles[index].name === 'Admin') throw new Error('Cannot modify Admin role structure');

    const updatedRole = { 
      ...roles[index], 
      ...payload,
      updatedAt: new Date().toISOString()
    };
    roles[index] = updatedRole;
    this.saveRolesToStorage(roles);
    return updatedRole;
  }

  async deleteRole(id: string): Promise<void> {
    await this.simulateDelay();
    let roles = this.getRolesFromStorage();
    const role = roles.find(r => r.id === id);
    if (!role) throw new Error('Role not found');
    if (role.name === 'Admin') throw new Error('Cannot delete Admin role');

    roles = roles.filter(r => r.id !== id);
    this.saveRolesToStorage(roles);
  }
}

export const mockRoleRepository = new MockRoleRepository();
