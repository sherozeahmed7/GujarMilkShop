// Runs the real report controller with isolated records; never opens a database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

let payments = [
  { method: 'cash', amount: 1000, sale: { saleType: 'split' } },
  { method: 'cash', amount: 500, sale: { saleType: 'walk_in' } },
  { method: 'online', amount: 750, sale: { saleType: 'walk_in' } },
];
let returns = [];
let shift = { status: 'Open', openingCash: 500, openedAt: new Date('2026-09-30T06:00:00'), closedAt: null, countedCash: null };
let drawerReceipts = 1500;
let drawerExpenses = 200;
let drawerSuppliers = 300;
let drawerRefunds = 50;
let cashbook = [{ transactionType: 'Receive Amount', amount: 100 }, { transactionType: 'Pay Amount', amount: 75 }];
let costRows = [{ productId: 1, unitCost: 180, date: new Date('2026-09-01') }, { productId: 1, unitCost: 220, date: new Date('2026-09-01') }];
let batches = [];
let selectedSales = null;
let nextSaleId = 0;
const sale = (itemName, quantity, unitPrice, remainingBalance, saleType) => ({
  id: ++nextSaleId,
  totalAmount: quantity * unitPrice, remainingBalance, saleType, createdAt: new Date('2026-09-30T08:00:00'),
  items: [{ id: nextSaleId, itemName, quantity, unitPrice, totalPrice: quantity * unitPrice }], payments: [],
});
const sales = [sale('milk', 10, 250, 1500, 'split'), sale('yogurt', 2, 300, 600, 'ledger_daily'), sale('butter', 1, 1000, 0, 'walk_in')];
const prisma = {
  sale: { findMany: async ({ where }) => {
    assert.equal(where.status.not, 'voided');
    if (!where.items) assert.ok(where.createdAt.gte instanceof Date);
    return where.items ? sales : (selectedSales ?? sales);
  } },
  return: { findMany: async () => returns, aggregate: async ({ where }) => {
    assert.equal(where.status, 'Completed');
    assert.deepEqual(Array.from(where.paymentMethod.in), ['Cash', 'cash']);
    return { _sum: { refundAmount: drawerRefunds } };
  } },
  shift: { findFirst: async () => { throw new Error('Cash in Hand must not query shift openings or counts'); } },
  expensePayment: { aggregate: async () => ({ _sum: { amount: drawerExpenses } }) },
  supplierPayment: { aggregate: async ({ where }) => {
    assert.equal(where.method, 'cash');
    return { _sum: { amount: drawerSuppliers } };
  } },
  cashbookTransaction: { findMany: async ({ where }) => {
    assert.deepEqual(Array.from(where.transactionType.in), ['Receive Amount', 'Pay Amount']);
    return cashbook;
  } },
  expense: { findMany: async () => [] },
  payment: { findMany: async ({ where }) => {
    assert.ok(where.createdAt.gte instanceof Date);
    assert.ok(where.createdAt.lte instanceof Date);
    assert.deepEqual(Array.from(where.status.in), ['completed', 'partial']);
    return payments;
  }, aggregate: async ({ where }) => {
    assert.equal(where.method, 'cash');
    assert.equal(where.sale.status.not, 'voided');
    assert.deepEqual(Array.from(where.status.in), ['completed', 'partial']);
    assert.equal(where.createdAt.gt, undefined);
    assert.equal(where.createdAt.gte, undefined);
    return { _sum: { amount: drawerReceipts } };
  } },
  inventoryProduct: { findMany: async () => [{ id: 1, code: 'MILK', name: 'Milk' }] },
  dailyRate: { findMany: async () => [{ date: new Date('2026-09-01'), milkRate: 250, butterRate: 1000 }] },
  inventoryMovement: { findMany: async ({ where }) => where.product
    ? [{ id: 1, date: new Date('2026-09-01'), product: { code: 'BUTTER', name: 'Butter' }, quantity: 1, unitCost: 700, movementType: 'OPENING' }]
    : where.date ? [] : costRows },
  butterGheeConversion: { findMany: async () => [] },
  milkProductDailyStock: { findMany: async () => batches },
};
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const requireMock = name => {
    if (name.endsWith('/config/database')) return { prisma };
    if (name.endsWith('/utils/apiResponse')) return { ApiResponse: { success: (_res, _message, data) => data } };
    if (name.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')));
    throw new Error(`Unexpected dependency: ${name}`);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, require: requireMock, Date, console }, { filename });
  return module.exports;
}

(async () => {
  const { averageInventoryCost } = load('src/utils/inventoryCost.ts');
  assert.equal(averageInventoryCost([{ unitCost: null }, { unitCost: 0 }, ...costRows]), 200);
  assert.equal(averageInventoryCost([]), 0);
  const { ReportsController } = load('src/controllers/reports.controller.ts');
  const run = () => ReportsController.profitLoss({ query: { from: '2026-09-01', to: '2026-09-30' } }, {}, e => { throw e; });
  let report = await run();
  assert.equal(report.summary.borrowedAmount, 2100, 'Partial milk plus unpaid yogurt; paid butter excluded');
  assert.equal(report.summary.milkInventoryUnitCost, 200);
  assert.equal(report.summary.cogs, 3100, 'Milk 2000 + yogurt 400 + existing butter cost 700');
  assert.equal(report.summary.cashInHand, 975, 'All cash 1500 + other received 100 - expenses 200 - suppliers 300 - refunds 50 - other paid 75; shift opening not counted twice');
  assert.equal(report.summary.amountCollected, 2250, 'Combined collections still include online');
  assert.equal(report.summary.netProfit, 1000);
  sales[0].remainingBalance = 100;
  report = await run();
  assert.equal(report.summary.borrowedAmount, 700, 'Later settlement reduces the outstanding balance');
  returns = [{ id: 1, saleId: 1, date: '2026-09-30', createdAt: new Date('2026-09-30T10:00:00'), refundAmount: 250, billNumber: '1', items: [{ id: 10, name: 'Milk', returnQty: 1, refundAmount: 250, unitPrice: 250 }] }];
  report = await run();
  assert.equal(report.returnsSummary.totalCogsReversed, 200);
  assert.equal(report.summary.cogs, 2900, 'Returns reverse the same Inventory Cost');
  drawerExpenses += 100;
  report = await run();
  assert.equal(report.summary.cashInHand, 875, 'Paying an expense reduces drawer cash');
  payments = [{ method: 'online', amount: 750, sale: { saleType: 'walk_in' } }];
  report = await run();
  assert.equal(report.summary.cashInHand, 875, 'Drawer snapshot is independent of period collections');
  shift = { ...shift, status: 'Closed', countedCash: 1200, closedAt: new Date('2026-09-30T18:00:00') };
  drawerReceipts = 0;
  drawerExpenses = 0;
  drawerSuppliers = 100;
  drawerRefunds = 0;
  cashbook = [];
  report = await run();
  assert.equal(report.summary.cashInHand, -100, 'Existing cash payments remain counted even when a shift is closed; negative balance is not hidden');
  shift = null;
  drawerReceipts = 1500;
  drawerExpenses = 200;
  drawerSuppliers = 300;
  drawerRefunds = 50;
  cashbook = [{ transactionType: 'Receive Amount', amount: 100 }, { transactionType: 'Pay Amount', amount: 75 }];
  report = await run();
  assert.equal(report.summary.cashInHand, 975, 'No shift: all recorded inflows minus outflows');
  assert.equal(report.summary.drawerCashBreakdown.startingCash, undefined);
  drawerReceipts = drawerExpenses = drawerSuppliers = drawerRefunds = 0;
  cashbook = [];
  report = await run();
  assert.equal(report.summary.cashInHand, 0, 'No cash records produces zero');
  costRows = [];
  report = await run();
  assert.equal(report.summary.milkCostAvailable, false);
  assert.equal(report.summary.milkInventoryUnitCost, 0, 'No guessed milk cost');
  costRows = [{ productId: 1, unitCost: 200, date: new Date('2026-09-01') }];
  batches = [{ date: new Date('2026-09-30T00:00:00'), milkTotal: 10, lassiProduced: 10, butterProduced: 2, lassiSold: 0 }];
  sales.push(sale('lassi', 1.5, 70, 0, 'walk_in'));
  report = await run();
  const lassi = report.productProfitability.find(product => product.product === 'lassi');
  assert.equal(lassi.revenue, 105);
  assert.equal(lassi.cogs, 105);
  assert.equal(lassi.grossProfit, 0);
  assert.equal(lassi.margin, 0);
  assert.equal(lassi.calculationLines[0].unitCost, 70);
  assert.equal(lassi.calculationLines[0].cost, 105);
  assert.equal(report.f2CostAllocation.batches[0].lassiCost, 105);
  assert.equal(report.f2CostAllocation.batches[0].butterCost, 1895);
  const originalButterCost = report.productProfitability.find(product => product.product === 'butter').cogs;
  selectedSales = [sales[sales.length - 1]];
  returns = [];
  report = await run();
  assert.equal(report.summary.cogs, 105, 'Selected sales retain cost from full F2 history');
  selectedSales = [];
  returns = [{ id: 2, saleId: sales[2].id, date: '2026-09-30', createdAt: new Date('2026-09-30T10:00:00'), refundAmount: 1000, billNumber: '3', items: [{ id: 11, name: 'Butter', returnQty: 1, refundAmount: 1000, unitPrice: 1000 }] }];
  report = await run();
  assert.equal(report.summary.cogs, -originalButterCost, 'Return-only period reverses historical F2 cost');
  assert.equal(report.productProfitability[0].quantitySold, -1);
  console.log('P&L regression checks passed: unpaid sales, Inventory Cost, all existing cash inflows/outflows without shift dependence.');
})().catch(error => { console.error(error); process.exitCode = 1; });
