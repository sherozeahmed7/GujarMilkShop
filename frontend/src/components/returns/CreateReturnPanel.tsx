import React, { useState, useEffect } from 'react';
import {
  Search, ReceiptText, User, Calendar, CreditCard,
  CheckSquare, Square, RotateCcw, X, RefreshCw, ArrowLeft,
  Tag, ShoppingBag, ArrowRight
} from 'lucide-react';
import { MockBill, ReturnType, ReturnItem } from '../../types';
import { useReturnsStore } from '../../store/returnsStore';
import { saleService, SaleRecord } from '../../services/sale.service';

const RETURN_TYPES: ReturnType[] = ['Full Return', 'Partial Return', 'Correction'];

const returnTypeColors: Record<ReturnType, string> = {
  'Full Return': 'bg-rose-100 text-rose-700 border-rose-200',
  'Partial Return': 'bg-amber-100 text-amber-700 border-amber-200',
  'Correction': 'bg-blue-100 text-blue-700 border-blue-200',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatInvoiceNumber(id: number) {
  return `INV-${String(id).padStart(5, '0')}`;
}

function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface CreateReturnPanelProps {
  onReturnCreated: () => void;
}

export const CreateReturnPanel: React.FC<CreateReturnPanelProps> = ({ onReturnCreated }) => {
  const { findBill, addReturn } = useReturnsStore();

  const [query, setQuery] = useState('');
  const [foundBill, setFoundBill] = useState<MockBill | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoadingBill, setIsLoadingBill] = useState(false);

  // Sales list from backend
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);

  // Selected item IDs and their return quantities
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [returnType, setReturnType] = useState<ReturnType>('Partial Return');
  const [reason, setReason] = useState('');

  const fetchSales = async () => {
    setIsLoadingSales(true);
    try {
      const today = getTodayStr();
      const data = await saleService.listSales({ fromDate: today, toDate: today });
      setSales(data);
    } catch (err) {
      console.error('Failed to fetch today sales for returns:', err);
    } finally {
      setIsLoadingSales(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const loadBillById = async (rawId: string | number) => {
    const cleaned = String(rawId).trim().replace(/^(INV-0*|BILL-0*|#)/i, '');
    if (!cleaned) return;
    setIsLoadingBill(true);
    setNotFound(false);

    try {
      const bill = await findBill(cleaned);
      if (bill) {
        setFoundBill(bill);
        setNotFound(false);
        setSelectedItems({});
        setReturnType('Partial Return');
        setReason('');
        setQuery(formatInvoiceNumber(Number(cleaned) || Number(bill.billNumber) || 0));
      } else {
        setFoundBill(null);
        setNotFound(true);
      }
    } finally {
      setIsLoadingBill(false);
    }
  };

  const handleFindBill = async () => {
    await loadBillById(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFindBill();
  };

  const toggleItem = (itemId: string, originalQty: number) => {
    if (returnType === 'Full Return') return; // Full Return always includes all items
    setSelectedItems((prev) => {
      if (itemId in prev) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: originalQty };
    });
  };

  const setItemQty = (itemId: string, qty: number, max: number) => {
    if (returnType === 'Full Return') return; // Full Return quantities are locked
    // Allow decimal kg (e.g. 0.5, 1.25); clamp to (0, max]
    const clamped = Math.min(Math.max(qty, 0.01), max);
    const rounded = Math.round(clamped * 100) / 100;
    setSelectedItems((prev) => ({ ...prev, [itemId]: rounded }));
  };

  // When return type is Full Return, auto-select all items at full qty
  const handleReturnTypeChange = (type: ReturnType) => {
    setReturnType(type);
    if (foundBill) {
      if (type === 'Full Return') {
        const all: Record<string, number> = {};
        foundBill.items.forEach((i) => { all[i.id] = i.quantity; });
        setSelectedItems(all);
      }
    }
  };

  const refundTotal = foundBill
    ? foundBill.items.reduce((sum, item) => {
        if (item.id in selectedItems) {
          return sum + selectedItems[item.id] * item.unitPrice;
        }
        return sum;
      }, 0)
    : 0;

  const handleCancel = () => {
    setQuery('');
    setFoundBill(null);
    setNotFound(false);
    setSelectedItems({});
    setReturnType('Partial Return');
    setReason('');
  };

  const handleConfirm = async () => {
    if (!foundBill) return;
    const returnItems: ReturnItem[] = foundBill.items
      .filter((i) => i.id in selectedItems)
      .map((i) => ({
        itemId: i.id,
        name: i.name,
        returnQty: selectedItems[i.id],
        unitPrice: i.unitPrice,
        refundAmount: selectedItems[i.id] * i.unitPrice,
      }));

    const now = new Date().toISOString();

    await addReturn({
      billNumber: foundBill.billNumber,
      date: now,
      customer: foundBill.customer,
      returnType,
      refundAmount: refundTotal,
      paymentMethod: foundBill.paymentMethod,
      reason: reason.trim() || 'No reason provided.',
      status: 'Completed',
      items: returnItems,
      processedBy: localStorage.getItem('userName') || 'User',
    });

    handleCancel();
    fetchSales();
    onReturnCreated();
  };

  const canConfirm = foundBill && Object.keys(selectedItems).length > 0 && refundTotal > 0;

  // Filter sales based on user query when browsing
  const filteredSales = sales.filter((sale) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const invNumber = formatInvoiceNumber(sale.id).toLowerCase();
    const rawId = String(sale.id);
    const token = sale.tokenNumber ? String(sale.tokenNumber) : '';
    const custName = (sale.customerName || sale.customer?.name || 'walk-in').toLowerCase();
    const saleType = (sale.saleType || '').toLowerCase();
    const itemsStr = (sale.items || []).map((i) => i.itemName.toLowerCase()).join(' ');

    return (
      invNumber.includes(q) ||
      rawId.includes(q) ||
      token.includes(q) ||
      custName.includes(q) ||
      saleType.includes(q) ||
      itemsStr.includes(q)
    );
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden h-full">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Create Return</h2>
        </div>
        {foundBill && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Invoices
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4">
        {/* Search Row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="bill-search-input"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setNotFound(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search invoice number: 15 or INV-00015..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder-slate-400 transition"
            />
          </div>
          <button
            id="find-bill-btn"
            onClick={handleFindBill}
            disabled={isLoadingBill || !query.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-sm transition-all flex-shrink-0 flex items-center gap-1.5"
          >
            {isLoadingBill ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              'Find Bill'
            )}
          </button>
        </div>

        {/* Quick Invoice Badges (Today's Invoices) */}
        {sales.length > 0 && !foundBill && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs custom-scrollbar">
            <span className="text-slate-400 font-semibold flex items-center gap-1 flex-shrink-0">
              <Tag className="w-3 h-3" /> Today's Invoices:
            </span>
            {sales.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() => loadBillById(s.id)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 font-mono font-bold rounded-lg border border-slate-200 transition-colors flex-shrink-0 flex items-center gap-1"
                title={`Click to load ${formatInvoiceNumber(s.id)} - Rs. ${s.totalAmount}`}
              >
                {formatInvoiceNumber(s.id)}
              </button>
            ))}
          </div>
        )}

        {/* Not found message */}
        {notFound && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
            <X className="w-4 h-4 flex-shrink-0" />
            No bill found for <span className="font-bold ml-1">"{query}"</span>. Select an invoice from the list below or enter a valid number.
          </div>
        )}

        {/* Idle state: Show Today's Invoices List */}
        {!foundBill && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Today's Sale Invoices ({filteredSales.length})
                </h3>
              </div>
              <button
                onClick={fetchSales}
                disabled={isLoadingSales}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                title="Refresh today's sales list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSales ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoadingSales && sales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                <p className="text-xs">Loading today's invoices...</p>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-xl border border-slate-200 p-6">
                <ReceiptText className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-slate-600 font-semibold text-sm">No sales invoices found for today</p>
                <p className="text-slate-400 text-xs mt-1">
                  {query ? `No invoices matching "${query}"` : 'Sales created today at POS will appear here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[480px] custom-scrollbar pr-1">
                {filteredSales.map((sale) => {
                  const inv = formatInvoiceNumber(sale.id);
                  const custName = sale.customerName || sale.customer?.name || 'Walk-in Customer';
                  const itemsSummary = (sale.items || [])
                    .map((item) => `${item.itemName} (${item.quantity}kg)`)
                    .join(', ');

                  return (
                    <div
                      key={sale.id}
                      onClick={() => loadBillById(sale.id)}
                      className="group bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl p-3 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold text-blue-700 font-mono bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-md">
                            {inv}
                          </span>
                          {sale.tokenNumber && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                              Token #{sale.tokenNumber}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {custName}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500 capitalize bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                            {sale.saleType.replace('_', ' ')}
                          </span>
                        </div>

                        {itemsSummary && (
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3 flex-shrink-0 text-slate-400" />
                            {itemsSummary}
                          </p>
                        )}

                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatDate(sale.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-800">
                            Rs. {sale.totalAmount.toLocaleString()}
                          </p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            sale.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {sale.status}
                          </span>
                        </div>
                        <div className="w-7 h-7 rounded-lg bg-white group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center transition-colors border border-slate-200 group-hover:border-blue-600">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bill Found - Return Creation Form */}
        {foundBill && (
          <>
            {/* Bill Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-blue-500" />
                  <span className="font-bold text-slate-800 text-sm">{formatInvoiceNumber(Number(foundBill.billNumber) || 0)}</span>
                  <span className="text-xs text-slate-400 font-mono">(ID: #{foundBill.billNumber})</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                  {foundBill.paymentMethod}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <User className="w-3.5 h-3.5" />
                  <span className="font-medium text-slate-700">{foundBill.customer}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="font-medium text-slate-700">{formatDate(foundBill.date)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="font-medium text-slate-700">Bill Total: Rs. {foundBill.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Return Type */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Return Type</label>
              <div className="flex gap-2 flex-wrap">
                {RETURN_TYPES.map((type) => (
                  <button
                    key={type}
                    id={`return-type-${type.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => handleReturnTypeChange(type)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      returnType === type
                        ? returnTypeColors[type]
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Select Items to Return
                </label>
                {returnType === 'Full Return' && (
                  <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    Full Return (All items & quantities included)
                  </span>
                )}
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-8"></th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Item</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Orig Qty</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rtn Qty</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit Price</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Line Total</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Refund</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {foundBill.items.map((item) => {
                      const isSelected = item.id in selectedItems;
                      const rtnQty = selectedItems[item.id] ?? item.quantity;
                      const refund = isSelected ? rtnQty * item.unitPrice : 0;
                      const isFullReturn = returnType === 'Full Return';

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${isSelected ? (isFullReturn ? 'bg-rose-50/40' : 'bg-blue-50/60') : 'bg-white hover:bg-slate-50'}`}
                        >
                          <td className="px-3 py-2.5">
                            <button
                              id={`toggle-item-${item.id}`}
                              onClick={() => toggleItem(item.id, item.quantity)}
                              disabled={isFullReturn}
                              className={`transition-colors ${
                                isFullReturn
                                  ? 'text-rose-500 cursor-not-allowed opacity-90'
                                  : 'text-blue-500 hover:text-blue-700'
                              }`}
                              title={isFullReturn ? 'All items are included in Full Return' : 'Toggle item for return'}
                            >
                              {isSelected
                                ? <CheckSquare className="w-4 h-4" />
                                : <Square className="w-4 h-4 text-slate-300" />}
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-slate-800 text-sm">{item.name}</div>
                            <div className="text-[11px] text-slate-400">{item.category}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-600 font-medium">{item.quantity}</td>
                          <td className="px-3 py-2.5 text-right">
                            {isFullReturn ? (
                              <span className="font-bold font-mono text-slate-800 text-xs px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg inline-block">
                                {item.quantity}
                              </span>
                            ) : isSelected ? (
                              <input
                                id={`qty-input-${item.id}`}
                                type="number"
                                min={0.01}
                                max={item.quantity}
                                step="0.01"
                                value={selectedItems[item.id]}
                                onChange={(e) =>
                                  setItemQty(
                                    item.id,
                                    parseFloat(e.target.value) || 0.01,
                                    item.quantity
                                  )
                                }
                                className="w-16 text-right border border-blue-300 rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-600">Rs. {item.unitPrice}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">Rs. {item.lineTotal.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                            {isSelected ? `Rs. ${refund.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Return Reason <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                id="return-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe why this return is being processed..."
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400 transition"
              />
            </div>

            {/* Refund Total */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Refund Total</p>
                <p className="text-2xl font-bold text-emerald-700 mt-0.5">
                  Rs. {refundTotal.toLocaleString()}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {Object.keys(selectedItems).length} item(s) selected · via {foundBill.paymentMethod}
                </p>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${returnTypeColors[returnType]}`}>
                {returnType}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 flex-shrink-0">
              <button
                id="confirm-return-btn"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed active:scale-95 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
              >
                Confirm Return
              </button>
              <button
                id="cancel-return-btn"
                onClick={handleCancel}
                className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

