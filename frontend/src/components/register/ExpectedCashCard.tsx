import React from 'react';
import { useRegisterStore } from '../../store/registerStore';

export const ExpectedCashCard: React.FC = () => {
  const { currentRegister } = useRegisterStore();
  const expectedCash = currentRegister?.expectedCash ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
      {/* Subtle decorative background pattern */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #e2e8f0 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      
      <div className="relative z-10">
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">
          Current Expected Cash
        </p>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-2xl font-bold text-slate-400">Rs.</span>
          <span className="text-5xl font-black text-slate-800 tracking-tight">
            {expectedCash.toLocaleString()}
          </span>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Calculation
        </div>
      </div>
    </div>
  );
};
