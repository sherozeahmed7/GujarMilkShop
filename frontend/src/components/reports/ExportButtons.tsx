import React from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportButtonsProps {
  reportName: string;
  data: any[]; // Data array to export
  columns: { header: string; dataKey: string }[];
  summaryData?: Record<string, any>;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ reportName, data, columns, summaryData }) => {
  
  const handleExportExcel = () => {
    try {
      // Map data to headers
      const worksheetData = data.map(item => {
        const row: any = {};
        columns.forEach(col => {
          row[col.header] = item[col.dataKey];
        });
        return row;
      });
      
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, reportName);
      XLSX.writeFile(workbook, `${reportName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error("Excel export failed", e);
      alert("Failed to export Excel.");
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text('Gujar Milk Shop', 14, 22);
      
      doc.setFontSize(14);
      doc.text(reportName, 14, 32);
      
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 40);

      // Summary Section (if provided)
      let startY = 50;
      if (summaryData) {
        doc.setFontSize(12);
        doc.text('Summary', 14, startY);
        startY += 8;
        doc.setFontSize(10);
        Object.entries(summaryData).forEach(([key, val], index) => {
           // Simple formatting
           const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
           doc.text(`${label}: ${val}`, 14 + (index % 2) * 90, startY + (Math.floor(index / 2) * 6));
        });
        startY += (Math.ceil(Object.keys(summaryData).length / 2) * 6) + 10;
      }

      // Table
      const tableColumn = columns.map(c => c.header);
      const tableRows = data.map(item => columns.map(c => item[c.dataKey] !== undefined ? item[c.dataKey] : '-'));

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startY,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save(`${reportName}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
      alert("Failed to export PDF.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={handleExportExcel}
        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-medium transition-colors"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Excel</span>
      </button>
      
      <button 
        onClick={handleExportPDF}
        className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-sm font-medium transition-colors"
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">PDF</span>
      </button>

      <button 
        onClick={handlePrint}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium transition-colors"
      >
        <Printer className="w-4 h-4" />
        <span className="hidden sm:inline">Print</span>
      </button>
    </div>
  );
};
