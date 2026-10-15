import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Droplets,
  Leaf,
  CheckCircle2,
  ArrowLeft,
  UserRound,
  Clock,
  AlertCircle,
  Banknote,
  Sparkles,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

interface LoginUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

function formatRole(role: string): string {
  return (role || 'user')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Distinct avatar colors by role key */
function roleAvatarClass(role: string): string {
  const key = (role || '').toLowerCase();
  if (key.includes('super')) return 'bg-[#166534] text-white ring-[#FEF3C7]';
  if (key.includes('admin') || key.includes('manager')) return 'bg-sky-700 text-white ring-sky-100';
  if (key.includes('cashier') || key.includes('counter')) return 'bg-amber-600 text-white ring-amber-100';
  if (key.includes('accountant') || key.includes('finance')) return 'bg-violet-700 text-white ring-violet-100';
  return 'bg-slate-700 text-white ring-slate-200';
}

export const Login: React.FC = () => {
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [selected, setSelected] = useState<LoginUser | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const MAX_RETRIES = 10;
    const RETRY_DELAY = 500;

    const fetchUsers = async (attempt: number) => {
      try {
        const response = await apiClient.get('/auth/login-users');
        const list = (response.data || []) as LoginUser[];
        if (!cancelled) {
          setUsers(list);
          setLoadingUsers(false);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (attempt < MAX_RETRIES) {
          // Backend just became ready — give it a moment and retry
          setTimeout(() => fetchUsers(attempt + 1), RETRY_DELAY);
        } else {
          setUsersError(err?.message || 'Could not load users. Check that the server is running.');
          setUsers([]);
          setLoadingUsers(false);
        }
      }
    };

    setLoadingUsers(true);
    setUsersError('');
    fetchUsers(0);

    return () => {
      cancelled = true;
    };
  }, []);


  const roleCount = useMemo(() => {
    const set = new Set(users.map((u) => (u.role || 'user').toLowerCase()));
    return set.size;
  }, [users]);

  const selectUser = (user: LoginUser) => {
    setSelected(user);
    setPassword('');
    setPasswordError('');
    setAuthError('');
    setShowPassword(false);
  };

  const clearSelection = () => {
    setSelected(null);
    setPassword('');
    setPasswordError('');
    setAuthError('');
  };

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftError, setShiftError] = useState('');
  const [pendingLoginData, setPendingLoginData] = useState<{ accessToken: string; user: any } | null>(null);

  const completeLoginSession = (accessToken: string, user: any) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('userId', String(user.id));
    localStorage.setItem('role', user.role);
    localStorage.setItem('userName', user.name || user.email || 'User');
    localStorage.setItem('assignedScreens', JSON.stringify(user.assignedScreens));

    toast.success('Login successful! Redirecting...');
    setTimeout(() => navigate('/'), 400);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setAuthError('');

    if (!selected) {
      setAuthError('Select a user to continue.');
      return;
    }
    if (!password.trim()) {
      setPasswordError('Password is required.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', {
        email: selected.email,
        password,
      });

      if (response && response.status === 'success' && response.data) {
        const { accessToken, user } = response.data;
        const roleKey = (user.role || '').toLowerCase().trim();

        // If user is super_admin, proceed directly without shift prompt
        if (roleKey === 'super_admin') {
          completeLoginSession(accessToken, user);
          return;
        }

        // For any role other than super_admin:
        // Set token temporarily in localStorage so shift API calls work with auth header
        localStorage.setItem('token', accessToken);

        try {
          // Check if there is already an open shift
          const shiftRes = await apiClient.get('/shifts');
          const shifts = (shiftRes.data || []) as any[];
          const hasOpenShift = shifts.some((s: any) => s.status === 'Open');

          if (hasOpenShift) {
            // Already an open shift, complete login directly
            completeLoginSession(accessToken, user);
          } else {
            // Prompt for opening balance popup
            setPendingLoginData({ accessToken, user });
            setOpeningBalance('');
            setOpeningNotes('');
            setShiftError('');
            setShowShiftModal(true);
          }
        } catch (shiftFetchErr) {
          // If check fails, still prompt opening balance modal to allow auto-open
          setPendingLoginData({ accessToken, user });
          setOpeningBalance('');
          setOpeningNotes('');
          setShiftError('');
          setShowShiftModal(true);
        }
      } else {
        const msg = response.message || '';
        if (msg.toLowerCase().includes('inactive')) {
          setAuthError('Your account is currently inactive. Please contact the administrator.');
        } else {
          setAuthError('Incorrect password for this user.');
        }
      }
    } catch (error: any) {
      const msg: string = error.message || '';
      if (msg.toLowerCase().includes('inactive')) {
        setAuthError('Your account is currently inactive. Please contact the administrator.');
      } else {
        setAuthError('Incorrect password for this user.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShiftAndProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingLoginData) return;

    const cash = parseFloat(openingBalance);
    if (isNaN(cash) || cash < 0) {
      setShiftError('Please enter a valid opening balance (0 or greater).');
      return;
    }

    setShiftSubmitting(true);
    setShiftError('');
    try {
      await apiClient.post('/shifts', {
        openingCash: cash,
        openingNotes: openingNotes.trim(),
      });
      toast.success(`Shift opened with Rs. ${cash.toLocaleString()} opening balance!`);
      setShowShiftModal(false);
      completeLoginSession(pendingLoginData.accessToken, pendingLoginData.user);
    } catch (err: any) {
      const msg = err?.message || 'Failed to open shift. Please try again.';
      // If error is that a shift is already open, proceed anyway
      if (msg.toLowerCase().includes('currently open') || msg.toLowerCase().includes('already open')) {
        setShowShiftModal(false);
        completeLoginSession(pendingLoginData.accessToken, pendingLoginData.user);
      } else {
        setShiftError(msg);
      }
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCancelShiftModal = () => {
    // Clear temporary token if user cancels shift opening
    localStorage.removeItem('token');
    setShowShiftModal(false);
    setPendingLoginData(null);
    setOpeningBalance('');
    setOpeningNotes('');
    setShiftError('');
  };

  return (
    <div className="min-h-screen w-full bg-[#edf1ee] dark:bg-[#0d1a10] overflow-hidden">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative hidden lg:flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(254,243,199,0.7),_transparent_40%),linear-gradient(135deg,#fffdf5_0%,#fef3c7_30%,#f0fdf4_70%,#dcfce7_100%)] p-10">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 30%), radial-gradient(circle at 75% 70%, rgba(22,101,52,0.15) 0, rgba(22,101,52,0) 35%)',
            }}
          />

          <div className="relative w-full max-w-xl rounded-[36px] border border-white/80 bg-white/40 backdrop-blur-md p-8 shadow-[0_30px_80px_rgba(22,101,52,0.08)]">
            <div className="flex items-center justify-center mb-10">
              <BrandLogo variant="login" />
            </div>

            <div className="relative mx-auto mb-8 flex h-72 w-72 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#FEF3C7] to-[#dcfce7] blur-3xl opacity-90" />
              <div className="relative h-44 w-32 rounded-[34px] border-[10px] border-[#fbf9f4] bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)] shadow-[0_25px_40px_rgba(22,101,52,0.12)]">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 h-10 w-12 rounded-t-[22px] border-[7px] border-[#f6f2ea] border-b-0 bg-white" />
                <div className="absolute inset-x-5 top-5 bottom-5 rounded-[22px] bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)]" />
                <div className="absolute left-1/2 top-16 -translate-x-1/2 text-[#166534]">
                  <Droplets className="w-12 h-12" />
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#FEF3C7] border-4 border-white flex items-center justify-center text-[#166534] shadow-xs">
                  <Leaf className="w-4 h-4" />
                </div>
              </div>

              <div className="absolute left-3 bottom-10 h-20 w-24 rounded-[22px] bg-[#FEF3C7] border border-[#FDE68A] shadow-sm rotate-[-20deg]">
                <div className="absolute inset-x-2 top-3 h-2 rounded-full bg-[#fde68a]" />
                <div className="absolute inset-x-3 bottom-4 flex justify-between text-[#78350F]">
                  <span className="text-[10px] font-black">Milk</span>
                  <span className="text-[10px] font-black">Fresh</span>
                </div>
              </div>

              <div className="absolute right-4 bottom-16 h-16 w-16 rounded-full bg-[#FEF3C7] border-4 border-white flex items-center justify-center text-[#166534] shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-800 text-base font-semibold">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#166534]" />
                Fresh milk & dairy billing
              </div>
              <div className="flex items-center gap-3 text-slate-800 text-base font-semibold">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#d97706]" />
                Khata ledger & customer accounts
              </div>
              <div className="flex items-center gap-3 text-slate-800 text-base font-semibold">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#15803d]" />
                Fast daily counter operations
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#142119] px-6 py-10 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center mb-8 lg:hidden">
              <BrandLogo variant="login" className="mb-4" />
              <h1 className="text-2xl font-black text-[#166534] dark:text-[#22c55e] mt-2">Gujar Milk Shop</h1>
              <p className="text-[11px] text-[#78350F] dark:text-[#fcd34d] bg-[#FEF3C7] dark:bg-[#2a1f0a] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-[0.2em] mt-1.5">
                POS Management System
              </p>
            </div>

            <div className="mb-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#166534] dark:text-[#22c55e] mb-2">
                Welcome
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-[#e2f5e8]">
                {selected ? 'Enter password' : 'Who is signing in?'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-[#64916e] mt-1.5">
                {selected
                  ? `Continue as ${selected.name}`
                  : loadingUsers
                    ? 'Loading users…'
                    : users.length > 0
                      ? `${users.length} user${users.length === 1 ? '' : 's'} · ${roleCount} role${roleCount === 1 ? '' : 's'} on this system`
                      : 'No active users found'}
              </p>
            </div>

            {authError && (
              <div className="mb-5 px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 font-medium">
                {authError}
              </div>
            )}

            {usersError && (
              <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
                {usersError}
              </div>
            )}

            {!selected ? (
              <div>
                {loadingUsers ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading users…
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-2">
                    <UserRound className="w-10 h-10 text-slate-200" />
                    <p className="text-sm font-medium">No active users to show</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => selectUser(user)}
                        className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-[#f0fdf4] hover:border-[#166534]/30 px-3 py-4 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#166534]/30"
                      >
                        <span
                          className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-black shadow-sm ring-4 ${roleAvatarClass(
                            user.role
                          )} group-hover:scale-105 transition-transform`}
                        >
                          {initials(user.name)}
                        </span>
                        <span className="text-sm font-bold text-slate-800 text-center leading-tight line-clamp-2">
                          {user.name}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          {formatRole(user.role)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-black ring-4 ${roleAvatarClass(
                      selected.role
                    )}`}
                  >
                    {initials(selected.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">{selected.name}</p>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                      {formatRole(selected.role)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#166534] px-2 py-1.5 rounded-lg hover:bg-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Change
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Password for {formatRole(selected.role)}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                        setAuthError('');
                      }}
                      placeholder="Enter password"
                      autoFocus
                      className={`w-full bg-slate-50 border rounded-xl py-3 pl-9 pr-10 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all ${
                        passwordError
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-slate-200 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/20'
                      }`}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="mt-1.5 text-xs text-rose-600">{passwordError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#166534] hover:bg-[#14532d] active:bg-[#0f3d21] text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-150 shadow-md shadow-[#166534]/25 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            )}

            <p className="text-center text-[11px] text-slate-400 mt-7">
              Gujar Milk Shop POS &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>

      {/* Auto-Open Shift: Opening Balance Popup Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1a2e1f] rounded-3xl shadow-2xl border border-slate-100 dark:border-[#2d4a35] max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Banner */}
            <div className="bg-[radial-gradient(ellipse_at_top,_rgba(254,243,199,0.8),_transparent_60%),linear-gradient(135deg,#f0fdf4_0%,#dcfce7_100%)] dark:bg-[linear-gradient(135deg,#162b1b_0%,#1e3b26_100%)] px-6 py-5 border-b border-slate-100 dark:border-[#2d4a35] relative">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] flex items-center justify-center shadow-md shadow-[#166534]/20 shrink-0">
                  <Banknote className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#166534] dark:text-[#22c55e]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Auto Shift Start
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-[#e2f5e8] leading-snug">
                    Enter Opening Balance
                  </h3>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleOpenShiftAndProceed} className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-[#2a1f0a] border border-amber-200 dark:border-[#3d2f12] rounded-2xl p-3.5 flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-900 dark:text-[#fcd34d] font-medium leading-relaxed">
                  Logging in as <span className="font-bold">{pendingLoginData?.user?.name || selected?.name}</span> ({formatRole(pendingLoginData?.user?.role || selected?.role || '')}). Please specify starting cash drawer amount to open your shift.
                </p>
              </div>

              {shiftError && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{shiftError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#a7c4ae] mb-1.5">
                  Opening Cash Balance (PKR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 dark:text-[#64916e]">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    autoFocus
                    required
                    value={openingBalance}
                    onChange={(e) => {
                      setOpeningBalance(e.target.value);
                      setShiftError('');
                    }}
                    placeholder="0.00"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-900 dark:text-[#e2f5e8] font-bold text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#a7c4ae] mb-1.5">
                  Opening Notes <span className="text-slate-400 dark:text-slate-500 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="e.g., Morning counter cash float..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e] resize-none transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-[#2d4a35]">
                <button
                  type="button"
                  onClick={handleCancelShiftModal}
                  disabled={shiftSubmitting}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 dark:text-[#a7c4ae] bg-slate-100 hover:bg-slate-200 dark:bg-[#142119] dark:hover:bg-[#223927] border border-slate-200 dark:border-[#2d4a35] rounded-xl transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shiftSubmitting || !openingBalance.trim()}
                  className="flex-[1.4] flex items-center justify-center gap-2 py-3 bg-[#166534] hover:bg-[#14532d] active:bg-[#0f3d21] text-white font-bold text-sm rounded-xl shadow-md shadow-[#166534]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {shiftSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Opening Shift...
                    </>
                  ) : (
                    'Start Shift & Enter'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
