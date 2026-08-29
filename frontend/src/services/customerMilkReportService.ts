/**
 * Customer Monthly Milk Report — real sales + settle-all payments.
 */

import {
  MonthlyStatement,
  CalculatedStatement,
  DailyMilkEntry,
  CustomerPayment,
  AddPaymentPayload,
} from '../types/customerMilkReport';
import { customerLedgerService } from './customerLedgerService';
import { customerService } from './customer.service';

const money = (value: number) => Math.round(value * 100) / 100;

function mapMethodLabel(method: string): CustomerPayment['method'] {
  const m = method.toLowerCase();
  if (m === 'online') return 'Online';
  if (m === 'bank' || m.includes('bank')) return 'Bank Transfer';
  return 'Cash';
}

function mapMethodToApi(method: AddPaymentPayload['method']): 'cash' | 'online' {
  return method === 'Cash' ? 'cash' : 'online';
}

async function buildDailyEntries(
  customerId: string,
  month0: number,
  year: number,
): Promise<{ dailyEntries: DailyMilkEntry[]; milkRatePerKg: number }> {
  const month1 = month0 + 1;
  const entries = await customerLedgerService.getMonthlyMilkEntries(customerId, month1, year);
  const daysInMonth = new Date(year, month1, 0).getDate();
  const byDay: Record<number, { qty: number; amount: number; rateSum: number; rateCount: number }> = {};

  for (const entry of entries) {
    const day = Number(entry.date.split('-')[2]);
    if (!byDay[day]) byDay[day] = { qty: 0, amount: 0, rateSum: 0, rateCount: 0 };
    byDay[day].qty += entry.quantity;
    byDay[day].amount += entry.amount;
    byDay[day].rateSum += entry.rate;
    byDay[day].rateCount += 1;
  }

  let rateFallback = 0;
  const dailyEntries: DailyMilkEntry[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const bucket = byDay[day];
    if (!bucket || bucket.qty <= 0) {
      return { date: day, quantityKg: 0, ratePerKg: rateFallback, amount: 0 };
    }
    const ratePerKg = money(bucket.rateSum / bucket.rateCount);
    rateFallback = ratePerKg || rateFallback;
    return {
      date: day,
      quantityKg: money(bucket.qty),
      ratePerKg,
      amount: money(bucket.amount),
    };
  });

  const withRate = dailyEntries.find((d) => d.quantityKg > 0);
  return { dailyEntries, milkRatePerKg: withRate?.ratePerKg || 0 };
}

export const customerMilkReportService = {
  getCustomerMonthlyStatement: async (
    customerId: number,
    customerName: string,
    customerPhone: string | null,
    month: number,
    year: number,
  ): Promise<MonthlyStatement> => {
    const month1 = month + 1;
    const id = String(customerId);
    const [{ dailyEntries, milkRatePerKg }, previousBalance, ledgerPayments] = await Promise.all([
      buildDailyEntries(id, month, year),
      customerLedgerService.getPreviousBalance(id, month1, year),
      customerLedgerService.getMonthlyPayments(id, month1, year),
    ]);

    const payments: CustomerPayment[] = ledgerPayments.map((p) => ({
      id: p.id,
      date: new Date(p.date).toISOString(),
      amount: p.amount,
      method: mapMethodLabel(p.paymentMethod),
      notes: p.reference || '',
      receivedBy: p.addedBy || 'System',
    }));

    return {
      customerId,
      customerName,
      customerPhone,
      milkRatePerKg,
      month,
      year,
      dailyEntries,
      previousBalance,
      payments,
    };
  },

  calculateMonthlyBalance: (stmt: MonthlyStatement): CalculatedStatement => {
    const totalMilkKg = money(stmt.dailyEntries.reduce((s, e) => s + e.quantityKg, 0));
    const totalMilkAmount = money(stmt.dailyEntries.reduce((s, e) => s + e.amount, 0));
    const totalPayable = money(stmt.previousBalance + totalMilkAmount);
    const totalReceived = money(stmt.payments.reduce((s, p) => s + p.amount, 0));
    const remaining = money(totalPayable - totalReceived);
    return { totalMilkKg, totalMilkAmount, totalPayable, totalReceived, remaining };
  },

  addPayment: async (payload: AddPaymentPayload): Promise<CustomerPayment> => {
    await customerService.settleAll(
      payload.customerId,
      mapMethodToApi(payload.method),
      payload.amount,
    );
    return {
      id: `pmt-${Date.now()}`,
      date: payload.date,
      amount: payload.amount,
      method: payload.method,
      notes: payload.notes,
      receivedBy: localStorage.getItem('userName') || 'System',
    };
  },

  generateStatementPDF: async (stmt: MonthlyStatement, calc: CalculatedStatement): Promise<void> => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const monthLabel = new Date(stmt.year, stmt.month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const fmtRs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Gujar Milk Shop', 14, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Monthly Milk Statement', 14, 25);

    doc.setFontSize(10);
    doc.text(`Customer: ${stmt.customerName}`, 14, 34);
    doc.text(`Phone: ${stmt.customerPhone || '—'}`, 14, 40);
    doc.text(`Month: ${monthLabel}`, 14, 46);
    doc.text(`Rate: Rs. ${stmt.milkRatePerKg}/kg`, 14, 52);

    const firstDay = new Date(stmt.year, stmt.month, 1).getDay();
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
    autoTable(doc, {
      body: [
        ['Milk', `${calc.totalMilkKg} kg`],
        ['Previous', fmtRs(stmt.previousBalance)],
        ['Current', fmtRs(calc.totalMilkAmount)],
        ['Total', fmtRs(calc.totalPayable)],
        ['Received', fmtRs(calc.totalReceived)],
        ['Remaining', fmtRs(calc.remaining)],
      ],
      startY: afterTable,
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { halign: 'right' } },
      theme: 'plain',
    });

    const afterSummary = (doc as any).lastAutoTable.finalY + 8;
    if (stmt.payments.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Payments Received', 14, afterSummary);
      autoTable(doc, {
        head: [['Date', 'Amount', 'Method', 'Notes', 'Received By']],
        body: stmt.payments.map((p) => [
          new Date(p.date).toLocaleDateString(),
          fmtRs(p.amount),
          p.method,
          p.notes || '—',
          p.receivedBy,
        ]),
        startY: afterSummary + 4,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 116, 139] },
      });
    }

    doc.save(`milk-statement-${stmt.customerName}-${monthLabel}.pdf`);
  },
};
