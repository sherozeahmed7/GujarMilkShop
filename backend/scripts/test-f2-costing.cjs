const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, Date };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/utils/f2Costing.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const calculate = context.exports.calculateF2Costs;
const date = (day, hour = 0) => new Date(2026, 8, day, hour);
const batch = (day, milkTotal = 20, butterProduced = 2, lassiProduced = 10) => ({ date: date(day), milkTotal, lassiProduced, lassiSold: 0, butterProduced });
const sale = (id, day, itemName, quantity, unitPrice = 200, hour = 12) => ({ id, createdAt: date(day, hour), items: [{ id, itemName, quantity, unitPrice, totalPrice: quantity * unitPrice }] });
const base = { asOf: date(3), milkUnitCost: 200, batches: [batch(1)], sales: [sale(1, 1, 'lassi', 10)], returns: [], conversions: [], movements: [] };
const cents = value => Math.round(value * 100);

// User example: 4,000 milk - 2,000 Lassi recovery = 2,000 butter / 2kg = 1,000/kg.
let result = calculate(base);
assert.equal(result.allocations[0].milkCost, 4000);
assert.equal(result.allocations[0].lassiRevenue, 2000);
assert.equal(result.allocations[0].lassiCost, 2000);
assert.equal(result.allocations[0].lassiProfit, 0);
assert.equal(result.allocations[0].butterCost, 2000);
assert.equal(result.allocations[0].butterUnitCost, 1000);
assert.equal(result.saleCosts.get(1).cost, 2000);
assert.equal(result.closingCosts.butter.cost, 2000);
assert.equal(result.allocations[0].provisional, false);
assert.equal(result.warnings.length, 0);

// Today is pending; tomorrow completes the exact same data without creating a shift.
const today = calculate({ ...base, asOf: date(1, 15) });
assert.equal(today.allocations[0].provisional, true);
assert.equal(today.saleCosts.get(1).provisional, true);
assert.equal(calculate({ ...base, asOf: date(2) }).allocations[0].provisional, false);

// More Lassi revenue reduces today's butter cost in real time, not by output weight.
result = calculate({ ...base, sales: [...base.sales, sale(2, 1, 'lassi', 5, 200, 15)] });
assert.equal(result.allocations[0].lassiCost, 3000);
assert.equal(result.allocations[0].butterCost, 1000);
assert.equal(result.allocations[0].butterUnitCost, 500);
result = calculate({ ...base, sales: [sale(1, 1, 'lassi', 10, 500)] });
assert.equal(result.allocations[0].lassiCost, 4000);
assert.equal(result.allocations[0].lassiProfit, 1000);
assert.equal(result.allocations[0].butterCost, 0);

// Unsold Lassi holds no recovery cost and never carries that cost to tomorrow.
result = calculate({ ...base, batches: [batch(1, 20, 2, 30)] });
assert.equal(result.saleCosts.get(1).cost, 2000);
assert.equal(result.closingCosts['lassi:2026-09-01'].cost, 0);
assert.equal(result.closingCosts['lassi:2026-09-01'].quantity, 20);

// Yesterday's butter cost carries forward; today's Lassi only recovers today's milk.
result = calculate({ ...base, batches: [batch(1), batch(2, 10)], sales: [...base.sales, sale(2, 2, 'lassi', 5, 200), sale(3, 2, 'butter', 4, 1500, 15)] });
assert.equal(result.allocations[0].butterCost, 2000);
assert.equal(result.allocations[1].butterCost, 1000);
assert.equal(result.saleCosts.get(3).cost, 3000);
assert.equal(result.closingCosts.butter.cost, 0);

// Ghee receives residual butter cost; no second milk charge.
result = calculate({ ...base,
  conversions: [{ id: 1, date: date(2), createdAt: date(2, 8), butterUsed: 2, gheeProduced: 1.5 }],
  sales: [...base.sales, sale(2, 2, 'ghee', 1.5, 2000)],
});
assert.equal(result.conversions[0].transferredCost, 2000);
assert.equal(result.saleCosts.get(2).cost, 2000);
assert.equal(cents(result.saleCosts.get(1).cost + result.saleCosts.get(2).cost), 400000);

// Recorded butter output is not duplicated by the Inventory stock-in path.
result = calculate({ ...base, movements: [{ id: 1, date: date(1), product: 'BUTTER', quantity: 2, unitCost: 900, movementType: 'STOCK_IN' }], sales: [...base.sales, sale(2, 1, 'butter', 2)] });
assert.equal(result.allocations[0].butterKg, 2);
assert.equal(result.saleCosts.get(2).cost, 2000);

// Refund reduces recovery of the original milk batch, not the new day's batch.
result = calculate({ ...base, batches: [batch(1), batch(2, 10)],
  returns: [{ id: 1, saleId: 1, date: '2026-09-02', createdAt: date(2, 14), items: [{ id: 10, name: 'Lassi', returnQty: 2, refundAmount: 400 }] }],
});
assert.equal(result.allocations[0].lassiCost, 1600);
assert.equal(result.allocations[0].butterCost, 2400);
assert.equal(result.allocations[1].butterCost, 2000);
assert.equal(result.returnCosts.get(10).cost, 400);
assert.equal(result.saleCosts.get(1).cost - result.returnCosts.get(10).cost, 1600);

// Above-cost revenue and refunds still reconcile exactly despite fractional shares.
result = calculate({ ...base, sales: [sale(1, 1, 'lassi', 10, 501.11), sale(2, 1, 'lassi', 3, 201.23)],
  returns: [{ id: 1, saleId: 1, date: '2026-09-02', createdAt: date(2, 14), items: [{ id: 10, name: 'Lassi', returnQty: 1, refundAmount: 501.11 }] }],
});
assert.equal(cents([...result.saleCosts.values()].reduce((sum, q) => sum + q.cost, 0) - result.returnCosts.get(10).cost), 400000);

// Historical batches use their own dated milk cost; no future price leakage.
result = calculate({ ...base, milkUnitCost: 999, milkCostsByDate: { '2026-09-01': 200 } });
assert.equal(result.allocations[0].milkCost, 4000);

// No Lassi sales: all milk cost belongs to butter; no butter: don't invent a divisor.
result = calculate({ ...base, sales: [] });
assert.equal(result.allocations[0].butterCost, 4000);
result = calculate({ ...base, batches: [batch(1, 20, 0)] });
assert.equal(result.allocations[0].unallocatedCost, 2000);
assert.ok(result.warnings.length > 0);
result = calculate({ ...base, batches: [], sales: [sale(1, 1, 'butter', 2)] });
assert.equal(result.saleCosts.get(1).missingQuantity, 2);
assert.ok(result.warnings.length > 0);
console.log('F2 recovery checks passed: daily revenue recovery, remaining butter cost, day end, carry-over, ghee, refunds, rounding and historical milk costs.');
