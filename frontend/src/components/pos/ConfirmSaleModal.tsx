import React from 'react';
import { ApiCustomer } from '../../types/customer';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  total: number;
  pricePerKg: number;
}

interface ConfirmSaleModalProps {
  cart: CartItem[];
  discount: number;
  finalTotal: number;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  selectedKhataCustomer: ApiCustomer | null;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export const ConfirmSaleModal: React.FC<ConfirmSaleModalProps> = ({
  cart,
  discount,
  finalTotal,
  paymentMethod,
  customerName,
  customerPhone,
  selectedKhataCustomer,
  onConfirm,
  onCancel,
  isProcessing
}) => {
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] bg-amber-50 dark:bg-amber-950/40 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Confirm F2 Products Sale
            </h2>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">This bill contains Lassi, Butter, or Ghee. Please confirm the details.</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-[#142119] p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35]">
              <h3 className="text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-2">Customer Details</h3>
              {paymentMethod === 'khata' && selectedKhataCustomer ? (
                <div>
                  <div className="font-bold text-slate-800 dark:text-[#e2f5e8]">{selectedKhataCustomer.name}</div>
                  <div className="text-sm text-slate-500 dark:text-[#8ba895]">{selectedKhataCustomer.phone}</div>
                  <div className="text-xs font-medium text-blue-600 mt-1">Khata Account</div>
                </div>
              ) : customerName ? (
                <div>
                  <div className="font-bold text-slate-800 dark:text-[#e2f5e8]">{customerName}</div>
                  <div className="text-sm text-slate-500 dark:text-[#8ba895]">{customerPhone || 'No phone'}</div>
                </div>
              ) : (
                <div className="font-medium text-slate-500 dark:text-[#8ba895]">Walk-in Customer</div>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-[#142119] p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35]">
              <h3 className="text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-2">Payment Info</h3>
              <div className="font-bold text-slate-800 dark:text-[#e2f5e8] uppercase">{paymentMethod}</div>
              {paymentMethod === 'khata' && (
                <div className="text-sm text-rose-600 font-medium mt-1">
                  Credit Amount: Rs. {finalTotal}
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-3">Bill Items</h3>
            <div className="border border-slate-200 dark:border-[#2d4a35] rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-[#142119] text-slate-500 dark:text-[#8ba895] font-bold">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {cart.map(item => (
                    <tr key={item.id} className={['Lassi', 'Butter', 'Ghee'].includes(item.name) ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''}>
                      <td className="px-4 py-2 font-medium text-slate-800 dark:text-[#e2f5e8]">
                        {item.name}
                        {['Lassi', 'Butter', 'Ghee'].includes(item.name) && (
                          <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">F2</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600 dark:text-[#a7c4ae]">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-2 text-right text-slate-600 dark:text-[#a7c4ae]">Rs. {item.pricePerKg}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-800 dark:text-[#e2f5e8]">Rs. {item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-800 text-white p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-sm text-slate-300">
              <span>Subtotal</span>
              <span>Rs. {subtotal}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-rose-300">
                <span>Discount</span>
                <span>- Rs. {discount}</span>
              </div>
            )}
            <div className="pt-2 mt-2 border-t border-slate-700 flex justify-between items-center">
              <span className="font-bold text-lg">Total Amount</span>
              <span className="font-black text-2xl">Rs. {finalTotal}</span>
            </div>
          </div>
          
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-[#2d4a35] flex justify-end gap-3 bg-slate-50 dark:bg-[#142119] shrink-0">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-6 py-2.5 text-sm font-bold text-slate-700 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? 'Processing...' : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirm & Complete Sale
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
