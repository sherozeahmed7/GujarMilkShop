import type jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

/**
 * Checks if the current application is running inside Tauri desktop app.
 */
export const isTauriApp = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

/**
 * Saves a jsPDF document either natively via Tauri dialog/fs or browser download.
 * Returns true if saved, false if cancelled by user.
 */
export async function savePdfDocument(doc: jsPDF, defaultFileName: string): Promise<boolean> {
  const fileName = defaultFileName.toLowerCase().endsWith('.pdf')
    ? defaultFileName
    : `${defaultFileName}.pdf`;

  if (isTauriApp()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      const path = await save({
        defaultPath: fileName,
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
      });

      if (!path) {
        // User cancelled dialog
        return false;
      }

      const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
      await writeFile(path, pdfBytes);
      toast.success('PDF saved successfully!');
      return true;
    } catch (err: any) {
      console.error('[Export] Tauri PDF save error:', err);
      try {
        doc.save(fileName);
        toast.success('PDF downloaded!');
        return true;
      } catch (fallbackErr) {
        toast.error('Failed to save PDF.');
        return false;
      }
    }
  } else {
    try {
      doc.save(fileName);
      toast.success('PDF downloaded!');
      return true;
    } catch (err) {
      console.error('[Export] Browser PDF save error:', err);
      toast.error('Failed to download PDF.');
      return false;
    }
  }
}

/**
 * Saves an XLSX workbook either natively via Tauri dialog/fs or browser download.
 * Returns true if saved, false if cancelled by user.
 */
export async function saveExcelDocument(workbook: XLSX.WorkBook, defaultFileName: string): Promise<boolean> {
  const fileName = defaultFileName.toLowerCase().endsWith('.xlsx')
    ? defaultFileName
    : `${defaultFileName}.xlsx`;

  if (isTauriApp()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      const path = await save({
        defaultPath: fileName,
        filters: [{ name: 'Excel spreadsheet', extensions: ['xlsx'] }],
      });

      if (!path) {
        // User cancelled
        return false;
      }

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      await writeFile(path, new Uint8Array(excelBuffer));
      toast.success('Excel file saved successfully!');
      return true;
    } catch (err: any) {
      console.error('[Export] Tauri Excel save error:', err);
      try {
        XLSX.writeFile(workbook, fileName);
        toast.success('Excel downloaded!');
        return true;
      } catch (fallbackErr) {
        toast.error('Failed to save Excel file.');
        return false;
      }
    }
  } else {
    try {
      XLSX.writeFile(workbook, fileName);
      toast.success('Excel downloaded!');
      return true;
    } catch (err) {
      console.error('[Export] Browser Excel save error:', err);
      toast.error('Failed to download Excel file.');
      return false;
    }
  }
}

/**
 * Generates and saves a professional Z-Report / Daily Register Closing PDF.
 */
export async function exportZReportToPdf(
  display: any,
  registerHistory: any[] = []
): Promise<boolean> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('GUJJAR MILK SHOP', 14, 16);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Z-Report / End of Day Closing Summary', 14, 22);

  // Meta box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 26, 182, 20, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Date:', 18, 32);
  doc.text('Cashier / Staff:', 18, 38);
  doc.text('Shift Times:', 18, 44);

  doc.text('Shift ID:', 110, 32);
  doc.text('Status:', 110, 38);
  doc.text('Generated At:', 110, 44);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(display.date || '—'), 32, 32);
  doc.text(String(display.cashier || 'Staff'), 46, 38);
  const openTime = display.shiftOpen
    ? new Date(display.shiftOpen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';
  const closeTime = display.shiftClose
    ? new Date(display.shiftClose).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Open';
  doc.text(`${openTime} – ${closeTime}`, 40, 44);

  doc.text(String(display.id ?? '—'), 126, 32);
  doc.text(String(display.status || 'OPEN'), 124, 38);
  doc.text(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 134, 44);

  // Financial Reconciliation Section
  const fmt = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

  const cashRows = [
    ['Opening Cash Float', fmt(display.openingBalance)],
    ['Cash Sales (POS)', fmt(display.cashSales)],
    ['Expenses / Cash Out', display.expenses ? `- ${fmt(display.expenses)}` : 'Rs. 0'],
    ['Expected Cash in Drawer', fmt(display.expectedCash)],
    ['Counted / Actual Cash', display.countedCash !== null && display.countedCash !== undefined ? fmt(display.countedCash) : 'Pending'],
    ['Discrepancy (Over / Short)', display.variance !== undefined ? (display.variance === 0 ? 'Balanced (Rs. 0)' : `${display.differenceStatus || ''} (${fmt(display.variance)})`) : '—'],
  ];

  autoTable(doc, {
    head: [['Cash Reconciliation', 'Amount']],
    body: cashRows,
    startY: 50,
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 100 }, 1: { halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.row.index === 5 && display.variance !== undefined && display.variance !== 0) {
        data.cell.styles.textColor = display.variance < 0 ? [220, 38, 38] : [16, 185, 129];
      }
    },
  });

  let nextY = (doc as any).lastAutoTable.finalY + 8;

  // Sales by payment method
  const salesRows = [
    ['Cash Sales', fmt(display.cashSales)],
    ['Online / Card / Bank', fmt(display.onlineSales)],
    ['Khata (Credit) Sales', fmt(display.khataSales)],
    ['Total Gross Sales', fmt(display.grossSales)],
    ['Total Bills Issued', String(display.billsCount || 0)],
  ];

  autoTable(doc, {
    head: [['Sales & Payment Breakdown', 'Amount / Count']],
    body: salesRows,
    startY: nextY,
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 100 }, 1: { halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  nextY = (doc as any).lastAutoTable.finalY + 8;

  // Recent Register Shift History (if available)
  if (registerHistory && registerHistory.length > 0) {
    if (nextY > 210) {
      doc.addPage();
      nextY = 20;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Register Shift History', 14, nextY);

    const historyRows = registerHistory.slice(0, 10).map((h) => [
      h.date || '—',
      h.cashier || '—',
      fmt(h.openingBalance),
      fmt(h.cashSales),
      fmt(h.expectedCash),
      h.countedCash !== null && h.countedCash !== undefined ? fmt(h.countedCash) : '—',
      h.variance !== undefined ? (h.variance === 0 ? 'Balanced' : fmt(h.variance)) : '—',
      h.status || 'CLOSED',
    ]);

    autoTable(doc, {
      head: [['Date', 'Staff', 'Opening', 'Cash Sales', 'Expected', 'Counted', 'Diff', 'Status']],
      body: historyRows,
      startY: nextY + 3,
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
      theme: 'striped',
    });
  }

  const filename = `ZReport_${display.date || new Date().toISOString().split('T')[0]}.pdf`;
  return await savePdfDocument(doc, filename);
}

/**
 * Generates and saves a Z-Report Excel workbook.
 */
export async function exportZReportToExcel(
  display: any,
  registerHistory: any[] = []
): Promise<boolean> {
  const summaryRows = [
    { Field: 'Shift Date', Value: display.date },
    { Field: 'Shift ID', Value: display.id },
    { Field: 'Cashier / Staff', Value: display.cashier },
    { Field: 'Status', Value: display.status },
    { Field: 'Opening Cash (Rs.)', Value: display.openingBalance },
    { Field: 'Cash Sales (Rs.)', Value: display.cashSales },
    { Field: 'Online Sales (Rs.)', Value: display.onlineSales },
    { Field: 'Khata Sales (Rs.)', Value: display.khataSales },
    { Field: 'Gross Sales (Rs.)', Value: display.grossSales },
    { Field: 'Bills Count', Value: display.billsCount },
    { Field: 'Expenses (Rs.)', Value: display.expenses || 0 },
    { Field: 'Expected Cash (Rs.)', Value: display.expectedCash },
    { Field: 'Counted Cash (Rs.)', Value: display.countedCash ?? '' },
    { Field: 'Variance (Rs.)', Value: display.variance ?? '' },
    { Field: 'Notes', Value: display.notes || '' },
  ];

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Shift Summary');

  if (registerHistory && registerHistory.length > 0) {
    const historyRows = registerHistory.map((h) => ({
      'Date': h.date,
      'Staff': h.cashier,
      'Opening Cash': h.openingBalance,
      'Cash Sales': h.cashSales,
      'Expected Cash': h.expectedCash,
      'Counted Cash': h.countedCash ?? '',
      'Difference': h.variance ?? '',
      'Status': h.status,
    }));
    const historySheet = XLSX.utils.json_to_sheet(historyRows);
    XLSX.utils.book_append_sheet(workbook, historySheet, 'Shift History');
  }

  const filename = `ZReport_${display.date || new Date().toISOString().split('T')[0]}.xlsx`;
  return await saveExcelDocument(workbook, filename);
}
