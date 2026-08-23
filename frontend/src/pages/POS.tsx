import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { rateService, StandardPrices } from '../services/rate.service';
import { saleService, CreateSalePayload, SaleItemPayload } from '../services/sale.service';
import { customerService } from '../services/customer.service';
import { ApiCustomer } from '../types/customer';
import { useDebounce } from '../hooks/useDebounce';

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
  const raw = cart
    .filter((c) => c.quantity > 0 && c.total > 0)
    .map((c) => ({
      itemName: (c.name.toLowerCase().includes('yogurt') ? 'yogurt' : 'milk') as 'milk' | 'yogurt',
      quantity: c.quantity,
      lineTotal: money(c.total),
    }));

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

  // Derive unitPrice from line total so API sum(qty * unitPrice) matches totalAmount
  return raw.map((r, idx) => {
    const qty = money(r.quantity);
    const line = lineTotals[idx];
    const unitPrice = qty > 0 ? money(line / qty) : 0;
    return {
      itemName: r.itemName,
      quantity: qty,
      unitPrice,
    };
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

  const [prices, setPrices] = useState<StandardPrices | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState<string | null>(null);

  // Split / walk-in / khata identity
  const [splitPaidAmount, setSplitPaidAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [khataLedgerType, setKhataLedgerType] = useState<'daily_ledger' | 'monthly_ledger'>(
    'daily_ledger'
  );
  const [selectedKhataCustomer, setSelectedKhataCustomer] = useState<ApiCustomer | null>(null);
  const [khataSearchResults, setKhataSearchResults] = useState<ApiCustomer[]>([]);
  const [khataSearching, setKhataSearching] = useState(false);
  const [khataSearchDone, setKhataSearchDone] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  const debouncedKhataName = useDebounce(customerName, 400);

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

  // Live search registered ledger customers when typing name on Khata tab
  useEffect(() => {
    if (paymentMethod !== 'khata') return;

    const q = debouncedKhataName.trim();
    if (q.length < 2) {
      setKhataSearchResults([]);
      setKhataSearchDone(false);
      setKhataSearching(false);
      return;
    }

    // If already selected and name matches selection, skip re-search noise
    if (
      selectedKhataCustomer &&
      selectedKhataCustomer.name.toLowerCase() === q.toLowerCase()
    ) {
      return;
    }

    let cancelled = false;
    setKhataSearching(true);
    setKhataSearchDone(false);

    customerService
      .getCustomers({
        search: q,
        customerType: khataLedgerType,
        status: 'active',
      })
      .then((list) => {
        if (cancelled) return;
        setKhataSearchResults(list);
        setKhataSearchDone(true);
        // Clear selection if it no longer matches search / type
        if (
          selectedKhataCustomer &&
          !list.some((c) => c.id === selectedKhataCustomer.id)
        ) {
          setSelectedKhataCustomer(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setKhataSearchResults([]);
        setKhataSearchDone(true);
      })
      .finally(() => {
        if (!cancelled) setKhataSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedKhataName, khataLedgerType, paymentMethod]);

  const milkRatePerKg = prices?.milkRatePerKg ?? 0;
  const yogurtRatePerKg = prices?.yogurtRatePerKg ?? 0;

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = Math.max(0, money(subtotal - (discount || 0)));

  const addToCart = (name: string, quantity: number, unit: 'kg' | 'rs', total: number, pricePerKg: number) => {
    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      quantity,
      unit,
      total,
      pricePerKg
    };
    setCart([...cart, newItem]);
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
        return {
          ...item,
          quantity: newQuantity,
          total: newQuantity * item.pricePerKg
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
    setKhataSearchResults([]);
    setKhataSearchDone(false);
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
      // khata / ledger
      if (!selectedKhataCustomer) {
        setCheckoutError(
          'Select a registered customer. If they are not registered yet, add them first on the Customers screen.'
        );
        return;
      }
      if (selectedKhataCustomer.customerType !== khataLedgerType) {
        setCheckoutError(
          `This customer is "${selectedKhataCustomer.customerType === 'monthly_ledger' ? 'Monthly' : 'Daily'}" ledger. Switch the Daily/Monthly toggle to match, or pick another customer.`
        );
        return;
      }

      payload = {
        saleType:
          khataLedgerType === 'daily_ledger' ? 'ledger_daily' : 'ledger_monthly',
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
          {pricesLoading ? (
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

      {/* Right Panel - Current Bill */}
      <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col gap-4 min-h-0">
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
            <h2 className="font-bold text-sm tracking-wide">CURRENT BILL ({cart.length})</h2>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50">
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
                    setKhataSearchResults([]);
                    setKhataSearchDone(false);
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

            {/* Khata / ledger fields */}
            {paymentMethod === 'khata' && (
              <div className="mb-4 space-y-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <div>
                  <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                    Ledger type *
                  </label>
                  <div className="mt-2 flex gap-2 p-1 bg-white/80 rounded-xl border border-blue-100">
                    <button
                      type="button"
                      onClick={() => {
                        setKhataLedgerType('daily_ledger');
                        setSelectedKhataCustomer(null);
                        setKhataSearchResults([]);
                        setKhataSearchDone(false);
                      }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        khataLedgerType === 'daily_ledger'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setKhataLedgerType('monthly_ledger');
                        setSelectedKhataCustomer(null);
                        setKhataSearchResults([]);
                        setKhataSearchDone(false);
                      }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        khataLedgerType === 'monthly_ledger'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                    Customer name * (search registered)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setSelectedKhataCustomer(null);
                      setCheckoutError(null);
                    }}
                    placeholder="Type at least 2 letters…"
                    className="mt-1 w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />

                  {khataSearching && (
                    <p className="mt-1 text-[11px] text-blue-600 font-medium">Searching…</p>
                  )}

                  {!khataSearching &&
                    khataSearchDone &&
                    customerName.trim().length >= 2 &&
                    !selectedKhataCustomer &&
                    khataSearchResults.length === 0 && (
                      <p className="mt-2 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5">
                        This person is not registered yet. First register them on the
                        Customers screen as{' '}
                        {khataLedgerType === 'daily_ledger' ? 'Daily' : 'Monthly'} ledger.
                      </p>
                    )}

                  {!selectedKhataCustomer && khataSearchResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-auto bg-white border border-blue-200 rounded-xl shadow-lg">
                      {khataSearchResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedKhataCustomer(c);
                            setCustomerName(c.name);
                            setCustomerPhone(c.phone || '');
                            setKhataSearchResults([]);
                            setCheckoutError(null);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-50 last:border-0"
                        >
                          <div className="text-sm font-bold text-slate-800">{c.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {c.phone || 'No phone'} ·{' '}
                            {c.customerType === 'monthly_ledger' ? 'Monthly' : 'Daily'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedKhataCustomer && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-800 font-medium">
                    Selected: <strong>{selectedKhataCustomer.name}</strong>
                    {selectedKhataCustomer.phone
                      ? ` · ${selectedKhataCustomer.phone}`
                      : ''}{' '}
                    ·{' '}
                    {selectedKhataCustomer.customerType === 'monthly_ledger'
                      ? 'Monthly Ledger'
                      : 'Daily Ledger'}
                  </div>
                )}
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
              {paymentMethod === 'cash' && (
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting}
                  className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl p-4 flex justify-between items-center transition-colors disabled:opacity-50"
                >
                  <div className="text-left">
                    <div className="font-bold text-sm">FAST CASH SALE</div>
                    <div className="text-[10px] text-emerald-600/80 mt-0.5">
                      {submitting ? 'Saving…' : 'No cash entry needed.'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-emerald-600/80 uppercase">Bill</div>
                    <div className="font-black text-lg">Rs. {finalTotal.toFixed(0)}</div>
                  </div>
                </button>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 font-bold tracking-wide transition-colors shadow-sm shadow-blue-600/20 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : primaryButtonLabel}
                </button>
                <button
                  type="button"
                  disabled
                  title="Hold coming soon"
                  className="px-6 bg-slate-800 text-white rounded-xl py-4 font-bold tracking-wide opacity-40 cursor-not-allowed"
                >
                  HOLD
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
