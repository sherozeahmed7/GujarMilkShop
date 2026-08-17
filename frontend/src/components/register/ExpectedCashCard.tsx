import React from 'react';
import { useRegisterStore } from '../../store/registerStore';

export const ExpectedCashCard: React.FC = () => {
  const { currentRegister } = useRegisterStore();

  return (
    <div className="bg-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-500"></div>
      <div className="absolute -left-16 -top-16 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
      <div className="absolute -right-16 -bottom-16 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>

      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 relative z-10">
        Current Expected Cash
      </p>
      <div className="flex items-baseline gap-2 relative z-10">
        <span className="text-2xl font-bold text-emerald-400">Rs.</span>
        <span className="text-5xl font-black text-white tracking-tight">
          {currentRegister.expectedCash.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
