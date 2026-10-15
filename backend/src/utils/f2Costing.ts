export type F2Product = 'lassi' | 'butter' | 'ghee';
type Pool = { quantity: number; cost: number; provisional?: boolean };
type Line = { id: number; itemName: string; quantity: number; totalPrice: number; unitPrice: number };
export type F2CostQuote = { cost: number; unitCost: number; missingQuantity: number; basis: string; provisional?: boolean };
export type F2CostInput = {
  milkUnitCost: number;
  milkCostsByDate?: Record<string, number>;
  asOf?: Date;
  batches: { date: Date; milkTotal: number; lassiProduced: number; lassiSold: number; butterProduced: number }[];
  movements: { id: number; date: Date; product: string; quantity: number; unitCost: number | null; movementType: string; supplierId?: number | null }[];
  conversions: { id: number; date: Date; createdAt: Date; butterUsed: number; gheeProduced: number }[];
  sales: { id: number; createdAt: Date; items: Line[] }[];
  returns: { id: number; saleId: number | null; date: string; createdAt: Date; items: { id: number; name: string; returnQty: number; refundAmount: number }[] }[];
};

const money = (n: number) => Math.round(n * 100) / 100;
const qty = (n: number) => Math.round(n * 1000000) / 1000000;
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const isF2 = (name: string): name is F2Product => ['lassi', 'butter', 'ghee'].includes(name);
const nameOf = (name: string) => name.trim().toLowerCase();
const businessTime = (date: string, timestamp: Date) => {
  const result = new Date(`${date}T00:00:00`);
  result.setHours(timestamp.getHours(), timestamp.getMinutes(), timestamp.getSeconds(), timestamp.getMilliseconds());
  return result.getTime();
};

/** Daily Lassi revenue recovers milk cost first; today's butter carries the remainder.
 * Current-day recovery is provisional. Closed days use their recorded revenue.
 * Butter and ghee use moving-average carrying cost. Lassi does not carry cost overnight.
 */
export function calculateF2Costs(input: F2CostInput) {
  const warnings = new Set<string>();
  const saleCosts = new Map<number, F2CostQuote>();
  const returnCosts = new Map<number, F2CostQuote>();
  const today = dayKey(input.asOf || new Date());
  const lassiSaleCosts = new Map<number, F2CostQuote>();
  const lassiReturnCosts = new Map<number, F2CostQuote>();
  const pools = new Map<string, Pool>();
  const poolFor = (product: F2Product, date: string) => {
    const key = product === 'lassi' ? `lassi:${date}` : product;
    if (!pools.has(key)) pools.set(key, { quantity: 0, cost: 0 });
    return pools.get(key)!;
  };
  const add = (product: F2Product, date: string, quantity: number, cost: number, provisional = false) => {
    const pool = poolFor(product, date);
    pool.quantity = qty(pool.quantity + quantity);
    pool.cost = money(pool.cost + cost);
    pool.provisional = Boolean(pool.provisional || provisional);
  };
  const take = (product: F2Product, date: string, quantity: number): F2CostQuote => {
    const pool = poolFor(product, date);
    const used = Math.min(quantity, pool.quantity);
    const unitCost = pool.quantity > 0 ? pool.cost / pool.quantity : 0;
    const provisional = Boolean(pool.provisional);
    // Taking the last quantity also takes the rounding remainder.
    const cost = used === pool.quantity ? pool.cost : money(used * unitCost);
    pool.quantity = qty(pool.quantity - used);
    pool.cost = money(pool.cost - cost);
    if (pool.quantity === 0) pool.provisional = false;
    const missingQuantity = qty(Math.max(0, quantity - used));
    if (missingQuantity > 0) warnings.add(`${date}: ${product} is missing production or opening stock for ${missingQuantity} kg.`);
    return { cost, unitCost, missingQuantity, provisional, basis: 'Carrying cost of production and recorded stock' };
  };

  const batches = new Map<string, F2CostInput['batches'][number]>();
  for (const batch of input.batches) {
    const key = dayKey(batch.date);
    const previous = batches.get(key);
    batches.set(key, previous ? { ...batch, milkTotal: previous.milkTotal + batch.milkTotal, lassiProduced: previous.lassiProduced + batch.lassiProduced, lassiSold: previous.lassiSold + batch.lassiSold, butterProduced: previous.butterProduced + batch.butterProduced } : { ...batch });
  }
  // POS can sell Lassi before a final production quantity is entered. The sold
  // quantity is a known minimum output, never an extra quantity added to production.
  const lassiSales = new Map<string, number>();
  type RecoveryLine = { id: number; quantity: number; amount: number; kind: 'Sale' | 'Return'; time: number };
  const recoveryLines = new Map<string, RecoveryLine[]>();
  const saleDates = new Map<number, string>();
  for (const sale of input.sales) {
    const date = dayKey(sale.createdAt);
    saleDates.set(sale.id, date);
    const total = sale.items.filter(i => nameOf(i.itemName) === 'lassi').reduce((sum, i) => sum + i.quantity, 0);
    lassiSales.set(date, (lassiSales.get(date) || 0) + total);
    for (const line of sale.items.filter(i => nameOf(i.itemName) === 'lassi')) {
      const lines = recoveryLines.get(date) || [];
      lines.push({ id: line.id, quantity: line.quantity, amount: money(line.totalPrice ?? line.quantity * line.unitPrice), kind: 'Sale', time: sale.createdAt.getTime() });
      recoveryLines.set(date, lines);
    }
  }
  for (const returned of input.returns) {
    const originalDate = returned.saleId === null ? undefined : saleDates.get(returned.saleId);
    if (!originalDate) continue;
    for (const line of returned.items.filter(i => nameOf(i.name) === 'lassi')) {
      const lines = recoveryLines.get(originalDate) || [];
      lines.push({ id: line.id, quantity: line.returnQty, amount: money(line.refundAmount), kind: 'Return', time: businessTime(returned.date, returned.createdAt) });
      recoveryLines.set(originalDate, lines);
    }
  }
  const productionMoves = new Set<number>();
  const inventoryOutput = new Map<string, { lassi: number; butter: number }>();
  for (const move of input.movements) {
    const product = nameOf(move.product);
    const date = dayKey(move.date);
    // Inventory stock-in without a supplier is the existing F2 production entry
    // path. Use it only when there is a milk batch for that day; never count it twice.
    if (move.quantity > 0 && ['STOCK_IN', 'ADJUSTMENT'].includes(move.movementType) && !move.supplierId && (batches.get(date)?.milkTotal || 0) > 0 && (product === 'lassi' || product === 'butter')) {
      const output = inventoryOutput.get(date) || { lassi: 0, butter: 0 };
      output[product] += move.quantity;
      inventoryOutput.set(date, output);
      productionMoves.add(move.id);
    }
  }
  type Event = { time: number; priority: number; id: number; run: () => void };
  const events: Event[] = [];
  const allocations: { date: string; milkKg: number; milkUnitCost: number; milkCost: number; lassiKg: number; butterKg: number; lassiRevenue: number; lassiCost: number; lassiProfit: number; butterCost: number; butterUnitCost: number; unallocatedCost: number; provisional: boolean }[] = [];
  for (const [date, batch] of batches) {
    const lassiKg = Math.max(0, batch.lassiProduced, batch.lassiSold, lassiSales.get(date) || 0, inventoryOutput.get(date)?.lassi || 0);
    const butterKg = Math.max(0, batch.butterProduced, inventoryOutput.get(date)?.butter || 0);
    if (batch.milkTotal <= 0) {
      if (lassiKg + butterKg > 0) warnings.add(`${date}: F2 output has no recorded milk allocation.`);
      continue;
    }
    const milkUnitCost = input.milkCostsByDate?.[date] ?? input.milkUnitCost;
    if (milkUnitCost <= 0) warnings.add(`${date}: milk inventory cost is missing.`);
    const milkCost = money(batch.milkTotal * milkUnitCost);
    const lines = (recoveryLines.get(date) || []).sort((a, b) => a.time - b.time || a.id - b.id);
    const lassiRevenue = money(lines.reduce((sum, line) => sum + (line.kind === 'Sale' ? line.amount : -line.amount), 0));
    if (lassiRevenue < 0) warnings.add(`${date}: Lassi refunds exceed recorded Lassi revenue.`);
    const lassiCost = Math.min(milkCost, Math.max(0, lassiRevenue));
    const remaining = money(milkCost - lassiCost);
    const butterCost = butterKg > 0 ? remaining : 0;
    const unallocatedCost = butterKg > 0 ? 0 : remaining;
    const provisional = date >= today;
    const lassiProfit = money(lassiRevenue - lassiCost);
    allocations.push({ date, milkKg: batch.milkTotal, milkUnitCost, milkCost, lassiKg, butterKg, lassiRevenue, lassiCost, lassiProfit, butterCost, butterUnitCost: butterKg > 0 ? butterCost / butterKg : 0, unallocatedCost, provisional });
    if (unallocatedCost > 0) warnings.add(`${date}: Rs. ${unallocatedCost.toFixed(2)} milk cost is waiting for today's butter production quantity.`);
    if (batch.lassiSold > (lassiSales.get(date) || 0) + 0.001) warnings.add(`${date}: day-end Lassi quantity exceeds recorded sale quantities; recovery uses recorded bill amounts only.`);
    // Allocate recovery across actual sale/refund amounts, not produced kg. This
    // recognizes all recovery even when some Lassi remains unsold at day end.
    const factor = lassiRevenue > 0 ? lassiCost / lassiRevenue : 0;
    let cumulativeRevenue = 0;
    let cumulativeCost = 0;
    for (const line of lines) {
      cumulativeRevenue = money(cumulativeRevenue + (line.kind === 'Sale' ? line.amount : -line.amount));
      const nextCost = money(cumulativeRevenue * factor);
      const cost = money(line.kind === 'Sale' ? nextCost - cumulativeCost : cumulativeCost - nextCost);
      cumulativeCost = nextCost;
      const quote = { cost, unitCost: line.quantity > 0 ? cost / line.quantity : 0, missingQuantity: 0, provisional, basis: line.kind === 'Sale' ? 'Daily milk cost recovered by Lassi revenue' : 'Reversal of Lassi milk-cost recovery' };
      (line.kind === 'Sale' ? lassiSaleCosts : lassiReturnCosts).set(line.id, quote);
    }
    events.push({ time: new Date(`${date}T00:00:00`).getTime(), priority: 0, id: 0, run: () => {
      if (lassiKg > 0) add('lassi', date, lassiKg, 0);
      if (butterKg > 0) add('butter', date, butterKg, butterCost, provisional);
    } });
  }
  for (const move of input.movements) {
    const product = nameOf(move.product);
    if (!isF2(product) || productionMoves.has(move.id)) continue;
    const date = dayKey(move.date);
    if (move.quantity > 0 && ['OPENING', 'STOCK_IN', 'PURCHASE', 'ADJUSTMENT'].includes(move.movementType)) {
      if (!(move.unitCost && move.unitCost > 0)) warnings.add(`${date}: ${product} stock receipt has no recorded cost.`);
      events.push({ time: move.date.getTime(), priority: 1, id: move.id, run: () => add(product, date, move.quantity, money(move.quantity * (move.unitCost || 0))) });
    } else if (move.quantity < 0 && ['WASTAGE', 'ADJUSTMENT'].includes(move.movementType)) {
      events.push({ time: move.date.getTime(), priority: 4, id: move.id, run: () => { take(product, date, -move.quantity); } });
    }
  }
  const conversionDetails: { date: string; butterKg: number; gheeKg: number; transferredCost: number; gheeUnitCost: number }[] = [];
  for (const conversion of input.conversions) {
    const date = dayKey(conversion.date);
    events.push({ time: businessTime(date, conversion.createdAt), priority: 2, id: conversion.id, run: () => {
      if (conversion.butterUsed <= 0 || conversion.gheeProduced <= 0) return;
      const used = take('butter', date, conversion.butterUsed);
      add('ghee', date, conversion.gheeProduced, used.cost, used.provisional);
      conversionDetails.push({ date, butterKg: conversion.butterUsed, gheeKg: conversion.gheeProduced, transferredCost: used.cost, gheeUnitCost: used.cost / conversion.gheeProduced });
    } });
  }
  const originalCosts = new Map<string, { quantity: number; cost: number; provisional?: boolean }>();
  for (const sale of input.sales) {
    const date = dayKey(sale.createdAt);
    events.push({ time: sale.createdAt.getTime(), priority: 3, id: sale.id, run: () => {
      for (const line of sale.items) {
        const product = nameOf(line.itemName);
        if (!isF2(product) || line.quantity <= 0) continue;
        const inventoryQuote = take(product, date, line.quantity);
        const quote = product === 'lassi' && lassiSaleCosts.has(line.id)
          ? { ...lassiSaleCosts.get(line.id)!, missingQuantity: inventoryQuote.missingQuantity }
          : inventoryQuote;
        saleCosts.set(line.id, quote);
        const key = `${sale.id}:${product}`;
        const existing = originalCosts.get(key) || { quantity: 0, cost: 0 };
        originalCosts.set(key, { quantity: qty(existing.quantity + line.quantity), cost: money(existing.cost + quote.cost), provisional: Boolean(existing.provisional || quote.provisional) });
      }
    } });
  }
  for (const returned of input.returns) {
    events.push({ time: businessTime(returned.date, returned.createdAt), priority: 4, id: returned.id, run: () => {
      for (const line of returned.items) {
        const product = nameOf(line.name);
        if (!isF2(product) || line.returnQty <= 0) continue;
        const original = originalCosts.get(`${returned.saleId}:${product}`);
        const quantity = Math.min(line.returnQty, original?.quantity || 0);
        const unitCost = original && original.quantity > 0 ? original.cost / original.quantity : 0;
        const cost = original && quantity === original.quantity ? original.cost : money(quantity * unitCost);
        const missingQuantity = qty(line.returnQty - quantity);
        if (missingQuantity > 0) warnings.add(`${returned.date}: ${product} return has no matching original sale quantity.`);
        const recoveryQuote = product === 'lassi' ? lassiReturnCosts.get(line.id) : undefined;
        if (original) { original.quantity = qty(original.quantity - quantity); original.cost = money(original.cost - (recoveryQuote?.cost ?? cost)); }
        add(product, returned.date, line.returnQty, recoveryQuote ? 0 : cost, original?.provisional);
        returnCosts.set(line.id, recoveryQuote ? { ...recoveryQuote, missingQuantity } : { cost, unitCost, missingQuantity, provisional: original?.provisional, basis: 'Reversal of original sale cost' });
      }
    } });
  }
  events.sort((a, b) => a.time - b.time || a.priority - b.priority || a.id - b.id).forEach(event => event.run());
  return { saleCosts, returnCosts, allocations, conversions: conversionDetails, warnings: [...warnings], closingCosts: Object.fromEntries(pools) };
}
