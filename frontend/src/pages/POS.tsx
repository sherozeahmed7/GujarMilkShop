import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Search, UserRound, ChevronLeft, PauseCircle, RotateCcw, Trash2 } from 'lucide-react';
import { rateService, StandardPrices } from '../services/rate.service';
import { saleService, CreateSalePayload, SaleItemPayload } from '../services/sale.service';
import { heldCartService, HeldCartRecord } from '../services/heldCart.service';
import { customerService } from '../services/customer.service';
import { ApiCustomer } from '../types/customer';
import { MilkProducts } from './inventory/MilkProducts';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'kg' | 'rs';
  total: number;
  pricePerKg: number;
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildSaleItems(cart: CartItem[], discount: number, finalTotal: number): SaleItemPayload[] {
  const NAME_MAP: Record<string, 'milk' | 'yogurt' | 'lassi' | 'butter' | 'ghee'> = {
    Milk: 'milk',
    Yogurt: 'yogurt',
    Lassi: 'lassi',
    Butter: 'butter',
    Ghee: 'ghee',
  };

  const raw = cart
    .filter((c) => c.quantity > 0 && c.total > 0)
    .map((c) => {
      const itemName = NAME_MAP[c.name];
      if (!itemName) throw new Error(`Unrecognised cart item name: "${c.name}"`);
      return { itemName, quantity: c.quantity, lineTotal: money(c.total) };
    });

  if (raw.length === 0) return [];

  const subtotal = money(raw.reduce((s, r) => s + r.lineTotal, 0));
  const target = money(finalTotal);

  // Scale line totals to match finalTotal when discount applied
  let lineTotals = raw.map((r) => r.lineTotal);
  if (discount > 0 && subtotal > 0 && target !== subtotal) {
    let allocated = 0;
    lineTotals = raw.map((r, idx) => {
      if (idx === raw.length - 1) return money(target - allocated);
      const t = money((r.lineTotal / subtotal) * target);
      allocated = money(allocated + t);
      return t;
    });
  }

  return raw.map((r, idx) => {
    const qty = money(r.quantity);
    const line = lineTotals[idx];
    const unitPrice = qty > 0 ? money(line / qty) : 0;
    return { itemName: r.itemName, quantity: qty, unitPrice };
  });
}

export const POS: React.FC = () => {
  const [activeTab, setActiveTab] = useState('milk-yogurt');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'split' | 'khata'>('cash');
  const [discount, setDiscount] = useState<number>(0);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);

  const [milkCustomAmount, setMilkCustomAmount] = useState('');
  const [yogurtCustomAmount, setYogurtCustomAmount] = useState('');

  // Ref to trigger F2 stock refresh after a successful sale
  const refreshF2StockRef = React.useRef<(() => void) | null>(null);

  const [prices, setPrices] = useState<StandardPrices | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState<string | null>(null);

  // Split / walk-in / khata identity
  const [splitPaidAmount, setSplitPaidAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedKhataCustomer, setSelectedKhataCustomer] = useState<ApiCustomer | null>(null);
  const [khataCustomers, setKhataCustomers] = useState<ApiCustomer[]>([]);
  const [khataLoading, setKhataLoading] = useState(false);
  const [khataLoadError, setKhataLoadError] = useState<string | null>(null);
  const [khataFilter, setKhataFilter] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [heldCarts, setHeldCarts] = useState<HeldCartRecord[]>([]);
  const [heldCartsLoading, setHeldCartsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPrices = async () => {
      setPricesLoading(true);
      setPricesError(null);
      try {
        const data = await rateService.getStandardPrices();
        if (!cancelled) setPrices(data);
      } catch (err: any) {
        if (!cancelled) setPricesError(err?.message || 'Failed to load standard prices');
      } finally {
        if (!cancelled) setPricesLoading(false);
      }
    };

    loadPrices();
    return () => { cancelled = true; };
  }, []);

  const loadHeldCarts = async () => {
    setHeldCartsLoading(true);
    try {
      setHeldCarts(await heldCartService.list());
    } catch (err: any) {
      setCheckoutError(err?.message || 'Failed to load held bills');
    } finally {
      setHeldCartsLoading(false);
    }
  };

  useEffect(() => {
    loadHeldCarts();
  }, []);

  // Load registered ledger customers when Khata is selected
  useEffect(() => {
    if (paymentMethod !== 'khata') return;

    let cancelled = false;
    setKhataLoading(true);
    setKhataLoadError(null);

    customerService
      .getCustomers({ status: 'active' })
      .then((list) => {
        if (cancelled) return;
        const ledgerOnly = list.filter(
          (c) => c.customerType === 'daily_ledger' || c.customerType === 'monthly_ledger'
        );
        setKhataCustomers(ledgerOnly);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setKhataCustomers([]);
        setKhataLoadError(err?.message || 'Failed to load registered customers');
      })
      .finally(() => {
        if (!cancelled) setKhataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paymentMethod]);

  const filteredKhataCustomers = useMemo(() => {
    const q = khataFilter.trim().toLowerCase();
    if (!q) return khataCustomers;
    return khataCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
    );
  }, [khataCustomers, khataFilter]);

  const milkRatePerKg = prices?.milkRatePerKg ?? 0;
  const yogurtRatePerKg = prices?.yogurtRatePerKg ?? 0;

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = Math.max(0, money(subtotal - (discount || 0)));

  const addToCart = (name: string, quantity: number, unit: 'kg' | 'rs', total: number, pricePerKg: number) => {
    setCart((prev) => {
      const qtyAdd = money(quantity);
      // Prefer daily rate; if missing (0), derive from preset total / kg so price is never stuck at 0
      const derivedRate =
        pricePerKg > 0
          ? pricePerKg
          : qtyAdd > 0 && total > 0
            ? money(total / qtyAdd)
            : 0;

      const existing = prev.find((item) => item.name === name);
      if (existing) {
        const rate = derivedRate > 0 ? derivedRate : existing.pricePerKg;
        const newQty = money(existing.quantity + qtyAdd);
        return prev.map((item) =>
          item.name === name
            ? {
                ...item,
                quantity: newQty,
                total: money(newQty * rate),
                pricePerKg: rate,
                unit: 'kg',
              }
            : item
        );
      }

      const rate = derivedRate;
      return [
        ...prev,
        {
          id: Math.random().toString(36).substr(2, 9),
          name,
          quantity: qtyAdd,
          unit: 'kg',
          total: money(rate > 0 ? qtyAdd * rate : total),
          pricePerKg: rate,
        },
      ];
    });
    setCheckoutError(null);
    setCheckoutSuccess(null);
  };

  const handleCustomAdd = (type: 'milk' | 'yogurt') => {
    const isMilk = type === 'milk';
    const input = isMilk ? milkCustomAmount : yogurtCustomAmount;
    const pricePerKg = isMilk ? milkRatePerKg : yogurtRatePerKg;

    if (!pricePerKg || pricePerKg <= 0) return;

    const rs = parseFloat(input);
    if (isNaN(rs) || rs <= 0) return;

    const kg = rs / pricePerKg;

    addToCart(isMilk ? 'Milk' : 'Yogurt', kg, 'kg', rs, pricePerKg);
    if (isMilk) setMilkCustomAmount('');
    else setYogurtCustomAmount('');
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateCartItemQuantity = (id: string, newQuantityStr: string) => {
    const newQuantity = parseFloat(newQuantityStr);
    setCart(cart.map(item => {
      if (item.id === id) {
        if (isNaN(newQuantity) || newQuantity < 0) {
          return { ...item, quantity: 0, total: 0 };
        }
        const qty = money(newQuantity);
        return {
          ...item,
          quantity: qty,
          total: money(qty * item.pricePerKg),
        };
      }
      return item;
    }));
  };

  const resetAfterSale = () => {
    setCart([]);
    setDiscount(0);
    setIsDiscountOpen(false);
    setSplitPaidAmount('');
    setCustomerName('');
    setCustomerPhone('');
    setSelectedKhataCustomer(null);
    setKhataFilter('');
  };

  const holdCurrentBill = async () => {
    if (cart.length === 0) {
      setCheckoutError('Add items to the cart before holding the bill.');
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);
    try {
      await heldCartService.create({
        cart,
        discount,
        paymentMethod,
        splitPaidAmount,
        customerName,
        customerPhone,
        selectedKhataCustomer,
      });
      resetAfterSale();
      setCheckoutSuccess('Bill held successfully.');
      await loadHeldCarts();
    } catch (err: any) {
      setCheckoutError(err?.message || 'Failed to hold bill');
    } finally {
      setSubmitting(false);
    }
  };

  const resumeHeldBill = async (id: number) => {
    if (cart.length > 0 && !window.confirm('Replace the current bill with this held bill?')) return;

    setSubmitting(true);
    setCheckoutError(null);
    try {
      const { snapshot } = await heldCartService.resume(id);
      setCart(snapshot.cart);
      setDiscount(snapshot.discount);
      setPaymentMethod(snapshot.paymentMethod);
      setSplitPaidAmount(snapshot.splitPaidAmount);
      setCustomerName(snapshot.customerName);
      setCustomerPhone(snapshot.customerPhone);
      setSelectedKhataCustomer(snapshot.selectedKhataCustomer);
      setIsDiscountOpen(snapshot.discount > 0);
      setCheckoutSuccess('Held bill loaded into the cart.');
      await loadHeldCarts();
    } catch (err: any) {
      setCheckoutError(err?.message || 'Failed to resume held bill');
    } finally {
      setSubmitting(false);
    }
  };

  const removeHeldBill = async (id: number) => {
    if (!window.confirm('Delete this held bill permanently?')) return;

    setSubmitting(true);
    setCheckoutError(null);
    try {
      await heldCartService.remove(id);
      setCheckoutSuccess('Held bill deleted successfully.');
      await loadHeldCarts();
    } catch (err: any) {
      setCheckoutError(err?.message || 'Failed to delete held bill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutClick = () => {
    if (cart.length === 0 || finalTotal <= 0) {
      setCheckoutError('Add items to the cart before completing the sale.');
      return;
    }
    handleCheckout();
  };

  const handleCheckout = async () => {
    setCheckoutError(null);
    setCheckoutSuccess(null);

    if (cart.length === 0 || finalTotal <= 0) {
      setCheckoutError('Add items to the cart before completing the sale.');
      return;
    }

    const items = buildSaleItems(cart, discount || 0, finalTotal);
    if (items.length === 0) {
      setCheckoutError('Cart has no valid items.');
      return;
    }

    // Recompute total from item lines so it always matches backend validation
    const totalAmount = money(
      items.reduce((sum, i) => sum + money(i.quantity * i.unitPrice), 0)
    );
    if (totalAmount <= 0) {
      setCheckoutError('Sale total must be greater than 0.');
      return;
    }

    let payload: CreateSalePayload;

    if (paymentMethod === 'cash' || paymentMethod === 'online') {
      payload = {
        saleType: 'walk_in',
        items,
        totalAmount,
        paidAmount: totalAmount,
        paymentMethod,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
      };
    } else if (paymentMethod === 'split') {
      const paid = money(parseFloat(splitPaidAmount));
      if (!splitPaidAmount || Number.isNaN(paid)) {
        setCheckoutError('Initial amount paid is required for split sales.');
        return;
      }
      if (paid <= 0) {
        setCheckoutError('Initial amount must be greater than 0.');
        return;
      }
      if (paid >= totalAmount) {
        setCheckoutError('For full payment use Cash or Online. Split requires amount less than total.');
        return;
      }
      if (!customerName.trim()) {
        setCheckoutError('Customer name is required for split sales.');
        return;
      }
      if (!customerPhone.trim()) {
        setCheckoutError('Phone is required for split customers (used to group their dues).');
        return;
      }

      payload = {
        saleType: 'split',
        items,
        totalAmount,
        paidAmount: paid,
        paymentMethod: 'cash',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
      };
    } else {
      // khata / ledger — must pick a registered customer
      if (!selectedKhataCustomer) {
        setCheckoutError(
          'Select a registered customer from the list. Register them first on the Customers screen if needed.'
        );
        return;
      }

      payload = {
        saleType:
          selectedKhataCustomer.customerType === 'monthly_ledger'
            ? 'ledger_monthly'
            : 'ledger_daily',
        items,
        totalAmount,
        customerId: selectedKhataCustomer.id,
      };
    }

    setSubmitting(true);
    try {
      const sale = await saleService.createSale(payload);
      let label = `Sale #${sale.id} saved.`;
      if (sale.saleType === 'walk_in') {
        label = `Walk-in sale #${sale.id} saved (${paymentMethod}).`;
      } else if (sale.saleType === 'split') {
        label = `Split sale #${sale.id} saved. Remaining Rs. ${sale.remainingBalance}.`;
      } else {
        label = `Khata sale #${sale.id} saved for ${selectedKhataCustomer?.name}. Due Rs. ${sale.remainingBalance}.`;
      }
      setCheckoutSuccess(label);
      resetAfterSale();
      // Refresh F2 stock display if the sale contained F2 items
      const hadF2 = cart.some((item) => ['Lassi', 'Butter', 'Ghee'].includes(item.name));
      if (hadF2) refreshF2StockRef.current?.();
    } catch (err: any) {
      setCheckoutError(err?.message || 'Failed to save sale');
    } finally {
      setSubmitting(false);
    }
  };

  const primaryButtonLabel =
    paymentMethod === 'online'
      ? 'ONLINE OK'
      : paymentMethod === 'split'
        ? 'SPLIT OK'
        : paymentMethod === 'khata'
          ? 'KHATA OK'
          : 'CASH OK';

  const showKhataPicker = paymentMethod === 'khata' && !selectedKhataCustomer;

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      {/* Left Panel - Products */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex gap-2 mb-4">
          <button
            className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'milk-yogurt'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm'
            }`}
            onClick={() => setActiveTab('milk-yogurt')}
          >
            Milk & Yogurt
          </button>
          <button
            className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'items'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm'
            }`}
            onClick={() => setActiveTab('items')}
          >
            <Plus className="w-4 h-4" /> Items F2
          </button>
        </div>

        <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
          {activeTab === 'items' ? (
            <MilkProducts
              onAddToCart={(name, qty, unitPrice) => addToCart(name, qty, 'kg', qty * unitPrice, unitPrice)}
              onRegisterRefresh={(fn) => { refreshF2StockRef.current = fn; }}
            />
          ) : pricesLoading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Loading standard prices…
            </div>
          ) : pricesError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm">
              <p className="text-rose-500 font-medium">{pricesError}</p>
              <button
                onClick={() => {
                  setPricesLoading(true);
                  setPricesError(null);
                  rateService.getStandardPrices()
                    .then(setPrices)
                    .catch((err: any) => setPricesError(err?.message || 'Failed to load standard prices'))
                    .finally(() => setPricesLoading(false));
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-emerald-700">Milk</h2>
                  <div className="flex items-center gap-2 bg-white rounded-lg p-1.5 border border-emerald-200 shadow-sm">
                    <div className="text-xs font-semibold text-emerald-700 pl-1">Rs:</div>
                    <input
                      type="number"
                      value={milkCustomAmount}
                      onChange={(e) => setMilkCustomAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-24 px-2 py-1 text-sm border-none bg-slate-50 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd('milk')}
                    />
                    <button
                      onClick={() => handleCustomAdd('milk')}
                      className="bg-emerald-500 text-white hover:bg-emerald-600 px-3 py-1 rounded-md text-xs font-bold transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {(prices?.milk ?? []).map((preset) => (
                    <button
                      key={`milk-${preset.weight}`}
                      onClick={() => addToCart('Milk', preset.weight, 'kg', preset.price, milkRatePerKg)}
                      className="border border-white bg-white hover:border-emerald-400 hover:bg-emerald-50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors group shadow-sm"
                    >
                      <div className="font-bold text-slate-800 group-hover:text-emerald-700 text-lg">{preset.label}</div>
                      <div className="text-xs text-slate-500 font-medium mt-1">Rs. {preset.price}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <p className="text-xs font-bold text-emerald-700/70 uppercase tracking-wider mb-2 px-0.5">
                    By Amount (RS)
                  </p>
                  <div className="rounded-xl border-2 border-emerald-200 bg-white p-2 grid grid-cols-4 gap-2">
                    {(prices?.milkByAmount ?? []).map((preset) => (
                      <button
                        key={`milk-rs-${preset.amount}`}
                        type="button"
                        onClick={() =>
                          addToCart('Milk', preset.weight, 'kg', preset.amount, milkRatePerKg)
                        }
                        className="aspect-square rounded-lg border border-emerald-100 bg-emerald-50/60 hover:bg-emerald-100 hover:border-emerald-400 flex flex-col items-center justify-center transition-colors group"
                      >
                        <span className="font-bold text-emerald-800 group-hover:text-emerald-900 text-base sm:text-lg">
                          {preset.amount}
                        </span>
                        <span className="text-[10px] text-emerald-600/80 font-medium mt-0.5">
                          {preset.weight > 0 ? `${preset.weight} kg` : 'Rs'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hidden lg:block w-px bg-slate-100"></div>

              <div className="flex-1 bg-blue-50/40 border border-blue-100 rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-blue-700">Yogurt</h2>
                  <div className="flex items-center gap-2 bg-white rounded-lg p-1.5 border border-blue-200 shadow-sm">
                    <div className="text-xs font-semibold text-blue-700 pl-1">Rs:</div>
                    <input
                      type="number"
                      value={yogurtCustomAmount}
                      onChange={(e) => setYogurtCustomAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-24 px-2 py-1 text-sm border-none bg-slate-50 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd('yogurt')}
                    />
                    <button
                      onClick={() => handleCustomAdd('yogurt')}
                      className="bg-blue-500 text-white hover:bg-blue-600 px-3 py-1 rounded-md text-xs font-bold transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="col-span-full flex text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
                    <div className="flex-1">By Weight (KG)</div>
                    <div className="flex-1 pl-3">By Amount (RS)</div>
                  </div>
                  {(prices?.yogurtByWeight ?? []).map((preset) => (
                    <button
                      key={`y-kg-${preset.weight}`}
                      onClick={() => addToCart('Yogurt', preset.weight, 'kg', preset.price, yogurtRatePerKg)}
                      className="border border-white bg-white hover:border-blue-400 hover:bg-blue-50 rounded-xl p-3 flex justify-between items-center transition-colors group shadow-sm"
                    >
                      <div className="font-bold text-slate-800 group-hover:text-blue-700">{preset.label}</div>
                      <div className="text-xs text-slate-500 font-medium">Rs. {preset.price}</div>
                    </button>
                  ))}
                  {(prices?.yogurtByAmount ?? []).map((preset) => (
                    <button
                      key={`y-rs-${preset.amount}`}
                      onClick={() => addToCart('Yogurt', preset.weight, 'kg', preset.amount, yogurtRatePerKg)}
                      className="border border-white bg-white hover:border-blue-400 hover:bg-blue-50 rounded-xl p-3 flex justify-between items-center transition-colors group shadow-sm"
                    >
                      <div className="font-bold text-slate-800 group-hover:text-blue-700 text-lg">{preset.label}</div>
                      <div className="text-xs text-slate-500 font-medium">{preset.weight.toFixed(2)} kg</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Current Bill / Khata customer picker */}
      <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col gap-4 min-h-0">
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[520px] md:min-h-0">

          {showKhataPicker ? (
            <div className="flex flex-col flex-1 min-h-0 transition-opacity duration-300">
              <div className="p-4 bg-blue-700 text-white flex-shrink-0">
                <h2 className="font-bold text-sm tracking-wide uppercase">Select Customer</h2>
                <p className="text-[11px] text-blue-100 mt-1">
                  Choose a registered customer to add this bill to their khata.
                </p>
              </div>

              <div className="p-4 border-b border-slate-100 flex-shrink-0 bg-slate-50">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={khataFilter}
                    onChange={(e) => setKhataFilter(e.target.value)}
                    placeholder="Filter by name or phone…"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white min-h-0">
                {khataLoading && (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">
                    Loading customers…
                  </div>
                )}

                {khataLoadError && (
                  <div className="p-4">
                    <p className="text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                      {khataLoadError}
                    </p>
                  </div>
                )}

                {!khataLoading && !khataLoadError && filteredKhataCustomers.length === 0 && (
                  <div className="h-full flex items-center justify-center p-6 text-center">
                    <p className="text-sm font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                      {khataCustomers.length === 0
                        ? 'No registered customers yet. Add Daily or Monthly ledger customers on the Customers screen first.'
                        : 'No customers match your filter.'}
                    </p>
                  </div>
                )}

                {!khataLoading && filteredKhataCustomers.length > 0 && (
                  <div className="divide-y divide-slate-100">
                    {filteredKhataCustomers.map((c) => {
                      const isMonthly = c.customerType === 'monthly_ledger';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedKhataCustomer(c);
                            setCheckoutError(null);
                          }}
                          className="w-full text-left px-4 py-4 flex items-center gap-3 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                            <UserRound className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-slate-800 truncate">{c.name}</div>
                            <div className="text-xs text-slate-500 truncate mt-0.5">
                              {c.phone?.trim() ? c.phone : 'Not Available'}
                            </div>
                          </div>
                          <span
                            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                              isMonthly
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            {isMonthly ? 'Monthly' : 'Daily'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('cash');
                    setKhataFilter('');
                    setCheckoutError(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-sm font-bold transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Cash
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 transition-opacity duration-300">
          <div className="p-4 bg-slate-800 text-white flex justify-between items-center flex-shrink-0">
            <h2 className="font-bold text-sm tracking-wide">CURRENT BILL ({cart.length})</h2>
            <div className="flex items-center gap-2">
              {heldCarts.length > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-200">
                  {heldCarts.length} held
                </span>
              )}
              <button
                type="button"
                onClick={holdCurrentBill}
                disabled={submitting || cart.length === 0}
                title="Hold current bill"
                className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] font-bold uppercase hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PauseCircle className="w-3.5 h-3.5" /> Hold
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No items added yet
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3 group shadow-sm">
                    <div className="font-bold text-slate-800 text-sm w-16">{item.name}</div>
                    <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                      <input
                        type="number"
                        value={item.quantity === 0 ? '' : Number(item.quantity.toFixed(3))}
                        onChange={(e) => updateCartItemQuantity(item.id, e.target.value)}
                        className="w-full bg-transparent text-sm font-bold text-slate-800 focus:outline-none text-right"
                        step="0.001"
                      />
                      <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{item.unit}</span>
                    </div>
                    <div className="font-bold text-slate-800 w-20 text-right">Rs. {item.total.toFixed(0)}</div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-100 bg-white">
            {heldCarts.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Held bills</span>
                  {heldCartsLoading && <span className="text-[10px] text-amber-700">Loading...</span>}
                </div>
                <div className="max-h-24 space-y-1.5 overflow-y-auto">
                  {heldCarts.map((heldCart) => (
                    <div
                      key={heldCart.id}
                      className="flex w-full items-center justify-between rounded-lg border border-amber-100 bg-white px-2.5 py-2 hover:border-amber-300"
                    >
                      <button
                        type="button"
                        onClick={() => resumeHeldBill(heldCart.id)}
                        disabled={submitting}
                        className="flex flex-1 items-center justify-between text-left disabled:opacity-50"
                      >
                        <span className="text-xs font-semibold text-slate-700">
                          {heldCart.snapshot.cart.length} item{heldCart.snapshot.cart.length === 1 ? '' : 's'} · Rs. {heldCart.snapshot.cart.reduce((sum, item) => sum + item.total, 0).toFixed(0)}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">
                          <RotateCcw className="h-3 w-3" /> Load
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeHeldBill(heldCart.id)}
                        disabled={submitting}
                        className="ml-2 rounded-md border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                        title="Delete held bill"
                        aria-label={`Delete held bill ${heldCart.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-medium text-slate-600">Subtotal:</div>
              <div className="text-sm font-bold text-slate-800">Rs. {subtotal.toFixed(0)}</div>
            </div>

            {isDiscountOpen ? (
              <div className="flex justify-between items-center mb-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <div className="text-sm font-medium text-slate-600">Discount (Rs):</div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                  <input
                    type="number"
                    value={discount === 0 ? '' : discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-16 text-sm text-right bg-transparent focus:outline-none font-bold text-slate-800"
                    placeholder="0"
                  />
                  <button onClick={() => setIsDiscountOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsDiscountOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Discount
              </button>
            )}

            <div className="flex justify-between items-end mb-4">
              <div className="text-sm font-bold text-slate-800 tracking-wider">TOTAL</div>
              <div className="text-3xl font-black text-emerald-500">Rs. {finalTotal.toFixed(0)}</div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
              {(['cash', 'online', 'split', 'khata'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => {
                    setPaymentMethod(method);
                    setCheckoutError(null);
                    setCheckoutSuccess(null);
                    setSelectedKhataCustomer(null);
                    setKhataFilter('');
                    if (method === 'khata') {
                      setCustomerName('');
                      setCustomerPhone('');
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    paymentMethod === method
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Split fields */}
            {paymentMethod === 'split' && (
              <div className="mb-4 space-y-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div>
                  <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Amount paying now *
                  </label>
                  <input
                    type="number"
                    value={splitPaidAmount}
                    onChange={(e) => setSplitPaidAmount(e.target.value)}
                    placeholder={`Less than ${finalTotal.toFixed(0)}`}
                    className="mt-1 w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {splitPaidAmount && !Number.isNaN(parseFloat(splitPaidAmount)) && (
                    <p className="text-[11px] text-amber-700 mt-1 font-medium">
                      Remaining:{' '}
                      Rs. {Math.max(0, money(finalTotal - parseFloat(splitPaidAmount))).toFixed(0)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="mt-1 w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Phone * (groups same person)
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 0300-1234567"
                    className="mt-1 w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'khata' && selectedKhataCustomer && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  <UserRound className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-blue-900 truncate">{selectedKhataCustomer.name}</div>
                  <div className="text-[10px] text-blue-700 truncate">
                    {selectedKhataCustomer.phone?.trim() || 'Not Available'}
                    {' · '}
                    {selectedKhataCustomer.customerType === 'monthly_ledger' ? 'Monthly' : 'Daily'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedKhataCustomer(null)}
                  className="text-[10px] font-bold text-blue-700 hover:text-blue-900 uppercase flex-shrink-0"
                >
                  Change
                </button>
              </div>
            )}

            {(paymentMethod === 'cash' || paymentMethod === 'online') && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Name (optional)"
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            )}

            {checkoutError && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-xs font-medium">
                {checkoutError}
              </div>
            )}
            {checkoutSuccess && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-xs font-medium">
                {checkoutSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCheckoutClick}
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 font-bold tracking-wide transition-colors shadow-sm shadow-blue-600/20 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : primaryButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={holdCurrentBill}
                  disabled={submitting || cart.length === 0}
                  title="Hold current bill"
                  className="px-6 bg-slate-800 text-white rounded-xl py-4 font-bold tracking-wide hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  HOLD
                </button>
              </div>
            </div>
          </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
