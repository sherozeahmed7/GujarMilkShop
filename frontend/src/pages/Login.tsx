import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';
import { Lock, Mail, Store } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Basic email regex format validator
  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Required field validation
    if (!email.trim() || !password.trim()) {
      toast.error('Both email and password are required!');
      return;
    }

    // 2. Email format validation
    if (!isValidEmail(email.trim())) {
      toast.error('Please enter a valid email address!');
      return;
    }

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
        toast.error(response.message || 'Login failed. Please try again.');
      }
    } catch (error: any) {
      // Catch & display specific error message from backend
      toast.error(error.message || 'Invalid credentials or server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl w-full max-w-md p-8 text-white">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30">
            <Store className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Gujar Milk Shop</h2>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gujarmilkshop.com"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition-all duration-200 shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
