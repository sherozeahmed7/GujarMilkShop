/**
 * customerMilkReportService.ts
 *
 * Service layer for Customer Monthly Milk Report.
 * Currently uses mock/in-memory data.
 *
 * TO CONNECT BACKEND:
 *   Replace the body of each function with real API calls.
 *   The React UI components do NOT need to change.
 */

import {
  MonthlyStatement,
  CalculatedStatement,
  DailyMilkEntry,
  CustomerPayment,
  AddPaymentPayload,
} from '../types/customerMilkReport';
import { savePdfDocument } from '../utils/exportUtils';

// ---------------------------------------------------------------------------
// Mock in-memory payment store (keyed by "customerId-month-year")
// ---------------------------------------------------------------------------
const _paymentStore: Record<string, CustomerPayment[]> = {
  '1-7-2026': [
    {
      id: 'p1', date: '2026-07-10T00:00:00.000Z', amount: 10000,
      method: 'Cash', notes: 'Monthly payment', receivedBy: 'System Admin',
    },
  ],
  '1-8-2026': [
    {
      id: 'p2', date: '2026-08-15T00:00:00.000Z', amount: 15000,
      method: 'Cash', notes: 'Monthly payment', receivedBy: 'System Admin',
    },
  ],
  '2-7-2026': [
    {
      id: 'p3', date: '2026-07-20T00:00:00.000Z', amount: 8000,
      method: 'Online', notes: '', receivedBy: 'System Admin',
    },
  ],
  '2-8-2026': [
    {
      id: 'p4', date: '2026-08-22T00:00:00.000Z', amount: 12000,
      method: 'Cash', notes: 'Partial payment', receivedBy: 'System Admin',
    },
  ],
  '3-8-2026': [
    {
      id: 'p5', date: '2026-08-28T00:00:00.000Z', amount: 9000,
      method: 'Cash', notes: '', receivedBy: 'System Admin',
    },
  ],
};

// ---------------------------------------------------------------------------
// Mock daily milk quantities (per customer per month)
// keys like "customerId-month-year", value = array of 0's with actual quantities
// ---------------------------------------------------------------------------
function getMockDailyQtys(customerId: number, month: number, year: number): number[] {
  // Returns an array where index = day-1, value = qty in kg
  const key = `${customerId}-${month}-${year}`;
  const patterns: Record<string, number[]> = {
    // Customer 1 — Abdul Malik — July 2026 (31 days)
    '1-6-2026': [14,14,0,12,15,14,0,14,14,12,0,14,14,16,14,0,14,12,14,14,0,15,14,14,0,14,14,12,14,0,14],
    // Customer 1 — Abdul Malik — August 2026 (31 days)
    '1-7-2026': [14,14,0,12,15,14,0,14,14,12,0,14,14,16,14,0,14,12,14,14,0,15,14,14,0,14,14,12,14,0,14],
    // Customer 1 — September 2026 (30 days)
    '1-8-2026': [14,14,0,12,15,14,0,14,14,12,0,14,14,16,14,0,14,12,14,14,0,15,14,14,0,14,14,12,14,14],
    // Customer 2 — Rehman Ghee Store — July 2026
    '2-6-2026': [20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20],
    '2-7-2026': [20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20],
    '2-8-2026': [20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,20,20,0,0],
    // Customer 3 — Sana Bakery — August 2026
    '3-7-2026': [10,10,10,0,10,10,10,0,10,10,10,0,10,10,10,0,10,10,10,0,10,10,10,0,10,10,10,0,10,10,10],
    '3-8-2026': [10,10,10,0,10,10,10,0,10,10,10,0,10,10,10,0,10,10,10,0,10,10,10,0,10,10,10,0,10,10],
  };
  return patterns[key] || [];
}

// Mock customer milk rates (Rs. per kg)
const CUSTOMER_RATES: Record<number, number> = {
  1: 180, // Abdul Malik
  2: 175, // Rehman Ghee Store
  3: 185, // Sana Bakery
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Build the dailyEntries array for an entire month */
function buildDailyEntries(customerId: number, month: number, year: number, rate: number): DailyMilkEntry[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const qtys = getMockDailyQtys(customerId, month, year);
  return Array.from({ length: daysInMonth }, (_, i) => {
    const qty = qtys[i] ?? 0;
    return {
      date: i + 1,
      quantityKg: qty,
      ratePerKg: rate,
      amount: qty * rate,
    };
  });
}

// ---------------------------------------------------------------------------
// Calculate the running remaining balance for a given month
// (walks backwards through all months from the first month of data)
// ---------------------------------------------------------------------------
function calcRemainingForMonth(customerId: number, month: number, year: number): number {
  // Walk backwards until we find a month with no data (treat as 0 balance start)
  // For mock, we hardcode starting balances for July 2026 as origin
  const mockStartBalances: Record<string, number> = {
    '1-6-2026': 2000,   // Abdul Malik started July with Rs 2,000 outstanding
    '2-6-2026': 0,
    '3-6-2026': 0,
  };

  // Build a chain from the "start" month up to the requested month
  const startMonth = 6; // July (0-indexed)
  const startYear = 2026;

  let balance = mockStartBalances[`${customerId}-${startMonth}-${startYear}`] ?? 0;

  let m = startMonth;
  let y = startYear;

  while (y < year || (y === year && m < month)) {
    const rate = CUSTOMER_RATES[customerId] ?? 180;
    const entries = buildDailyEntries(customerId, m, y, rate);
    const milkAmt = entries.reduce((s, e) => s + e.amount, 0);
    const pmtKey = `${customerId}-${m}-${y}`;
    const pmts = (_paymentStore[pmtKey] || []).reduce((s, p) => s + p.amount, 0);
    balance = balance + milkAmt - pmts;

    m++;
    if (m > 11) { m = 0; y++; }
  }

  return Math.max(0, balance);
}

// ---------------------------------------------------------------------------
// Public service API
// ---------------------------------------------------------------------------

export const customerMilkReportService = {
  /**
   * Get the full monthly statement for a customer.
   * Replace with: GET /api/customers/:id/monthly-statement?month=&year=
   */
  getCustomerMonthlyStatement: async (
    customerId: number,
    customerName: string,
    customerPhone: string | null,
    month: number,
    year: number,
  ): Promise<MonthlyStatement> => {
    await delay(300);
    const rate = CUSTOMER_RATES[customerId] ?? 180;
    const dailyEntries = buildDailyEntries(customerId, month, year, rate);
    const previousBalance = calcRemainingForMonth(customerId, month, year);
    const pmtKey = `${customerId}-${month}-${year}`;
    const payments = _paymentStore[pmtKey] ?? [];

    return {
      customerId,
      customerName,
      customerPhone,
      milkRatePerKg: rate,
      month,
      year,
      dailyEntries,
      previousBalance,
      payments,
    };
  },

  /**
   * Calculate totals from a MonthlyStatement.
   * This is a pure function — no async needed.
   */
  calculateMonthlyBalance: (stmt: MonthlyStatement): CalculatedStatement => {
    const totalMilkKg = stmt.dailyEntries.reduce((s, e) => s + e.quantityKg, 0);
    const totalMilkAmount = stmt.dailyEntries.reduce((s, e) => s + e.amount, 0);
    const totalPayable = stmt.previousBalance + totalMilkAmount;
    const totalReceived = stmt.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = totalPayable - totalReceived;
    return { totalMilkKg, totalMilkAmount, totalPayable, totalReceived, remaining };
  },

  /**
   * Record a payment for a customer.
   * Replace with: POST /api/customers/:id/payments
   */
  addPayment: async (payload: AddPaymentPayload): Promise<CustomerPayment> => {
    await delay(400);
    const newPayment: CustomerPayment = {
      id: `pmt-${Date.now()}`,
      date: payload.date,
      amount: payload.amount,
      method: payload.method,
      notes: payload.notes,
      receivedBy: 'System Admin',
    };
    const key = `${payload.customerId}-${payload.month}-${payload.year}`;
    if (!_paymentStore[key]) _paymentStore[key] = [];
    _paymentStore[key].push(newPayment);
    return newPayment;
  },

  /**
   * Generate and download a PDF statement.
   * Uses jsPDF (already in project dependencies).
   */
  generateStatementPDF: async (stmt: MonthlyStatement, calc: CalculatedStatement): Promise<void> => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const monthLabel = new Date(stmt.year, stmt.month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const fmtRs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Gujar Milk Shop', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Monthly Milk Statement', 14, 25);

    // Customer info
    doc.setFontSize(10);
    doc.text(`Customer: ${stmt.customerName}`, 14, 34);
    doc.text(`Phone: ${stmt.customerPhone || '—'}`, 14, 40);
    doc.text(`Month: ${monthLabel}`, 14, 46);
    doc.text(`Rate: Rs. ${stmt.milkRatePerKg}/kg`, 14, 52);

    // Calendar table — 7 columns for the month
    const daysInMonth = stmt.dailyEntries.length;
    const firstDay = new Date(stmt.year, stmt.month, 1).getDay();

    // Build calendar rows
    const calRows: string[][] = [];
    let cells: string[] = Array(firstDay).fill('');
    stmt.dailyEntries.forEach((entry) => {
      const label = entry.quantityKg > 0
        ? `${entry.date}\n${entry.quantityKg}kg\n${fmtRs(entry.amount)}`
        : `${entry.date}\n—`;
      cells.push(label);
      if (cells.length === 7) {
        calRows.push(cells);
        cells = [];
      }
    });
    if (cells.length > 0) {
      while (cells.length < 7) cells.push('');
      calRows.push(cells);
    }

    autoTable(doc, {
      head: [['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']],
      body: calRows,
      startY: 58,
      styles: { fontSize: 7, cellPadding: 2, halign: 'center', valign: 'middle', minCellHeight: 14 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const afterTable = (doc as any).lastAutoTable.finalY + 8;

    // Financial Summary
    const summaryData = [
      ['Milk', `${calc.totalMilkKg} kg`],
      ['Previous', fmtRs(stmt.previousBalance)],
      ['Current', fmtRs(calc.totalMilkAmount)],
      ['Total', fmtRs(calc.totalPayable)],
      ['Received', fmtRs(calc.totalReceived)],
      ['Remaining', fmtRs(calc.remaining)],
    ];

    autoTable(doc, {
      body: summaryData,
      startY: afterTable,
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { halign: 'right' } },
      theme: 'plain',
    });

    const afterSummary = (doc as any).lastAutoTable.finalY + 8;

    // Payment History
    if (stmt.payments.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Payments Received', 14, afterSummary);
      const pmtData = stmt.payments.map(p => [
        new Date(p.date).toLocaleDateString(),
        fmtRs(p.amount),
        p.method,
        p.notes || '—',
        p.receivedBy,
      ]);
      autoTable(doc, {
        head: [['Date', 'Amount', 'Method', 'Notes', 'Received By']],
        body: pmtData,
        startY: afterSummary + 4,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 116, 139] },
      });
    }

    const filename = `milk-statement-${stmt.customerName.replace(/\s+/g, '_')}-${monthLabel.replace(/\s+/g, '_')}.pdf`;
    await savePdfDocument(doc, filename);
  },
};
