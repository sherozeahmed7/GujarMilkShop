import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Printer, Info } from 'lucide-react';
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

  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Customer Milk Statement — ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 12px; }
            h2 { margin-bottom: 5px; }
            .header-info { margin-bottom: 20px; color: #444; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #ddd; }
            td { padding: 8px; border: 1px solid #ddd; vertical-align: top; }
            .summary-box { border: 1px solid #ddd; padding: 15px; background: #fafafa; margin-bottom: 20px; }
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
            .total-row { font-weight: bold; border-top: 2px solid #ccc; padding-top: 5px; margin-top: 5px; }
            .day-cell { height: 60px; }
            .day-num { font-weight: bold; margin-bottom: 4px; display: block; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="/logo.png" alt="Gujjar Milk Shop" style="height: 64px; object-fit: contain; margin-bottom: 10px;" />
            <h2 style="margin: 0;">GUJJAR MILK SHOP</h2>
            <h3 style="margin-top: 5px; color: #555;">Customer Milk Statement</h3>
          </div>
          <div class="header-info">
            <p><strong>Customer:</strong> ${customer?.name || 'Unknown'}</p>
            <p><strong>Phone:</strong> ${customer?.phone || 'N/A'}</p>
            <p><strong>Period:</strong> ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}</p>
          </div>
          
          <div class="summary-box">
            <div class="summary-row"><span>Total Sales / Purchases:</span> <span>Rs. ${summary?.currentMonthAmount.toLocaleString()}</span></div>
            <div class="summary-row"><span>Previous Balance:</span> <span>Rs. ${summary?.previousBalance.toLocaleString()}</span></div>
            <div class="summary-row total-row"><span>Total Payable:</span> <span>Rs. ${summary?.totalPayable.toLocaleString()}</span></div>
            <div class="summary-row"><span>Total Received:</span> <span>Rs. ${summary?.totalReceived.toLocaleString()}</span></div>
            <div class="summary-row total-row"><span>Remaining:</span> <span>Rs. ${summary?.remaining.toLocaleString()}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                ${WEEK_DAYS.map(d => `<th>${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, rowIndex) => `
                <tr>
                  ${calendarDays.slice(rowIndex * 7, (rowIndex + 1) * 7).map(day => {
                    if (!day) return `<td></td>`;
                    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayEntries = entriesByDate.get(dateStr) || [];
                    const dailyAmt = dayEntries.reduce((sum, e) => sum + e.amount, 0);
                    return `
                      <td class="day-cell">
                        <span class="day-num">${day}</span>
                        ${dailyAmt > 0 ? `Rs. ${dailyAmt.toLocaleString()}` : '-'}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.print();
    }
  };

  if (loading && !customer) {
    return <div className="p-8 flex justify-center text-slate-500">Loading ledger data...</div>;
  }

  if (error && !customer) {
    return <div className="p-8 flex justify-center text-rose-500">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-10">
        <div>
          <button 
            onClick={() => navigate('/ledger')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Khata / Ledger
          </button>
          <h1 className="text-xl font-bold text-slate-800">Customer Monthly Milk Ledger</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors shadow-sm" title="Previous Month">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={handleCurrentMonth} className="px-3 py-1.5 hover:bg-white rounded-lg text-sm font-bold text-slate-700 transition-colors shadow-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </button>
          <button onClick={handleNextMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors shadow-sm" title="Next Month">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <button 
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors"
        >
          <Printer className="w-4 h-4" />
          Generate PDF
        </button>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Customer Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-wrap gap-x-12 gap-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Customer Name</p>
            <p className="text-lg font-bold text-slate-800">{customer?.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone</p>
            <p className="text-lg font-semibold text-slate-700">{customer?.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Type</p>
            <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold uppercase">{customer?.type === 'monthly_ledger' ? 'Monthly' : customer?.type}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Balance</p>
            <p className="text-lg font-bold text-rose-600">Rs. {customer?.balance.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          
          {/* Calendar Area (FULL WIDTH) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">Monthly Milk Ledger &mdash; {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h3>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEK_DAYS.map(d => (
                <div key={d} className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 last:border-0 truncate">
                  {d}
                </div>
              ))}
            </div>
            
            {loading ? (
              <div className="p-12 text-center text-slate-400">Loading calendar...</div>
            ) : (
              <div className="grid grid-cols-7 bg-slate-200 gap-px">
                {calendarDays.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="bg-slate-50 min-h-[120px]" />;
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
                      className={`bg-white min-h-[120px] p-3 flex flex-col relative group ${hasMilk ? 'cursor-pointer hover:bg-blue-50/50 transition-colors' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-base font-bold w-8 h-8 flex items-center justify-center rounded-full ${hasMilk ? 'text-slate-700' : 'text-slate-400'} ${isToday ? 'bg-blue-600 text-white shadow-sm' : ''}`}>
                          {day}
                        </span>
                        {isToday && <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-1.5 mr-1">Today</span>}
                      </div>
                      
                      {hasMilk ? (
                        <div className="flex flex-col mt-auto">
                          <p className="text-lg font-bold text-emerald-600">Rs. {dailyAmt.toLocaleString()}</p>
                          {dayEntries.length > 1 && (
                            <span className="text-[10px] text-slate-400 mt-0.5">{dayEntries.length} entries</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xl text-slate-300 mt-auto font-medium">-</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Compact Monthly Total Under Calendar */}
            {!loading && (
              <div className="border-t border-slate-200 bg-slate-50 p-4 flex items-center justify-end gap-8">
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Total Monthly Bill</p>
                  <p className="text-xl font-bold text-emerald-600">Rs. {calendarMonthlyTotal.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Section: Summary & Payments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Monthly Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-slate-800 text-lg">Monthly Summary</h3>
              </div>
              
              {loading || !summary ? (
                <div className="p-8 flex-1 flex items-center justify-center text-sm text-slate-400">Calculating...</div>
              ) : (
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Month Amount</p>
                    <p className="text-xl font-bold text-slate-800">Rs. {summary.currentMonthAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Previous Balance</p>
                    <p className="text-xl font-bold text-amber-600">Rs. {summary.previousBalance.toLocaleString()}</p>
                  </div>
                  <div className="sm:col-span-2 h-px bg-slate-100" />
                  
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Payable</p>
                    <p className="text-xl font-bold text-rose-600">Rs. {summary.totalPayable.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Received</p>
                    <p className="text-xl font-bold text-emerald-600">Rs. {summary.totalReceived.toLocaleString()}</p>
                  </div>
                  
                  <div className="sm:col-span-2 mt-2 bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">Remaining Balance</p>
                    <p className="text-2xl font-black text-rose-600">Rs. {summary.remaining.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Summary & History */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-lg">Payment Summary</h3>
              </div>
              
              {!loading && (
                <div className="grid grid-cols-3 border-b border-slate-100 p-5 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Received</p>
                    <p className="text-lg font-bold text-emerald-600">Rs. {summary?.totalReceived.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Payments</p>
                    <p className="text-lg font-bold text-slate-800">{payments.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Payment</p>
                    <p className="text-sm font-bold text-slate-800 pt-0.5">
                      {payments.length > 0 ? new Date(payments[payments.length - 1].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-'}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex-1 overflow-auto bg-slate-50/50">
                {loading ? (
                  <div className="p-8 text-center text-sm text-slate-400">Loading payments...</div>
                ) : payments.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-400 font-medium">No payments this month</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Method</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Reference</th>
                        <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {payments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">{new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-600">{p.paymentMethod}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-500 font-mono text-xs">{p.reference || '-'}</td>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">
                {new Date(selectedDateDetails.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="space-y-4">
                {selectedDateDetails.entries.map((entry, i) => (
                  <div key={entry.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 relative">
                    <div className="absolute -top-2.5 left-4 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                      ENTRY {i + 1}
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Time: {entry.time}</p>
                        <p className="text-xs text-slate-500 mt-1">Rate: Rs. {entry.rate}/kg</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-slate-800">{entry.quantity.toFixed(2)} kg</p>
                        <p className="text-sm font-bold text-emerald-600">Rs. {entry.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center">
                <span className="font-bold text-slate-800">Daily Total</span>
                <div className="text-right">
                  <span className="font-bold text-slate-800 mr-3">{selectedDateDetails.entries.reduce((s, e) => s + e.quantity, 0).toFixed(2)} kg</span>
                  <span className="font-black text-rose-600">Rs. {selectedDateDetails.entries.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedDateDetails(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
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
