import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { User, CreateUserPayload } from '../../types/user';
import { PermissionSelector } from './PermissionSelector';
import { useUserStore } from '../../store/userStore';
import toast from 'react-hot-toast';

interface UserFormModalProps {
  user?: User;
  onClose: () => void;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({ user, onClose }) => {
  const { createUser, updateUser } = useUserStore();
  const isEditing = !!user;

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState(user?.role || '');
  const [assignedScreens, setAssignedScreens] = useState<string[]>(user?.assignedScreens || []);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset fields whenever user prop changes
  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setPassword('');
    setConfirmPassword('');
    setRole(user?.role || '');
    setAssignedScreens(user?.assignedScreens || []);
    setError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [user]);

  const adminScreensStr = localStorage.getItem('assignedScreens');
  const allowedScreens = adminScreensStr ? JSON.parse(adminScreensStr) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) return setError('Name is required');
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setError('Valid email is required');
    if (!role.trim()) return setError('Role is required');
    
    if (!isEditing) {
      if (!password) return setError('Password is required');
      if (password !== confirmPassword) return setError('Passwords do not match');
      if (password.length < 6) return setError('Password must be at least 6 characters');
    }

    if (assignedScreens.length === 0) return setError('At least one screen must be assigned');
    const invalidScreens = assignedScreens.filter(s => !allowedScreens.includes(s));
    if (invalidScreens.length > 0) return setError('Selected screens include unauthorized permissions');

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateUser(user.id, {
          name,
          email,
          role,
          assignedRole: role,
          assignedScreens
        });
        toast.success('User updated successfully.');
      } else {
        await createUser({
          name,
          email,
          password,
          role,
          assignedRole: role,
          assignedScreens
        });
        toast.success('User created successfully.');
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">
            {isEditing ? 'Edit User' : 'Create New User'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}

          <form id="user-form" onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="new_user_fullname"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  name="new_user_account_email"
                  autoComplete="new-password"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="john@example.com"
                />
              </div>

              {/* Role (Text Input) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Role <span className="text-xs font-normal text-slate-500 ml-2">(Enter role name to create or assign)</span></label>
                <input
                  type="text"
                  name="new_user_role"
                  autoComplete="off"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={user?.isPrimaryAdmin}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all disabled:opacity-50"
                  placeholder="e.g. Cashier, Store Manager"
                />
              </div>

              {/* Passwords (Only for Create) */}
              {!isEditing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="new_user_account_password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="new_user_account_confirm_password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Permissions */}
            <div>
              <PermissionSelector 
                selectedScreens={assignedScreens}
                onChange={setAssignedScreens}
                disabled={user?.isPrimaryAdmin}
              />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create User'}
          </button>
        </div>

      </div>
    </div>
  );
};
