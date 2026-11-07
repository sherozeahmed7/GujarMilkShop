import React from 'react';
import { ExportButtons } from './ExportButtons';
import { BrandLogo } from '../BrandLogo';

interface ReportHeaderProps {
  title: string;
  description: string;
  exportData?: any[];
  exportColumns?: { header: string; dataKey: string }[];
  exportSummary?: Record<string, any>;
  exportSummaryTitle?: string;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({ 
  title, 
  description,
  exportData = [],
  exportColumns = [],
  exportSummary,
  exportSummaryTitle
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1a2e1f] p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35]">
      <div className="flex items-center gap-3 sm:gap-4">
        <BrandLogo variant="report" className="hidden sm:block shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-[#e2f5e8] truncate">{title}</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">{description}</p>
        </div>
      </div>
      
      <div className="shrink-0 flex items-center gap-2">
        <ExportButtons 
          reportName={title} 
          data={exportData} 
          columns={exportColumns}
          summaryData={exportSummary}
          summaryTitle={exportSummaryTitle}
        />
      </div>
    </div>
  );
};
