import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { UsersTable } from '../../components/users/UsersTable';
import { UserFormModal } from '../../components/users/UserFormModal';
import { UserPermissionsModal } from '../../components/users/UserPermissionsModal';
import { ChangePasswordModal } from '../../components/users/ChangePasswordModal';
import { DeleteUserModal } from '../../components/users/DeleteUserModal';
import { User } from '../../types/user';

export const UsersRoles: React.FC = () => {
  const { users, roles, isLoading, error, fetchUsers, fetchRoles, changeStatus } = useUserStore();

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

  const [viewingPermissionsUser, setViewingPermissionsUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null); // null means own password if another state is set, wait, let's use a separate state or just pass undefined to mean 'own'
  const [isChangingOwnPassword, setIsChangingOwnPassword] = useState(false);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  // Dynamic role list based on actual users and existing roles
  const availableRoles = useMemo(() => {
    const roleNames = new Set<string>();
    roles.forEach(r => roleNames.add(r.name));
    users.forEach(u => roleNames.add(u.role));
    return Array.from(roleNames).sort();
  }, [roles, users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Status
      if (statusFilter !== 'All' && u.status !== statusFilter) return false;
      // Role
      if (roleFilter !== 'All' && u.role !== roleFilter) return false;
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, statusFilter, roleFilter, searchQuery]);

  const handleAddClick = () => {
    setEditingUser(undefined);
    setIsFormModalOpen(true);
  };

  const handleToggleStatus = async (user: User) => {
    if (user.isPrimaryAdmin) return;
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    // Ideally use confirmation for disable
    if (newStatus === 'Inactive') {
      if (!window.confirm(`Are you sure you want to disable ${user.name}?`)) return;
    }
    await changeStatus(user.id, newStatus);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Users & Roles</h1>
          <p className="text-slate-500 text-sm mt-1">Manage users, roles, and screen permissions.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsChangingOwnPassword(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-medium shadow-sm transition-colors"
          >
            Change My Password
          </button>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add User
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 flex-shrink-0">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
              >
                <option value="All">All Roles</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-red-500 bg-red-50 px-4 py-3 rounded-lg border border-red-100">
                Failed to load users: {error}
              </div>
            </div>
          ) : (
            <UsersTable
              users={filteredUsers}
              onViewPermissions={setViewingPermissionsUser}
              onEdit={(u) => { setEditingUser(u); setIsFormModalOpen(true); }}
              onChangePassword={setPasswordUser}
              onToggleStatus={handleToggleStatus}
              onDelete={setDeletingUser}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {isFormModalOpen && (
        <UserFormModal
          user={editingUser}
          onClose={() => setIsFormModalOpen(false)}
        />
      )}

      {viewingPermissionsUser && (
        <UserPermissionsModal
          user={viewingPermissionsUser}
          onClose={() => setViewingPermissionsUser(null)}
        />
      )}

      {(passwordUser || isChangingOwnPassword) && (
        <ChangePasswordModal
          user={passwordUser || undefined}
          onClose={() => {
            setPasswordUser(null);
            setIsChangingOwnPassword(false);
          }}
        />
      )}

      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
        />
      )}
    </div>
  );
};
