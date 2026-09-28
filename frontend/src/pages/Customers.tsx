import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { CustomerSummary } from '../components/customers/CustomerSummary';
import {
  CustomerToolbar,
  CustomerTypeFilter,
  NameSortOrder,
} from '../components/customers/CustomerToolbar';
import { CustomerTable } from '../components/customers/CustomerTable';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { SplitKhataModal } from '../components/customers/SplitKhataModal';
import { CollectConfirmModal } from '../components/customers/CollectConfirmModal';
import { Pagination } from '../components/common/Pagination';
import { customerService, CustomerSummaryStats } from '../services/customer.service';
import { saleService, SaleRecord } from '../services/sale.service';
import { getReturns } from '../services/returnsService';
import { ApiCustomer, CustomerTableRow } from '../types/customer';
import { ReturnRecord } from '../types/returns';
import { useDebounce } from '../hooks/useDebounce';
import { activityLogger } from '../services/activityLogger';

function normalizePhone(phone: string | null | undefined): string {
  return (phone || '').replace(/\s+/g, '').toLowerCase();
}

function ledgerTypeLabel(t: ApiCustomer['customerType']): string {
  return t === 'monthly_ledger' ? 'Monthly Ledger' : 'Daily Ledger';
}

function mapLedgerRow(c: ApiCustomer): CustomerTableRow {
  const remaining =
    typeof c.remainingBalance === 'number'
      ? c.remainingBalance
      : typeof c.totalDue === 'number'
        ? c.totalDue
        : 0;
  return {
    key: `ledger-${c.id}`,
    kind: 'ledger',
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    typeLabel: ledgerTypeLabel(c.customerType),
    customerType: c.customerType,
    currentDue: typeof c.currentDue === 'number' ? c.currentDue : 0,
    previousDue: typeof c.previousDue === 'number' ? c.previousDue : 0,
    totalAmount: typeof c.totalAmount === 'number' ? c.totalAmount : remaining,
    paidAmount: typeof c.paidAmount === 'number' ? c.paidAmount : 0,
    balance: remaining,
    lastSaleDate: c.lastSaleDate ?? null,
    status: c.status,
    paymentType: 'Khata',
  };
}

function mapWalkInRow(sale: SaleRecord): CustomerTableRow {
  const method = sale.payments?.[0]?.method;
  return {
    key: `walkin-${sale.id}`,
    kind: 'walk_in',
    id: sale.id,
    name: sale.customerName || 'Walk-in Customer',
    phone: sale.customerPhone,
    address: null,
    typeLabel: 'Walk-in',
    currentDue: null,
    previousDue: null,
    totalAmount: null,
    paidAmount: null,
    balance: 0,
    lastSaleDate: sale.createdAt,
    status: sale.status,
    paymentType: method === 'online' ? 'Online' : method === 'cash' ? 'Cash' : null,
    saleIds: [sale.id],
  };
}

/** Group split sales by phone → one customer row with total remaining */
function mapSplitGroups(splits: SaleRecord[]): CustomerTableRow[] {
  const groups = new Map<string, SaleRecord[]>();

  for (const sale of splits) {
    const phoneKey = normalizePhone(sale.customerPhone);
    const key = phoneKey || `sale-${sale.id}`;
    const list = groups.get(key) || [];
    list.push(sale);
    groups.set(key, list);
  }

  const rows: CustomerTableRow[] = [];
  for (const [, list] of groups) {
    list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest = list[0];
    const totalRemaining = list.reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
    const name =
      list.find((s) => s.customerName)?.customerName || 'Split Customer';

    rows.push({
      key: `split-${normalizePhone(latest.customerPhone) || latest.id}`,
      kind: 'split',
      id: latest.id,
      name,
      phone: latest.customerPhone,
      address: null,
      typeLabel: 'Split',
      currentDue: null,
      previousDue: null,
      totalAmount: null,
      paidAmount: null,
      balance: totalRemaining,
      lastSaleDate: latest.createdAt,
      status: totalRemaining > 0 ? 'partial' : 'paid',
      paymentType: 'Split',
      saleIds: list.map((s) => s.id),
    });
  }
  return rows;
}

export const Customers: React.FC = () => {
  const [rows, setRows] = useState<CustomerTableRow[]>([]);
  const [ledgerById, setLedgerById] = useState<Record<number, ApiCustomer>>({});
  const [splitSalesByPhone, setSplitSalesByPhone] = useState<Record<string, SaleRecord[]>>({});
  const [summary, setSummary] = useState<CustomerSummaryStats>({
    totalRows: 0,
    totalOutstanding: 0,
    withDues: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ApiCustomer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerTableRow | null>(null);

  const [khataRow, setKhataRow] = useState<CustomerTableRow | null>(null);
  const [khataSales, setKhataSales] = useState<SaleRecord[]>([]);
  const [khataReturns, setKhataReturns] = useState<ReturnRecord[]>([]);
  const [collectRow, setCollectRow] = useState<CustomerTableRow | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Dues'>('All');
  const [customerTypeFilter, setCustomerTypeFilter] =
    useState<CustomerTypeFilter>('All');
  const [nameSort, setNameSort] = useState<NameSortOrder>('default');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const debouncedSearch = useDebounce(searchQuery, 400);

  // Reset to page 1 on filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterType, customerTypeFilter, nameSort]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ledgerType =
        customerTypeFilter === 'daily_ledger' ||
        customerTypeFilter === 'monthly_ledger'
          ? customerTypeFilter
          : undefined;

      const skipLedger =
        customerTypeFilter === 'walk_in' || customerTypeFilter === 'split';
      const skipWalkIn =
        customerTypeFilter === 'daily_ledger' ||
        customerTypeFilter === 'monthly_ledger' ||
        customerTypeFilter === 'split';
      const skipSplit =
        customerTypeFilter === 'daily_ledger' ||
        customerTypeFilter === 'monthly_ledger' ||
        customerTypeFilter === 'walk_in';

      const customerFilters = {
        search: debouncedSearch || undefined,
        dues: filterType === 'Dues' || undefined,
        customerType: ledgerType,
      };

      const [customers, walkIns, splits, summaryData] = await Promise.all([
        skipLedger
          ? Promise.resolve([] as ApiCustomer[])
          : customerService.getCustomers(customerFilters),
        skipWalkIn
          ? Promise.resolve([] as SaleRecord[])
          : saleService.listSales({ saleType: 'walk_in', limit: 0 }),
        skipSplit
          ? Promise.resolve([] as SaleRecord[])
          : saleService.listSales({ saleType: 'split', limit: 0 }),
        customerService.getSummary(),
      ]);

      setSummary(summaryData);

      const map: Record<number, ApiCustomer> = {};
      customers.forEach((c) => {
        map[c.id] = c;
      });
      setLedgerById(map);

      // Index split sales by phone for Khata modal
      const byPhone: Record<string, SaleRecord[]> = {};
      for (const s of splits) {
        const k = normalizePhone(s.customerPhone) || `sale-${s.id}`;
        if (!byPhone[k]) byPhone[k] = [];
        byPhone[k].push(s);
      }
      setSplitSalesByPhone(byPhone);

      let walkRows = walkIns.map(mapWalkInRow);
      let splitRows = mapSplitGroups(splits);

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        const match = (r: CustomerTableRow) =>
          (r.name || '').toLowerCase().includes(q) ||
          (r.phone || '').toLowerCase().includes(q);
        walkRows = walkRows.filter(match);
        splitRows = splitRows.filter(match);
      }
      if (filterType === 'Dues') {
        walkRows = walkRows.filter((r) => r.balance !== null && r.balance > 0);
        splitRows = splitRows.filter((r) => r.balance !== null && r.balance > 0);
      }

      const merged: CustomerTableRow[] = [
        ...customers.map(mapLedgerRow),
        ...walkRows,
        ...splitRows,
      ];

      merged.sort((a, b) => {
        if (nameSort === 'az') {
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        if (nameSort === 'za') {
          return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
        }
        const aTime = a.lastSaleDate ? new Date(a.lastSaleDate).getTime() : a.id;
        const bTime = b.lastSaleDate ? new Date(b.lastSaleDate).getTime() : b.id;
        return bTime - aTime;
      });

      setRows(merged);
    } catch (err: any) {
      setError(err?.message || 'Failed to load customers');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterType, customerTypeFilter, nameSort]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (row: CustomerTableRow) => {
    if (row.kind !== 'ledger') return;
    const full = ledgerById[row.id];
    if (!full) {
      setError('Could not load customer for edit.');
      return;
    }
    setEditingCustomer(full);
    setIsFormModalOpen(true);
  };

  const handleDelete = (row: CustomerTableRow) => {
    if (row.kind !== 'ledger' || deleting) return;
    setDeleteTarget(row);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await customerService.deleteCustomer(deleteTarget.id);
      activityLogger.log({
        action: 'CUSTOMER_DELETED',
        module: 'Customers',
        description: `Deleted customer "${deleteTarget.name}" (ID: ${deleteTarget.id}). They have been deactivated and hidden from the customer list.`,
        entityId: String(deleteTarget.id),
        status: 'Success',
      });
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      const message = err?.message || 'Failed to delete customer';
      activityLogger.log({
        action: 'CUSTOMER_DELETED',
        module: 'Customers',
        description: `Failed to delete customer "${deleteTarget.name}" (ID: ${deleteTarget.id}): ${message}`,
        entityId: String(deleteTarget.id),
        status: 'Error',
      });
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleViewKhata = async (row: CustomerTableRow) => {
    if (row.kind === 'split') {
      const key = normalizePhone(row.phone) || `sale-${row.id}`;
      const list = splitSalesByPhone[key] || [];
      setKhataSales(
        [...list].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
      setKhataReturns([]);
      setKhataRow(row);
      return;
    }

    if (row.kind === 'ledger') {
      try {
        const [list, returnList] = await Promise.all([
          saleService.listSales({ customerId: row.id }),
          getReturns({ customerId: row.id }),
        ]);
        setKhataSales(
          [...list].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        setKhataReturns(returnList);
        setKhataRow(row);
      } catch (err: any) {
        setError(err?.message || 'Failed to load khata');
      }
    }
  };

  const handleCollectConfirm = async (
    paymentMethod: 'cash' | 'online',
    amount?: number,
    discount?: number
  ) => {
    if (!collectRow) return;

    if (collectRow.kind === 'ledger') {
      await customerService.settleAll(collectRow.id, paymentMethod, amount, discount);
    } else if (collectRow.kind === 'split') {
      if (discount && discount > 0) {
        throw new Error(
          'Discount write-off for split customers is not supported. Collect without discount, or use Khata Cash Collect for ledger customers.'
        );
      }
      const key = normalizePhone(collectRow.phone) || `sale-${collectRow.id}`;
      const list = splitSalesByPhone[key] || [];
      const openSales = list.filter(
        (s) => s.status === 'partial' && s.remainingBalance > 0
      );

      if (openSales.length === 0 && collectRow.saleIds?.length) {
        for (const saleId of collectRow.saleIds) {
          try {
            await saleService.settleSale(saleId, paymentMethod, amount);
          } catch {
            // skip already settled
          }
        }
      } else {
        const totalOutstanding = openSales.reduce((sum, sale) => sum + sale.remainingBalance, 0);
        let remainingToCollect = amount ?? totalOutstanding;

        for (const sale of openSales) {
          if (remainingToCollect <= 0) break;
          const saleDue = sale.remainingBalance;
          const thisPayment = Math.min(saleDue, remainingToCollect);
          await saleService.settleSale(sale.id, paymentMethod, thisPayment);
          remainingToCollect -= thisPayment;
        }
      }
    } else {
      throw new Error('Collect is only for split or ledger customers.');
    }

    await loadData();
  };

  const handleAddClick = () => {
    setEditingCustomer(null);
    setIsFormModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">
            Customers &amp; Khata
          </h1>
          <p className="text-slate-500 dark:text-[#64916e] text-sm mt-1">
            Ledger accounts, walk-in bills, and split dues (grouped by phone).
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddClick}
          className="flex items-center gap-2 bg-[#166534] hover:bg-[#14532d] active:bg-[#0f3d21] text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-[#166534]/25 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      <div className="flex-shrink-0">
        <CustomerSummary
          totalCustomers={summary.totalRows}
          totalOutstanding={summary.totalOutstanding}
          withDues={summary.withDues}
        />
      </div>

      {error && (
        <div className="flex-shrink-0 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col overflow-hidden">
        <CustomerToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterType={filterType}
          setFilterType={setFilterType}
          customerTypeFilter={customerTypeFilter}
          setCustomerTypeFilter={setCustomerTypeFilter}
          nameSort={nameSort}
          setNameSort={setNameSort}
          duesCount={summary.withDues}
        />

        <div className="w-full overflow-x-auto">
          {loading ? (
            <div className="px-5 py-12 text-center text-slate-400 text-sm">
              Loading customers…
            </div>
          ) : (
            <CustomerTable
              rows={rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onViewKhata={handleViewKhata}
              onCollect={(row) => setCollectRow(row)}
            />
          )}
        </div>

        {!loading && rows.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={rows.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            itemLabel="customers"
          />
        )}
      </div>

      {isFormModalOpen && (
        <CustomerFormModal
          customer={editingCustomer}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingCustomer(null);
          }}
          onSaved={loadData}
        />
      )}

      {khataRow && (
        <SplitKhataModal
          title={khataRow.name}
          phone={khataRow.phone}
          sales={khataSales}
          returns={khataReturns}
          mode={khataRow.kind === 'ledger' ? 'ledger' : 'split'}
          onClose={() => {
            setKhataRow(null);
            setKhataSales([]);
            setKhataReturns([]);
          }}
        />
      )}

      {collectRow && (
        <CollectConfirmModal
          row={collectRow}
          onClose={() => setCollectRow(null)}
          onConfirm={handleCollectConfirm}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl border border-slate-100 dark:border-[#2d4a35] w-full max-w-sm p-6 animate-in fade-in zoom-in duration-150">
            {/* Icon + Title */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#e2f5e8] leading-snug">Delete Customer?</h3>
                <p className="text-sm text-slate-500 dark:text-[#8ba895] mt-1 leading-relaxed">
                  You are about to delete{' '}
                  <span className="font-semibold text-slate-800 dark:text-[#e2f5e8]">"{deleteTarget.name}"</span>.
                  They will be deactivated and hidden from the customer list.
                </p>
              </div>
            </div>

            {/* Warning note */}
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 mb-5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                This action cannot be undone from the customers list.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-[#a7c4ae] bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#1e3124] rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors shadow-sm shadow-red-600/25 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
