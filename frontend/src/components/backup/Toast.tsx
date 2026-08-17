import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  type: ToastType;
  message: string;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type, message, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const styles: Record<ToastType, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  const iconColor: Record<ToastType, string> = {
    success: 'text-emerald-500',
    error: 'text-rose-500',
    info: 'text-blue-500',
  };

  return (
    <div className={`fixed bottom-5 right-5 z-[100] flex items-start gap-3 max-w-sm w-full border rounded-xl px-4 py-3 shadow-lg ${styles[type]}`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor[type]}`} />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button onClick={onDismiss} className="flex-shrink-0 opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
