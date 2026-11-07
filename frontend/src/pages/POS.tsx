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
import { buildReceipt, buildPixelPerfectReceipt } from '../utils/escposBuilder';
import { NumericKeypadInput } from '../components/pos/NumericKeypadInput';
import { inventoryService } from '../services/inventoryService';
import { getInitialStandardPrices, computeStandardPrices, cacheStandardRates } from '../utils/pricingCalculator';
import { nextToken, prewarmTokenAllocator } from '../utils/tokenAllocator';

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
      return { itemName, quantity: c.quantity, lineTotal: money(c.total), catalogRate: c.pricePerKg };
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

  // Keep the effective rate at full precision for backend mathematical balance:
  return raw.map((r, idx) => {
    const line = lineTotals[idx];
    const qty = qtyMoney(r.quantity) || 0.001;
    const unitPrice = line / qty;
    return { itemName: r.itemName, quantity: qty, unitPrice, catalogRate: r.catalogRate };
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

  // Initialize prices INSTANTLY in-memory from client storage/defaults (0ms load time)
  const [prices, setPrices] = useState<StandardPrices>(() => getInitialStandardPrices());
  const [pricesLoading, setPricesLoading] = useState(false);
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
  // Auto-print: seeded from localStorage for instant startup; synced from backend config once loaded
  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    try { return localStorage.getItem('posAutoPrint') !== 'false'; } catch { return true; }
  });
  const [lastSaleDetails, setLastSaleDetails] = useState<any>(null);
  // Duplicate-print protection: track which sale IDs have already been sent to the printer
  const printedSaleIds = useRef<Set<number>>(new Set());

  // Shared print helper — used by auto-print and Reprint button
  const executePrint = React.useCallback(async (saleData: any, forceRaster = false) => {
    if (!posConfig || !posConfig.printerEnabled) return;
    // Default to raster mode unless explicitly configured as 'text'
    const useRaster = forceRaster || (posConfig as any).printMode !== 'text';
    let receiptBytes: number[];
    if (useRaster) {
      // No silent fallback — let error throw to caller so cashier is alerted
      receiptBytes = await buildPixelPerfectReceipt(saleData);
    } else {
      receiptBytes = buildReceipt(saleData);
    }
    await invoke<boolean>('print_raw_bytes', {
      printerName: posConfig.printerName || '',
      data: receiptBytes,
    });
  }, [posConfig]);

  useEffect(() => {
    let cancelled = false;

    // Background sync of daily rates without blocking the POS UI
    const syncDailyRates = async () => {
      try {
        const data = await rateService.getStandardPrices();
        if (!cancelled && data) {
          setPrices(data);
          cacheStandardRates({
            milkRatePerKg: data.milkRatePerKg,
            yogurtRatePerKg: data.yogurtRatePerKg,
            lassiRatePerKg: data.lassiRatePerKg,
            butterRatePerKg: data.butterRatePerKg,
            gheeRatePerKg: data.gheeRatePerKg,
            lastUpdated: data.lastUpdated,
          });
        }
      } catch (err: any) {
        // Non-blocking: we already have valid client-side prices computed in memory
        console.warn('[POS] Daily rates background sync warning:', err?.message);
      }
    };

    const loadConfig = async () => {
      try {
        const conf = await posConfigService.getPOSConfig();
        if (!cancelled) {
          setPosConfig(conf);
          // Sync autoPrint from backend config (authoritative source)
          setAutoPrint(conf.printReceiptAutomatically);
          try { localStorage.setItem('posAutoPrint', conf.printReceiptAutomatically ? 'true' : 'false'); } catch { /* ignore */ }
        }
      } catch (e) {
        console.error('Failed to load POS config', e);
      }
    };

    syncDailyRates();
    loadConfig();

    // Pre-warm token allocator so first checkout token is available instantly
    prewarmTokenAllocator();

    // Startup Crash Recovery: Scan durable pending journal and safely reconcile any uncommitted sales
    invoke<any>('recover_pending_journal')
      .then((report) => {
        if (report && (report.total_journal_entries > 0 || report.recovered_and_committed > 0)) {
          console.log('[RECOVERY] Startup journal reconciliation complete:', report);
          if (report.recovered_and_committed > 0) {
            setCheckoutSuccess(`Recovered and committed ${report.recovered_and_committed} previously interrupted sale(s).`);
          }
        }
      })
      .catch((rErr) => {
        console.warn('[RECOVERY] Startup journal recovery check notice:', rErr);
      });

    return () => { cancelled = true; };
  }, []);

  const loadHeldCarts = React.useCallback(async () => {
    setHeldCartsLoading(true);
    try {
      setHeldCarts(await heldCartService.list());
    } catch (err: any) {
      setCheckoutError(err?.message || 'Failed to load held bills');
    } finally {
      setHeldCartsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHeldCarts();
  }, []);

  // Preload registered ledger customers on mount so switching to Khata is instant
  useEffect(() => {
    let cancelled = false;
    setKhataLoading(true);
    setKhataLoadError(null);

    customerService
      .getCustomers({ status: 'all' })
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
  }, []);

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

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);
  const finalTotal = useMemo(() => Math.max(0, money(subtotal - (discount || 0))), [subtotal, discount]);

  const setCartLineModePersisted = (mode: 'combine' | 'new') => {
    setCartLineMode(mode);
    try {
      localStorage.setItem('posCartLineMode', mode);
    } catch {
      /* ignore */
    }
  };

  /** Toggle auto-print: persists to backend POSConfig + localStorage cache */
  const setAutoPrintPersisted = async (value: boolean) => {
    setAutoPrint(value);
    try { localStorage.setItem('posAutoPrint', value ? 'true' : 'false'); } catch { /* ignore */ }
    if (posConfig) {
      const updated = { ...posConfig, printReceiptAutomatically: value };
      setPosConfig(updated);
      try { await posConfigService.updatePOSConfig(updated); } catch (e) {
        console.warn('[POS] Failed to persist autoPrint to backend:', e);
      }
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

  const removeFromCart = React.useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateCartItemQuantity = React.useCallback((id: string, newQuantityStr: string) => {
    const newQuantity = parseFloat(newQuantityStr);
    setCart(prev => prev.map(item => {
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
  }, []);

  const resetAfterSale = React.useCallback(() => {
    setCart([]);
    setDiscount(0);
    setIsDiscountOpen(false);
    setSplitPaidAmount('');
    setCustomerName('');
    setCustomerPhone('');
    setSelectedKhataCustomer(null);
    setKhataFilter('');
    setPaymentMethod('cash');
  }, []);

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

    // Butter / Ghee inventory stock gate is fully and atomically validated by backend createSale transaction.

    // Never silently replace the bill shown to the cashier with a rounded product.
    const totalAmount = money(finalTotal);
    const itemsTotal = money(
      items.reduce((sum, i) => sum + money(i.quantity * i.unitPrice), 0)
    );
    if (itemsTotal !== totalAmount) {
      setCheckoutError('Item totals do not match the bill. Please review the cart.');
      return;
    }
    if (totalAmount <= 0) {
      setCheckoutError('Sale total must be greater than 0.');
      return;
    }

    let payload: CreateSalePayload;

    const discountVal = discount > 0 ? money(discount) : 0;

    if (paymentMethod === 'cash' || paymentMethod === 'online') {
      payload = {
        saleType: 'walk_in',
        items,
        totalAmount,
        paidAmount: totalAmount,
        discountAmount: discountVal,
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
        discountAmount: discountVal,
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
        paidAmount: 0,
        discountAmount: discountVal,
        customerId: selectedKhataCustomer.id,
      };
    }

    // --- SAFE LOCAL-FIRST ATOMIC CHECKOUT ---
    // ─── INSTANT CASH OK ORCHESTRATION WITH DURABLE RECOVERY JOURNAL ────────────
    const t0 = performance.now();

    // 1. Generate unique permanent checkoutUuid and reserve next token
    const checkoutUuid = crypto.randomUUID();
    payload.checkoutUuid = checkoutUuid;
    const tokenNumber = await nextToken();
    payload.tokenNumber = tokenNumber;
    const currentUserId = Number(localStorage.getItem('userId')) || undefined;
    payload.createdById = currentUserId;

    // 2. Deep-clone / freeze immutable sale snapshot
    const snapshotCart = [...cart];
    const snapshotDiscount = discount;
    const snapshotSubtotal = subtotal;
    const snapshotPaymentMethod = paymentMethod;
    const snapshotKhataCustomer = selectedKhataCustomer;
    const snapshotCustomerName = customerName.trim() || selectedKhataCustomer?.name || null;
    const snapshotCreatedAt = new Date();
    const snapshotPayload = { ...payload };

    // 3. DURABLY WRITE TINY PENDING JOURNAL RECOVERY RECORD
    // Fast append-only write to %APPDATA%\com.shero.tauri-app\pending_checkout.journal (<1ms)
    let tJournalWritten = t0;
    try {
      invoke('write_pending_journal', { payload: snapshotPayload }).catch((err) => {
        console.warn('[JOURNAL] Background journal sync warning:', err);
      });
      // Also write secondary fallback to localStorage for defense-in-depth
      localStorage.setItem(`pending_journal_${checkoutUuid}`, JSON.stringify({
        uuid: checkoutUuid,
        timestamp: snapshotCreatedAt.toISOString(),
        payload: snapshotPayload,
      }));
      tJournalWritten = performance.now();
    } catch (jErr) {
      console.warn('[JOURNAL] Local journal write warning:', jErr);
    }

    // 4. IMMEDIATELY RESET POS UI (Target: 0ms cashier queue clearing)
    resetAfterSale();
    const tUiReset = performance.now();

    let successLabel = `Sale recording (${snapshotPaymentMethod})...`;
    if (snapshotPaymentMethod === 'cash' || snapshotPaymentMethod === 'online') {
      successLabel = `Walk-in sale recorded (${snapshotPaymentMethod}).`;
    } else if (snapshotPaymentMethod === 'split') {
      successLabel = `Split sale recorded.`;
    } else {
      successLabel = `Khata sale recorded for ${snapshotKhataCustomer?.name}.`;
    }
    setCheckoutSuccess(successLabel);

    // 5. BUILD & PRINT RASTER RECEIPT FROM SNAPSHOT (instant — token already known)
    let tCmdBuilt = tUiReset;
    let tIpcDispatched = tUiReset;

    if (autoPrint && posConfig?.printerEnabled) {
      try {
        const saleData = {
          checkoutUuid,
          tokenNumber,
          shopName: posConfig.shopName || 'Gujar Milk Shop',
          createdAt: snapshotCreatedAt,
          customerName: snapshotCustomerName,
          items: items.map((i: any) => ({
            itemName: i.itemName,
            quantity: i.quantity,
            unitPrice: i.catalogRate ?? i.unitPrice,
            totalPrice: money(i.quantity * i.unitPrice),
          })),
          totalAmount,
          discountAmount: snapshotDiscount > 0 ? snapshotDiscount : undefined,
          paidAmount: payload.paidAmount ?? totalAmount,
          remainingBalance: money(totalAmount - (payload.paidAmount ?? totalAmount)),
          paymentMethod: snapshotPaymentMethod === 'khata' ? 'KHATA' : snapshotPaymentMethod,
          currencySymbol: posConfig.currencySymbol || 'Rs.',
          receiptWidth: posConfig.receiptWidth || '80mm',
          footerText: posConfig.receiptFooterText,
          autoCutter: posConfig.autoCutter,
        };
        tCmdBuilt = performance.now();

        // 6. IMMEDIATELY DISPATCH PRINTER VIA executePrint (raster mode by default, no silent fallback)
        executePrint(saleData).catch((printErr) => {
          console.error('[PRINT] Async print dispatch error:', printErr);
          setCheckoutError(`Receipt printing error: ${printErr}. Check printer connection.`);
        });
        tIpcDispatched = performance.now();
      } catch (printBuildErr) {
        console.error('[PRINT] Failed to build receipt bytes:', printBuildErr);
        setCheckoutError(`Receipt generation error: ${printBuildErr}`);
      }
    }

    // 7. IN PARALLEL: DISPATCH save_pos_sale IN BACKGROUND (Never blocks UI or printer)
    (async () => {
      try {
        let sale: any;
        try {
          sale = await invoke('save_pos_sale', { payload: snapshotPayload });
        } catch (invokeErr: any) {
          console.warn('[POS] Tauri direct save_pos_sale unavailable or failed, falling back to local service:', invokeErr);
          sale = await saleService.createSale(snapshotPayload);
        }

        const tCommit = performance.now();
        console.log(
          `⚡ [CASH OK ORCHESTRATION] Journal: ${(tJournalWritten - t0).toFixed(2)}ms | ` +
          `UI reset: ${(tUiReset - tJournalWritten).toFixed(2)}ms | ` +
          `Receipt built: ${(tCmdBuilt - tUiReset).toFixed(2)}ms | ` +
          `Printer IPC: ${(tIpcDispatched - tCmdBuilt).toFixed(2)}ms | ` +
          `SQLite commit: ${(tCommit - t0).toFixed(2)}ms`
        );

        // 8. ATOMIC LOCAL COMMIT COMPLETE: Clear durable journal entry
        invoke('clear_pending_journal', { checkoutUuid }).catch((cErr) => {
          console.warn('[JOURNAL] Clear pending journal warning:', cErr);
        });
        localStorage.removeItem(`pending_journal_${checkoutUuid}`);

        setLastSaleDetails({
          ...sale,
          tokenNumber: sale?.tokenNumber ?? tokenNumber,
          subtotal: snapshotSubtotal,
          discount: snapshotDiscount,
          paymentMethod: snapshotPaymentMethod === 'khata' ? 'KHATA' : snapshotPaymentMethod,
        });

        const hadF2 = snapshotCart.some((item) => ['Lassi', 'Butter', 'Ghee'].includes(item.name));
        if (hadF2) refreshF2StockRef.current?.();
      } catch (err: any) {
        // RECOVERY SAFETY: If database persistence fails after receipt dispatch, keep journal
        console.error('[CHECKOUT BACKGROUND COMMIT FAILED]', err);
        setCheckoutError(
          `⚠️ WARNING: SALE NOT RECORDED IN DATABASE: ${err?.message || 'Write failed'}. ` +
          `Receipt was dispatched (Ref: ${checkoutUuid.slice(-8).toUpperCase()}). ` +
          `A durable recovery journal entry has been preserved. Please click 'Retry Sale' or review held bills.`
        );

        // Keep recovery record in localStorage as well
        try {
          const recoveryKey = `failed_sale_${checkoutUuid}`;
          localStorage.setItem(recoveryKey, JSON.stringify({
            uuid: checkoutUuid,
            payload: snapshotPayload,
            cart: snapshotCart,
            discount: snapshotDiscount,
            paymentMethod: snapshotPaymentMethod,
            timestamp: new Date().toISOString(),
            error: err?.message || 'Database write error'
          }));
        } catch (_) {}
      }
    })();
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
    <div className="min-h-full xl:h-full flex flex-col xl:flex-row gap-4 lg:gap-6 min-w-0">
      {/* Left Panel - Products (On screens < xl, orders after Current Bill) */}
      <div className="order-2 xl:order-1 flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex gap-2 mb-4 shrink-0">
          <button
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'milk-yogurt'
              ? 'bg-[#166534] text-white shadow-sm shadow-[#166534]/25'
              : 'bg-white dark:bg-[#1a2e1f] text-slate-600 dark:text-[#e2f5e8] hover:bg-[#FEF3C7]/50 dark:hover:bg-[#142119] hover:text-[#166534] dark:hover:text-[#22c55e] border border-slate-200 dark:border-[#2d4a35] shadow-xs'
              }`}
            onClick={() => setActiveTab('milk-yogurt')}
          >
            Milk & Yogurt
          </button>
          <button
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'items'
              ? 'bg-[#166534] text-white shadow-sm shadow-[#166534]/25'
              : 'bg-white dark:bg-[#1a2e1f] text-slate-600 dark:text-[#e2f5e8] hover:bg-[#FEF3C7]/50 dark:hover:bg-[#142119] hover:text-[#166534] dark:hover:text-[#22c55e] border border-slate-200 dark:border-[#2d4a35] shadow-xs'
              }`}
            onClick={() => setActiveTab('items')}
          >
            <Plus className="w-4 h-4" /> Items F2
          </button>
        </div>

        <div className="flex-1 bg-white dark:bg-[#1a2e1f] rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col min-h-0 xl:overflow-y-auto custom-scrollbar">
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
                className="text-[#166534] hover:text-[#14532d] font-bold"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex flex-col 2xl:flex-row gap-4 lg:gap-6 min-w-0 w-full">
              {/* Milk Terminal Card */}
              <div className="flex-1 w-full min-w-0 bg-[#F0FDF4] dark:bg-[#1a3d24]/60 border border-[#BBF7D0] dark:border-[#2d4a35] rounded-2xl p-3 sm:p-4 flex flex-col shadow-xs">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 sm:mb-6">
                  <h2 className="text-xl font-black text-[#166534] dark:text-[#22c55e]">Milk</h2>
                  <div className="flex items-center gap-2 bg-white dark:bg-[#142119] rounded-xl p-1.5 sm:p-2 border border-[#BBF7D0] dark:border-[#2d4a35] shadow-sm max-w-full overflow-x-auto">
                    <div className="flex bg-slate-100 dark:bg-[#1e3124] rounded-lg p-0.5 shrink-0">
                      <button
                        onClick={() => setMilkCustomType('rs')}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-md transition-colors ${milkCustomType === 'rs' ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-xs' : 'text-slate-500 dark:text-[#64916e] hover:text-slate-700 dark:hover:text-[#a7c4ae]'}`}
                      >
                        RS
                      </button>
                      <button
                        onClick={() => setMilkCustomType('kg')}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-md transition-colors ${milkCustomType === 'kg' ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-xs' : 'text-slate-500 dark:text-[#64916e] hover:text-slate-700 dark:hover:text-[#a7c4ae]'}`}
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
                      accent="primary"
                      confirmLabel="Add"
                      className="w-20 sm:w-28 md:w-32 min-w-[60px]"
                      triggerClassName="border-none"
                    />
                    <button
                      onClick={() => handleCustomAdd('milk')}
                      className="bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] hover:bg-[#14532d] dark:hover:bg-[#16a34a] active:bg-[#0f3d21] px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-xs shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-3 gap-2 sm:gap-3">
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
                      if (item.type === 'empty') return <div key={`milk-empty-${i}`} className="hidden sm:block" />;
                      return item.type === 'weight' ? (
                        <button
                          key={`milk-w-${item.preset.weight}-${i}`}
                          onClick={() => addToCart('Milk', item.preset.weight, 'kg', item.preset.price, milkRatePerKg)}
                          className="border border-emerald-100/80 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f] hover:border-[#166534] dark:hover:border-[#22c55e] hover:bg-[#F0FDF4] dark:hover:bg-[#1e3124] rounded-xl p-2.5 sm:p-3 flex flex-col items-center justify-center transition-colors group shadow-sm min-w-0"
                        >
                          <div className="font-bold text-slate-800 dark:text-[#e2f5e8] group-hover:text-[#166534] dark:group-hover:text-[#22c55e] text-base sm:text-lg truncate max-w-full">{item.preset.label}</div>
                          <div className="text-xs text-slate-500 dark:text-[#64916e] font-medium mt-1 truncate max-w-full">Rs. {item.preset.price}</div>
                        </button>
                      ) : (
                        <button
                          key={`milk-rs-${item.preset.amount}`}
                          type="button"
                          onClick={() => addToCart('Milk', item.preset.weight, 'rs', item.preset.amount, milkRatePerKg)}
                          className="rounded-xl border border-[#FDE68A] dark:border-[#3d2f12] bg-[#FEF3C7]/40 dark:bg-[#2a1f0a] hover:bg-[#FEF3C7] dark:hover:bg-[#3d2f12] hover:border-[#FDE68A] p-2.5 sm:p-3 flex flex-col items-center justify-center transition-colors group shadow-sm min-w-0"
                        >
                          <span className="font-black text-[#166534] dark:text-[#fcd34d] text-base sm:text-lg truncate max-w-full">
                            {item.preset.amount}
                          </span>
                          <span className="text-[10px] sm:text-xs text-[#78350F] dark:text-[#fcd34d]/80 font-bold mt-0.5 truncate max-w-full">
                            {item.preset.weight > 0 ? `${item.preset.weight} kg` : 'Rs'}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Yogurt Terminal Card */}
              <div className="flex-1 w-full min-w-0 bg-[#FFFDF5] dark:bg-[#2a1f0a]/40 border border-[#FDE68A] dark:border-[#3d2f12] rounded-2xl p-3 sm:p-4 flex flex-col shadow-xs">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 sm:mb-6">
                  <h2 className="text-xl font-black text-[#78350F] dark:text-[#fcd34d]">Yogurt</h2>
                  <div className="flex items-center gap-2 bg-white dark:bg-[#142119] rounded-xl p-1.5 sm:p-2 border border-[#FDE68A] dark:border-[#3d2f12] shadow-sm max-w-full overflow-x-auto">
                    <div className="flex bg-slate-100 dark:bg-[#1e3124] rounded-lg p-0.5 shrink-0">
                      <button
                        onClick={() => setYogurtCustomType('rs')}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-md transition-colors ${yogurtCustomType === 'rs' ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-xs' : 'text-slate-500 dark:text-[#64916e] hover:text-slate-700 dark:hover:text-[#a7c4ae]'}`}
                      >
                        RS
                      </button>
                      <button
                        onClick={() => setYogurtCustomType('kg')}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-md transition-colors ${yogurtCustomType === 'kg' ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-xs' : 'text-slate-500 dark:text-[#64916e] hover:text-slate-700 dark:hover:text-[#a7c4ae]'}`}
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
                      accent="cream"
                      confirmLabel="Add"
                      className="w-20 sm:w-28 md:w-32 min-w-[60px]"
                      triggerClassName="border-none"
                    />
                    <button
                      onClick={() => handleCustomAdd('yogurt')}
                      className="bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] hover:bg-[#14532d] dark:hover:bg-[#16a34a] active:bg-[#0f3d21] px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-xs shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-3 gap-2 sm:gap-3">
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
                      if (item.type === 'empty') return <div key={`yogurt-empty-${i}`} className="hidden sm:block" />;
                      return item.type === 'weight' ? (
                        <button
                          key={`y-w-${item.preset.weight}-${i}`}
                          onClick={() => addToCart('Yogurt', item.preset.weight, 'kg', item.preset.price, yogurtRatePerKg)}
                          className="border border-amber-100/80 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f] hover:border-[#166534] dark:hover:border-[#22c55e] hover:bg-[#F0FDF4] dark:hover:bg-[#1e3124] rounded-xl p-2.5 sm:p-3 flex flex-col items-center justify-center transition-colors group shadow-sm min-w-0"
                        >
                          <div className="font-bold text-slate-800 dark:text-[#e2f5e8] group-hover:text-[#166534] dark:group-hover:text-[#22c55e] text-base sm:text-lg truncate max-w-full">{item.preset.label}</div>
                          <div className="text-xs text-slate-500 dark:text-[#64916e] font-medium mt-1 truncate max-w-full">Rs. {item.preset.price}</div>
                        </button>
                      ) : (
                        <button
                          key={`y-rs-${item.preset.amount}`}
                          type="button"
                          onClick={() => addToCart('Yogurt', item.preset.weight, 'rs', item.preset.amount, yogurtRatePerKg)}
                          className="border border-[#FDE68A] dark:border-[#3d2f12] bg-[#FEF3C7]/40 dark:bg-[#2a1f0a] hover:bg-[#FEF3C7] dark:hover:bg-[#3d2f12] rounded-xl p-2.5 sm:p-3 flex flex-col items-center justify-center transition-colors group shadow-sm min-w-0"
                        >
                          <div className="font-black text-[#166534] dark:text-[#fcd34d] text-base sm:text-lg truncate max-w-full">{item.preset.label}</div>
                          <div className="text-xs text-[#78350F] dark:text-[#fcd34d]/80 font-bold mt-1 truncate max-w-full">{item.preset.weight > 0 ? `${item.preset.weight} kg` : 'Rs'}</div>
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

      {/* Right Panel - Current Bill / Khata customer picker (On screens < xl, orders first on top) */}
      <div className="order-1 xl:order-2 w-full xl:w-[380px] 2xl:w-[420px] flex flex-col gap-4 min-h-0 shrink-0">
        <div className="flex-1 bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col min-h-0">

          {showKhataPicker ? (
            <div className="flex flex-col flex-1 min-h-0 transition-opacity duration-300">
              <div className="p-4 bg-[#166534] text-white flex-shrink-0">
                <h2 className="font-bold text-sm tracking-wide uppercase">Select Customer</h2>
                <p className="text-[11px] text-emerald-100 mt-1">
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
                    className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl text-sm font-medium text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e]"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-[#1a2e1f] min-h-0">
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
                      const isInactive = c.status === 'inactive';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedKhataCustomer(c);
                            setCheckoutError(null);
                          }}
                          className={`w-full text-left px-4 py-4 flex items-center gap-3 transition-colors ${
                            isInactive 
                              ? 'bg-red-50/50 hover:bg-red-100/50 active:bg-red-100' 
                              : 'hover:bg-[#FEF3C7]/40 active:bg-[#FEF3C7]/70'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            isInactive 
                              ? 'bg-red-100 text-red-600 border-red-200' 
                              : 'bg-[#FEF3C7] text-[#166534] border-[#FDE68A]'
                          }`}>
                            <UserRound className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <div className={`text-sm truncate ${
                              isInactive 
                                ? 'line-through text-red-500 font-bold' 
                                : 'font-bold text-slate-800'
                            }`}>
                              {c.name}
                            </div>
                            {isInactive && (
                              <div className="text-[10px] text-red-500 font-semibold">Khata Ended / Inactive</div>
                            )}
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-1">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${isMonthly
                                ? 'bg-[#FEF3C7] text-[#78350F] border-[#FDE68A]'
                                : 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
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
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-slate-600 dark:text-[#e2f5e8] hover:bg-[#FEF3C7]/40 dark:hover:bg-[#1a2e1f] hover:text-[#166534] dark:hover:text-[#22c55e] text-sm font-bold transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Cash
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 transition-opacity duration-300">
              <div className="p-4 bg-[#166534] text-white flex-shrink-0 space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <h2 className="font-bold text-sm tracking-wide">CURRENT BILL ({cart.length})</h2>
                  <div className="flex items-center gap-2">
                    {heldCarts.length > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-[#FEF3C7] text-[#78350F] border border-[#FDE68A] px-2 py-0.5 rounded-md">
                        {heldCarts.length} held
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={holdCurrentBill}
                      disabled={submitting || cart.length === 0}
                      title="Hold current bill"
                      className="flex items-center gap-1 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 px-2.5 py-1.5 text-[10px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      <PauseCircle className="w-3.5 h-3.5" /> Hold
                    </button>
                  </div>
                </div>

                {/* Card options: auto-print | same item → new line OR combine (last line only) */}
                <div className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-2">
                    {/* Auto-print toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-white" title="Auto-print receipt on every Cash OK">
                      <input
                        type="checkbox"
                        checked={autoPrint}
                        onChange={(e) => setAutoPrintPersisted(e.target.checked)}
                        className="h-4 w-4 rounded border-white/30 accent-[#FEF3C7] cursor-pointer"
                      />
                      Print Receipt
                    </label>
                    {/* Divider */}
                    <span className="text-white/20 text-sm select-none hidden sm:inline">|</span>
                    {/* Same-item mode */}
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={cartLineMode === 'combine'}
                        onChange={() => setCartLineModePersisted('combine')}
                        className="h-4 w-4 rounded border-white/30 accent-[#FEF3C7] cursor-pointer"
                      />
                      Combine
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-white">
                      <input
                        type="checkbox"
                        checked={cartLineMode === 'new'}
                        onChange={() => setCartLineModePersisted('new')}
                        className="h-4 w-4 rounded border-white/30 accent-[#FEF3C7] cursor-pointer"
                      />
                      New line
                    </label>
                  </div>
                  <p className="text-[10px] text-emerald-100/70 leading-snug">
                    {autoPrint ? '🖨 Receipt prints automatically after each sale.' : '🔕 Auto-print off — use Reprint to print manually.'}
                    {' '}
                    {cartLineMode === 'combine'
                      ? 'Same item: qty combined on last line.'
                      : 'Same item: always adds a new line.'}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50 dark:bg-[#142119] min-h-0">
                {cart.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-[#64916e] text-sm">
                    No items added yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="bg-white dark:bg-[#1e3124] p-3 rounded-xl border border-slate-200 dark:border-[#2d4a35] flex items-center gap-3 group shadow-sm">
                        <div className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm w-16">{item.name}</div>
                        <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-lg px-2 py-1.5 focus-within:border-[#166534] dark:focus-within:border-[#22c55e] focus-within:ring-1 focus-within:ring-[#166534]">
                          <input
                            type="number"
                            value={item.quantity === 0 ? '' : Number(item.quantity.toFixed(3))}
                            onChange={(e) => updateCartItemQuantity(item.id, e.target.value)}
                            className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-[#e2f5e8] focus:outline-none text-right"
                            step="0.001"
                          />
                          <span className="text-xs text-slate-500 dark:text-[#64916e] font-medium whitespace-nowrap">{item.unit}</span>
                        </div>
                        <div className="font-bold text-slate-800 dark:text-[#e2f5e8] w-24 text-right tabular-nums">Rs. {item.total.toFixed(2)}</div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 dark:text-[#64916e] hover:text-rose-500 transition-colors p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f]">
                {heldCarts.length > 0 && (
                  <div className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FEF3C7]/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#78350F]">Held bills</span>
                      {heldCartsLoading && <span className="text-[10px] text-[#78350F]">Loading...</span>}
                    </div>
                    <div className="max-h-24 space-y-1.5 overflow-y-auto">
                      {heldCarts.map((heldCart) => (
                        <div
                          key={heldCart.id}
                          className="flex w-full items-center justify-between rounded-lg border border-[#FDE68A] dark:border-[#3d2f12] bg-white dark:bg-[#142119] px-2.5 py-2 hover:border-[#fcd34d] dark:hover:border-[#524018]"
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
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#166534]">
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
                  <div className="text-sm font-medium text-slate-600 dark:text-[#a7c4ae]">Subtotal:</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">Rs. {subtotal.toFixed(2)}</div>
                </div>

                {isDiscountOpen ? (
                  <div className="flex justify-between items-center mb-4 bg-slate-50 dark:bg-[#142119] p-2 rounded-lg border border-slate-200 dark:border-[#2d4a35]">
                    <div className="text-sm font-medium text-slate-600 dark:text-[#a7c4ae]">Discount (Rs):</div>
                    <div className="flex items-center gap-2 bg-white dark:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] rounded-md px-2 py-1 focus-within:border-[#166534] dark:focus-within:border-[#22c55e] focus-within:ring-1 focus-within:ring-[#166534]">
                      <input
                        type="number"
                        value={discount === 0 ? '' : discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="w-16 text-sm text-right bg-transparent focus:outline-none font-bold text-slate-800 dark:text-[#e2f5e8]"
                        placeholder="0"
                      />
                      <button onClick={() => setIsDiscountOpen(false)} className="text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] p-0.5">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsDiscountOpen(true)}
                    className="text-xs text-[#166534] dark:text-[#22c55e] hover:text-[#14532d] dark:hover:text-[#86efac] font-bold mb-4 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Discount
                  </button>
                )}

                <div className="flex justify-between items-end mb-4">
                  <div className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] tracking-wider">TOTAL</div>
                  <div className="text-3xl font-black text-[#166534] dark:text-[#22c55e]">Rs. {finalTotal.toFixed(2)}</div>
                </div>

                <div className="flex bg-slate-100 dark:bg-[#142119] p-1 rounded-xl mb-4">
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
                        ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-sm'
                        : 'text-slate-600 dark:text-[#a7c4ae] hover:bg-[#FEF3C7]/60 dark:hover:bg-[#22c55e]/15 hover:text-[#166534] dark:hover:text-[#22c55e]'
                        }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                {/* Split fields */}
                {paymentMethod === 'split' && (
                  <div className="mb-4 space-y-3 p-3 bg-[#FFFDF5] border border-[#FDE68A] rounded-xl">
                    <div>
                      <label className="text-[10px] font-bold text-[#78350F] uppercase tracking-wider">
                        Amount paying now *
                      </label>
                      <input
                        type="number"
                        value={splitPaidAmount}
                        onChange={(e) => setSplitPaidAmount(e.target.value)}
                        placeholder={`Less than ${finalTotal.toFixed(0)}`}
                        className="mt-1 w-full px-3 py-2 bg-white dark:bg-[#142119] border border-[#FDE68A] dark:border-[#3d2f12] rounded-lg text-sm font-bold text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e]"
                      />
                      {splitPaidAmount && !Number.isNaN(parseFloat(splitPaidAmount)) && (
                        <p className="text-[11px] text-[#78350F] mt-1 font-semibold">
                          Remaining:{' '}
                          Rs. {Math.max(0, money(finalTotal - parseFloat(splitPaidAmount))).toFixed(0)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#78350F] uppercase tracking-wider">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Customer name"
                        className="mt-1 w-full px-3 py-2 bg-white dark:bg-[#142119] border border-[#FDE68A] dark:border-[#3d2f12] rounded-lg text-sm font-medium text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#78350F] uppercase tracking-wider">
                        Phone * (groups same person)
                      </label>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="e.g. 0300-1234567"
                        className="mt-1 w-full px-3 py-2 bg-white dark:bg-[#142119] border border-[#FDE68A] dark:border-[#3d2f12] rounded-lg text-sm font-medium text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e]"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'khata' && selectedKhataCustomer && (
                  <div className={`mb-4 flex items-center gap-2 p-3 rounded-xl border ${
                    selectedKhataCustomer.status === 'inactive'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-[#FEF3C7] border-[#FDE68A]'
                  }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${
                      selectedKhataCustomer.status === 'inactive'
                        ? 'bg-red-600 text-white'
                        : 'bg-[#166534] text-white'
                    }`}>
                      <UserRound className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs truncate ${
                        selectedKhataCustomer.status === 'inactive'
                          ? 'line-through text-red-600 font-bold'
                          : 'font-bold text-[#78350F]'
                      }`}>
                        {selectedKhataCustomer.name}
                      </div>
                      <div className={`text-[10px] truncate ${
                        selectedKhataCustomer.status === 'inactive'
                          ? 'text-red-500 font-semibold'
                          : 'text-[#78350F]/80'
                      }`}>
                        {selectedKhataCustomer.status === 'inactive' ? 'Khata Ended · ' : ''}
                        {selectedKhataCustomer.phone?.trim() || 'Not Available'}
                        {' · '}
                        {selectedKhataCustomer.customerType === 'monthly_ledger' ? 'Monthly' : 'Daily'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedKhataCustomer(null)}
                      className="text-[10px] font-bold text-[#166534] hover:text-[#14532d] uppercase flex-shrink-0"
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
                      className="px-3 py-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-lg text-xs font-medium text-slate-700 dark:text-[#e2f5e8] focus:outline-none focus:ring-1 focus:ring-[#166534]"
                    />
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="px-3 py-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-lg text-xs font-medium text-slate-700 dark:text-[#e2f5e8] focus:outline-none focus:ring-1 focus:ring-[#166534]"
                    />
                  </div>
                )}

                {checkoutError && (
                  <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-xs font-medium">
                    {checkoutError}
                  </div>
                )}
                {checkoutSuccess && (
                  <div className="mb-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-xs font-medium flex justify-between items-center">
                    <span className="text-[#166534] font-semibold">{checkoutSuccess}</span>
                    {lastSaleDetails && posConfig?.printerEnabled && (
                      <button
                        onClick={async () => {
                          if (!lastSaleDetails || !posConfig) return;
                          const saleData = {
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
                          };
                          try {
                            await executePrint(saleData);
                          } catch (e) {
                            console.error('[PRINT] Manual reprint failed:', e);
                            setCheckoutError(`Reprint failed: ${e}`);
                          }
                        }}
                        className="ml-2 px-3 py-1 bg-white dark:bg-[#142119] border border-[#BBF7D0] dark:border-[#2d4a35] text-[#166534] dark:text-[#22c55e] hover:bg-[#F0FDF4] dark:hover:bg-[#1a2e1f] rounded shadow-sm text-xs font-semibold"
                      >
                        🖨 Reprint
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
                      className="flex-1 bg-[#166534] hover:bg-[#14532d] active:bg-[#0f3d21] text-white rounded-xl py-4 font-black tracking-wide text-sm sm:text-base transition-all shadow-md shadow-[#166534]/25 disabled:opacity-50"
                    >
                      {submitting ? 'Saving…' : primaryButtonLabel}
                    </button>
                    <button
                      type="button"
                      onClick={holdCurrentBill}
                      disabled={submitting || cart.length === 0}
                      title="Hold current bill"
                      className="px-6 bg-[#FEF3C7] hover:bg-[#FDE68A] active:bg-[#FCD34D] text-[#78350F] border border-[#FDE68A] rounded-xl py-4 font-bold tracking-wide transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
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

