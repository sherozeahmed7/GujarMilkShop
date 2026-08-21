export interface Role {
  id: string;
  name: string;
  assignedScreens: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRolePayload {
  name: string;
  assignedScreens: string[];
}

export interface UpdateRolePayload {
  name?: string;
  assignedScreens?: string[];
}
