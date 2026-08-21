import { mockRoleRepository } from '../repositories/mock-role.repository';
import { Role, CreateRolePayload, UpdateRolePayload } from '../types/role';

const repository = mockRoleRepository;

export const roleService = {
  getRoles: async (): Promise<Role[]> => {
    return repository.getRoles();
  },

  createRole: async (payload: CreateRolePayload): Promise<Role> => {
    return repository.createRole(payload);
  },

  updateRole: async (id: string, payload: UpdateRolePayload): Promise<Role> => {
    return repository.updateRole(id, payload);
  },

  deleteRole: async (id: string): Promise<void> => {
    return repository.deleteRole(id);
  }
};
