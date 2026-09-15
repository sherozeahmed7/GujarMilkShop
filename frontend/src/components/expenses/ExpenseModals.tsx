import React, { useState, useEffect } from 'react';
import { useExpenseStore } from '../../store/expenseStore';
import { ExpenseRecord } from '../../types';
import { X, AlertTriangle } from 'lucide-react';

interface ExpenseModalsProps {
  viewExpense: ExpenseRecord | null;
  onCloseView: () => void;
  editExpense: ExpenseRecord | null;
  onCloseEdit: () => void;
  deleteExpenseId: string | null;
  onCloseDelete: () => void;
  payExpense: ExpenseRecord | null;
  onClosePay: () => void;
}

export const ExpenseModals: React.FC<ExpenseModalsProps> = ({
  viewExpense,
  onCloseView,
  editExpense,
  onCloseEdit,
  deleteExpenseId,
  onCloseDelete,
  payExpense,
  onClosePay,
}) => {
  const { updateExpense, deleteExpense, payExpense: recordPay, isSaving } = useExpenseStore();

  const [editDate, setEditDate] = useState('');
  const [editProduct, setEditProduct] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (editExpense) {
      setEditDate(editExpense.date);
      setEditProduct(editExpense.category);
      setEditAmount(String(editExpense.amount ?? editExpense.netExpense ?? 0));
      setEditPaidAmount(String(editExpense.paidAmount ?? 0));
      setEditNotes(editExpense.reason || '');
      setEditError(null);
    }
  }, [editExpense]);

  const totalInEdit = parseFloat(editAmount) || 0;
  const paidInEdit = editPaidAmount.trim() === '' ? 0 : parseFloat(editPaidAmount) || 0;
  const remainingInEdit = Math.max(0, Math.round((totalInEdit - paidInEdit) * 100) / 100);

  useEffect(() => {
    if (payExpense) {
      const rem = payExpense.remaining ?? Math.max(0, (payExpense.amount || 0) - (payExpense.paidAmount || 0));
      setPayAmount(String(rem));
      setPayError(null);
    }
  }, [payExpense]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpense) return;
    setEditError(null);
    const amount = parseFloat(editAmount);
    const paid = editPaidAmount.trim() === '' ? 0 : parseFloat(editPaidAmount);

    if (!editDate || !editProduct.trim()) {
      setEditError('Date and product are required.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setEditError('Enter a total amount greater than zero.');
      return;
    }
    if (!Number.isFinite(paid) || paid < 0) {
      setEditError('Paid amount must be 0 or greater.');
      return;
    }
    if (paid > amount) {
      setEditError('Paid amount cannot exceed total amount.');
      return;
    }

    try {
      await updateExpense(editExpense.id, {
        date: editDate,
        category: editProduct.trim(),
        description: editProduct.trim(),
        amount,
        paidAmount: paid,
        remaining: Math.max(0, amount - paid),
        netExpense: amount,
        grossLoss: amount,
        reason: editNotes,
      });
      onCloseEdit();
    } catch (err: any) {
      setEditError(err?.message || 'Unable to update expense.');
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payExpense) return;
    setPayError(null);
    const amount = parseFloat(payAmount);
    const rem =
      payExpense.remaining ??
      Math.max(0, (payExpense.amount || 0) - (payExpense.paidAmount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError('Enter a payment greater than zero.');
      return;
    }
    if (amount > rem) {
      setPayError(`Cannot exceed remaining Rs. ${Math.round(rem).toLocaleString()}.`);
      return;
    }
    try {
      await recordPay(payExpense.id, amount);
      onClosePay();
    } catch (err: any) {
      setPayError(err?.message || 'Unable to record payment.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteExpenseId) return;
    try {
      await deleteExpense(deleteExpenseId);
      onCloseDelete();
    } catch {
      alert('Unable to delete expense.');
    }
  };

  return (
    <>
      {viewExpense && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Expense Details</h3>
              <button
                onClick={onCloseView}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Date</p>
                  <p className="text-sm font-medium text-slate-800">
                    {new Date(viewExpense.date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Product</p>
                  <p className="text-sm font-medium text-slate-800">{viewExpense.category}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Total</p>
                  <p className="text-sm font-bold text-slate-800">
                    Rs. {(viewExpense.amount ?? viewExpense.netExpense).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Paid</p>
                  <p className="text-sm font-bold text-emerald-700">
                    Rs. {(viewExpense.paidAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Remaining</p>
                  <p className="text-sm font-bold text-amber-600">
                    Rs.{' '}
                    {(
                      viewExpense.remaining ??
                      Math.max(
                        0,
                        (viewExpense.amount || 0) - (viewExpense.paidAmount || 0)
                      )
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Notes</p>
                <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">
                  {viewExpense.reason || viewExpense.description || 'None'}
                </p>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-100">
                <span>Added by: {viewExpense.addedBy}</span>
                <span>{new Date(viewExpense.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={onCloseView}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editExpense && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Edit Expense</h3>
              <button onClick={onCloseEdit} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Product</label>
                <input
                  type="text"
                  value={editProduct}
                  onChange={(e) => setEditProduct(e.target.value)}
                  required
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Total amount (Rs)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editAmount}
                  onChange={(e) => {
                    setEditAmount(e.target.value);
                    setEditError(null);
                  }}
                  required
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600">Paid amount (Rs)</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditPaidAmount('0');
                        setEditError(null);
                      }}
                      className="text-[11px] font-medium text-amber-600 hover:text-amber-700 hover:underline"
                    >
                      Unpaid (Rs. 0)
                    </button>
                    {totalInEdit > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPaidAmount(String(totalInEdit));
                          setEditError(null);
                        }}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        Pay Full (Rs. {totalInEdit.toLocaleString()})
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  max={totalInEdit > 0 ? totalInEdit : undefined}
                  step="1"
                  value={editPaidAmount}
                  onChange={(e) => {
                    setEditPaidAmount(e.target.value);
                    setEditError(null);
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-emerald-700 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="flex items-center justify-between text-[11px] mt-0.5">
                  <span className="text-slate-500">
                    Previously paid: Rs. {(editExpense.paidAmount || 0).toLocaleString()}
                  </span>
                  <span className={remainingInEdit > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
                    Remaining: Rs. {remainingInEdit.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {editError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {editError}
                </div>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseEdit}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-70"
                >
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payExpense && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Pay remaining</h3>
              <button onClick={onClosePay} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">{payExpense.category}</span>
                {' · '}
                Remaining{' '}
                <span className="font-bold text-amber-600">
                  Rs.{' '}
                  {Math.round(
                    payExpense.remaining ??
                      Math.max(0, (payExpense.amount || 0) - (payExpense.paidAmount || 0))
                  ).toLocaleString()}
                </span>
              </p>
              <p className="text-[11px] text-slate-500">
                This payment is deducted from the currently open shift expected cash.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Amount to pay</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                  autoFocus
                />
              </div>
              {payError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {payError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClosePay}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-70"
                >
                  {isSaving ? 'Saving…' : 'Confirm Pay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteExpenseId && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Expense</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete this expense? This action cannot be undone.
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={onCloseDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-70"
                >
                  {isSaving ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
