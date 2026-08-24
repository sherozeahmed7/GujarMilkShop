import React, { useEffect, useState } from 'react';
import { ApiCustomer } from '../../types/customer';
import { saleService, SaleRecord } from '../../services/sale.service';
import { SplitKhataModal } from '../customers/SplitKhataModal';

interface KhataLedgerModalProps {
  customer: ApiCustomer;
  onClose: () => void;
}

export const KhataLedgerModal: React.FC<KhataLedgerModalProps> = ({
  customer,
  onClose,
}) => {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    saleService
      .listSales({ customerId: customer.id })
      .then((list) => {
        if (!cancelled) setSales(list);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Failed to load ledger');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl px-8 py-6 text-sm text-slate-500 font-medium">
          Loading ledger…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
          <p className="text-sm font-medium text-rose-600">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <SplitKhataModal
      title={customer.name}
      phone={customer.phone}
      sales={sales}
      mode="ledger"
      onClose={onClose}
    />
  );
};
