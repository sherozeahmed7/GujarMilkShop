import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { UsersTable } from '../../components/users/UsersTable';
import { UserFormModal } from '../../components/users/UserFormModal';
import { UserPermissionsModal } from '../../components/users/UserPermissionsModal';
import { ChangePasswordModal } from '../../components/users/ChangePasswordModal';
import { DeleteUserModal } from '../../components/users/DeleteUserModal';
import { ToggleStatusModal } from '../../components/users/ToggleStatusModal';
import { User } from '../../types/user';
import { useDebounce } from '../../hooks/useDebounce';

export const UsersRoles: React.FC = () => {
  const { users, roles, isLoading, error, fetchUsers, fetchRoles, changeStatus } = useUserStore();

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

  const [viewingPermissionsUser, setViewingPermissionsUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [isChangingOwnPassword, setIsChangingOwnPassword] = useState(false);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [togglingStatusUser, setTogglingStatusUser] = useState<User | null>(null);

  // Filters (raw input values)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'active' | 'inactive'>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  // Debounce search so we don't hammer the API on every keystroke
  const debouncedSearch = useDebounce(searchQuery, 400);

  // Fetch users from backend whenever debounced search or filters change
  useEffect(() => {
    const filters: { name?: string; role?: string; status?: string } = {};
    if (debouncedSearch.trim()) filters.name = debouncedSearch.trim();
    if (roleFilter !== 'All')   filters.role = roleFilter;
    if (statusFilter !== 'All') filters.status = statusFilter;
    fetchUsers(filters);
  }, [debouncedSearch, roleFilter, statusFilter, fetchUsers]);

  // Fetch roles once on mount (still used for the role dropdown)
  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Dynamic role list — backend roles + any additional roles seen on loaded users
  const availableRoles = useMemo(() => {
    const roleNames = new Set<string>(roles);
    users.forEach(u => { if (u.role) roleNames.add(u.role); });
    return Array.from(roleNames).sort();
  }, [roles, users]);

  const handleAddClick = () => {
    setEditingUser(undefined);
    setIsFormModalOpen(true);
  };

  const handleToggleStatus = (user: User) => {
    if (user.isPrimaryAdmin) return;
    setTogglingStatusUser(user);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">Users &amp; Roles</h1>
          <p className="text-slate-500 dark:text-[#8ba895] text-sm mt-1">Manage users, roles, and screen permissions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsChangingOwnPassword(true)}
            className="flex items-center gap-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#142119] text-slate-700 dark:text-[#e2f5e8] px-4 py-2 rounded-xl font-medium shadow-sm transition-colors"
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
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-[#2d4a35] flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-900/20 flex-shrink-0">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-lg text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
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
              className="bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
            >
              <option value="All">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table Area */}
        <div className="w-full overflow-x-auto relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-10">
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
              users={users}
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

      {togglingStatusUser && (
        <ToggleStatusModal
          user={togglingStatusUser}
          onClose={() => setTogglingStatusUser(null)}
        />
      )}
    </div>
  );
};
