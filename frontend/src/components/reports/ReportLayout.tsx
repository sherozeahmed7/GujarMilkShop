import React from 'react';

export const ReportLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col gap-6 relative">
      {children}
    </div>
  );
};
