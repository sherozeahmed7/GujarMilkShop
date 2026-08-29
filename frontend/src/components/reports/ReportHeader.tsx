import React from 'react';
import { ExportButtons } from './ExportButtons';
import { BrandLogo } from '../BrandLogo';

interface ReportHeaderProps {
  title: string;
  description: string;
  exportData?: any[];
  exportColumns?: { header: string; dataKey: string }[];
  exportSummary?: Record<string, any>;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({ 
  title, 
  description,
  exportData = [],
  exportColumns = [],
  exportSummary
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center gap-4">
        <BrandLogo variant="report" className="hidden sm:block" />
        <div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
      </div>
      
      <ExportButtons 
        reportName={title} 
        data={exportData} 
        columns={exportColumns}
        summaryData={exportSummary}
      />
    </div>
  );
};
