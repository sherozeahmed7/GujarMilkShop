import { Prisma } from '@prisma/client';
import {
  WALK_IN_CUSTOMER_CLOUD_UUID,
  WALK_IN_CUSTOMER_NAME,
  WALK_IN_CUSTOMER_TYPE,
} from '../config/walkInCustomer';
import { SyncQueueService } from '../services/syncQueue.service';
import { getDeviceId } from '../utils/deviceId';

export const WALK_IN_CUSTOMER_MIGRATION_KEY = 'walk_in_customer_canonical_v1';
export const WALK_IN_CUSTOMER_MIGRATION_VERSION = 1;

type Tx = Prisma.TransactionClient;

interface AggregateRow {
  saleCount: bigint | number;
  gross: number | null;
  paid: number | null;
  remaining: number | null;
  returnCount: bigint | number;
  returns: number | null;
  saleItems: bigint | number;
  payments: bigint | number;
}

interface MonthlyRow {
  month: string;
  saleCount: bigint | number;
  gross: number | null;
  paid: number | null;
  remaining: number | null;
  returnCount: bigint | number;
  returns: number | null;
}

export interface FinancialSnapshot {
  totals: {
    saleCount: number;
    gross: number;
    paid: number;
    remaining: number;
    returnCount: number;
    returns: number;
    saleItems: number;
    payments: number;
  };
  monthly: Record<string, Pick<FinancialSnapshot['totals'], 'saleCount' | 'gross' | 'paid' | 'remaining' | 'returnCount' | 'returns'>>;
}

function finite(value: unknown): number {
  const result = Number(value ?? 0);
  if (!Number.isFinite(result)) throw new Error(`Invalid financial snapshot value: ${String(value)}`);
  return result;
}

export async function getFinancialSnapshot(tx: Tx): Promise<FinancialSnapshot> {
  const [aggregate] = await tx.$queryRaw<AggregateRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "Sale") AS "saleCount",
      (SELECT COALESCE(SUM("totalAmount"), 0) FROM "Sale") AS "gross",
      (SELECT COALESCE(SUM("paidAmount"), 0) FROM "Sale") AS "paid",
      (SELECT COALESCE(SUM("remainingBalance"), 0) FROM "Sale") AS "remaining",
      (SELECT COUNT(*) FROM "Return") AS "returnCount",
      (SELECT COALESCE(SUM("refundAmount"), 0) FROM "Return") AS "returns",
      (SELECT COUNT(*) FROM "SaleItem") AS "saleItems",
      (SELECT COUNT(*) FROM "Payment") AS "payments"
  `;

  const saleMonths = await tx.$queryRaw<MonthlyRow[]>`
    SELECT
      strftime('%Y-%m', "createdAt" / 1000, 'unixepoch') AS "month",
      COUNT(*) AS "saleCount",
      COALESCE(SUM("totalAmount"), 0) AS "gross",
      COALESCE(SUM("paidAmount"), 0) AS "paid",
      COALESCE(SUM("remainingBalance"), 0) AS "remaining",
      0 AS "returnCount",
      0 AS "returns"
    FROM "Sale"
    GROUP BY 1
  `;
  const returnMonths = await tx.$queryRaw<MonthlyRow[]>`
    SELECT
      substr("date", 1, 7) AS "month",
      0 AS "saleCount",
      0 AS "gross",
      0 AS "paid",
      0 AS "remaining",
      COUNT(*) AS "returnCount",
      COALESCE(SUM("refundAmount"), 0) AS "returns"
    FROM "Return"
    GROUP BY 1
  `;

  const monthly: FinancialSnapshot['monthly'] = {};
  for (const row of [...saleMonths, ...returnMonths]) {
    const month = String(row.month || 'unknown');
    const current = monthly[month] || {
      saleCount: 0, gross: 0, paid: 0, remaining: 0, returnCount: 0, returns: 0,
    };
    current.saleCount += finite(row.saleCount);
    current.gross += finite(row.gross);
    current.paid += finite(row.paid);
    current.remaining += finite(row.remaining);
    current.returnCount += finite(row.returnCount);
    current.returns += finite(row.returns);
    monthly[month] = current;
  }

  return {
    totals: {
      saleCount: finite(aggregate.saleCount),
      gross: finite(aggregate.gross),
      paid: finite(aggregate.paid),
      remaining: finite(aggregate.remaining),
      returnCount: finite(aggregate.returnCount),
      returns: finite(aggregate.returns),
      saleItems: finite(aggregate.saleItems),
      payments: finite(aggregate.payments),
    },
    monthly: Object.fromEntries(Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b))),
  };
}

export function compareFinancialSnapshots(before: FinancialSnapshot, after: FinancialSnapshot): void {
  const failures: string[] = [];
  for (const key of Object.keys(before.totals) as Array<keyof FinancialSnapshot['totals']>) {
    if (before.totals[key] !== after.totals[key]) {
      failures.push(`total.${key}: ${before.totals[key]} -> ${after.totals[key]}`);
    }
  }
  const months = new Set([...Object.keys(before.monthly), ...Object.keys(after.monthly)]);
  for (const month of [...months].sort()) {
    const left = before.monthly[month];
    const right = after.monthly[month];
    if (!left || !right) {
      failures.push(`month.${month}: period added or removed`);
      continue;
    }
    for (const key of Object.keys(left) as Array<keyof typeof left>) {
      if (left[key] !== right[key]) failures.push(`month.${month}.${key}: ${left[key]} -> ${right[key]}`);
    }
  }
  if (failures.length) throw new Error(`Financial integrity validation failed: ${failures.join('; ')}`);
}

export interface WalkInMigrationReport {
  canonicalLocalId: number;
  existingWalkInCustomers: number;
  salesRelinked: number;
  duplicateCustomersRemoved: number;
}

export async function runWalkInCustomerCanonicalV1(tx: Tx): Promise<WalkInMigrationReport> {
  const before = await getFinancialSnapshot(tx);
  const candidates = await tx.customer.findMany({
    where: { customerType: WALK_IN_CUSTOMER_TYPE },
    orderBy: { id: 'asc' },
  });
  const canonical = candidates[0] || await tx.customer.create({
    data: { name: WALK_IN_CUSTOMER_NAME, customerType: WALK_IN_CUSTOMER_TYPE, status: 'active' },
  });
  const duplicateIds = candidates.slice(1).map((row) => row.id);
  const salesToMove = await tx.sale.findMany({
    where: {
      OR: [
        { saleType: 'walk_in', customerId: null },
        { saleType: 'walk_in', customerId: { not: canonical.id } },
        ...(duplicateIds.length ? [{ customerId: { in: duplicateIds } }] : []),
      ],
    },
  });

  const deviceId = getDeviceId();
  const existingCanonicalMapping = await tx.localToCloudMapping.findUnique({
    where: { deviceId_entityType_localId: { deviceId, entityType: 'Customer', localId: canonical.id } },
  });
  await tx.localToCloudMapping.upsert({
    where: { deviceId_entityType_localId: { deviceId, entityType: 'Customer', localId: canonical.id } },
    update: { cloudUuid: WALK_IN_CUSTOMER_CLOUD_UUID },
    create: { deviceId, entityType: 'Customer', localId: canonical.id, cloudUuid: WALK_IN_CUSTOMER_CLOUD_UUID },
  });
  if (!existingCanonicalMapping || existingCanonicalMapping.cloudUuid !== WALK_IN_CUSTOMER_CLOUD_UUID) {
    await SyncQueueService.enqueueUpdate(tx, 'Customer', canonical.id, canonical, 0, 'UPSERT');
  }

  for (const sale of salesToMove) {
    const updated = await tx.sale.update({ where: { id: sale.id }, data: { customerId: canonical.id } });
    const currentMapping = await SyncQueueService.getCloudMapping('Sale', updated.id, tx);
    if (!currentMapping) {
      const priorMapping = await tx.localToCloudMapping.findFirst({
        where: { entityType: 'Sale', localId: updated.id }, orderBy: { createdAt: 'asc' },
      });
      if (priorMapping) await SyncQueueService.createCloudMapping('Sale', updated.id, priorMapping.cloudUuid, tx);
    }
    await SyncQueueService.enqueueUpdate(tx, 'Sale', updated.id, updated, 1);
  }

  if (duplicateIds.length) {
    const remainingReferences = await tx.sale.count({ where: { customerId: { in: duplicateIds } } });
    if (remainingReferences !== 0) throw new Error(`Refusing to delete referenced Walk-In customers (${remainingReferences} references remain)`);
    const duplicateMappings = await tx.localToCloudMapping.findMany({
      where: { entityType: 'Customer', localId: { in: duplicateIds } },
    });
    const queuedCloudDeletes = new Set<string>();
    for (const mapping of duplicateMappings) {
      if (mapping.cloudUuid === WALK_IN_CUSTOMER_CLOUD_UUID || queuedCloudDeletes.has(mapping.cloudUuid)) continue;
      const duplicate = candidates.find((row) => row.id === mapping.localId);
      if (duplicate) {
        await SyncQueueService.enqueue(tx, 'Customer', duplicate.id, mapping.cloudUuid, 'DELETE', duplicate, 0);
        queuedCloudDeletes.add(mapping.cloudUuid);
      }
    }
    await tx.localToCloudMapping.deleteMany({ where: { entityType: 'Customer', localId: { in: duplicateIds } } });
    await tx.customer.deleteMany({ where: { id: { in: duplicateIds } } });
  }

  await tx.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Customer_single_walk_in_key" ON "Customer"("customerType") WHERE "customerType" = 'walk_in'`
  );
  const after = await getFinancialSnapshot(tx);
  compareFinancialSnapshots(before, after);

  return {
    canonicalLocalId: canonical.id,
    existingWalkInCustomers: candidates.length,
    salesRelinked: salesToMove.length,
    duplicateCustomersRemoved: duplicateIds.length,
  };
}
