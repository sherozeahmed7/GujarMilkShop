import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ExpenseCustomer, ExpenseRecord } from '../../types/expense';
import {
  getExpenseCustomers,
  createExpenseCustomer,
  updateExpenseCustomer,
  deleteExpenseCustomer,
  getExpenses,
} from '../../services/expenseService';
import { Pagination } from '../common/Pagination';
import { savePdfDocument } from '../../utils/exportUtils';
import { formatUserName } from '../../utils/userFormat';
import {
  Users, UserPlus, Search, Edit2, Trash2, FileText, Download,
  RefreshCw, Phone, Wallet, ArrowDownLeft, ArrowUpRight,
  ChevronRight, Calendar, DollarSign, X, Check, Store, User,
  Filter, ArrowUpDown, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

function fmt(n: number): string {
  if (isNaN(n) || !isFinite(n)) return 'Rs. 0';
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

interface LedgerEntry {
  id: string;
  date: string;
  type: 'Expense' | 'Payment';
  expenseType: 'SHOP' | 'PERSONAL';
  description: string;
  debit: number;   // What we gave / billed to customer
  credit: number;  // What we received / paid back
  balance: number; // Running balance
  addedBy: string;
  notes?: string;
}

type ExpenseTypeFilter = 'ALL' | 'SHOP' | 'PERSONAL';
type DueStatusFilter = 'ALL' | 'HAS_REMAINING' | 'CLEARED' | 'ACTIVE_TODAY';
type SortField = 'name' | 'billed' | 'paid' | 'remaining' | 'activity';
type SortOrder = 'asc' | 'desc';

const DATE_PRESETS = [
  'All Time', 'Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'This Year', 'Custom'
] as const;

export const CustomerExpensesSection: React.FC = () => {
  const [customers, setCustomers] = useState<ExpenseCustomer[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter and Sort states
  const [datePreset, setDatePreset] = useState<typeof DATE_PRESETS[number]>('All Time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [typeFilter, setTypeFilter] = useState<ExpenseTypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<DueStatusFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const customPickerRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ExpenseCustomer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<ExpenseCustomer | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<ExpenseCustomer | null>(null);
  const [activeLedgerTab, setActiveLedgerTab] = useState<'SHOP' | 'PERSONAL'>('SHOP');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Form input state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCategory, setFormCategory] = useState<'SHOP' | 'PERSONAL'>('SHOP');
  const [formNotes, setFormNotes] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Close custom picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customPickerRef.current && !customPickerRef.current.contains(e.target as Node)) {
        setShowCustomPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custList, expList] = await Promise.all([
        getExpenseCustomers(),
        getExpenses(),
      ]);
      setCustomers(custList || []);
      setExpenses(expList || []);
    } catch (err: any) {
      console.error('Failed to load expense customer data:', err);
      toast.error('Failed to load expense customers data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute date range boundary based on datePreset (using local calendar)
  const activeDateRange = useMemo(() => {
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const now = new Date();
    const todayStr = toYMD(now);

    if (datePreset === 'Today') return { start: todayStr, end: todayStr };
    if (datePreset === 'Yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      return { start: yStr, end: yStr };
    }
    if (datePreset === 'This Week') {
      const start = new Date(now);
      const dow = start.getDay();
      start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
      return { start: toYMD(start), end: todayStr };
    }
    if (datePreset === 'This Month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: toYMD(start), end: todayStr };
    }
    if (datePreset === 'Last Month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toYMD(start), end: toYMD(end) };
    }
    if (datePreset === 'This Year') {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: toYMD(start), end: todayStr };
    }
    if (datePreset === 'Custom' && (customStart || customEnd)) {
      return { start: customStart || undefined, end: customEnd || undefined };
    }
    return { start: undefined, end: undefined };
  }, [datePreset, customStart, customEnd]);

  // Compute expenses related to a specific customer, optionally filtered by type and date
  const getCustomerExpenses = (
    customer: ExpenseCustomer,
    opts?: { type?: 'SHOP' | 'PERSONAL'; applyDateFilter?: boolean }
  ) => {
    const custNameLower = customer.name.trim().toLowerCase();
    const phone = customer.phone?.trim();

    return expenses.filter((e) => {
      // Filter by type
      if (opts?.type && (e.expenseType || 'SHOP') !== opts.type) {
        return false;
      }

      // Check name/phone match
      const cat = (e.category || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      const reason = (e.reason || '').toLowerCase();

      const nameMatch =
        cat === custNameLower ||
        desc === custNameLower ||
        cat.includes(custNameLower) ||
        desc.includes(custNameLower) ||
        reason.includes(custNameLower);

      const phoneMatch = phone && (reason.includes(phone) || desc.includes(phone));
      if (!nameMatch && !phoneMatch) return false;

      // Filter by date if requested
      if (opts?.applyDateFilter && (activeDateRange.start || activeDateRange.end)) {
        const expDate = e.date ? e.date.slice(0, 10) : '';
        if (activeDateRange.start && expDate < activeDateRange.start) {
          // If expense was before period, also check if it had payments within this period
          const hasPaymentInPeriod = Array.isArray(e.payments) && e.payments.some(p => {
            const pDate = p.date ? p.date.slice(0, 10) : '';
            return (!activeDateRange.start || pDate >= activeDateRange.start) &&
                   (!activeDateRange.end || pDate <= activeDateRange.end);
          });
          if (!hasPaymentInPeriod) return false;
        }
        if (activeDateRange.end && expDate > activeDateRange.end) {
          return false;
        }
      }

      return true;
    });
  };

  // Build granular chronological statement ledger
  const buildCustomerLedger = (customer: ExpenseCustomer, type: 'SHOP' | 'PERSONAL'): LedgerEntry[] => {
    const list = getCustomerExpenses(customer, { type });
    const rawEvents: Array<{
      id: string;
      date: string;
      createdAt: string;
      type: 'Expense' | 'Payment';
      expenseType: 'SHOP' | 'PERSONAL';
      description: string;
      debit: number;
      credit: number;
      addedBy: string;
      notes?: string;
    }> = [];

    list.forEach((exp) => {
      const expAmount = exp.amount || exp.netExpense || 0;
      rawEvents.push({
        id: `exp-${exp.id}`,
        date: exp.date,
        createdAt: exp.createdAt || exp.date,
        type: 'Expense',
        expenseType: exp.expenseType || 'SHOP',
        description: exp.description || exp.category || 'Expense recorded',
        debit: expAmount,
        credit: 0,
        addedBy: exp.addedBy || 'Staff',
        notes: exp.reason || undefined,
      });

      if (Array.isArray(exp.payments) && exp.payments.length > 0) {
        exp.payments.forEach((p) => {
          const pAmt = Number(p.amount) || 0;
          const isReturn = pAmt < 0;
          rawEvents.push({
            id: `pay-${p.id}`,
            date: p.date,
            createdAt: p.createdAt || p.date,
            type: 'Payment',
            expenseType: exp.expenseType || 'SHOP',
            description: isReturn
              ? `Return for: ${exp.description || exp.category}`
              : `Payment for: ${exp.description || exp.category}`,
            debit: isReturn ? Math.abs(pAmt) : 0,
            credit: isReturn ? 0 : pAmt,
            addedBy: p.addedBy || 'Staff',
            notes: isReturn ? `Returned from #${exp.id}` : `Paid toward #${exp.id}`,
          });
        });
      } else if ((exp.paidAmount || 0) > 0) {
        rawEvents.push({
          id: `pay-fallback-${exp.id}`,
          date: exp.date,
          createdAt: exp.createdAt || exp.date,
          type: 'Payment',
          expenseType: exp.expenseType || 'SHOP',
          description: `Payment for: ${exp.description || exp.category}`,
          debit: 0,
          credit: exp.paidAmount,
          addedBy: exp.addedBy || 'Staff',
          notes: 'Settled at drawer',
        });
      }
    });

    rawEvents.sort((a, b) => {
      const cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (cmp !== 0) return cmp;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let runningBalance = 0;
    return rawEvents.map((ev) => {
      runningBalance += ev.debit - ev.credit;
      return {
        ...ev,
        balance: runningBalance,
      };
    });
  };

  // Compute stats for each customer taking active type filter and date filter into account
  const customersWithStats = useMemo(() => {
    const isDateFiltered = Boolean(activeDateRange.start || activeDateRange.end);
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const todayStr = toYMD(new Date());

    return customers.map((c) => {
      const customerLedgerType = c.customerCategory || 'SHOP';
      // All expenses for customer (unbounded)
      const allExpenses = getCustomerExpenses(c);
      // Expenses matching current type filter and date filter
      const cExpenses = getCustomerExpenses(c, {
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        applyDateFilter: isDateFiltered,
      });

      // Calculate period-scoped or active amounts
      let totalBilled = 0;
      let totalPaid = 0;
      let totalRemaining = 0;
      let paidToday = 0;

      cExpenses.forEach((e) => {
        totalBilled += (e.amount || 0);
        totalPaid += (e.paidAmount || 0);
        totalRemaining += (e.remaining || 0);

        // Check if payments were made today
        if (Array.isArray(e.payments)) {
          e.payments.forEach((p) => {
            const pDate = p.date ? p.date.slice(0, 10) : '';
            if (pDate === todayStr) {
              paidToday += (Number(p.amount) || 0);
            }
          });
        }
      });

      const shopCount = allExpenses.filter((e) => (e.expenseType || 'SHOP') === 'SHOP').length;
      const personalCount = allExpenses.filter((e) => e.expenseType === 'PERSONAL').length;
      const hasRecentActivity = cExpenses.length > 0 || paidToday > 0;

      return {
        customer: c,
        customerLedgerType,
        expenseCount: cExpenses.length,
        shopCount,
        personalCount,
        totalBilled,
        totalPaid,
        totalRemaining,
        paidToday,
        hasRecentActivity,
      };
    });
  }, [customers, expenses, typeFilter, activeDateRange]);

  // Overall statistics (for the cards)
  const overallStats = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let totalPaidToday = 0;
    let activeCustomerCount = 0;

    customersWithStats.forEach((c) => {
      totalBilled += c.totalBilled;
      totalPaid += c.totalPaid;
      totalRemaining += c.totalRemaining;
      totalPaidToday += c.paidToday;
      if (c.hasRecentActivity || c.totalRemaining > 0) {
        activeCustomerCount++;
      }
    });

    return {
      customerCount: customersWithStats.length,
      activeCustomerCount,
      totalBilled,
      totalPaid,
      totalRemaining,
      totalPaidToday,
    };
  }, [customersWithStats]);

  // Apply Search, Type Filter (Shop vs Personal Customer Ledger), Status Filter, and Sorting
  const filteredAndSortedCustomers = useMemo(() => {
    let list = customersWithStats;

    // Filter by Customer Ledger Type (Shop Customer vs Personal Customer)
    if (typeFilter !== 'ALL') {
      list = list.filter((c) => c.customerLedgerType === typeFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        ({ customer }) =>
          customer.name.toLowerCase().includes(q) ||
          (customer.phone && customer.phone.toLowerCase().includes(q)) ||
          (customer.notes && customer.notes.toLowerCase().includes(q))
      );
    }

    // Status Filter (Remaining / Cleared / Today Paid)
    if (statusFilter === 'HAS_REMAINING') {
      list = list.filter((c) => c.totalRemaining > 0);
    } else if (statusFilter === 'CLEARED') {
      list = list.filter((c) => c.totalRemaining <= 0 && c.totalBilled > 0);
    } else if (statusFilter === 'ACTIVE_TODAY') {
      list = list.filter((c) => c.paidToday > 0 || c.hasRecentActivity);
    }

    // When a date range filter is active, only show customers with matching activity
    if (activeDateRange.start || activeDateRange.end) {
      list = list.filter((c) => c.hasRecentActivity);
    }

    // Sort
    const sorted = [...list];
    sorted.sort((a, b) => {
      let diff = 0;
      if (sortField === 'name') {
        diff = a.customer.name.localeCompare(b.customer.name, undefined, { sensitivity: 'base' });
      } else if (sortField === 'billed') {
        diff = a.totalBilled - b.totalBilled;
      } else if (sortField === 'paid') {
        diff = a.totalPaid - b.totalPaid;
      } else if (sortField === 'remaining') {
        diff = a.totalRemaining - b.totalRemaining;
      } else if (sortField === 'activity') {
        diff = a.expenseCount - b.expenseCount;
      }
      return sortOrder === 'asc' ? diff : -diff;
    });

    return sorted;
  }, [customersWithStats, searchQuery, statusFilter, sortField, sortOrder, activeDateRange]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, datePreset, customStart, customEnd, typeFilter, statusFilter, sortField, sortOrder]);

  // Pagination
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedCustomers.slice(start, start + itemsPerPage);
  }, [filteredAndSortedCustomers, currentPage, itemsPerPage]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormCategory('SHOP');
    setFormNotes('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (customer: ExpenseCustomer) => {
    setEditingCustomer(customer);
    setFormName(customer.name);
    setFormPhone(customer.phone || '');
    setFormCategory(customer.customerCategory || 'SHOP');
    setFormNotes(customer.notes || '');
    setIsFormOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingCustomer) {
        await updateExpenseCustomer(editingCustomer.id, {
          name: formName.trim(),
          phone: formPhone.trim() || undefined,
          customerCategory: formCategory,
          notes: formNotes.trim() || undefined,
        });
        toast.success('Customer updated successfully');
      } else {
        await createExpenseCustomer({
          name: formName.trim(),
          phone: formPhone.trim() || undefined,
          customerCategory: formCategory,
          notes: formNotes.trim() || undefined,
        });
        toast.success('Customer added successfully');
      }
      setIsFormOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save customer');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCustomer) return;
    try {
      await deleteExpenseCustomer(deletingCustomer.id);
      toast.success('Customer deleted successfully');
      setDeletingCustomer(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete customer');
    }
  };

  // Export Customer Ledger PDF
  const handleDownloadLedgerPdf = async (customer: ExpenseCustomer, type: 'SHOP' | 'PERSONAL') => {
    setIsExportingPdf(true);
    try {
      const ledger = buildCustomerLedger(customer, type);
      const totalDebit = ledger.reduce((sum, e) => sum + e.debit, 0);
      const totalCredit = ledger.reduce((sum, e) => sum + e.credit, 0);
      const closingBalance = ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;

      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const isShop = type === 'SHOP';
      doc.setFillColor(isShop ? 26 : 45, isShop ? 46 : 28, isShop ? 31 : 58);
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('GUJAR MILK SHOP', 14, 15);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(210, 230, 220);
      doc.text(`${isShop ? 'Shop Expense' : 'Personal Expense'} Ledger Statement`, 14, 23);

      doc.setFontSize(9);
      doc.setTextColor(200, 200, 200);
      doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 30);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 42, 182, 32, 2, 2, 'FD');

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(customer.name, 20, 51);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Phone: ${customer.phone || 'N/A'}`, 20, 58);
      doc.text(`Notes: ${customer.notes || 'None'}`, 20, 65);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Gave (Debit):`, 125, 51);
      doc.text(`Total Received (Credit):`, 125, 58);
      doc.text(`Closing Balance:`, 125, 65);

      doc.setTextColor(15, 23, 42);
      doc.text(`Rs. ${Math.round(totalDebit).toLocaleString()}`, 180, 51, { align: 'right' });
      doc.setTextColor(22, 163, 74);
      doc.text(`Rs. ${Math.round(totalCredit).toLocaleString()}`, 180, 58, { align: 'right' });
      doc.setTextColor(closingBalance > 0 ? 220 : 71, closingBalance > 0 ? 38 : 85, closingBalance > 0 ? 38 : 105);
      doc.text(`Rs. ${Math.round(closingBalance).toLocaleString()}`, 180, 65, { align: 'right' });

      const tableRows = ledger.map((entry, idx) => [
        idx + 1,
        entry.date,
        entry.type === 'Expense' ? 'Gave / Bill' : 'Received',
        entry.description,
        entry.addedBy,
        entry.debit > 0 ? `Rs. ${Math.round(entry.debit).toLocaleString()}` : '—',
        entry.credit > 0 ? `Rs. ${Math.round(entry.credit).toLocaleString()}` : '—',
        `Rs. ${Math.round(entry.balance).toLocaleString()}`,
      ]);

      autoTable(doc, {
        startY: 80,
        head: [['#', 'Date', 'Type', 'Description / Details', 'Added By', 'Gave (Rs)', 'Received (Rs)', 'Balance (Rs)']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: isShop ? [26, 46, 31] : [76, 29, 149],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 20 },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 42 },
          4: { cellWidth: 24 },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 22, halign: 'right' },
          7: { cellWidth: 24, halign: 'right' },
        },
        foot: [[
          '',
          '',
          '',
          'Total Summary',
          '',
          `Rs. ${Math.round(totalDebit).toLocaleString()}`,
          `Rs. ${Math.round(totalCredit).toLocaleString()}`,
          `Rs. ${Math.round(closingBalance).toLocaleString()}`,
        ]],
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 8,
        },
      });

      const safeName = customer.name.replace(/[^a-zA-Z0-9]/g, '_');
      savePdfDocument(doc, `${type}_Ledger_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(`${type === 'SHOP' ? 'Shop' : 'Personal'} ledger PDF downloaded`);
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      toast.error('Failed to generate PDF document');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 border border-slate-200 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">
              Expense Customers
            </p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] mt-0.5">
              {overallStats.customerCount}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-[#6f8b78] mt-0.5">
              {overallStats.activeCustomerCount} with active balances
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 border border-slate-200 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">
              Total Billed
            </p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] mt-0.5">
              {fmt(overallStats.totalBilled)}
            </h3>
            <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-0.5">
              {typeFilter === 'ALL' ? 'Shop + Personal' : typeFilter === 'SHOP' ? 'Shop Expense Only' : 'Personal Expense Only'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 border border-slate-200 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">
              Total Paid
            </p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-[#22c55e] mt-0.5">
              {fmt(overallStats.totalPaid)}
            </h3>
            <p className="text-[11px] text-emerald-600 dark:text-[#22c55e] font-medium mt-0.5">
              Today Paid: {fmt(overallStats.totalPaidToday)}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 border border-slate-200 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">
              Remaining Balance
            </p>
            <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {fmt(overallStats.totalRemaining)}
            </h3>
            <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-0.5">
              Unsettled dues
            </p>
          </div>
        </div>
      </div>

      {/* ── Date Range Presets Bar ── */}
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-3 border border-slate-200 dark:border-[#2d4a35] shadow-sm flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-[#8ba895] uppercase tracking-wider mr-1">
          <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>Date Filter:</span>
        </div>

        {DATE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              setDatePreset(preset);
              if (preset === 'Custom') setShowCustomPicker(true);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              datePreset === preset
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-slate-100 dark:bg-[#142119] text-slate-600 dark:text-[#8ba895] hover:bg-slate-200 dark:hover:bg-[#1e3124]'
            }`}
          >
            {preset}
          </button>
        ))}

        {datePreset === 'Custom' && (
          <div className="relative" ref={customPickerRef}>
            <button
              onClick={() => setShowCustomPicker(!showCustomPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40"
            >
              <span>{customStart || 'Start'} → {customEnd || 'End'}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showCustomPicker && (
              <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xl border border-slate-200 dark:border-[#2d4a35] z-30 flex items-center gap-2 animate-fade-in">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-xs rounded-lg text-slate-800 dark:text-[#e2f5e8]"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-xs rounded-lg text-slate-800 dark:text-[#e2f5e8]"
                />
                <button
                  onClick={() => setShowCustomPicker(false)}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden">
        {/* Header Toolbar & Multi-Filter Controls */}
        <div className="p-5 border-b border-slate-100 dark:border-[#2d4a35] flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by customer name, phone, notes..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl text-sm text-slate-800 dark:text-[#e2f5e8] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                />
              </div>
              <button
                onClick={loadData}
                title="Refresh list"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2d4a35] text-slate-500 dark:text-[#8ba895] hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-500' : ''}`} />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Expense Customer</span>
              </button>
            </div>
          </div>

          {/* Filter Pills and Sort Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-[#2d4a35]/60">
            {/* Left: Type and Due Status filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Customer Type / Ledger Filter */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#142119] p-1 rounded-xl border border-slate-200 dark:border-[#2d4a35]">
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    typeFilter === 'ALL'
                      ? 'bg-white dark:bg-[#1a2e1f] text-slate-800 dark:text-[#e2f5e8] shadow-sm'
                      : 'text-slate-500 dark:text-[#8ba895] hover:text-slate-800 dark:hover:text-[#e2f5e8]'
                  }`}
                >
                  All Customers
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('SHOP')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    typeFilter === 'SHOP'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-[#8ba895] hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Shop Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('PERSONAL')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    typeFilter === 'PERSONAL'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-[#8ba895] hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Personal Expense</span>
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#142119] p-1 rounded-xl border border-slate-200 dark:border-[#2d4a35]">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'ALL'
                      ? 'bg-white dark:bg-[#1a2e1f] text-slate-800 dark:text-[#e2f5e8] shadow-sm'
                      : 'text-slate-500 dark:text-[#8ba895] hover:text-slate-800 dark:hover:text-[#e2f5e8]'
                  }`}
                >
                  All Status
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('HAS_REMAINING')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'HAS_REMAINING'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-[#8ba895] hover:text-rose-600 dark:hover:text-rose-400'
                  }`}
                >
                  Remaining Dues
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('CLEARED')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'CLEARED'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-[#8ba895] hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  Cleared
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ACTIVE_TODAY')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'ACTIVE_TODAY'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-[#8ba895] hover:text-purple-600 dark:hover:text-purple-400'
                  }`}
                >
                  Today Activity
                </button>
              </div>
            </div>

            {/* Right: Sort controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort:
              </span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-lg text-xs font-bold text-slate-700 dark:text-[#e2f5e8] focus:outline-none"
              >
                <option value="name">Name</option>
                <option value="remaining">Remaining Balance</option>
                <option value="paid">Total Paid</option>
                <option value="billed">Total Billed</option>
                <option value="activity">Total Entries</option>
              </select>

              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-1 rounded-lg border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#8ba895] hover:bg-slate-100 dark:hover:bg-[#142119] text-xs font-bold"
                title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50/75 dark:bg-[#142119] text-xs font-bold text-slate-600 dark:text-[#8ba895] uppercase tracking-wider">
                <th className="py-3.5 px-4">Customer Details</th>
                <th className="py-3.5 px-4">Contact & Notes</th>
                <th className="py-3.5 px-4 text-center">Expense Ledger Type</th>
                <th className="py-3.5 px-4 text-right">Total Billed</th>
                <th className="py-3.5 px-4 text-right">Total Paid</th>
                <th className="py-3.5 px-4 text-right">Remaining Balance</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-[#8ba895]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
                      <span>Loading expense customers...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-[#8ba895]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="w-8 h-8 opacity-40 text-slate-400" />
                      <p className="font-medium text-slate-600 dark:text-[#e2f5e8]">No expense customers match your filters</p>
                      <p className="text-xs">Try selecting 'All Time' or clearing the status/type filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(({ customer, customerLedgerType, shopCount, personalCount, totalBilled, totalPaid, totalRemaining, paidToday }) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#1e3124]/50 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-sm">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-[#e2f5e8]">
                            {customer.name}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-[#8ba895]">
                            ID: #{customer.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5 text-xs text-slate-600 dark:text-[#8ba895]">
                        {customer.phone ? (
                          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-[#a7c4ae]">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {customer.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-[#6f8b78] italic">No phone</span>
                        )}
                        {customer.notes && (
                          <span className="text-[11px] text-slate-500 dark:text-[#8ba895] truncate max-w-xs" title={customer.notes}>
                            {customer.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center justify-center">
                        {customerLedgerType === 'PERSONAL' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                            <User className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Personal Expense</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-xs">
                            <Store className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>Shop Expense</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-semibold text-slate-800 dark:text-[#e2f5e8]">
                      {fmt(totalBilled)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-semibold text-emerald-600 dark:text-[#22c55e]">
                        {fmt(totalPaid)}
                      </div>
                      {paidToday > 0 && (
                        <div className="text-[10px] text-emerald-500 font-bold">
                          +{fmt(paidToday)} today
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`font-bold ${
                          totalRemaining > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500 dark:text-[#8ba895]'
                        }`}
                      >
                        {fmt(totalRemaining)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View Ledger */}
                        <button
                          onClick={() => {
                            setLedgerCustomer(customer);
                            setActiveLedgerTab(customer.customerCategory || 'SHOP');
                          }}
                          title={`View ${customer.customerCategory === 'PERSONAL' ? 'Personal' : 'Shop'} Expense Statement`}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:text-blue-400 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                        </button>

                        {/* Edit Customer */}
                        <button
                          onClick={() => handleOpenEdit(customer)}
                          title="Edit Customer"
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 dark:text-amber-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Customer */}
                        <button
                          onClick={() => setDeletingCustomer(customer)}
                          title="Delete Customer"
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Pagination */}
        <div className="p-4 border-t border-slate-100 dark:border-[#2d4a35]">
          <Pagination
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredAndSortedCustomers.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(limit) => {
              setItemsPerPage(limit);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
            itemLabel="customers"
          />
        </div>
      </div>

      {/* ── Add / Edit Customer Modal ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#2d4a35]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] bg-slate-50/50 dark:bg-[#142119]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-base">
                    {editingCustomer ? 'Edit Expense Customer' : 'Add Expense Customer'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8ba895]">
                    Customer name for expense tracking and ledgers
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#e2f5e8] hover:bg-slate-100 dark:hover:bg-[#1e3124] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
                  Customer Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aslam Butt, Tariq Mehmood"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
                  Expense Type *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormCategory('SHOP')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      formCategory === 'SHOP'
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 dark:bg-[#142119] border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#8ba895] hover:bg-slate-100'
                    }`}
                  >
                    <Store className="w-4 h-4 text-blue-500" />
                    <span>Shop Expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCategory('PERSONAL')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      formCategory === 'PERSONAL'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-[#142119] border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#8ba895] hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-4 h-4 text-emerald-500" />
                    <span>Personal Expense</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-[#8ba895] mt-1">
                  {formCategory === 'SHOP'
                    ? 'Customer will appear in Shop Expenses for business costs.'
                    : 'Customer will appear in Personal Expenses for personal drawings/khata.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="0300-1234567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Regular contractor, equipment mechanic, personal friend"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#8ba895] hover:bg-slate-50 dark:hover:bg-[#1e3124] text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-[#2d4a35] p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg mb-2">Delete Customer?</h3>
            <p className="text-xs text-slate-500 dark:text-[#8ba895] mb-6">
              Are you sure you want to remove <span className="font-semibold text-slate-700 dark:text-[#e2f5e8]">"{deletingCustomer.name}"</span>?
              Existing expense records will not be deleted.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#8ba895] hover:bg-slate-50 dark:hover:bg-[#1e3124] text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Customer Ledger Modal (with 2 Separate Tabs: Shop Expense vs Personal Expense) ── */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#2d4a35]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] bg-slate-50/60 dark:bg-[#142119]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
                  {ledgerCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-base">
                    {ledgerCustomer.name} — Expense Ledger
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#8ba895]">
                    {ledgerCustomer.phone ? `Phone: ${ledgerCustomer.phone}` : 'No phone'}
                    {ledgerCustomer.notes ? ` • ${ledgerCustomer.notes}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadLedgerPdf(ledgerCustomer, activeLedgerTab)}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] hover:bg-slate-100 dark:hover:bg-[#1e3124] text-xs font-semibold transition-colors disabled:opacity-50"
                  title="Download Ledger Statement PDF"
                >
                  <Download className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>{isExportingPdf ? 'Exporting...' : 'PDF'}</span>
                </button>
                <button
                  onClick={() => setLedgerCustomer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#e2f5e8] hover:bg-slate-100 dark:hover:bg-[#1e3124] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Separate Ledger Switch Tabs: Shop Expense Ledger vs Personal Expense Ledger */}
            <div className="px-6 pt-3 bg-slate-50/30 dark:bg-[#142119]/50 border-b border-slate-200 dark:border-[#2d4a35] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveLedgerTab('SHOP')}
                className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs rounded-t-xl border-t border-x transition-all ${
                  activeLedgerTab === 'SHOP'
                    ? 'bg-white dark:bg-[#1a2e1f] text-blue-600 dark:text-blue-400 border-slate-200 dark:border-[#2d4a35] border-b-transparent -mb-px'
                    : 'text-slate-500 dark:text-[#8ba895] border-transparent hover:text-slate-800'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Shop Expense Statement</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                  {getCustomerExpenses(ledgerCustomer, { type: 'SHOP' }).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveLedgerTab('PERSONAL')}
                className={`flex items-center gap-2 px-5 py-2.5 font-bold text-xs rounded-t-xl border-t border-x transition-all ${
                  activeLedgerTab === 'PERSONAL'
                    ? 'bg-white dark:bg-[#1a2e1f] text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-[#2d4a35] border-b-transparent -mb-px'
                    : 'text-slate-500 dark:text-[#8ba895] border-transparent hover:text-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Personal Expense Statement</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  {getCustomerExpenses(ledgerCustomer, { type: 'PERSONAL' }).length}
                </span>
              </button>
            </div>

            {/* Modal Body: Active Tab Ledger Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {(() => {
                const ledger = buildCustomerLedger(ledgerCustomer, activeLedgerTab);
                const totalDebit = ledger.reduce((sum, e) => sum + e.debit, 0);
                const totalCredit = ledger.reduce((sum, e) => sum + e.credit, 0);
                const closingBalance = ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;

                return (
                  <>
                    {/* Summary Mini Cards for Ledger Modal */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Gave (Debit)</p>
                        <p className="text-base font-bold text-slate-800 dark:text-[#e2f5e8] mt-0.5">{fmt(totalDebit)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Received (Credit)</p>
                        <p className="text-base font-bold text-emerald-600 dark:text-[#22c55e] mt-0.5">{fmt(totalCredit)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Closing Balance</p>
                        <p className={`text-base font-bold mt-0.5 ${closingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-[#e2f5e8]'}`}>
                          {fmt(closingBalance)}
                        </p>
                      </div>
                    </div>

                    {/* Chronological Table */}
                    <div className="border border-slate-200 dark:border-[#2d4a35] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 dark:bg-[#142119] border-b border-slate-200 dark:border-[#2d4a35] font-bold text-slate-600 dark:text-[#8ba895] uppercase tracking-wider">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Description / Details</th>
                            <th className="py-2.5 px-3">Added By</th>
                            <th className="py-2.5 px-3 text-right">Gave (Debit)</th>
                            <th className="py-2.5 px-3 text-right">Received (Credit)</th>
                            <th className="py-2.5 px-3 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                          {ledger.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-[#8ba895]">
                                No {activeLedgerTab === 'SHOP' ? 'Shop' : 'Personal'} expense records for this customer.
                              </td>
                            </tr>
                          ) : (
                            ledger.map((entry) => (
                              <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-[#142119]/50 transition-colors">
                                <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-[#e2f5e8] whitespace-nowrap">
                                  {entry.date}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      entry.type === 'Expense'
                                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    }`}
                                  >
                                    {entry.type === 'Expense' ? 'Gave / Bill' : 'Received'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 dark:text-[#e2f5e8]">
                                  <div className="font-medium">{entry.description}</div>
                                  {entry.notes && <div className="text-[10px] text-slate-400 italic">{entry.notes}</div>}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 dark:text-[#8ba895] whitespace-nowrap">
                                  {formatUserName(entry.addedBy)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                  {entry.debit > 0 ? fmt(entry.debit) : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-medium text-emerald-600 dark:text-[#22c55e] whitespace-nowrap">
                                  {entry.credit > 0 ? fmt(entry.credit) : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-[#e2f5e8] whitespace-nowrap">
                                  {fmt(entry.balance)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {ledger.length > 0 && (
                          <tfoot>
                            <tr className="bg-slate-50/90 dark:bg-[#142119] border-t-2 border-slate-200 dark:border-[#2d4a35] font-bold">
                              <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[10px] text-slate-500">
                                Total Summary:
                              </td>
                              <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400">
                                {fmt(totalDebit)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-[#22c55e]">
                                {fmt(totalCredit)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-900 dark:text-[#e2f5e8]">
                                {fmt(closingBalance)}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 dark:border-[#2d4a35] bg-slate-50/50 dark:bg-[#142119] flex justify-end">
              <button
                type="button"
                onClick={() => setLedgerCustomer(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-[#2d4a35] hover:bg-slate-300 dark:hover:bg-[#3d5a45] text-slate-800 dark:text-[#e2f5e8] text-xs font-bold transition-colors"
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
