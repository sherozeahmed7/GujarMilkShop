import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';
import { Lock, Mail, Store, Eye, EyeOff, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();

  // Basic email regex format validator
  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset inline errors
    setEmailError('');
    setPasswordError('');
    setAuthError('');

    // 1. Required field validation
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
      // 3. Send login request to backend API
      const response = await apiClient.post('/auth/login', {
        email: email.trim(),
        password: password,
      });

      if (response && response.status === 'success' && response.data) {
        const { accessToken, user } = response.data;

        // 4. Save authentication state to localStorage
        localStorage.setItem('token', accessToken);
        localStorage.setItem('userId', String(user.id));
        localStorage.setItem('role', user.role);
        localStorage.setItem('assignedScreens', JSON.stringify(user.assignedScreens));

        toast.success('Login successful! Redirecting...');
        
        // 5. Navigate to home/dashboard page
        setTimeout(() => {
          navigate('/');
        }, 500);
      } else {
        const msg = response.message || '';
        if (msg.toLowerCase().includes('inactive')) {
          setAuthError('Your account is currently inactive. Please contact the administrator.');
        } else {
          setAuthError('Invalid email or password.');
        }
      }
    } catch (error: any) {
      // Catch & display specific error message from backend
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* Subtle grid background pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-200/80 p-8">

          {/* Logo + App Name */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4 shadow-sm">
              <Store className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Gujar Milk Shop</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5 uppercase tracking-widest">POS Management System</p>
            <p className="text-sm text-slate-500 mt-3">Sign in to continue</p>
          </div>

          {/* Auth error banner */}
          {authError && (
            <div className="mb-5 px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 font-medium">
              {authError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4" noValidate>

            {/* Email Field */}
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
                  className={`w-full bg-white border rounded-lg py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all
                    ${emailError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                      : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
                    }`}
                  autoComplete="email"
                />
              </div>
              {emailError && (
                <p className="mt-1.5 text-xs text-rose-600">{emailError}</p>
              )}
            </div>

            {/* Password Field */}
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
                  className={`w-full bg-white border rounded-lg py-2.5 pl-9 pr-10 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all
                    ${passwordError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                      : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
                    }`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-medium py-2.5 rounded-lg text-sm transition-all duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
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
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-5">
          Gujar Milk Shop POS &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};
