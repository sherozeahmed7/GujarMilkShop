import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';
import { Lock, Mail, Store, Eye, EyeOff, Loader2, Droplets, Leaf, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();

  const isValidEmail = (emailStr: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');
    setAuthError('');

    let hasError = false;
    if (!email.trim()) {
      setEmailError('Email address is required.');
      hasError = true;
    } else if (!isValidEmail(email.trim())) {
      setEmailError('Please enter a valid email address.');
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordError('Password is required.');
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim(),
        password,
      });

      if (response && response.status === 'success' && response.data) {
        const { accessToken, user } = response.data;

        localStorage.setItem('token', accessToken);
        localStorage.setItem('userId', String(user.id));
        localStorage.setItem('role', user.role);
        localStorage.setItem('assignedScreens', JSON.stringify(user.assignedScreens));

        toast.success('Login successful! Redirecting...');

        setTimeout(() => navigate('/'), 500);
      } else {
        const msg = response.message || '';
        if (msg.toLowerCase().includes('inactive')) {
          setAuthError('Your account is currently inactive. Please contact the administrator.');
        } else {
          setAuthError('Invalid email or password.');
        }
      }
    } catch (error: any) {
      const msg: string = error.message || '';
      if (msg.toLowerCase().includes('inactive')) {
        setAuthError('Your account is currently inactive. Please contact the administrator.');
      } else {
        setAuthError('Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#edf1ee] overflow-hidden">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative hidden lg:flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.8),_transparent_32%),linear-gradient(135deg,#f9f1e6_0%,#edf7f1_35%,#e4eefb_100%)] p-10">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 30%), radial-gradient(circle at 75% 70%, rgba(93,153,224,0.22) 0, rgba(93,153,224,0) 35%)'
          }} />

          <div className="relative w-full max-w-xl rounded-[36px] border border-white/70 bg-white/20 backdrop-blur-sm p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-14 h-14 rounded-2xl bg-[#1f2d3d] flex items-center justify-center shadow-md">
                <Store className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Fresh dairy</div>
                <div className="text-3xl font-black text-slate-800">Gujar Milk Shop</div>
              </div>
            </div>

            <div className="relative mx-auto mb-8 flex h-72 w-72 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#fbe8c5] to-[#d9f1ea] blur-3xl opacity-90" />
              <div className="relative h-44 w-32 rounded-[34px] border-[10px] border-[#f7f4ee] bg-[linear-gradient(180deg,#ffffff_0%,#edf7fb_100%)] shadow-[0_25px_40px_rgba(15,23,42,0.14)]">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 h-10 w-12 rounded-t-[22px] border-[7px] border-[#f3f0eb] border-b-0 bg-white" />
                <div className="absolute inset-x-5 top-5 bottom-5 rounded-[22px] bg-[linear-gradient(180deg,#f5fbff_0%,#e7f6fd_100%)]" />
                <div className="absolute left-1/2 top-16 -translate-x-1/2 text-[#7dbbe7]">
                  <Droplets className="w-12 h-12" />
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#e9f7f0] border-4 border-white flex items-center justify-center text-[#2f9d7b]">
                  <Leaf className="w-4 h-4" />
                </div>
              </div>

              <div className="absolute left-3 bottom-10 h-20 w-24 rounded-[22px] bg-amber-100 border border-amber-200 shadow-sm rotate-[-20deg]">
                <div className="absolute inset-x-2 top-3 h-2 rounded-full bg-[#d7b06a]" />
                <div className="absolute inset-x-3 bottom-4 flex justify-between text-[#c48a33]">
                  <span className="text-[10px] font-black">Milk</span>
                  <span className="text-[10px] font-black">Fresh</span>
                </div>
              </div>

              <div className="absolute right-4 bottom-16 h-16 w-16 rounded-full bg-[#fef3c7] border-4 border-white flex items-center justify-center text-[#d97706] shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-700 text-base font-semibold">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Smart dairy billing
              </div>
              <div className="flex items-center gap-3 text-slate-700 text-base font-semibold">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                Khata tracking & sales control
              </div>
              <div className="flex items-center gap-3 text-slate-700 text-base font-semibold">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                Built for daily shop operations
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-screen items-center justify-center bg-white px-6 py-10 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center mb-8 lg:hidden">
              <div className="w-14 h-14 rounded-2xl bg-[#1f2d3d] flex items-center justify-center mb-4 shadow-sm">
                <Store className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-black text-slate-800">Gujar Milk Shop</h1>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-[0.2em] mt-1">POS Management System</p>
              <p className="text-sm text-slate-500 mt-3">Sign in to continue</p>
            </div>

            <div className="hidden lg:block mb-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Welcome back</div>
              <h2 className="text-3xl font-black text-slate-800">Sign in</h2>
            </div>

            {authError && (
              <div className="mb-5 px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 font-medium">
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); setAuthError(''); }}
                    placeholder="admin@gujarmilkshop.com"
                    className={`w-full bg-slate-50 border rounded-xl py-3 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all ${
                      emailError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
                    }`}
                    autoComplete="email"
                  />
                </div>
                {emailError && <p className="mt-1.5 text-xs text-rose-600">{emailError}</p>}
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPasswordError(''); setAuthError(''); }}
                    placeholder="••••••••"
                    className={`w-full bg-slate-50 border rounded-xl py-3 pl-9 pr-10 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all ${
                      passwordError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
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
                {passwordError && <p className="mt-1.5 text-xs text-rose-600">{passwordError}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#1f2d3d] hover:bg-[#172333] active:bg-[#101c2d] text-white font-bold py-3 rounded-xl text-sm transition-all duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
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

            <p className="text-center text-[11px] text-slate-400 mt-7">
              Gujar Milk Shop POS &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
