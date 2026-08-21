import { Role, CreateRolePayload, UpdateRolePayload } from '../types/role';

export interface RoleRepository {
  getRoles(): Promise<Role[]>;
  getRoleById(id: string): Promise<Role | null>;
  createRole(payload: CreateRolePayload): Promise<Role>;
  updateRole(id: string, payload: UpdateRolePayload): Promise<Role>;
  deleteRole(id: string): Promise<void>;
}
