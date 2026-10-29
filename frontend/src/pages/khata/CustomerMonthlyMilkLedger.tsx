import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Printer, Info, Download, FileText } from 'lucide-react';
import { savePdfDocument } from '../../utils/exportUtils';
import { 
  customerLedgerService, 
  MilkEntry, 
  PaymentEntry, 
  LedgerSummary 
} from '../../services/customerLedgerService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const CustomerMonthlyMilkLedger: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  // Date State
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Data State
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [milkEntries, setMilkEntries] = useState<MilkEntry[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [selectedDateDetails, setSelectedDateDetails] = useState<{date: string, entries: MilkEntry[]} | null>(null);

  useEffect(() => {
    if (!customerId) return;
    
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [cust, entries, pays, summ] = await Promise.all([
          customerLedgerService.getCustomer(customerId),
          customerLedgerService.getMonthlyMilkEntries(customerId, selectedMonth, selectedYear),
          customerLedgerService.getMonthlyPayments(customerId, selectedMonth, selectedYear),
          customerLedgerService.getMonthlySummary(customerId, selectedMonth, selectedYear)
        ]);

        if (isMounted) {
          setCustomer(cust);
          setMilkEntries(entries);
          setPayments(pays);
          setSummary(summ);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load ledger data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [customerId, selectedMonth, selectedYear]);

  // Calendar logic
  const { calendarDays } = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // 0 (Sun) to 6 (Sat)
    
    // Total cells = leading empty cells + days in month
    const totalCells = firstDayOfWeek + daysInMonth;
    const rows = Math.ceil(totalCells / 7);
    const totalGridCells = rows * 7;
    
    const calendarDays = [];
    for (let i = 0; i < totalGridCells; i++) {
      if (i < firstDayOfWeek || i >= firstDayOfWeek + daysInMonth) {
        calendarDays.push(null);
      } else {
        const dayNumber = i - firstDayOfWeek + 1;
        calendarDays.push(dayNumber);
      }
    }
    return { calendarDays };
  }, [selectedMonth, selectedYear]);

  // Aggregate entries by date string (YYYY-MM-DD) for the calendar
  const entriesByDate = useMemo(() => {
    const map = new Map<string, MilkEntry[]>();
    milkEntries.forEach(entry => {
      const existing = map.get(entry.date) || [];
      existing.push(entry);
      map.set(entry.date, existing);
    });
    return map;
  }, [milkEntries]);

  // Calendar total = sum of ALL daily amounts from milkEntries
  const calendarMonthlyTotal = useMemo(
    () => milkEntries.reduce((sum, e) => sum + e.amount, 0),
    [milkEntries]
  );

  // Navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    const d = new Date();
    setSelectedMonth(d.getMonth() + 1);
    setSelectedYear(d.getFullYear());
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleGeneratePdf = async () => {
    if (!customer) return;
    setIsGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const monthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('GUJJAR MILK SHOP', 14, 16);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Customer Monthly Milk Statement', 14, 22);

      // Customer Info Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 26, 182, 18, 2, 2, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Customer:', 18, 32);
      doc.text('Phone:', 18, 38);
      doc.text('Period:', 110, 32);
      doc.text('Customer Type:', 110, 38);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(customer.name || '—', 38, 32);
      doc.text(customer.phone || 'N/A', 38, 38);
      doc.text(monthLabel, 138, 32);
      doc.text(customer.customerType === 'monthly_ledger' ? 'Monthly Ledger' : 'Daily Ledger', 138, 38);

      // Financial Summary Box
      const summaryItems = [
        ['Current Purchases', `Rs. ${(summary?.currentMonthAmount ?? 0).toLocaleString()}`],
        ['Previous Balance', `Rs. ${(summary?.previousBalance ?? 0).toLocaleString()}`],
        ['Total Payable', `Rs. ${(summary?.totalPayable ?? 0).toLocaleString()}`],
        ['Total Received', `Rs. ${(summary?.totalReceived ?? 0).toLocaleString()}`],
        ['Remaining Due', `Rs. ${(summary?.remaining ?? 0).toLocaleString()}`],
      ];

      autoTable(doc, {
        body: summaryItems,
        startY: 48,
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50, textColor: [71, 85, 105] },
          1: { fontStyle: 'bold', halign: 'right', textColor: [15, 23, 42] },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
      });

      let nextY = (doc as any).lastAutoTable?.finalY + 8 || 85;

      // Calendar Table
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Monthly Calendar Overview (${monthLabel})`, 14, nextY);

      const calRows: string[][] = [];
      const totalWeeks = Math.ceil(calendarDays.length / 7);
      for (let r = 0; r < totalWeeks; r++) {
        const rowCells = calendarDays.slice(r * 7, (r + 1) * 7).map((day) => {
          if (!day) return '';
          const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEntries = entriesByDate.get(dateStr) || [];
          const dailyAmt = dayEntries.reduce((sum, e) => sum + e.amount, 0);
          return dailyAmt > 0 ? `${day}\nRs. ${dailyAmt.toLocaleString()}` : `${day}\n—`;
        });
        while (rowCells.length < 7) rowCells.push('');
        calRows.push(rowCells);
      }

      autoTable(doc, {
        head: [WEEK_DAYS.map(w => w.slice(0, 3))],
        body: calRows,
        startY: nextY + 3,
        styles: { fontSize: 7, cellPadding: 2, halign: 'center', valign: 'middle', minCellHeight: 11 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        theme: 'grid',
      });

      nextY = (doc as any).lastAutoTable?.finalY + 8 || 150;

      // Payments Table (if any)
      if (payments.length > 0) {
        if (nextY > 230) {
          doc.addPage();
          nextY = 20;
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Payments Received This Month', 14, nextY);

        const paymentRows = payments.map(p => [
          p.date ? new Date(p.date).toLocaleDateString('en-GB') : '—',
          p.paymentMethod || 'Cash',
          `Rs. ${Number(p.amount || 0).toLocaleString()}`,
          p.reference || '—',
          p.addedBy || '—',
        ]);

        autoTable(doc, {
          head: [['Date', 'Method', 'Amount', 'Reference', 'Received By']],
          body: paymentRows,
          startY: nextY + 3,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [16, 185, 129], textColor: 255 },
          theme: 'striped',
        });

        nextY = (doc as any).lastAutoTable?.finalY + 8 || 200;
      }

      // Detailed Entries Table
      if (milkEntries.length > 0) {
        if (nextY > 230) {
          doc.addPage();
          nextY = 20;
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Detailed Milk Purchases', 14, nextY);

        const entryRows = milkEntries.map(e => [
          e.date ? new Date(e.date).toLocaleDateString('en-GB') : '—',
          e.product || 'Fresh Milk',
          `${Number(e.quantity || 0).toFixed(2)} ${(e as any).unit || 'kg'}`,
          `Rs. ${Number(e.rate || 0).toLocaleString()}`,
          `Rs. ${Number(e.amount || 0).toLocaleString()}`,
        ]);

        autoTable(doc, {
          head: [['Date', 'Product', 'Quantity', 'Rate', 'Total']],
          body: entryRows,
          startY: nextY + 3,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [51, 65, 85], textColor: 255 },
          theme: 'striped',
        });
      }

      const safeName = (customer.name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Customer_Milk_Statement_${safeName}_${selectedMonth}_${selectedYear}.pdf`;
      await savePdfDocument(doc, filename);
    } catch (err) {
      console.error('[Customer Ledger] PDF generation failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading && !customer) {
    return <div className="p-8 flex justify-center text-slate-500 dark:text-[#8ba895]">Loading ledger data...</div>;
  }

  if (error && !customer) {
    return <div className="p-8 flex justify-center text-rose-500">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-[#142119]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a2e1f] border-b border-slate-200 dark:border-[#2d4a35] px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-10">
        <div>
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-500 dark:text-[#8ba895] hover:text-blue-600 transition-colors text-sm font-medium mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">Customer Monthly Milk Ledger</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#111e14] p-1 rounded-xl">
          <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white dark:hover:bg-[#1a2e1f] rounded-lg text-slate-600 dark:text-[#a7c4ae] transition-colors shadow-sm" title="Previous Month">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={handleCurrentMonth} className="px-3 py-1.5 hover:bg-white dark:hover:bg-[#1a2e1f] rounded-lg text-sm font-bold text-slate-700 dark:text-[#e2f5e8] transition-colors shadow-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </button>
          <button onClick={handleNextMonth} className="p-1.5 hover:bg-white dark:hover:bg-[#1a2e1f] rounded-lg text-slate-600 dark:text-[#a7c4ae] transition-colors shadow-sm" title="Next Month">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <button 
          onClick={handleGeneratePdf}
          disabled={isGeneratingPdf || !customer}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          {isGeneratingPdf ? 'Saving PDF…' : 'Generate PDF'}
        </button>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Customer Info Card */}
        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 flex flex-wrap gap-x-12 gap-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-[#64916e] uppercase tracking-wider mb-1">Customer Name</p>
            <p className={`text-lg font-bold ${customer?.status === 'inactive' ? 'line-through text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-[#e2f5e8]'}`}>{customer?.name}{customer?.status === 'inactive' ? ' (Khata Ended / Inactive)' : ''}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-[#64916e] uppercase tracking-wider mb-1">Phone</p>
            <p className="text-lg font-semibold text-slate-700 dark:text-[#e2f5e8]">{customer?.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-[#64916e] uppercase tracking-wider mb-1">Type</p>
            <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold uppercase">{customer?.type === 'monthly_ledger' ? 'Monthly' : customer?.type}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-[#64916e] uppercase tracking-wider mb-1">Current Balance</p>
            <p className="text-lg font-bold text-rose-600">Rs. {customer?.balance.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          
          {/* Calendar Area (FULL WIDTH) */}
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg">Monthly Milk Ledger &mdash; {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h3>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119]">
              {WEEK_DAYS.map(d => (
                <div key={d} className="p-3 text-center text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider border-r border-slate-200 dark:border-[#2d4a35] last:border-0 truncate">
                  {d}
                </div>
              ))}
            </div>
            
            {loading ? (
              <div className="p-12 text-center text-slate-400 dark:text-[#64916e]">Loading calendar...</div>
            ) : (
              <div className="grid grid-cols-7 bg-slate-200 dark:bg-[#1e3124] gap-px">
                {calendarDays.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="bg-slate-50 dark:bg-[#142119] min-h-[120px]" />;
                  }

                  const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEntries = entriesByDate.get(dateStr) || [];
                  const dailyAmt = dayEntries.reduce((sum, e) => sum + e.amount, 0);
                  const hasMilk = dailyAmt > 0;
                  
                  const isToday = 
                    currentDate.getDate() === day && 
                    currentDate.getMonth() + 1 === selectedMonth && 
                    currentDate.getFullYear() === selectedYear;

                  return (
                    <div 
                      key={`day-${day}`} 
                      onClick={() => hasMilk && setSelectedDateDetails({ date: dateStr, entries: dayEntries })}
                      className={`bg-white dark:bg-[#1a2e1f] min-h-[120px] p-3 flex flex-col relative group ${hasMilk ? 'cursor-pointer hover:bg-blue-50/50 transition-colors' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-base font-bold w-8 h-8 flex items-center justify-center rounded-full ${hasMilk ? 'text-slate-700 dark:text-[#e2f5e8]' : 'text-slate-400 dark:text-[#64916e]'} ${isToday ? 'bg-blue-600 text-white shadow-sm' : ''}`}>
                          {day}
                        </span>
                        {isToday && <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-1.5 mr-1">Today</span>}
                      </div>
                      
                      {hasMilk ? (
                        <div className="flex flex-col mt-auto">
                          <p className="text-lg font-bold text-emerald-600">Rs. {dailyAmt.toLocaleString()}</p>
                          {dayEntries.length > 1 && (
                            <span className="text-[10px] text-slate-400 dark:text-[#64916e] mt-0.5">{dayEntries.length} entries</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xl text-slate-300 dark:text-[#2d4a35] mt-auto font-medium">-</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Compact Monthly Total Under Calendar */}
            {!loading && (
              <div className="border-t border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] p-4 flex items-center justify-end gap-8">
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-0.5">Total Monthly Bill</p>
                  <p className="text-xl font-bold text-emerald-600">Rs. {calendarMonthlyTotal.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Section: Summary & Payments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Monthly Summary */}
            <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg">Monthly Summary</h3>
              </div>
              
              {loading || !summary ? (
                <div className="p-8 flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">Calculating...</div>
              ) : (
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Current Month Amount</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">Rs. {summary.currentMonthAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Previous Balance</p>
                    <p className="text-xl font-bold text-amber-600">Rs. {summary.previousBalance.toLocaleString()}</p>
                  </div>
                  <div className="sm:col-span-2 h-px bg-slate-100 dark:bg-[#111e14]" />
                  
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Total Payable</p>
                    <p className="text-xl font-bold text-rose-600">Rs. {summary.totalPayable.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Total Received</p>
                    <p className="text-xl font-bold text-emerald-600">Rs. {summary.totalReceived.toLocaleString()}</p>
                  </div>
                  
                  <div className="sm:col-span-2 mt-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-4 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] uppercase tracking-wider">Remaining Balance</p>
                    <p className="text-2xl font-black text-rose-600">Rs. {summary.remaining.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Summary & History */}
            <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg">Payment Summary</h3>
              </div>
              
              {!loading && (
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-[#2d4a35] p-5 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Total Received</p>
                    <p className="text-lg font-bold text-emerald-600">Rs. {summary?.totalReceived.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Payments</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">{payments.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Last Payment</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] pt-0.5">
                      {payments.length > 0 ? new Date(payments[payments.length - 1].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-'}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-[#142119]">
                {loading ? (
                  <div className="p-8 text-center text-sm text-slate-400 dark:text-[#64916e]">Loading payments...</div>
                ) : payments.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-400 dark:text-[#64916e] font-medium">No payments this month</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-[#111e14] border-b border-slate-200 dark:border-[#2d4a35]">
                      <tr>
                        <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Date</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Method</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Reference</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35] bg-white dark:bg-[#1a2e1f]">
                      {payments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                          <td className="px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-[#e2f5e8]">{new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-[#a7c4ae]">{p.paymentMethod}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-[#8ba895] font-mono text-xs">{p.reference || '-'}</td>
                          <td className="px-5 py-3.5 text-sm font-bold text-emerald-600 text-right">Rs. {p.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Details Modal */}
      {selectedDateDetails && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex justify-between items-center bg-slate-50 dark:bg-[#142119]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg">
                {new Date(selectedDateDetails.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="space-y-4">
                {selectedDateDetails.entries.map((entry, i) => (
                  <div key={entry.id} className="p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] relative">
                    <div className="absolute -top-2.5 left-4 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                      ENTRY {i + 1}
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-[#e2f5e8]">Time: {entry.time}</p>
                        <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-1">Rate: Rs. {entry.rate}/kg</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-slate-800 dark:text-[#e2f5e8]">{entry.quantity.toFixed(2)} kg</p>
                        <p className="text-sm font-bold text-emerald-600">Rs. {entry.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-[#2d4a35] flex justify-between items-center">
                <span className="font-bold text-slate-800 dark:text-[#e2f5e8]">Daily Total</span>
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-[#e2f5e8] mr-3">{selectedDateDetails.entries.reduce((s, e) => s + e.quantity, 0).toFixed(2)} kg</span>
                  <span className="font-black text-rose-600">Rs. {selectedDateDetails.entries.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex justify-end">
              <button 
                onClick={() => setSelectedDateDetails(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-[#1e3124] hover:bg-slate-300 text-slate-700 dark:text-[#e2f5e8] rounded-xl text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
