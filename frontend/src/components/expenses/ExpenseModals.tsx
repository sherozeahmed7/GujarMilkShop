import React, { useState, useEffect } from 'react';
import { useExpenseStore } from '../../store/expenseStore';
import { ExpenseCategory, ExpenseRecord } from '../../types';
import { X, AlertTriangle } from 'lucide-react';

interface ExpenseModalsProps {
  viewExpense: ExpenseRecord | null;
  onCloseView: () => void;
  editExpense: ExpenseRecord | null;
  onCloseEdit: () => void;
  deleteExpenseId: string | null;
  onCloseDelete: () => void;
}

export const ExpenseModals: React.FC<ExpenseModalsProps> = ({
  viewExpense,
  onCloseView,
  editExpense,
  onCloseEdit,
  deleteExpenseId,
  onCloseDelete
}) => {
  const { updateExpense, deleteExpense, isSaving } = useExpenseStore();

  // Edit State
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState<ExpenseCategory>('Milk');
  const [editQty, setEditQty] = useState('');
  const [editRecovery, setEditRecovery] = useState('');
  const [editReason, setEditReason] = useState('');
  
  useEffect(() => {
    if (editExpense) {
      setEditDate(editExpense.date);
      setEditCategory(editExpense.category);
      setEditQty(editExpense.quantity.toString());
      setEditRecovery(editExpense.soldRecovery.toString());
      setEditReason(editExpense.reason || '');
    }
  }, [editExpense]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpense) return;

    const qty = parseFloat(editQty);
    const recovery = parseFloat(editRecovery);
    
    if (!editDate || isNaN(qty) || qty <= 0 || isNaN(recovery) || recovery < 0) {
      alert("Please ensure quantity > 0 and recovery >= 0.");
      return;
    }

    const calculatedGross = qty * editExpense.unitCost;
    let calculatedNet = calculatedGross - recovery;
    if (calculatedNet < 0) calculatedNet = 0;

    try {
      await updateExpense(editExpense.id, {
        date: editDate,
        category: editCategory,
        quantity: qty,
        grossLoss: calculatedGross,
        soldRecovery: recovery,
        netExpense: calculatedNet,
        reason: editReason
      });
      onCloseEdit();
    } catch (err) {
      alert("Unable to update expense.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteExpenseId) return;
    try {
      await deleteExpense(deleteExpenseId);
      onCloseDelete();
    } catch (err) {
      alert("Unable to delete expense.");
    }
  };

  return (
    <>
      {/* View Modal */}
      {viewExpense && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Expense Details</h3>
              <button onClick={onCloseView} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Date</p>
                  <p className="text-sm font-medium text-slate-800">{new Date(viewExpense.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Category</p>
                  <p className="text-sm font-medium text-slate-800">{viewExpense.category}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Quantity</p>
                  <p className="text-sm font-medium text-slate-800">{viewExpense.quantity} kg</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Unit Cost</p>
                  <p className="text-sm font-medium text-slate-800">Rs. {viewExpense.unitCost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Gross Loss</p>
                  <p className="text-sm font-medium text-rose-600">Rs. {viewExpense.grossLoss.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Sold Recovery</p>
                  <p className="text-sm font-medium text-emerald-600">Rs. {viewExpense.soldRecovery.toLocaleString()}</p>
                </div>
              </div>
              
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 font-semibold mb-1">Net Expense</p>
                <p className="text-lg font-bold text-rose-700">Rs. {viewExpense.netExpense.toLocaleString()}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-semibold mb-1">Reason / Notes</p>
                <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{viewExpense.reason || 'None'}</p>
              </div>
              
              <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-100">
                <span>Added by: {viewExpense.addedBy}</span>
                <span>{new Date(viewExpense.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button onClick={onCloseView} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editExpense && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Edit Expense</h3>
              <button onClick={onCloseEdit} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">Date</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} required
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">Category</label>
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value as ExpenseCategory)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Milk">Milk</option>
                    <option value="Yogurt">Yogurt</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Gas">Gas</option>
                    <option value="Water">Water</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">Qty</label>
                  <input type="number" step="0.01" value={editQty} onChange={e => setEditQty(e.target.value)} required
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600">Recovery</label>
                  <input type="number" step="0.01" value={editRecovery} onChange={e => setEditRecovery(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">Reason / Notes</label>
                <input type="text" value={editReason} onChange={e => setEditReason(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={onCloseEdit} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-70">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
                <button onClick={onCloseDelete} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleDeleteConfirm} disabled={isSaving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-70">
                  {isSaving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
