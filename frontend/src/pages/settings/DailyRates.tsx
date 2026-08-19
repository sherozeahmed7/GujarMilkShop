import React from 'react';

export const DailyRates: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Daily Rates</h1>
      </div>
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center text-slate-500">
        <p className="text-lg">This is the placeholder for the Daily Rates configuration page.</p>
      </div>
    </div>
  );
};
