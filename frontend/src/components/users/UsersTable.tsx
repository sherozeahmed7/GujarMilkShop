import React from 'react';
import { User } from '../../types/user';
import { UserActionsMenu } from './UserActionsMenu';
import { format } from 'date-fns'; // Assuming date-fns is available, or we'll use native Date

interface UsersTableProps {
  users: User[];
  onViewPermissions: (user: User) => void;
  onEdit: (user: User) => void;
  onChangePassword: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onDelete: (user: User) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  onViewPermissions,
  onEdit,
  onChangePassword,
  onToggleStatus,
  onDelete
}) => {
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Screens</th>
            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{user.name}</div>
                    {user.isPrimaryAdmin && (
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Primary Admin</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-slate-600">{user.email}</td>
              <td className="py-3 px-4">
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {user.role}
                </span>
              </td>
              <td className="py-3 px-4">
                <button 
                  onClick={() => onViewPermissions(user)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  {user.assignedScreens.length} screens
                </button>
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                  user.status === 'Active' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {user.status}
                </span>
              </td>
              <td className="py-3 px-4 text-sm text-slate-500">{formatDate(user.createdAt)}</td>
              <td className="py-3 px-4 text-right">
                <UserActionsMenu 
                  user={user}
                  onViewPermissions={onViewPermissions}
                  onEdit={onEdit}
                  onChangePassword={onChangePassword}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                />
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={7} className="py-12 text-center text-slate-500">
                No users found matching the criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
