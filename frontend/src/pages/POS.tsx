import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, X, Search, UserRound, ChevronLeft, PauseCircle, RotateCcw, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { rateService, StandardPrices } from '../services/rate.service';
import { saleService, CreateSalePayload, SaleItemPayload } from '../services/sale.service';
import { heldCartService, HeldCartRecord } from '../services/heldCart.service';
import { customerService } from '../services/customer.service';
import { ApiCustomer } from '../types/customer';
import { MilkProducts } from './inventory/MilkProducts';
import { posConfigService, POSConfigData } from '../services/posConfig.service';
import { buildReceipt } from '../utils/escposBuilder';
import { NumericKeypadInput } from '../components/pos/NumericKeypadInput';
import { inventoryService } from '../services/inventoryService';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'kg' | 'rs';
  total: number;
  pricePerKg: number;
}

/** Rupee money — 2 decimal places */
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Weight qty — 3 decimal places (avoids Rs→kg→Rs drift at 2dp) */
function qtyMoney(n: number): number {
  return Math.round(n * 1000) / 1000;
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

  // Send qty + unitPrice such that money(qty * unitPrice) === line total (backend recomputes total that way)
  return raw.map((r, idx) => {
    const line = lineTotals[idx];
    let qty = qtyMoney(r.quantity);
    if (qty <= 0) qty = qtyMoney(r.quantity) || 0.001;
    let unitPrice = qty > 0 ? money(line / qty) : 0;
    // Fix rare 0.01 drift from rounding
    if (qty > 0 && money(qty * unitPrice) !== line) {
      unitPrice = money(line / qty);
      if (money(qty * unitPrice) !== line) {
        // Last resort: nudge qty so product matches the intended rupees
        qty = unitPrice > 0 ? qtyMoney(line / unitPrice) : qty;
        if (money(qty * unitPrice) !== line && qty > 0) {
          unitPrice = money(line / qty);
        }
      }
    }
    return { itemName: r.itemName, quantity: qty, unitPrice };
  });
}

export const POS: React.FC = () => {
  const [activeTab, setActiveTab] = useState('milk-yogurt');
  const [cart, setCart] = useState<CartItem[]>([]);
  /** combine = bump last matching line only; new = always add a separate row */
  const [cartLineMode, setCartLineMode] = useState<'combine' | 'new'>(() => {
    try {
      const saved = localStorage.getItem('posCartLineMode');
      return saved === 'new' ? 'new' : 'combine';
    } catch {
      return 'combine';
    }
  });
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'split' | 'khata'>('cash');
  const [discount, setDiscount] = useState<number>(0);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);

  const [milkCustomAmount, setMilkCustomAmount] = useState('');
  const [yogurtCustomAmount, setYogurtCustomAmount] = useState('');
  const [milkCustomType, setMilkCustomType] = useState<'rs' | 'kg'>('rs');
  const [yogurtCustomType, setYogurtCustomType] = useState<'rs' | 'kg'>('rs');

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

  const [posConfig, setPosConfig] = useState<POSConfigData | null>(null);
  const [lastSaleDetails, setLastSaleDetails] = useState<any>(null);
  // Duplicate-print protection: track which sale IDs have already been sent to the printer
  const printedSaleIds = useRef<Set<number>>(new Set());

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

    const loadConfig = async () => {
      try {
        const conf = await posConfigService.getPOSConfig();
        if (!cancelled) setPosConfig(conf);
      } catch (e) {
        console.error('Failed to load POS config', e);
      }
    };

    loadPrices();
    loadConfig();
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

  const setCartLineModePersisted = (mode: 'combine' | 'new') => {
    setCartLineMode(mode);
    try {
      localStorage.setItem('posCartLineMode', mode);
    } catch {
      /* ignore */
    }
  };

  const addToCart = (name: string, quantity: number, unit: 'kg' | 'rs', total: number, pricePerKg: number) => {
    setCart((prev) => {
      const qtyAdd = qtyMoney(quantity);
      const derivedRate =
        pricePerKg > 0
          ? pricePerKg
          : qtyAdd > 0 && total > 0
            ? money(total / qtyAdd)
            : 0;

      // RS sales: keep the entered rupees. KG sales: qty × rate.
      const addedTotal =
        unit === 'rs'
          ? money(total)
          : money(derivedRate > 0 ? qtyAdd * derivedRate : total);

      if (cartLineMode === 'combine') {
        let lastIdx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].name === name) {
            lastIdx = i;
            break;
          }
        }
        if (lastIdx >= 0) {
          const existing = prev[lastIdx];
          const rate = derivedRate > 0 ? derivedRate : existing.pricePerKg;
          const newTotal = money(existing.total + addedTotal);
          // Prefer money-preserving qty when any side was sold by Rs (or rate known)
          const newQty =
            rate > 0
              ? qtyMoney(newTotal / rate)
              : qtyMoney(existing.quantity + qtyAdd);
          return prev.map((item, idx) =>
            idx === lastIdx
              ? {
                  ...item,
                  quantity: newQty,
                  total: newTotal,
                  pricePerKg: rate,
                  unit: unit === 'rs' || existing.unit === 'rs' ? 'rs' : 'kg',
                }
              : item
          );
        }
      }

      const rate = derivedRate;
      const lineQty =
        unit === 'rs' && rate > 0 ? qtyMoney(addedTotal / rate) : qtyAdd;
      return [
        ...prev,
        {
          id: Math.random().toString(36).substr(2, 9),
          name,
          quantity: lineQty,
          unit,
          total: addedTotal,
          pricePerKg: rate,
        },
      ];
    });
    setCheckoutError(null);
    setCheckoutSuccess(null);
  };

  const handleCustomAdd = (type: 'milk' | 'yogurt', amountOverride?: string) => {
    const isMilk = type === 'milk';
    const input = amountOverride ?? (isMilk ? milkCustomAmount : yogurtCustomAmount);
    const pricePerKg = isMilk ? milkRatePerKg : yogurtRatePerKg;
    const customType = isMilk ? milkCustomType : yogurtCustomType;

    if (!pricePerKg || pricePerKg <= 0) return;

    const parsedInput = parseFloat(input);
    if (isNaN(parsedInput) || parsedInput <= 0) return;

    let rs = 0;
    let kg = 0;

    if (customType === 'rs') {
      rs = money(parsedInput);
      kg = rs / pricePerKg;
      addToCart(isMilk ? 'Milk' : 'Yogurt', kg, 'rs', rs, pricePerKg);
    } else {
      kg = parsedInput;
      rs = money(kg * pricePerKg);
      addToCart(isMilk ? 'Milk' : 'Yogurt', kg, 'kg', rs, pricePerKg);
    }

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
        const qty = qtyMoney(newQuantity);
        return {
          ...item,
          quantity: qty,
          total: money(qty * item.pricePerKg),
          unit: 'kg',
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
    setPaymentMethod('cash');
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

    // Butter / Ghee: block on Cash OK (not when adding to cart) if inventory is short
    const butterQty = money(
      items.filter((i) => i.itemName === 'butter').reduce((s, i) => s + i.quantity, 0)
    );
    const gheeQty = money(
      items.filter((i) => i.itemName === 'ghee').reduce((s, i) => s + i.quantity, 0)
    );
    if (butterQty > 0 || gheeQty > 0) {
      try {
        const products = await inventoryService.getProducts();
        const butterStock = Number(
          products.find((p) => p.code?.toUpperCase() === 'BUTTER' || p.name?.toLowerCase() === 'butter')
            ?.stock ?? 0
        );
        const gheeStock = Number(
          products.find((p) => p.code?.toUpperCase() === 'GHEE' || p.name?.toLowerCase() === 'ghee')
            ?.stock ?? 0
        );
        if (butterQty > 0 && butterStock < butterQty) {
          setCheckoutError(
            butterStock <= 0
              ? 'Cannot sell Butter. Inventory stock is 0 kg. Add Butter stock in Inventory first.'
              : `Cannot sell ${butterQty} kg Butter. Only ${butterStock} kg available in Inventory.`
          );
          return;
        }
        if (gheeQty > 0 && gheeStock < gheeQty) {
          setCheckoutError(
            gheeStock <= 0
              ? 'Cannot sell Ghee. Inventory stock is 0 kg. Add Ghee stock in Inventory first.'
              : `Cannot sell ${gheeQty} kg Ghee. Only ${gheeStock} kg available in Inventory.`
          );
          return;
        }
      } catch {
        /* backend still enforces on createSale */
      }
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
      // khata / ledger â€” must pick a registered customer
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
      setLastSaleDetails({
        ...sale,
        subtotal: subtotal,
        discount: discount,
        paymentMethod: paymentMethod === 'khata' ? 'KHATA' : paymentMethod
      });
      resetAfterSale();
      // Refresh F2 stock display if the sale contained F2 items
      const hadF2 = cart.some((item) => ['Lassi', 'Butter', 'Ghee'].includes(item.name));
      if (hadF2) refreshF2StockRef.current?.();

      // â”€â”€ Silent native ESC/POS print (post-sale, non-blocking) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (posConfig?.printReceiptAutomatically && posConfig?.printerEnabled) {
        const saleId: number = sale.id;
        if (!printedSaleIds.current.has(saleId)) {
          printedSaleIds.current.add(saleId);
          const receiptBytes = buildReceipt({
            id: sale.id,
            tokenNumber: sale.tokenNumber,
            shopName: posConfig.shopName || 'Gujar Milk Shop',
            createdAt: sale.createdAt,
            customerName: sale.customerName ?? selectedKhataCustomer?.name ?? null,
            items: sale.items?.map((i: any) => ({
              itemName: i.itemName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
            })) ?? [],
            totalAmount: sale.totalAmount,
            discountAmount: discount > 0 ? discount : undefined,
            paidAmount: sale.paidAmount,
            remainingBalance: sale.remainingBalance,
            paymentMethod: paymentMethod === 'khata' ? 'KHATA' : paymentMethod,
            currencySymbol: posConfig.currencySymbol || 'Rs.',
            receiptWidth: posConfig.receiptWidth || '80mm',
            footerText: posConfig.receiptFooterText,
            autoCutter: posConfig.autoCutter,
          });
          // Fire-and-forget: printing MUST NOT affect the committed sale
          invoke<boolean>('print_raw_bytes', {
            printerName: posConfig.printerName,
            data: receiptBytes,
          }).catch((printErr) => {
            console.error('[PRINT] Failed to print receipt:', printErr);
            setCheckoutError(`Receipt printing failed: ${printErr}. Sale #${sale.id} was saved successfully.`);
            // Remove from set so a manual retry is possible
            printedSaleIds.current.delete(saleId);
          });
        }
      }
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
            className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeTab === 'milk-yogurt'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm'
              }`}
            onClick={() => setActiveTab('milk-yogurt')}
          >
            Milk & Yogurt
          </button>
          <button
            className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'items'
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
              onAddToCart={(name, qty, unitPrice, customTotal) =>
                addToCart(
                  name,
                  qty,
                  customTotal !== undefined ? 'rs' : 'kg',
                  customTotal ?? money(qty * unitPrice),
                  unitPrice
                )
              }
              onRegisterRefresh={(fn) => { refreshF2StockRef.current = fn; }}
            />
          ) : pricesLoading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Loading standard pricesâ€¦
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
              <div className="flex-1 bg-emerald-100/70 border border-emerald-200 rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-emerald-700">Milk</h2>
                  <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-emerald-300 shadow-sm">
                    <div className="flex bg-slate-100 rounded-md p-0.5">
                      <button
                        onClick={() => setMilkCustomType('rs')}
                        className={`px-3 py-1.5 text-sm font-bold rounded-md transition-colors ${milkCustomType === 'rs' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        RS
                      </button>
                      <button
                        onClick={() => setMilkCustomType('kg')}
                        className={`px-3 py-1.5 text-sm font-bold rounded-md transition-colors ${milkCustomType === 'kg' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        KG
                      </button>
                    </div>
                    <NumericKeypadInput
                      value={milkCustomAmount}
                      onChange={setMilkCustomAmount}
                      onConfirm={(v) => handleCustomAdd('milk', v)}
                      placeholder={milkCustomType === 'kg' ? 'kg' : 'Rs'}
                      title="Milk amount"
                      accent="emerald"
                      confirmLabel="Add"
                      className="w-36"
                      triggerClassName="border-none"
                    />
                    <button
                      onClick={() => handleCustomAdd('milk')}
                      className="bg-emerald-500 text-white hover:bg-emerald-600 px-4 py-1.5 rounded-md text-sm font-bold transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    const milkPresets = prices?.milk ?? [];
                    const amtPresets = prices?.milkByAmount ?? [];
                    const items: Array<{ type: 'weight' | 'amount' | 'empty'; preset?: any }> = [];
                    const rows = Math.max(Math.ceil(milkPresets.length / 2), amtPresets.length);

                    for (let r = 0; r < rows; r++) {
                      // Col 1
                      if (r * 2 < milkPresets.length) items.push({ type: 'weight', preset: milkPresets[r * 2] });
                      else items.push({ type: 'empty' });
                      // Col 2
                      if (r * 2 + 1 < milkPresets.length) items.push({ type: 'weight', preset: milkPresets[r * 2 + 1] });
                      else items.push({ type: 'empty' });
                      // Col 3
                      if (r < amtPresets.length) items.push({ type: 'amount', preset: amtPresets[r] });
                      else items.push({ type: 'empty' });
                    }

                    return items.map((item, i) => {
                      if (item.type === 'empty') return <div key={`milk-empty-${i}`} />;
                      return item.type === 'weight' ? (
                        <button
                          key={`milk-w-${item.preset.weight}-${i}`}
                          onClick={() => addToCart('Milk', item.preset.weight, 'kg', item.preset.price, milkRatePerKg)}
                          className="border border-white bg-white hover:border-emerald-400 hover:bg-emerald-50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors group shadow-sm"
                        >
                          <div className="font-bold text-slate-800 group-hover:text-emerald-700 text-lg">{item.preset.label}</div>
                          <div className="text-xs text-slate-500 font-medium mt-1">Rs. {item.preset.price}</div>
                        </button>
                      ) : (
                        <button
                          key={`milk-rs-${item.preset.amount}`}
                          type="button"
                          onClick={() => addToCart('Milk', item.preset.weight, 'rs', item.preset.amount, milkRatePerKg)}
                          className="rounded-xl border border-white bg-white hover:border-emerald-400 hover:bg-emerald-50 p-3 flex flex-col items-center justify-center transition-colors group shadow-sm"
                        >
                          <span className="font-bold text-emerald-800 group-hover:text-emerald-900 text-base sm:text-lg">
                            {item.preset.amount}
                          </span>
                          <span className="text-[10px] text-emerald-600/80 font-medium mt-0.5">
                            {item.preset.weight > 0 ? `${item.preset.weight} kg` : 'Rs'}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="hidden lg:block w-px bg-slate-100"></div>

              <div className="flex-1 bg-blue-100/70 border border-blue-200 rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-blue-700">Yogurt</h2>
                  <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-blue-300 shadow-sm">
                    <div className="flex bg-slate-100 rounded-md p-0.5">
                      <button
                        onClick={() => setYogurtCustomType('rs')}
                        className={`px-3 py-1.5 text-sm font-bold rounded-md transition-colors ${yogurtCustomType === 'rs' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        RS
                      </button>
                      <button
                        onClick={() => setYogurtCustomType('kg')}
                        className={`px-3 py-1.5 text-sm font-bold rounded-md transition-colors ${yogurtCustomType === 'kg' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        KG
                      </button>
                    </div>
                    <NumericKeypadInput
                      value={yogurtCustomAmount}
                      onChange={setYogurtCustomAmount}
                      onConfirm={(v) => handleCustomAdd('yogurt', v)}
                      placeholder={yogurtCustomType === 'kg' ? 'kg' : 'Rs'}
                      title="Yogurt amount"
                      accent="blue"
                      confirmLabel="Add"
                      className="w-36"
                      triggerClassName="border-none"
                    />
                    <button
                      onClick={() => handleCustomAdd('yogurt')}
                      className="bg-blue-500 text-white hover:bg-blue-600 px-4 py-1.5 rounded-md text-sm font-bold transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    const weightPresets = prices?.yogurtByWeight ?? [];
                    const amtPresets = prices?.yogurtByAmount ?? [];
                    const items: Array<{ type: 'weight' | 'amount' | 'empty'; preset?: any }> = [];
                    const rows = Math.max(Math.ceil(weightPresets.length / 2), amtPresets.length);

                    for (let r = 0; r < rows; r++) {
                      // Col 1
                      if (r * 2 < weightPresets.length) items.push({ type: 'weight', preset: weightPresets[r * 2] });
                      else items.push({ type: 'empty' });
                      // Col 2
                      if (r * 2 + 1 < weightPresets.length) items.push({ type: 'weight', preset: weightPresets[r * 2 + 1] });
                      else items.push({ type: 'empty' });
                      // Col 3
                      if (r < amtPresets.length) items.push({ type: 'amount', preset: amtPresets[r] });
                      else items.push({ type: 'empty' });
                    }

                    return items.map((item, i) => {
                      if (item.type === 'empty') return <div key={`yogurt-empty-${i}`} />;
                      return item.type === 'weight' ? (
                        <button
                          key={`y-w-${item.preset.weight}-${i}`}
                          onClick={() => addToCart('Yogurt', item.preset.weight, 'kg', item.preset.price, yogurtRatePerKg)}
                          className="border border-white bg-white hover:border-blue-400 hover:bg-blue-50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors group shadow-sm"
                        >
                          <div className="font-bold text-slate-800 group-hover:text-blue-700 text-lg">{item.preset.label}</div>
                          <div className="text-xs text-slate-500 font-medium mt-1">Rs. {item.preset.price}</div>
                        </button>
                      ) : (
                        <button
                          key={`y-rs-${item.preset.amount}`}
                          type="button"
                          onClick={() => addToCart('Yogurt', item.preset.weight, 'rs', item.preset.amount, yogurtRatePerKg)}
                          className="border border-white bg-white hover:border-blue-400 hover:bg-blue-50 rounded-xl p-3 flex flex-col items-center justify-center transition-colors group shadow-sm"
                        >
                          <div className="font-bold text-slate-800 group-hover:text-blue-700 text-lg">{item.preset.label}</div>
                          <div className="text-xs text-slate-500 font-medium mt-1">{item.preset.weight > 0 ? `${item.preset.weight} kg` : 'Rs'}</div>
                        </button>
                      );
                    });
                  })()}
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
                    placeholder="Filter by name or phoneâ€¦"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white min-h-0">
                {khataLoading && (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">
                    Loading customersâ€¦
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
                          <div className="min-w-0 flex-1 text-left">
                            <div className="text-sm font-bold text-slate-800 truncate">{c.name}</div>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-1">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${isMonthly
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-sky-100 text-sky-700'
                                }`}
                            >
                              {isMonthly ? 'Monthly' : 'Daily'}
                            </span>
                            <span className="text-sm font-bold text-slate-700">
                              Rs. {(c.remainingBalance ?? 0).toFixed(0)}
                            </span>
                          </div>
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
              <div className="p-4 bg-slate-800 text-white flex-shrink-0 space-y-3">
                <div className="flex justify-between items-center gap-2">
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

                {/* Card options: same item → new line OR combine (last line only) */}
                <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-2">
                    Same item click
                  </p>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={cartLineMode === 'combine'}
                        onChange={() => setCartLineModePersisted('combine')}
                        className="h-4 w-4 rounded border-white/30 accent-emerald-400 cursor-pointer"
                      />
                      Combine
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={cartLineMode === 'new'}
                        onChange={() => setCartLineModePersisted('new')}
                        className="h-4 w-4 rounded border-white/30 accent-emerald-400 cursor-pointer"
                      />
                      New line
                    </label>
                  </div>
                  <p className="mt-1.5 text-[10px] text-white/50 leading-snug">
                    {cartLineMode === 'combine'
                      ? 'Adds qty to the last matching line only — earlier separate lines stay as they are.'
                      : 'Every click adds a new cart line, even for the same product.'}
                  </p>
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
                        <div className="font-bold text-slate-800 w-24 text-right tabular-nums">Rs. {item.total.toFixed(2)}</div>
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
                              {heldCart.snapshot.cart.length} item{heldCart.snapshot.cart.length === 1 ? '' : 's'} Â· Rs. {heldCart.snapshot.cart.reduce((sum, item) => sum + item.total, 0).toFixed(0)}
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
                  <div className="text-sm font-bold text-slate-800">Rs. {subtotal.toFixed(2)}</div>
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
                  <div className="text-3xl font-black text-emerald-500">Rs. {finalTotal.toFixed(2)}</div>
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
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${paymentMethod === method
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
                        {' Â· '}
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
                  <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium flex justify-between items-center">
                    <span className="text-emerald-700">{checkoutSuccess}</span>
                    {lastSaleDetails && posConfig?.printerEnabled && (
                      <button
                        onClick={() => {
                          if (!lastSaleDetails || !posConfig) return;
                          const bytes = buildReceipt({
                            id: lastSaleDetails.id,
                            tokenNumber: lastSaleDetails.tokenNumber,
                            shopName: posConfig.shopName || 'Gujar Milk Shop',
                            createdAt: lastSaleDetails.createdAt,
                            customerName: lastSaleDetails.customerName ?? null,
                            items: lastSaleDetails.items?.map((i: any) => ({
                              itemName: i.itemName,
                              quantity: i.quantity,
                              unitPrice: i.unitPrice,
                              totalPrice: i.totalPrice,
                            })) ?? [],
                            totalAmount: lastSaleDetails.totalAmount,
                            discountAmount: lastSaleDetails.discount > 0 ? lastSaleDetails.discount : undefined,
                            paidAmount: lastSaleDetails.paidAmount,
                            remainingBalance: lastSaleDetails.remainingBalance,
                            paymentMethod: lastSaleDetails.paymentMethod,
                            currencySymbol: posConfig.currencySymbol || 'Rs.',
                            receiptWidth: posConfig.receiptWidth || '80mm',
                            footerText: posConfig.receiptFooterText,
                            autoCutter: posConfig.autoCutter,
                          });
                          invoke<boolean>('print_raw_bytes', {
                            printerName: posConfig.printerName,
                            data: bytes,
                          }).catch((e) => console.error('[PRINT] Manual reprint failed:', e));
                        }}
                        className="ml-2 px-3 py-1 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 rounded shadow-sm text-xs"
                      >
                        ðŸ–¨ Reprint
                      </button>
                    )}
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
                      {submitting ? 'Savingâ€¦' : primaryButtonLabel}
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

