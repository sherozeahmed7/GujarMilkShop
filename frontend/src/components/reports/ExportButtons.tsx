import React from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfDocument, saveExcelDocument } from '../../utils/exportUtils';

interface ExportButtonsProps {
  reportName: string;
  data: any[]; // Data array to export
  columns: { header: string; dataKey: string }[];
  summaryData?: Record<string, any>;
  summaryTitle?: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ reportName, data, columns, summaryData, summaryTitle = 'Summary' }) => {
  const handleExportExcel = async () => {
    try {
      // Map data to headers
      const worksheetData = data.map(item => {
        const row: any = {};
        columns.forEach(col => {
          const val = item[col.dataKey];
          row[col.header] = val !== undefined && val !== null ? val : '';
        });
        return row;
      });
      
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, reportName.slice(0, 31));
      const filename = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await saveExcelDocument(workbook, filename);
    } catch (e) {
      console.error("Excel export failed", e);
    }
  };

  const handleExportPDF = async () => {
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
        doc.text(summaryTitle, 14, startY);
        startY += 8;
        const summaryEntries = Object.entries(summaryData);
        const cardWidth = 87;
        const cardHeight = 16;
        const cardGap = 5;
        summaryEntries.forEach(([key, val], index) => {
          const column = index % 2;
          const row = Math.floor(index / 2);
          const x = 14 + column * (cardWidth + cardGap);
          const y = startY + row * (cardHeight + cardGap);
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

          doc.setDrawColor(226, 232, 240);
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(label, x + 4, y + 6);
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text(String(val), x + 4, y + 12);
        });
        startY += (Math.ceil(summaryEntries.length / 2) * (cardHeight + cardGap)) + 4;
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

      const filename = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      await savePdfDocument(doc, filename);
    } catch (e) {
      console.error("PDF export failed", e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={handleExportExcel}
        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm font-medium transition-colors"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Excel</span>
      </button>
      
      <button 
        onClick={handleExportPDF}
        className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 rounded-lg text-sm font-medium transition-colors"
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">PDF</span>
      </button>

      <button 
        onClick={handlePrint}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-[#142119] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#223927] border border-slate-200 dark:border-[#2d4a35] rounded-lg text-sm font-medium transition-colors"
      >
        <Printer className="w-4 h-4" />
        <span className="hidden sm:inline">Print</span>
      </button>
    </div>
  );
};
