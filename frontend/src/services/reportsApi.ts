/**
 * Reports API — reads exclusively from the shared MockDataStore.
 * To switch to a real backend: replace getMockDataStore() with fetch() calls.
 */
import { DateFilterType } from '../types';
import { getMockDataStore, filterByDateRange, toDailyTrend } from './mockDataStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

// ─── Sales API ────────────────────────────────────────────────────────────────
export const getSalesReport = async (filter: DateFilterType) => {
  await new Promise(r => setTimeout(r, 200));
  const { sales, returns } = getMockDataStore();
  const s = filterByDateRange(sales, filter.startDate, filter.endDate);
  const r = filterByDateRange(returns, filter.startDate, filter.endDate);

  const completed = s.filter(x => x.status === 'Completed');
  const totalSales = completed.reduce((acc, x) => acc + x.gross, 0);
  const discounts = completed.reduce((acc, x) => acc + x.discount, 0);
  const netSales = completed.reduce((acc, x) => acc + x.net, 0);
  const refundsTotal = r.reduce((acc, x) => acc + x.amount, 0);
  const cashSales = completed.filter(x => x.paymentMethod === 'Cash').reduce((acc, x) => acc + x.net, 0);
  const creditSales = completed.filter(x => x.paymentMethod === 'Credit').reduce((acc, x) => acc + x.net, 0);
  const onlineSales = completed.filter(x => x.paymentMethod === 'Online').reduce((acc, x) => acc + x.net, 0);
  const totalBills = completed.length;

  const trendData = toDailyTrend(completed.map(x => ({ date: x.date, value: x.net })));
  const catMap: Record<string, number> = {};
  completed.forEach(x => { catMap[x.category] = (catMap[x.category] || 0) + x.net; });
  const productCategoryData = Object.entries(catMap).map(([label, value]) => ({ label, value: Math.round(safeDiv(value, netSales) * 100) }));
  const cashPct = Math.round(safeDiv(cashSales, netSales) * 100);
  const creditPct = Math.round(safeDiv(creditSales, netSales) * 100);
  const onlinePct = 100 - cashPct - creditPct;

  return {
    summary: {
      totalSales, discounts, netSales, refunds: refundsTotal,
      cashSales, creditSales, onlineSales, totalBills,
      averageBillValue: Math.round(safeDiv(netSales, totalBills)),
    },
    trendData,
    paymentMethodData: [
      { label: 'Cash', value: cashPct },
      { label: 'Credit (Khata)', value: creditPct },
      { label: 'Online', value: onlinePct },
    ],
    productCategoryData,
    transactions: s.slice(0, 50).map(x => ({ ...x, status: x.status, refund: 0 })),
  };
};

// ─── Profit & Loss API ────────────────────────────────────────────────────────
export const getProfitAndLossReport = async (filter: DateFilterType) => {
  await new Promise(r => setTimeout(r, 200));
  const { sales, returns, expenses } = getMockDataStore();
  const s = filterByDateRange(sales, filter.startDate, filter.endDate).filter(x => x.status === 'Completed');
  const ret = filterByDateRange(returns, filter.startDate, filter.endDate);
  const exp = filterByDateRange(expenses, filter.startDate, filter.endDate);

  const grossSales = s.reduce((acc, x) => acc + x.gross, 0);
  const discounts = s.reduce((acc, x) => acc + x.discount, 0);
  const returnsAmt = ret.reduce((acc, x) => acc + x.amount, 0);
  const netSales = Math.max(0, grossSales - discounts - returnsAmt);

  const cogs = s.reduce((acc, x) => acc + x.costOfGoods, 0);
  const wastage = Math.round(cogs * 0.03);
  const totalCosts = cogs + wastage;

  const grossProfit = Math.max(0, netSales - totalCosts);

  const operatingExpenses = exp.reduce((acc, x) => acc + x.amount, 0);
  const netProfit = grossProfit - operatingExpenses;
  const margin = netSales === 0 ? 0 : parseFloat(((netProfit / netSales) * 100).toFixed(2));

  // Charts
  const trendRaw = toDailyTrend(s.map(x => ({ date: x.date, value: x.net })));
  const cogsByDay = toDailyTrend(s.map(x => ({ date: x.date, value: x.costOfGoods })));
  const revVsCost = trendRaw.map((t, i) => ({
    label: t.label,
    revenue: t.value,
    cost: cogsByDay[i]?.value || 0,
  }));

  const profitTrend = trendRaw.map((t, i) => ({
    label: t.label,
    value: Math.max(0, t.value - (cogsByDay[i]?.value || 0)),
  }));

  const expByCategory: Record<string, number> = {};
  exp.forEach(x => { expByCategory[x.category] = (expByCategory[x.category] || 0) + x.amount; });
  const expBreakdown = Object.entries(expByCategory).map(([label, value]) => ({ label, value }));

  return {
    revenue: { grossSales, discounts, returns: returnsAmt, netSales },
    costs: { cogs, wastage, otherCosts: 0, totalCosts },
    expenses: {
      operating: operatingExpenses,
      breakdown: expByCategory,
      utilities: expByCategory['Utilities'] || 0,
      salaries: expByCategory['Salaries'] || 0,
      rent: expByCategory['Rent'] || 0,
      totalExpenses: operatingExpenses,
    },
    profit: { grossProfit, netProfit, margin },
    charts: { revVsCost, profitTrend, expBreakdown },
  };
};

// ─── Cash Register API ────────────────────────────────────────────────────────
export const getCashRegisterReport = async (filter: DateFilterType) => {
  await new Promise(r => setTimeout(r, 200));
  const reg = filterByDateRange(getMockDataStore().cashRegister, filter.startDate, filter.endDate);

  const totals = {
    openingCash: reg.length > 0 ? reg[reg.length - 1].openingCash : 0,
    cashSales: reg.reduce((s, r) => s + r.cashSales, 0),
    cashIn: reg.reduce((s, r) => s + r.cashIn, 0),
    cashOut: reg.reduce((s, r) => s + r.cashOut, 0),
    expenses: reg.reduce((s, r) => s + r.expenses, 0),
    refunds: reg.reduce((s, r) => s + r.refunds, 0),
    expectedCash: reg.reduce((s, r) => s + r.expectedCash, 0),
    countedCash: reg.reduce((s, r) => s + r.countedCash, 0),
    variance: reg.reduce((s, r) => s + r.variance, 0),
    closingCash: reg.length > 0 ? reg[0].closingCash : 0,
  };

  const movementData = [...reg].reverse().slice(0, 14).map(r => ({
    label: new Date(r.date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    cashIn: r.cashSales + r.cashIn,
    cashOut: r.cashOut + r.expenses + r.refunds,
    expected: r.expectedCash,
    actual: r.countedCash,
  }));

  return { summary: totals, history: reg, movementData };
};

// ─── Shifts API ───────────────────────────────────────────────────────────────
export const getShiftsReport = async (filter: DateFilterType) => {
  await new Promise(r => setTimeout(r, 200));
  const shifts = filterByDateRange(getMockDataStore().shifts, filter.startDate, filter.endDate);

  const totalHours = shifts.reduce((s, sh) => s + sh.durationHours, 0);
  const totalVariance = shifts.reduce((s, sh) => s + Math.abs(sh.variance), 0);

  const salesByShift = shifts.slice(0, 10).map(sh => ({
    label: sh.id,
    value: sh.cashSales,
  }));

  const varianceByShift = shifts.slice(0, 10).map(sh => ({
    label: sh.id,
    value: Math.abs(sh.variance),
  }));

  // Cashier performance
  const cashierMap: Record<string, { sales: number; hours: number; shifts: number }> = {};
  shifts.forEach(sh => {
    if (!cashierMap[sh.openedBy]) cashierMap[sh.openedBy] = { sales: 0, hours: 0, shifts: 0 };
    cashierMap[sh.openedBy].sales += sh.cashSales;
    cashierMap[sh.openedBy].hours += sh.durationHours;
    cashierMap[sh.openedBy].shifts += 1;
  });
  const byCashier = Object.entries(cashierMap).map(([label, d]) => ({ label, value: d.sales }));

  return {
    summary: {
      totalShifts: shifts.length,
      openShifts: shifts.filter(sh => sh.status === 'Open').length,
      closedShifts: shifts.filter(sh => sh.status === 'Closed').length,
      totalHours,
      openingCash: shifts.length > 0 ? shifts[shifts.length - 1].openingCash : 0,
      expectedCash: shifts.reduce((s, sh) => s + sh.expectedCash, 0),
      countedCash: shifts.reduce((s, sh) => s + sh.countedCash, 0),
      totalVariance,
    },
    shifts,
    salesByShift,
    varianceByShift,
    byCashier,
  };
};

// ─── Expenses API ─────────────────────────────────────────────────────────────
export const getExpensesReport = async (filter: DateFilterType) => {
  await new Promise(r => setTimeout(r, 200));
  const allExp = getMockDataStore().expenses;
  const exp = filterByDateRange(allExp, filter.startDate, filter.endDate);

  const today = new Date().toISOString().split('T')[0];
  const todayExp = allExp.filter(e => e.date === today);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0,0,0,0);
  const weekExp = allExp.filter(e => e.date >= weekStart.toISOString().split('T')[0]);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const monthExp = allExp.filter(e => e.date >= monthStart);

  const total = exp.reduce((s, e) => s + e.amount, 0);
  const catMap: Record<string, number> = {};
  exp.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
  const byCategory = Object.entries(catMap).map(([label, value]) => ({ label, value }));

  const dailyTrend = toDailyTrend(exp.map(e => ({ date: e.date, value: e.amount })));
  const topCategory = byCategory.sort((a, b) => b.value - a.value)[0]?.label || '—';

  return {
    summary: {
      totalExpenses: exp.length,
      totalAmount: total,
      avgExpense: Math.round(safeDiv(total, exp.length)),
      todayAmount: todayExp.reduce((s, e) => s + e.amount, 0),
      thisWeekAmount: weekExp.reduce((s, e) => s + e.amount, 0),
      thisMonthAmount: monthExp.reduce((s, e) => s + e.amount, 0),
      cashExpenses: exp.filter(e => e.paymentMethod === 'Cash').reduce((s, e) => s + e.amount, 0),
      bankExpenses: exp.filter(e => e.paymentMethod === 'Bank Transfer').reduce((s, e) => s + e.amount, 0),
      topCategory,
    },
    expenses: exp,
    byCategory,
    dailyTrend,
  };
};

// ─── Returns API ──────────────────────────────────────────────────────────────
export const getReturnsReport = async (filter: DateFilterType) => {
  await new Promise(r => setTimeout(r, 200));
  const ret = filterByDateRange(getMockDataStore().returns, filter.startDate, filter.endDate);

  const returnAmount = ret.reduce((s, r) => s + r.amount, 0);
  const cashRefunds = ret.filter(r => r.refundMethod === 'Cash').reduce((s, r) => s + r.amount, 0);
  const creditRefunds = returnAmount - cashRefunds;

  const catMap: Record<string, number> = {};
  ret.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + r.amount; });
  const byCategory = Object.entries(catMap).map(([label, value]) => ({ label, value }));

  const reasonMap: Record<string, number> = {};
  ret.forEach(r => { reasonMap[r.reason] = (reasonMap[r.reason] || 0) + 1; });
  const byReason = Object.entries(reasonMap).map(([label, value]) => ({ label, value }));

  const dailyTrend = toDailyTrend(ret.map(r => ({ date: r.date, value: r.amount })));

  return {
    summary: {
      totalReturns: ret.length, returnAmount, cashRefunds, creditRefunds,
      returnedBills: ret.length,
      returnedItems: ret.reduce((s, r) => s + r.items, 0),
    },
    returns: ret,
    dailyTrend,
    byCategory,
    byReason,
  };
};

// ─── Supplier Report API ──────────────────────────────────────────────────────
export const getSupplierReport = async (_filter: DateFilterType) => {
  await new Promise(r => setTimeout(r, 200));
  const supplierNames = [
    { name: 'Noon Dairy Farm', phone: '0300-1234567' },
    { name: 'Punjab Milk Co.', phone: '0321-9876543' },
    { name: 'Sitara Enterprises', phone: '0333-5556667' },
    { name: 'Al-Hamza Dairy', phone: '0345-1112223' },
    { name: 'Shaheen Feeds', phone: '0311-4445556' },
  ];
  const suppliers = supplierNames.map((s, i) => {
    const purchases = 50000 + i * 30000;
    const paid = purchases * 0.75;
    const ret = purchases * 0.03;
    const incentives = purchases * 0.015;
    const outstanding = Math.max(0, purchases - paid - ret);
    const lastDate = new Date(); lastDate.setDate(lastDate.getDate() - i * 3);
    const transactions = Array.from({ length: 8 }).map((_, j) => {
      const d = new Date(); d.setDate(d.getDate() - j * 3);
      const types = ['Purchase', 'Payment', 'Return', 'Incentive'];
      const type = types[j % types.length];
      const amount = 5000 + j * 2000;
      return { id: `TXN-${i}${j}`, date: d.toISOString(), type, amount: type === 'Payment' || type === 'Incentive' ? -amount : amount, balance: outstanding - j * 2000, notes: `${type} entry` };
    });
    return { id: `SUP-${i + 1}`, name: s.name, phone: s.phone, totalPurchases: purchases, paid, returns: ret, incentives, outstanding, lastTransaction: lastDate.toISOString(), status: outstanding <= 0 ? 'Cleared' : 'Pending', transactions };
  });
  const totalPurchases = suppliers.reduce((s, x) => s + x.totalPurchases, 0);
  return {
    summary: {
      totalSuppliers: suppliers.length, totalPurchases,
      totalPaid: suppliers.reduce((s, x) => s + x.paid, 0),
      totalPayable: suppliers.reduce((s, x) => s + (x.totalPurchases - x.paid), 0),
      totalReturns: suppliers.reduce((s, x) => s + x.returns, 0),
      totalIncentives: suppliers.reduce((s, x) => s + x.incentives, 0),
      outstandingBalance: suppliers.reduce((s, x) => s + x.outstanding, 0),
    },
    suppliers,
    purchasesBySupplier: suppliers.map(s => ({ label: s.name.split(' ')[0], value: s.totalPurchases })),
    outstandingBySupplier: suppliers.map(s => ({ label: s.name.split(' ')[0], value: s.outstanding })),
  };
};

// ─── Customer Report API ──────────────────────────────────────────────────────
export const getCustomerReport = async (filter: DateFilterType) => {
  await new Promise(r => setTimeout(r, 200));
  const { sales } = getMockDataStore();
  const s = filterByDateRange(sales, filter.startDate, filter.endDate).filter(x => x.status === 'Completed');

  // Aggregate per customer from actual sales
  const custMap: Record<string, { name: string; totalSales: number; credit: number; cash: number }> = {};
  s.forEach(sale => {
    if (!custMap[sale.customerId]) custMap[sale.customerId] = { name: sale.customer, totalSales: 0, credit: 0, cash: 0 };
    custMap[sale.customerId].totalSales += sale.net;
    if (sale.paymentMethod === 'Credit') custMap[sale.customerId].credit += sale.net;
    if (sale.paymentMethod === 'Cash') custMap[sale.customerId].cash += sale.net;
  });

  const customers = Object.entries(custMap).map(([id, c]) => ({
    id, name: c.name, phone: '0300-0000000',
    totalSales: c.totalSales, paid: c.cash,
    credit: c.credit, returns: 0,
    outstanding: c.credit * 0.4,
    lastPurchase: new Date().toISOString(),
    isActive: true,
  })).sort((a, b) => b.totalSales - a.totalSales);

  const trendData = toDailyTrend(s.map(x => ({ date: x.date, value: x.net })));

  return {
    summary: {
      totalCustomers: customers.length,
      activeCustomers: customers.length,
      totalCustomerSales: customers.reduce((s, c) => s + c.totalSales, 0),
      totalCollected: customers.reduce((s, c) => s + c.paid, 0),
      totalOutstanding: customers.reduce((s, c) => s + c.outstanding, 0),
      creditSales: customers.reduce((s, c) => s + c.credit, 0),
      customerReturns: 0,
    },
    customers,
    topCustomers: customers.slice(0, 5).map(c => ({ label: c.name.split(' ')[0], value: c.totalSales })),
    outstandingChart: customers.filter(c => c.outstanding > 0).map(c => ({ label: c.name.split(' ')[0], value: c.outstanding })),
    trendData,
  };
};

// ─── Inventory Report API ─────────────────────────────────────────────────────
export const getInventoryReport = async () => {
  await new Promise(r => setTimeout(r, 200));
  const { sales } = getMockDataStore();
  const salesLast30 = sales.filter(s => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return s.date >= d.toISOString().split('T')[0];
  });
  const soldByCategory: Record<string, number> = {};
  salesLast30.forEach(s => { soldByCategory[s.category] = (soldByCategory[s.category] || 0) + s.items; });

  const products = [
    { name: 'Full Cream Milk', sku: 'MLK-001', category: 'Milk', supplier: 'Noon Dairy Farm', stock: 142, costPrice: 95, salePrice: 120, minStock: 50 },
    { name: 'Skimmed Milk', sku: 'MLK-002', category: 'Milk', supplier: 'Noon Dairy Farm', stock: 8, costPrice: 90, salePrice: 110, minStock: 30 },
    { name: 'Dahi 1 Kg', sku: 'YGT-001', category: 'Yogurt', supplier: 'Punjab Milk Co.', stock: 0, costPrice: 140, salePrice: 180, minStock: 20 },
    { name: 'Dahi 500g', sku: 'YGT-002', category: 'Yogurt', supplier: 'Punjab Milk Co.', stock: 35, costPrice: 75, salePrice: 95, minStock: 15 },
    { name: 'Lassi 250ml', sku: 'YGT-003', category: 'Yogurt', supplier: 'Sitara Enterprises', stock: 12, costPrice: 30, salePrice: 45, minStock: 25 },
    { name: 'Pure Butter 200g', sku: 'BTR-001', category: 'Butter', supplier: 'Al-Hamza Dairy', stock: 55, costPrice: 180, salePrice: 240, minStock: 20 },
    { name: 'Cream 250ml', sku: 'CRM-001', category: 'Cream', supplier: 'Noon Dairy Farm', stock: 0, costPrice: 120, salePrice: 160, minStock: 15 },
    { name: 'Poly Bags (500)', sku: 'PKG-001', category: 'Packaging', supplier: 'Sitara Enterprises', stock: 200, costPrice: 400, salePrice: 600, minStock: 100 },
    { name: 'Khoya 500g', sku: 'OTH-001', category: 'Other', supplier: 'Al-Hamza Dairy', stock: 22, costPrice: 320, salePrice: 420, minStock: 10 },
    { name: 'Malai 250g', sku: 'CRM-002', category: 'Cream', supplier: 'Noon Dairy Farm', stock: 4, costPrice: 95, salePrice: 130, minStock: 20 },
  ].map(p => {
    const stockStatus = p.stock === 0 ? 'Out of Stock' : p.stock <= p.minStock ? 'Low Stock' : 'In Stock';
    const lastUpdated = new Date(); lastUpdated.setHours(lastUpdated.getHours() - Math.floor(Math.random() * 48));
    return { ...p, inventoryValue: p.stock * p.costPrice, retailValue: p.stock * p.salePrice, stockStatus, lastUpdated: lastUpdated.toISOString() };
  });

  const byCategoryMap: Record<string, { stock: number; value: number }> = {};
  products.forEach(p => {
    if (!byCategoryMap[p.category]) byCategoryMap[p.category] = { stock: 0, value: 0 };
    byCategoryMap[p.category].stock += p.stock;
    byCategoryMap[p.category].value += p.inventoryValue;
  });

  return {
    summary: {
      totalProducts: products.length,
      totalStock: products.reduce((s, p) => s + p.stock, 0),
      lowStockItems: products.filter(p => p.stockStatus === 'Low Stock').length,
      outOfStockItems: products.filter(p => p.stockStatus === 'Out of Stock').length,
      inventoryValue: products.reduce((s, p) => s + p.inventoryValue, 0),
      costValue: products.reduce((s, p) => s + p.inventoryValue, 0),
      estimatedRetailValue: products.reduce((s, p) => s + p.retailValue, 0),
    },
    products,
    categories: ['Milk', 'Yogurt', 'Butter', 'Cream', 'Packaging', 'Other'],
    suppliers: ['Noon Dairy Farm', 'Punjab Milk Co.', 'Sitara Enterprises', 'Al-Hamza Dairy'],
    stockByCategory: Object.entries(byCategoryMap).map(([label, d]) => ({ label, value: d.stock })),
    valueByCategory: Object.entries(byCategoryMap).map(([label, d]) => ({ label, value: d.value })),
    lowStockProducts: products.filter(p => p.stockStatus !== 'In Stock').map(p => ({ label: p.name.split(' ')[0], value: p.stock, max: p.minStock })),
    topSellingProducts: Object.entries(soldByCategory).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6),
  };
};

// ─── Backup API ───────────────────────────────────────────────────────────────
export const getBackupReport = async () => {
  await new Promise(r => setTimeout(r, 200));
  const { backups } = getMockDataStore();
  const successful = backups.filter(b => b.status === 'Success');
  const totalSize = successful.reduce((s, b) => s + b.sizeBytes, 0);
  return {
    summary: {
      totalBackups: backups.length,
      latestBackup: backups[0]?.date,
      successfulBackups: successful.length,
      failedBackups: backups.filter(b => b.status === 'Failed').length,
      totalStorage: `${(totalSize / (1024 * 1024)).toFixed(1)} MB`,
      backupFrequency: 'Every 2 days (Auto)',
    },
    backups,
  };
};

// ─── Re-export legacy alias (do not break old imports) ────────────────────────
export const reportsApi = {
  getSalesReport,
  getProfitAndLossReport,
  getSupplierReport,
  getCustomerReport,
  getInventoryReport,
  getReturnsReport,
  getCashRegisterReport,
  getShiftsReport,
  getExpensesReport,
  getBackupReport,
};
