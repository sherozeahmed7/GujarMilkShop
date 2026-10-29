export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedRole: string;
  assignedScreens: string[];
  status: 'Active' | 'Inactive';
  createdAt: string;
  isPrimaryAdmin?: boolean;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password?: string;
  assignedRole: string;
  role: string;
  assignedScreens: string[];
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: string;
  assignedRole?: string;
  assignedScreens?: string[];
  status?: 'Active' | 'Inactive';
  password?: string;
}
