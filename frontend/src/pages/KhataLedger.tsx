import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KhataSummaryCards } from '../components/khata/KhataSummaryCards';
import { CollectedBreakdownModal } from '../components/khata/CollectedBreakdownModal';
import { KhataCashCollectModal } from '../components/khata/KhataCashCollectModal';
import { KhataLedgerModal } from '../components/khata/KhataLedgerModal';
import { KhataCustomerFormModal } from '../components/khata/KhataCustomerFormModal';
import { ReportFilters } from '../components/reports/ReportFilters';
import {
  customerService,
  LedgerSummaryStats,
} from '../services/customer.service';
import { ApiCustomer } from '../types/customer';
import { DateFilterType, Supplier, CycleType } from '../types';
import { supplierService } from '../services/supplier.service';
import { SupplierLedgerModal } from '../components/khata/SupplierLedgerModal';
import { SupplierDailyLedgerModal } from '../components/khata/SupplierDailyLedgerModal';
import { KhataSupplierFormModal } from '../components/khata/KhataSupplierFormModal';
import { useDebounce } from '../hooks/useDebounce';
import {
  Search, Download, FileText, Printer, Filter, Plus, ChevronDown,
  DollarSign, BookOpen, Edit2, Trash2, CheckCircle2, RefreshCw, MoreVertical, AlertTriangle, Power
} from 'lucide-react';
import { CustomerTypeFilter, NameSortOrder } from '../components/customers/CustomerToolbar';
import { Pagination } from '../components/common/Pagination';
import * as XLSX from 'xlsx';
import { savePdfDocument, saveExcelDocument } from '../utils/exportUtils';
import { activityLogger } from '../services/activityLogger';

function sortByName<T extends { name: string }>(list: T[], order: NameSortOrder): T[] {
  if (order === 'default') return list;
  const sorted = [...list];
  sorted.sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return order === 'az' ? cmp : -cmp;
  });
  return sorted;
}

const EMPTY_SUMMARY: LedgerSummaryStats = {
  khataAccounts: 0,
  totalOutstanding: 0,
  collectedToday: 0,
  pendingCount: 0,
  paidCount: 0,
};

const ALL_TIME_FILTER: DateFilterType = {
  label: 'All Time',
  startDate: null,
  endDate: null,
};

type SupplierCycleFilter = 'All' | CycleType;

function typeBadge(t: ApiCustomer['customerType']) {
  return t === 'monthly_ledger' ? 'Monthly' : 'Daily';
}

export const KhataLedger: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [partyMode, setPartyMode] = useState<'customers' | 'suppliers'>(
    searchParams.get('tab') === 'suppliers' ? 'suppliers' : 'customers'
  );

  const handleSelectParty = useCallback((mode: 'customers' | 'suppliers') => {
    setPartyMode(mode);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (mode === 'suppliers') {
        next.set('tab', 'suppliers');
      } else {
        next.delete('tab');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [partySearch, setPartySearch] = useState('');
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [dailyLedgerOpen, setDailyLedgerOpen] = useState(false);
  const [collectedBreakdownOpen, setCollectedBreakdownOpen] = useState(false);
  const [summary, setSummary] = useState<LedgerSummaryStats>(EMPTY_SUMMARY);
  const [totalCount, setTotalCount] = useState(0);

  const [collectCustomer, setCollectCustomer] = useState<ApiCustomer | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<ApiCustomer | null>(null);
  const [formCustomer, setFormCustomer] = useState<ApiCustomer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [customerTypeFilter, setCustomerTypeFilter] =
    useState<CustomerTypeFilter>('All');
  const [customerStatusFilter, setCustomerStatusFilter] =
    useState<'all' | 'active' | 'inactive'>('all');
  const [supplierCycleFilter, setSupplierCycleFilter] =
    useState<SupplierCycleFilter>('All');
  const [nameSort, setNameSort] = useState<NameSortOrder>('default');
  const [dateFilter, setDateFilter] = useState<DateFilterType>(ALL_TIME_FILTER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiCustomer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (openActionMenu === null) return;
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openActionMenu]);

  const [customerPage, setCustomerPage] = useState(() => {
    const saved = sessionStorage.getItem('khata_customer_page');
    return saved ? Number(saved) : 1;
  });
  const [customerItemsPerPage, setCustomerItemsPerPage] = useState(25);
  const [supplierPage, setSupplierPage] = useState(() => {
    const saved = sessionStorage.getItem('khata_supplier_page');
    return saved ? Number(saved) : 1;
  });
  const [supplierItemsPerPage, setSupplierItemsPerPage] = useState(25);

  const debouncedSearch = useDebounce(searchQuery, 400);

  // Keep saved pages in sync
  useEffect(() => {
    sessionStorage.setItem('khata_customer_page', String(customerPage));
  }, [customerPage]);

  useEffect(() => {
    sessionStorage.setItem('khata_supplier_page', String(supplierPage));
  }, [supplierPage]);

  // Reset page when filters change (ignore initial partyMode)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setCustomerPage(1);
    setSupplierPage(1);
  }, [debouncedSearch, filterMode, customerTypeFilter, customerStatusFilter, supplierCycleFilter, nameSort, dateFilter, partyMode]);

  const sortedCustomers = useMemo(
    () => sortByName(customers, nameSort),
    [customers, nameSort]
  );

  const paginatedCustomers = useMemo(() => {
    const start = (customerPage - 1) * customerItemsPerPage;
    return sortedCustomers.slice(start, start + customerItemsPerPage);
  }, [sortedCustomers, customerPage, customerItemsPerPage]);

  const visibleSuppliers = useMemo(() => {
    const filtered = suppliers.filter((s) =>
      `${s.name} ${s.code}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return sortByName(filtered, nameSort);
  }, [suppliers, searchQuery, nameSort]);

  const paginatedSuppliers = useMemo(() => {
    const start = (supplierPage - 1) * supplierItemsPerPage;
    return visibleSuppliers.slice(start, start + supplierItemsPerPage);
  }, [visibleSuppliers, supplierPage, supplierItemsPerPage]);

  // Restore scroll position or scroll to active supplier/customer row
  useEffect(() => {
    const scrollToId = sessionStorage.getItem('khata_scroll_to_id');
    if (scrollToId) {
      const el = document.getElementById(scrollToId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        sessionStorage.removeItem('khata_scroll_to_id');
      } else {
        const timer = setTimeout(() => {
          const retryEl = document.getElementById(scrollToId);
          if (retryEl) {
            retryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            sessionStorage.removeItem('khata_scroll_to_id');
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [paginatedSuppliers, paginatedCustomers, partyMode]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const duesStatus =
        filterMode === 'Pending' ? 'pending' : filterMode === 'Paid' ? 'paid' : undefined;

      const ledgerType =
        customerTypeFilter === 'daily_ledger' ||
        customerTypeFilter === 'monthly_ledger'
          ? customerTypeFilter
          : undefined;

      const toYMD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const fromYMD = dateFilter.startDate ? toYMD(dateFilter.startDate) : undefined;
      const toYMDStr = dateFilter.endDate ? toYMD(dateFilter.endDate) : undefined;

      const [list, ledgerSummary] = await Promise.all([
        customerService.getCustomers({
          status: customerStatusFilter,
          search: debouncedSearch.trim() || undefined,
          duesStatus,
          customerType: ledgerType,
          fromDate: fromYMD,
          toDate: toYMDStr,
        }),
        customerService.getLedgerSummary(fromYMD, toYMDStr),
      ]);

      setCustomers(list);
      setSummary(ledgerSummary);
      setTotalCount(ledgerSummary.khataAccounts);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Khata ledger');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterMode, dateFilter, customerTypeFilter, customerStatusFilter]);

  const loadSuppliers = useCallback(async () => {
    try {
      const toYMD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const list = await supplierService.list({
        ...(supplierCycleFilter !== 'All'
          ? { cycleType: supplierCycleFilter }
          : {}),
        ...(dateFilter.startDate
          ? { fromDate: toYMD(dateFilter.startDate) }
          : {}),
        ...(dateFilter.endDate
          ? { toDate: toYMD(dateFilter.endDate) }
          : {}),
      });
      setSuppliers(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load suppliers');
      setSuppliers([]);
    }
  }, [supplierCycleFilter, dateFilter]);

  const refreshAfterAction = useCallback(async () => {
    await Promise.all([
      loadData(),
      partyMode === 'suppliers' ? loadSuppliers() : Promise.resolve(),
    ]);
  }, [loadData, loadSuppliers, partyMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (partyMode === 'suppliers') loadSuppliers();
  }, [partyMode, loadSuppliers]);

  const cycleFilter = () => {
    setFilterMode((prev) =>
      prev === 'All' ? 'Pending' : prev === 'Pending' ? 'Paid' : 'All'
    );
  };

  const handleDelete = (c: ApiCustomer) => {
    setDeleteTarget(c);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteLoading) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await customerService.deleteCustomer(deleteTarget.id);
      activityLogger.log({
        action: 'CUSTOMER_DELETED',
        module: 'Customers',
        description: `Removed customer "${deleteTarget.name}" (ID: ${deleteTarget.id}) from Khata Ledger. They have been marked as inactive.`,
        entityId: String(deleteTarget.id),
        status: 'Success',
      });
      setDeleteTarget(null);
      await refreshAfterAction();
    } catch (err: any) {
      const message = err?.message || 'Failed to delete customer';
      activityLogger.log({
        action: 'CUSTOMER_DELETED',
        module: 'Customers',
        description: `Failed to remove customer "${deleteTarget.name}" (ID: ${deleteTarget.id}) from Khata Ledger: ${message}`,
        entityId: String(deleteTarget.id),
        status: 'Error',
      });
      setError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleActive = async (c: ApiCustomer) => {
    const nextStatus = c.status === 'inactive' ? 'active' : 'inactive';
    try {
      await customerService.updateStatus(c.id, nextStatus);
      activityLogger.log({
        action: nextStatus === 'active' ? 'CUSTOMER_ACTIVATED' : 'CUSTOMER_DEACTIVATED',
        module: 'Customers',
        description: `Customer "${c.name}" (ID: ${c.id}) is now marked as ${nextStatus}.`,
        entityId: String(c.id),
        status: 'Success',
      });
      await refreshAfterAction();
    } catch (err: any) {
      const msg = err?.message || `Failed to set customer to ${nextStatus}`;
      setError(msg);
    }
  };

  const handleOpenAdd = () => {
    setFormCustomer(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (c: ApiCustomer) => {
    setFormCustomer(c);
    setIsFormOpen(true);
  };

  const handleExcelExport = async () => {
    try {
      const dataRows = customers.map((c) => {
        const current = c.currentDue ?? 0;
        const previous = c.previousDue ?? 0;
        const totalPay = c.totalAmount ?? current + previous;
        const paid = c.paidAmount ?? 0;
        const bal = c.remainingBalance ?? c.totalDue ?? 0;
        return {
          'Name': c.name,
          'Phone': c.phone || '',
          'Customer Type': c.customerType === 'monthly_ledger' ? 'Monthly' : 'Daily',
          'Current Due (Rs.)': current,
          'Previous Due (Rs.)': previous,
          'Total to Pay (Rs.)': totalPay,
          'Paid (Rs.)': paid,
          'Remaining Balance (Rs.)': bal,
          'Address': c.address || '',
          'Last Sale': c.lastSaleDate ? new Date(c.lastSaleDate).toLocaleDateString('en-GB') : '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Khata Ledger');
      const filename = `Khata_Ledger_${filterMode}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await saveExcelDocument(workbook, filename);
    } catch (err) {
      console.error('[Khata] Excel export error:', err);
    }
  };

  const handlePdfExport = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('GUJJAR MILK SHOP', 14, 15);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Khata Ledger Report — Filter: ${filterLabel}`, 14, 22);
      doc.setFontSize(9);
      doc.text(`Generated on: ${new Date().toLocaleString('en-PK')}`, 14, 28);

      // Summary Card row
      const summaryItems = [
        { label: 'Total Accounts', val: String(summary.khataAccounts) },
        { label: 'Total Outstanding', val: `Rs. ${Math.round(summary.totalOutstanding).toLocaleString()}` },
        { label: 'Collected Today', val: `Rs. ${Math.round(summary.collectedToday).toLocaleString()}` },
        { label: 'Pending Accounts', val: String(summary.pendingCount) },
        { label: 'Paid Accounts', val: String(summary.paidCount) },
      ];

      let cardX = 14;
      const cardWidth = 51;
      const cardHeight = 14;
      const cardGap = 4;
      summaryItems.forEach((item) => {
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(cardX, 32, cardWidth, cardHeight, 1.5, 1.5, 'FD');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(item.label, cardX + 3, 37);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(item.val, cardX + 3, 43);
        doc.setFont('helvetica', 'normal');
        cardX += cardWidth + cardGap;
      });

      // Rows
      let totalCurrent = 0;
      let totalPrevious = 0;
      let totalToPay = 0;
      let totalPaid = 0;
      let totalRemaining = 0;

      const body = customers.map((c) => {
        const current = c.currentDue ?? 0;
        const previous = c.previousDue ?? 0;
        const totalPay = c.totalAmount ?? current + previous;
        const paid = c.paidAmount ?? 0;
        const bal = c.remainingBalance ?? c.totalDue ?? 0;

        totalCurrent += current;
        totalPrevious += previous;
        totalToPay += totalPay;
        totalPaid += paid;
        totalRemaining += bal;

        return [
          c.name || '—',
          c.phone || '—',
          c.customerType === 'monthly_ledger' ? 'Monthly' : 'Daily',
          Math.round(current).toLocaleString(),
          Math.round(previous).toLocaleString(),
          Math.round(totalPay).toLocaleString(),
          Math.round(paid).toLocaleString(),
          bal > 0 ? Math.round(bal).toLocaleString() : 'Clear',
          c.lastSaleDate
            ? new Date(c.lastSaleDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            : '—',
        ];
      });

      // Total row
      body.push([
        'TOTAL',
        '',
        '',
        Math.round(totalCurrent).toLocaleString(),
        Math.round(totalPrevious).toLocaleString(),
        Math.round(totalToPay).toLocaleString(),
        Math.round(totalPaid).toLocaleString(),
        Math.round(totalRemaining).toLocaleString(),
        '',
      ]);

      autoTable(doc, {
        head: [
          [
            'Customer Name',
            'Phone',
            'Type',
            'Current Due',
            'Previous Due',
            'Total to Pay',
            'Paid',
            'Remaining',
            'Last Sale',
          ],
        ],
        body,
        startY: 50,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        didParseCell: (hookData) => {
          if (hookData.section === 'body' && hookData.row.index === body.length - 1) {
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fillColor = [241, 245, 249];
          }
          if (hookData.column.index === 7 && hookData.cell.text[0] !== 'Clear' && hookData.cell.text[0] !== '0') {
            hookData.cell.styles.textColor = [220, 38, 38];
          }
        },
      });

      const filename = `Khata_Ledger_${filterMode}_${new Date().toISOString().split('T')[0]}.pdf`;
      await savePdfDocument(doc, filename);
    } catch (err) {
      console.error('[Khata] PDF export error:', err);
    }
  };

  const handleDailyPrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Daily Khata Report — ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 12px; }
            h2 { margin-bottom: 2px; } p { color:#666; margin-bottom:16px; }
            table { width:100%; border-collapse:collapse; }
            th { background:#f1f5f9; text-align:left; padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
            td { padding:8px 12px; border-bottom:1px solid #e2e8f0; }
            .bal { font-weight:bold; color:#dc2626; }
            .clear { color:#16a34a; font-weight:bold; }
          </style>
        </head>
        <body>
          <h2>Daily Khata Report</h2>
          <p>Gujar Milk Shop — ${new Date().toLocaleString()}</p>
          <p>Accounts: ${summary.khataAccounts} · Outstanding: Rs. ${Math.round(summary.totalOutstanding).toLocaleString()} · Collected today: Rs. ${Math.round(summary.collectedToday).toLocaleString()}</p>
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Customer Type</th><th>Current Month/Day</th><th>Previous Month/Day</th><th>Total to Pay</th><th>Paid</th><th>Remaining</th><th>Last Sale</th></tr></thead>
            <tbody>
              ${customers
                .map((c) => {
                  const current = c.currentDue ?? 0;
                  const previous = c.previousDue ?? 0;
                  const totalPay = c.totalAmount ?? current + previous;
                  const paid = c.paidAmount ?? 0;
                  const bal = c.remainingBalance ?? c.totalDue ?? 0;
                  const fmt = (n: number) => 'Rs. ' + Math.round(n).toLocaleString();
                  return `<tr>
                <td>${c.name}</td>
                <td>${c.phone || 'Not Available'}</td>
                <td>${typeBadge(c.customerType)}</td>
                <td>${fmt(current)}</td>
                <td>${fmt(previous)}</td>
                <td>${fmt(totalPay)}</td>
                <td>${fmt(paid)}</td>
                <td class="${bal > 0 ? 'bal' : 'clear'}">${bal > 0 ? fmt(bal) : 'Clear'}</td>
                <td>${c.lastSaleDate ? new Date(c.lastSaleDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Not Available'}</td>
              </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </body>
      </html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.print();
    }
  };

  const filterLabel =
    filterMode === 'All'
      ? 'Paid / Pending'
      : filterMode === 'Pending'
        ? `Pending (${summary.pendingCount})`
        : `Paid (${summary.paidCount})`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">Khata Ledger</h1>
          <p className="text-slate-500 dark:text-[#64916e] text-sm mt-1">Manage credit customers and track payments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={refreshAfterAction}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#a7c4ae] rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#1e3124] shadow-sm transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleExcelExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#a7c4ae] rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#1e3124] shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Excel
          </button>
          <button
            type="button"
            onClick={handlePdfExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#a7c4ae] rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#1e3124] shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            PDF
          </button>
          <button
            type="button"
            onClick={handleDailyPrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#a7c4ae] rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#1e3124] shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Daily Print
          </button>
          <button
            type="button"
            onClick={cycleFilter}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border shadow-sm transition-colors ${
              filterMode !== 'All'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white dark:bg-[#1a2e1f] text-slate-600 dark:text-[#a7c4ae] border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#1e3124]'
            }`}
          >
            <Filter className="w-4 h-4" />
            {filterLabel}
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Customer
          </button>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex-shrink-0">
      <KhataSummaryCards
        summary={summary}
        loading={loading}
        dateFilterLabel={dateFilter.label}
        partyMode={partyMode}
        onCollectedClick={() => setCollectedBreakdownOpen(true)}
      />
      </div>

      {(partyMode === 'customers' || partyMode === 'suppliers') && (
        <div className="flex-shrink-0">
          <ReportFilters
            currentFilter={dateFilter}
            onFilterChange={setDateFilter}
            onRefresh={refreshAfterAction}
            isLoading={loading}
            allowAllTime
          />
        </div>
      )}

      {partyMode === 'customers' ? <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0 flex items-center gap-3">
          <div className="relative w-56 flex-shrink-0">
            <button type="button" onClick={() => setPartyPickerOpen((open) => !open)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#e2f5e8] rounded-xl text-sm font-semibold shadow-sm" aria-haspopup="listbox" aria-expanded={partyPickerOpen}>
              {partyMode === 'customers' ? 'Customers' : 'Suppliers'}
              <ChevronDown className="w-4 h-4 text-slate-400 dark:text-[#64916e]" />
            </button>
            {partyPickerOpen && <div className="absolute left-0 top-full mt-2 z-30 w-56 rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f] p-2 shadow-xl"><div className="relative mb-2"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-[#64916e]" /><input autoFocus type="search" value={partySearch} onChange={(e) => setPartySearch(e.target.value)} placeholder="Search party type..." className="w-full rounded-lg border border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] py-2 pl-8 pr-2 text-xs text-slate-700 dark:text-[#e2f5e8] outline-none focus:border-blue-500" /></div>{(['customers', 'suppliers'] as const).filter((mode) => mode.includes(partySearch.toLowerCase().trim())).map((mode) => <button key={mode} type="button" onClick={() => { handleSelectParty(mode); setPartySearch(''); setPartyPickerOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${partyMode === mode ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124]'}`}>{mode === 'customers' ? 'Customers' : 'Suppliers'}</button>)}</div>}
          </div>
          <div className="relative max-w-lg flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#64916e] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={
              customerTypeFilter === 'daily_ledger' ||
              customerTypeFilter === 'monthly_ledger'
                ? customerTypeFilter
                : 'All'
            }
            onChange={(e) =>
              setCustomerTypeFilter(e.target.value as CustomerTypeFilter)
            }
            className="px-3 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
          >
            <option value="All">All Types</option>
            <option value="daily_ledger">Daily Ledger</option>
            <option value="monthly_ledger">Monthly Ledger</option>
          </select>
          <select
            value={customerStatusFilter}
            onChange={(e) =>
              setCustomerStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
            }
            className="px-3 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
            title="Filter by Active / Inactive"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <select
            value={nameSort}
            onChange={(e) => setNameSort(e.target.value as NameSortOrder)}
            className="px-3 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
            title="Sort by name"
          >
            <option value="default">Sort: Default</option>
            <option value="az">Name A–Z</option>
            <option value="za">Name Z–A</option>
          </select>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0 z-10">
              <tr>
                <th className="w-14 px-3 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35] text-center">
                  #
                </th>
                <th className="px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
                  Name
                </th>
                <th className="px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
                  Phone
                </th>
                <th className="px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
                  Type
                </th>
                <th className="px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
                  Current Month / Day
                </th>
                <th className="px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
                  Previous Month / Day
                </th>
                <th className="px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
                  Total to Pay
                </th>
                <th className="px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
                  Paid
                </th>
                <th className="px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
                  Remaining Balance
                </th>
                <th className="px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
                  Last Sale
                </th>
                <th className="w-12 px-4 py-3.5 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35] text-right">
                  
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-16 text-center text-sm text-slate-400">
                    Loading customers…
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <CheckCircle2 className="w-10 h-10 text-slate-200" />
                      <p className="text-sm font-medium">No customers found</p>
                      <p className="text-xs">Try adjusting your search or filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c, index) => {
                  const currentDue = c.currentDue ?? 0;
                  const previousDue = c.previousDue ?? 0;
                  const totalToPay = c.totalAmount ?? currentDue + previousDue;
                  const paid = c.paidAmount ?? 0;
                  const balance = c.remainingBalance ?? c.totalDue ?? 0;
                  const initials = c.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();
                  const isMonthly = c.customerType === 'monthly_ledger';
                  const fmtAmt = (n: number) =>
                    n > 0 ? (
                      <span className="font-bold text-sm text-slate-700 dark:text-[#e2f5e8]">
                        Rs. {Math.round(n).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-slate-400 dark:text-[#64916e]">Rs. 0</span>
                    );

                  const isInactive = c.status === 'inactive';

                  return (
                    <tr id={`customer-row-${c.id}`} key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-[#1e3124] transition-colors group">
                      <td className="px-3 py-3 text-center text-sm font-medium text-slate-500 dark:text-[#64916e] tabular-nums">
                        {(customerPage - 1) * customerItemsPerPage + index + 1}
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="min-w-0">
                          <button 
                            type="button"
                            onClick={() => {
                              sessionStorage.setItem('khata_scroll_to_id', `customer-row-${c.id}`);
                              navigate(`/ledger/customers/${c.id}`);
                            }}
                            className={`font-semibold text-sm hover:underline truncate text-left block w-full ${
                              isInactive 
                                ? 'line-through text-red-500 dark:text-red-400 font-bold hover:text-red-600 dark:hover:text-red-300' 
                                : 'text-blue-600 dark:text-[#22c55e] hover:text-blue-800 dark:hover:text-[#86efac]'
                            }`}
                            title={isInactive ? `${c.name} (Inactive / Khata Ended)` : c.name}
                          >
                            {c.name}
                          </button>
                          {c.address && (
                            <p className="text-[10px] text-slate-400 dark:text-[#64916e] truncate">
                              {c.address}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae] truncate max-w-[140px]" title={c.phone?.trim() ? c.phone : 'Not Available'}>
                        {c.phone?.trim() ? c.phone : 'Not Available'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            isMonthly
                              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                              : 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                          }`}
                        >
                          {typeBadge(c.customerType)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{fmtAmt(currentDue)}</td>
                      <td className="px-4 py-3">{fmtAmt(previousDue)}</td>
                      <td className="px-4 py-3">{fmtAmt(totalToPay)}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                          Rs. {Math.round(paid).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {balance > 0 ? (
                          <span className="font-bold text-sm text-rose-600 dark:text-rose-400">
                            Rs. {Math.round(balance).toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/40">
                            <CheckCircle2 className="w-3 h-3" /> Clear
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {c.lastSaleDate
                          ? new Date(c.lastSaleDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })
                          : 'Not Available'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative flex items-center justify-end" ref={openActionMenu === c.id ? actionMenuRef : undefined}>
                          <button
                            type="button"
                            onClick={() => setOpenActionMenu(openActionMenu === c.id ? null : c.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-[#e2f5e8] hover:bg-slate-100 dark:hover:bg-[#223927] transition-colors"
                            title="More Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionMenu === c.id && (
                            <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xl border border-slate-200 dark:border-[#2d4a35] py-1 overflow-hidden">
                              {/* Toggle Active from menu too */}
                              <button
                                type="button"
                                onClick={() => { handleToggleActive(c); setOpenActionMenu(null); }}
                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm font-semibold transition-colors ${
                                  isInactive
                                    ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-[#223927]'
                                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-[#223927]'
                                }`}
                              >
                                <Power className="w-4 h-4" />
                                {isInactive ? 'Mark as Active' : 'Mark as Inactive'}
                              </button>

                              <div className="h-px bg-slate-100 dark:bg-[#2d4a35] my-1" />

                              {/* Cash Collect */}
                              <button
                                type="button"
                                onClick={() => { setCollectCustomer(c); setOpenActionMenu(null); }}
                                disabled={balance <= 0}
                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
                                  balance > 0
                                    ? 'text-emerald-700 dark:text-[#22c55e] hover:bg-emerald-50 dark:hover:bg-[#223927]'
                                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                }`}
                              >
                                <DollarSign className="w-4 h-4" />
                                Cash Collect
                              </button>

                              {/* Ledger */}
                              <button
                                type="button"
                                onClick={() => { setLedgerCustomer(c); setOpenActionMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-[#223927] transition-colors"
                              >
                                <BookOpen className="w-4 h-4" />
                                View Ledger
                              </button>

                              <div className="h-px bg-slate-100 dark:bg-[#2d4a35] my-1" />

                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => { handleOpenEdit(c); setOpenActionMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#e2f5e8] hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => { handleDelete(c); setOpenActionMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {customers.length > 0 && (
          <Pagination
            currentPage={customerPage}
            totalItems={sortedCustomers.length}
            itemsPerPage={customerItemsPerPage}
            onPageChange={setCustomerPage}
            onItemsPerPageChange={setCustomerItemsPerPage}
            itemLabel="customers"
          />
        )}
      </div> : (
        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-[#2d4a35] flex items-center gap-3 flex-wrap">
            <div className="relative w-56 flex-shrink-0">
              <button
                type="button"
                onClick={() => setPartyPickerOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#e2f5e8] rounded-xl text-sm font-semibold shadow-sm"
                aria-haspopup="listbox"
                aria-expanded={partyPickerOpen}
              >
                Suppliers
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {partyPickerOpen && (
                <div className="absolute left-0 top-full mt-2 z-30 w-56 rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f] p-2 shadow-xl">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-[#64916e]" />
                    <input
                      autoFocus
                      type="search"
                      value={partySearch}
                      onChange={(e) => setPartySearch(e.target.value)}
                      placeholder="Search party type..."
                      className="w-full rounded-lg border border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] py-2 pl-8 pr-2 text-xs text-slate-700 dark:text-[#e2f5e8] outline-none focus:border-blue-500"
                    />
                  </div>
                  {(['customers', 'suppliers'] as const)
                    .filter((mode) => mode.includes(partySearch.toLowerCase().trim()))
                    .map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          handleSelectParty(mode);
                          setPartySearch('');
                          setPartyPickerOpen(false);
                        }}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                          partyMode === mode
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124]'
                        }`}
                      >
                        {mode === 'customers' ? 'Customers' : 'Suppliers'}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="relative max-w-lg flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search suppliers by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <select
              value={supplierCycleFilter}
              onChange={(e) =>
                setSupplierCycleFilter(e.target.value as SupplierCycleFilter)
              }
              className="px-3 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
            >
              <option value="All">All Types</option>
              <option value="Monthly Cycle">Monthly Cycle</option>
              <option value="Weekly Cycle">Weekly Cycle</option>
              <option value="1-Day Cycle">1-Day Cycle</option>
            </select>
            <select
              value={nameSort}
              onChange={(e) => setNameSort(e.target.value as NameSortOrder)}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0"
              title="Sort by name"
            >
              <option value="default">Sort: Default</option>
              <option value="az">Name A–Z</option>
              <option value="za">Name Z–A</option>
            </select>
            <button
              type="button"
              onClick={() => setDailyLedgerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Download Ledgers
            </button>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0 z-10">
                <tr>
                  <th className="w-14 px-3 py-3 text-center text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]">#</th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]">Supplier</th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]">Code</th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]">Cycle</th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35] text-right" title="Morning milk collection in kg">
                    Morning (kg)
                  </th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35] text-right" title="Evening milk collection in kg">
                    Evening (kg)
                  </th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35] text-right" title="Milk purchase rate">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35] text-right" title="Total milk purchase value for period">
                    Total
                  </th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]">Advance</th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]" title="Purchases in current month, week, or day">
                    Current Cycle
                  </th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]" title="Purchases before current cycle">
                    Previous Cycle
                  </th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]">Total to Pay</th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]">Paid</th>
                  <th className="px-4 py-3 text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]">Remaining Balance</th>
                  <th className="px-4 py-3 text-right text-xs uppercase text-slate-500 dark:text-[#64916e] border-b border-slate-100 dark:border-[#2d4a35]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                {(() => {
                    const rows = paginatedSuppliers.map((supplier, index) => {
                    const current = supplier.currentAmount ?? 0;
                    const previous = supplier.previousAmount ?? 0;
                    const totalToPay = supplier.totalAmount ?? current + previous;
                    const paid = supplier.paidAmount ?? 0;
                    const remaining = supplier.remainingBalance ?? supplier.payableBalance;
                    const morningMilk = supplier.morningQty ?? 0;
                    const eveningMilk = supplier.eveningQty ?? 0;
                    const totalMilk = morningMilk + eveningMilk;
                    // ── RATE: from Supplier page's defaultRate if period has milk, else 0 ──
                    const supplierRate = totalMilk > 0 ? (supplier.defaultRate ?? 0) : 0;
                    const periodTotal = supplier.periodPurchases ?? (totalMilk * (supplier.defaultRate ?? 0));

                    const fmtAmt = (n: number) => {
                      if (n < 0) {
                        return (
                          <span className="font-bold text-emerald-600">
                            Rs. −{Math.abs(Math.round(n)).toLocaleString()}
                          </span>
                        );
                      }
                      if (n === 0) {
                        return <span className="text-sm font-medium text-slate-400">Rs. 0</span>;
                      }
                      return (
                        <span className="font-bold text-slate-700">
                          Rs. {Math.round(n).toLocaleString()}
                        </span>
                      );
                    };
                    return (
                      <tr id={`supplier-row-${supplier.id}`} key={supplier.id} className="hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors">
                        <td className="px-3 py-3 text-center text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                          {(supplierPage - 1) * supplierItemsPerPage + index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-[#e2f5e8] max-w-[200px]">
                          <button
                            type="button"
                            onClick={() => {
                              sessionStorage.setItem('khata_scroll_to_id', `supplier-row-${supplier.id}`);
                              navigate(`/ledger/suppliers/${supplier.id}`);
                            }}
                            className="text-blue-600 dark:text-[#22c55e] hover:text-blue-800 dark:hover:text-[#86efac] hover:underline truncate block w-full text-left"
                            title={supplier.name}
                          >
                            {supplier.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{supplier.code}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{supplier.cycleType}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                          {morningMilk > 0 ? `${morningMilk.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {eveningMilk > 0 ? `${eveningMilk.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700 dark:text-[#e2f5e8] tabular-nums">
                          {supplierRate > 0 ? `Rs. ${supplierRate}` : 'Rs. 0'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-800 dark:text-[#e2f5e8] tabular-nums">
                          {periodTotal > 0 ? `Rs. ${Math.round(periodTotal).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {(supplier.guaranteedAdvance || 0) > 0
                            ? `−Rs. ${Math.round(supplier.guaranteedAdvance).toLocaleString()}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">{fmtAmt(current)}</td>
                        <td className="px-4 py-3">{fmtAmt(previous)}</td>
                        <td className="px-4 py-3">{fmtAmt(totalToPay)}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                            Rs. {Math.round(paid).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {remaining < 0 ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Rs. −{Math.abs(Math.round(remaining)).toLocaleString()}
                            </span>
                          ) : remaining === 0 ? (
                            <span className="text-sm font-medium text-slate-400 dark:text-slate-500">Rs. 0</span>
                          ) : (
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              Rs. {Math.round(remaining).toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setLedgerSupplier(supplier)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              Ledger
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditSupplier(supplier)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Edit supplier name and remaining balance"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                    return rows;
                  })()}

                  {/* ── Grand Total Row ── */}
                  {visibleSuppliers.length > 0 && (() => {
                    // Calculate totals over ALL filtered suppliers (visibleSuppliers) regardless of pagination
                    let gtMorning = 0, gtEvening = 0, gtPeriodTotal = 0;
                    let gtAdvance = 0, gtCurrent = 0, gtPrevious = 0;
                    let gtTotalToPay = 0, gtPaid = 0, gtRemaining = 0;
                    let gtWeightedRateNum = 0, gtWeightedRateDen = 0;
                    for (const s of visibleSuppliers) {
                      const morning = s.morningQty ?? 0;
                      const evening = s.eveningQty ?? 0;
                      const totalKg = morning + evening;
                      const sRate = s.defaultRate ?? 0;
                      const speriodTotal = s.periodPurchases ?? (totalKg * sRate);
                      const scurrent = s.currentAmount ?? 0;
                      const sprevious = s.previousAmount ?? 0;
                      const stotalToPay = s.totalAmount ?? (scurrent + sprevious);
                      const spaid = s.paidAmount ?? 0;
                      const sremaining = s.remainingBalance ?? s.payableBalance;
                      gtMorning += morning;
                      gtEvening += evening;
                      gtPeriodTotal += speriodTotal;
                      gtAdvance += s.guaranteedAdvance || 0;
                      gtCurrent += scurrent;
                      gtPrevious += sprevious;
                      gtTotalToPay += stotalToPay;
                      gtPaid += spaid;
                      gtRemaining += sremaining;
                      gtWeightedRateNum += totalKg * sRate;
                      gtWeightedRateDen += totalKg;
                    }
                    const weightedAvgRate = gtWeightedRateDen > 0
                      ? Math.round(gtWeightedRateNum / gtWeightedRateDen)
                      : 0;
                    const fmtTotal = (n: number) => n !== 0 ? `Rs. ${Math.round(Math.abs(n)).toLocaleString()}` : 'Rs. 0';
                    return (
                      <tr className="bg-slate-100 dark:bg-[#111e14] border-t-2 border-slate-300 dark:border-[#2d4a35] font-bold">
                        <td className="px-3 py-3 text-center text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">—</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-[#a7c4ae] uppercase tracking-wider" colSpan={3}>Grand Total</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                          {gtMorning > 0 ? `${gtMorning.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                          {gtEvening > 0 ? `${gtEvening.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-700 dark:text-[#e2f5e8] tabular-nums">
                          {weightedAvgRate > 0 ? `≈ Rs. ${weightedAvgRate}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-800 dark:text-[#e2f5e8] tabular-nums">
                          {gtPeriodTotal > 0 ? fmtTotal(gtPeriodTotal) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {gtAdvance > 0 ? `−Rs. ${Math.round(gtAdvance).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-[#e2f5e8]">{fmtTotal(gtCurrent)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-[#e2f5e8]">{fmtTotal(gtPrevious)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{fmtTotal(gtTotalToPay)}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">Rs. {Math.round(gtPaid).toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3">
                          {gtRemaining > 0 ? (
                            <span className="font-bold text-amber-700 dark:text-amber-400">Rs. {Math.round(gtRemaining).toLocaleString()}</span>
                          ) : gtRemaining < 0 ? (
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">Rs. −{Math.abs(Math.round(gtRemaining)).toLocaleString()}</span>
                          ) : (
                            <span className="text-sm font-medium text-slate-400">Rs. 0</span>
                          )}
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    );
                  })()}
              </tbody>
            </table>
          </div>
          {visibleSuppliers.length > 0 && (
            <Pagination
              currentPage={supplierPage}
              totalItems={visibleSuppliers.length}
              itemsPerPage={supplierItemsPerPage}
              onPageChange={setSupplierPage}
              onItemsPerPageChange={setSupplierItemsPerPage}
              itemLabel="suppliers"
            />
          )}
        </div>
      )}

      {isFormOpen && (
        <KhataCustomerFormModal
          customer={formCustomer}
          onClose={() => setIsFormOpen(false)}
          onSaved={refreshAfterAction}
        />
      )}
      {collectCustomer && (
        <KhataCashCollectModal
          customer={collectCustomer}
          onClose={() => setCollectCustomer(null)}
          onCollected={refreshAfterAction}
        />
      )}
      {ledgerCustomer && (
        <KhataLedgerModal
          customer={ledgerCustomer}
          onClose={() => {
            setLedgerCustomer(null);
            refreshAfterAction();
          }}
        />
      )}
      {ledgerSupplier && (
        <SupplierLedgerModal
          supplier={ledgerSupplier}
          onClose={() => setLedgerSupplier(null)}
          onPaid={async () => {
            const list = await supplierService.list();
            setSuppliers(list);
            setLedgerSupplier((prev) => {
              if (!prev) return null;
              return list.find((s) => s.id === prev.id) ?? prev;
            });
            try {
              const ledgerSummary = await customerService.getLedgerSummary();
              setSummary(ledgerSummary);
            } catch {
              /* summary is best-effort */
            }
          }}
        />
      )}
      {editSupplier && (
        <KhataSupplierFormModal
          supplier={editSupplier}
          onClose={() => setEditSupplier(null)}
          onSaved={refreshAfterAction}
        />
      )}
      {dailyLedgerOpen && (
        <SupplierDailyLedgerModal onClose={() => setDailyLedgerOpen(false)} />
      )}

      {/* Delete Customer Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl border border-slate-100 dark:border-[#2d4a35] w-full max-w-sm p-6 animate-in fade-in zoom-in duration-150">
            {/* Icon + Title */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#e2f5e8] leading-snug">Remove from Khata?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  You are about to remove{' '}
                  <span className="font-semibold text-slate-800 dark:text-[#e2f5e8]">"{deleteTarget.name}"</span>{' '}
                  from the Khata ledger. They will be marked as inactive.
                </p>
              </div>
            </div>

            {/* Warning note */}
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3.5 py-2.5 mb-5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                This action cannot be undone from the Khata ledger.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#223927] rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors shadow-sm shadow-red-600/25 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleteLoading ? 'Removing…' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {collectedBreakdownOpen && (() => {
        const toYMD = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        const fromDate = dateFilter.startDate ? toYMD(dateFilter.startDate) : undefined;
        const toDate = dateFilter.endDate ? toYMD(dateFilter.endDate) : undefined;
        return (
          <CollectedBreakdownModal
            mode={partyMode}
            periodLabel={dateFilter.label}
            fromDate={fromDate}
            toDate={toDate}
            onClose={() => setCollectedBreakdownOpen(false)}
          />
        );
      })()}
    </div>
  );
};
