import React, { useState } from 'react';
import {
  Search, ReceiptText, User, Calendar, CreditCard,
  CheckSquare, Square, ChevronDown, RotateCcw, X
} from 'lucide-react';
import { MockBill, ReturnRecord, ReturnType, ReturnItem } from '../../types';
import { useReturnsStore } from '../../store/returnsStore';

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

interface CreateReturnPanelProps {
  onReturnCreated: () => void;
}

export const CreateReturnPanel: React.FC<CreateReturnPanelProps> = ({ onReturnCreated }) => {
  const { findBill, addReturn } = useReturnsStore();

  const [query, setQuery] = useState('');
  const [foundBill, setFoundBill] = useState<MockBill | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Selected item IDs and their return quantities
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [returnType, setReturnType] = useState<ReturnType>('Partial Return');
  const [reason, setReason] = useState('');

  const handleFindBill = () => {
    const bill = findBill(query);
    if (bill) {
      setFoundBill(bill);
      setNotFound(false);
      setSelectedItems({});
      setReturnType('Partial Return');
      setReason('');
    } else {
      setFoundBill(null);
      setNotFound(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFindBill();
  };

  const toggleItem = (itemId: string, originalQty: number) => {
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
    const clamped = Math.max(1, Math.min(qty, max));
    setSelectedItems((prev) => ({ ...prev, [itemId]: clamped }));
  };

  // When return type is Full Return, auto-select all items at full qty
  const handleReturnTypeChange = (type: ReturnType) => {
    setReturnType(type);
    if (type === 'Full Return' && foundBill) {
      const all: Record<string, number> = {};
      foundBill.items.forEach((i) => { all[i.id] = i.quantity; });
      setSelectedItems(all);
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

  const handleConfirm = () => {
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
    const id = `RET-${now.slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;

    const record: ReturnRecord = {
      returnId: id,
      billNumber: foundBill.billNumber,
      date: now,
      customer: foundBill.customer,
      returnType,
      refundAmount: refundTotal,
      paymentMethod: foundBill.paymentMethod,
      reason: reason.trim() || 'No reason provided.',
      status: 'Completed',
      items: returnItems,
      processedBy: 'System Admin',
    };

    addReturn(record);
    handleCancel();
    onReturnCreated();
  };

  const canConfirm = foundBill && Object.keys(selectedItems).length > 0 && refundTotal > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Create Return</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5">
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
              placeholder="Scan receipt barcode or enter BILL-0001"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder-slate-400 transition"
            />
          </div>
          <button
            id="find-bill-btn"
            onClick={handleFindBill}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-sm transition-all flex-shrink-0"
          >
            Find Bill
          </button>
        </div>

        {/* Not found message */}
        {notFound && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
            <X className="w-4 h-4 flex-shrink-0" />
            No bill found for <span className="font-bold ml-1">"{query}"</span>. Try BILL-0001 to BILL-0008.
          </div>
        )}

        {/* Idle state */}
        {!foundBill && !notFound && (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ReceiptText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">Find a bill to start a return</p>
            <p className="text-slate-400 text-xs mt-1">Use the bill number printed on the receipt.</p>
            <p className="text-slate-400 text-xs mt-1">Demo: BILL-0001 through BILL-0008</p>
          </div>
        )}

        {/* Bill Found */}
        {foundBill && (
          <>
            {/* Bill Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-blue-500" />
                  <span className="font-bold text-slate-800 text-sm">{foundBill.billNumber}</span>
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Select Items to Return
              </label>
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
                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${isSelected ? 'bg-blue-50/60' : 'bg-white hover:bg-slate-50'}`}
                        >
                          <td className="px-3 py-2.5">
                            <button
                              id={`toggle-item-${item.id}`}
                              onClick={() => toggleItem(item.id, item.quantity)}
                              className="text-blue-500 hover:text-blue-700 transition-colors"
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
                            {isSelected ? (
                              <input
                                id={`qty-input-${item.id}`}
                                type="number"
                                min={1}
                                max={item.quantity}
                                value={selectedItems[item.id]}
                                onChange={(e) => setItemQty(item.id, parseInt(e.target.value) || 1, item.quantity)}
                                className="w-14 text-right border border-blue-300 rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
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
