import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RegisterData } from '../types';

const money = (n: number | undefined) => `Rs. ${Math.round(Number(n) || 0).toLocaleString()}`;

export function exportRegisterExcel(data: RegisterData, reportName = 'Z-Report') {
  const rows = [
    { Field: 'Date', Value: data.date },
    { Field: 'Cashier', Value: data.cashier },
    { Field: 'Status', Value: data.status },
    { Field: 'Shift Open', Value: data.shiftOpen || '—' },
    { Field: 'Shift Close', Value: data.shiftClose || '—' },
    { Field: 'Bills', Value: data.billsCount },
    { Field: 'Gross Sales', Value: data.grossSales },
    { Field: 'Cash Sales', Value: data.cashSales },
    { Field: 'Online Sales', Value: data.onlineSales },
    { Field: 'Khata Sales', Value: data.khataSales },
    { Field: 'Opening Cash', Value: data.openingBalance },
    { Field: 'Expected Cash', Value: data.expectedCash },
    { Field: 'Counted Cash', Value: data.countedCash ?? '—' },
    { Field: 'Variance', Value: data.variance ?? '—' },
    { Field: 'Difference', Value: data.differenceStatus || '—' },
    { Field: 'Notes', Value: data.notes || '—' },
  ];
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, reportName);
  XLSX.writeFile(workbook, `${reportName}_${data.date}.xlsx`);
}

export function exportRegisterPDF(data: RegisterData, reportName = 'Z-Report') {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Gujar Milk Shop', 14, 22);
  doc.setFontSize(14);
  doc.text(reportName, 14, 32);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

  autoTable(doc, {
    startY: 48,
    head: [['Field', 'Value']],
    body: [
      ['Date', data.date],
      ['Cashier', data.cashier],
      ['Status', data.status],
      ['Shift Open', data.shiftOpen || '—'],
      ['Shift Close', data.shiftClose || '—'],
      ['Bills', String(data.billsCount)],
      ['Gross Sales', money(data.grossSales)],
      ['Cash Sales', money(data.cashSales)],
      ['Online Sales', money(data.onlineSales)],
      ['Khata Sales', money(data.khataSales)],
      ['Opening Cash', money(data.openingBalance)],
      ['Expected Cash', money(data.expectedCash)],
      ['Counted Cash', data.countedCash != null ? money(data.countedCash) : '—'],
      ['Variance', data.variance != null ? money(data.variance) : '—'],
      ['Difference', data.differenceStatus || '—'],
      ['Notes', data.notes || '—'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(`${reportName}_${data.date}.pdf`);
}
