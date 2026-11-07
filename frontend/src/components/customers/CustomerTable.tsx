import React from 'react';
import { CustomerTableRow } from '../../types/customer';
import { BookOpen, DollarSign, Edit2, Trash2 } from 'lucide-react';

const NA = 'Not Available';

function displayText(value: string | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === '') return NA;
  return String(value);
}

function formatLastSale(date: string | null): string {
  if (!date) return NA;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatDueAmount(amount: number | null): React.ReactNode {
  if (amount === null || amount === undefined) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  if (amount > 0) {
    return (
      <span className="font-bold text-sm text-rose-600">
        Rs. {Math.round(amount).toLocaleString()}
      </span>
    );
  }
  return <span className="text-sm font-medium text-slate-400">Rs. 0</span>;
}

function formatTotalDue(balance: number | null): React.ReactNode {
  if (balance === null || balance === undefined) {
    return <span className="text-sm text-slate-400">{NA}</span>;
  }
  if (balance > 0) {
    return (
      <span className="font-bold text-sm text-rose-600">
        Rs. {Math.round(balance).toLocaleString()}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs bg-emerald-50 px-2 py-1 rounded-md">
      Clear
    </span>
  );
}

function typeBadgeClass(kind: CustomerTableRow['kind']): string {
  if (kind === 'walk_in') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (kind === 'split') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

interface CustomerTableProps {
  rows: CustomerTableRow[];
  onEdit?: (row: CustomerTableRow) => void;
  onDelete?: (row: CustomerTableRow) => void;
  onViewKhata?: (row: CustomerTableRow) => void;
  onCollect?: (row: CustomerTableRow) => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  rows,
  onEdit,
  onDelete,
  onViewKhata,
  onCollect,
}) => {
  return (
    <table className="w-full text-left border-collapse">
      <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0 z-10">
        <tr>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
            Customer
          </th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
            Phone
          </th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
            Customer Type
          </th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
            Payment Type
          </th>
          <th
            className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]"
            title="Billed this month (monthly) or today (daily)"
          >
            Current Month / Day
          </th>
          <th
            className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]"
            title="Billed before the current period"
          >
            Previous Month / Day
          </th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
            Total to Pay
          </th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
            Paid
          </th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
            Remaining Balance
          </th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">
            Last Sale
          </th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 dark:text-[#64916e] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35] text-right">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={11} className="px-5 py-12 text-center text-slate-500">
              No customers found. Try adjusting your search or filters.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <CustomerRow
              key={row.key}
              row={row}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewKhata={onViewKhata}
              onCollect={onCollect}
            />
          ))
        )}
      </tbody>
    </table>
  );
};

interface CustomerRowProps {
  row: CustomerTableRow;
  onEdit?: (row: CustomerTableRow) => void;
  onDelete?: (row: CustomerTableRow) => void;
  onViewKhata?: (row: CustomerTableRow) => void;
  onCollect?: (row: CustomerTableRow) => void;
}

const CustomerRow: React.FC<CustomerRowProps> = ({
  row,
  onEdit,
  onDelete,
  onViewKhata,
  onCollect,
}) => {
  const isLedger = row.kind === 'ledger';
  const isInactive = row.status === 'inactive';
  const canKhata = row.kind === 'split' || row.kind === 'ledger';
  const canCollect =
    (row.kind === 'split' || row.kind === 'ledger') &&
    row.balance !== null &&
    row.balance > 0;
  const initials =
    displayText(row.name) === NA
      ? '?'
      : row.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();

  return (
    <tr className="hover:bg-slate-50/70 dark:hover:bg-[#1e3124] transition-colors group">
      <td className="px-5 py-3 max-w-[220px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#1e3124] flex items-center justify-center text-xs font-bold text-slate-600 dark:text-[#a7c4ae] flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className={`font-semibold text-sm truncate ${isInactive ? "line-through text-red-500 dark:text-red-400 font-bold" : "text-slate-800 dark:text-[#e2f5e8]"}`} title={isInactive ? `${row.name} (Inactive / Khata Ended)` : row.name}>
              {displayText(row.name)}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-[#64916e] mt-0.5 truncate flex items-center gap-1.5 flex-wrap">
              {displayText(row.address)}
              {row.customMilkRate != null && row.customMilkRate > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/50">
                  Rate: Rs. {row.customMilkRate}/kg
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-5 py-3 text-sm text-slate-600 dark:text-[#a7c4ae] font-medium whitespace-nowrap">
        {displayText(row.phone)}
      </td>
      <td className="px-5 py-3">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${typeBadgeClass(row.kind)}`}
        >
          {row.typeLabel}
        </span>
      </td>
      <td className="px-5 py-3 text-sm font-medium text-slate-700 dark:text-[#a7c4ae]">
        {displayText(row.paymentType)}
      </td>
      <td className="px-5 py-3">{formatDueAmount(row.currentDue)}</td>
      <td className="px-5 py-3">{formatDueAmount(row.previousDue)}</td>
      <td className="px-5 py-3">{formatDueAmount(row.totalAmount)}</td>
      <td className="px-5 py-3">
        {row.paidAmount === null || row.paidAmount === undefined ? (
          <span className="text-sm text-slate-400 dark:text-[#64916e]">—</span>
        ) : (
          <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
            Rs. {Math.round(row.paidAmount).toLocaleString()}
          </span>
        )}
      </td>
      <td className="px-5 py-3">{formatTotalDue(row.balance)}</td>
      <td className="px-5 py-3 text-sm text-slate-500 dark:text-[#64916e]">
        {formatLastSale(row.lastSaleDate)}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-60 lg:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => canCollect && onCollect?.(row)}
            disabled={!canCollect}
            title={
              canCollect
                ? 'Collect all outstanding bills'
                : 'No outstanding balance to collect'
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              canCollect
                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/50'
                : 'text-slate-400 bg-slate-50 cursor-not-allowed border-slate-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Collect
          </button>

          <button
            type="button"
            onClick={() => canKhata && onViewKhata?.(row)}
            disabled={!canKhata}
            title={
              canKhata
                ? 'View khata / purchases'
                : 'Khata is for split and ledger customers'
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              canKhata
                ? row.kind === 'ledger'
                  ? 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200'
                : 'text-slate-300 bg-slate-50 cursor-not-allowed border-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Khata
          </button>

          <button
            type="button"
            onClick={() => isLedger && onEdit?.(row)}
            disabled={!isLedger}
            title={isLedger ? 'Edit' : 'Edit is for ledger customers only'}
            className={`p-1.5 rounded-lg transition-colors ml-1 ${
              isLedger
                ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => isLedger && onDelete?.(row)}
            disabled={!isLedger}
            title={isLedger ? 'Delete' : 'Delete is for ledger customers only'}
            className={`p-1.5 rounded-lg transition-colors ${
              isLedger
                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};
