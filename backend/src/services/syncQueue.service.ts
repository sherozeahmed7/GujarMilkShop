import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { getDeviceId } from '../utils/deviceId';
import crypto from 'crypto';

type DbClient = Prisma.TransactionClient | typeof prisma;

/** Nested Prisma includes / relation objects — never send to Neon */
const NESTED_KEYS = new Set([
  'items',
  'payments',
  // NOTE: 'customer' intentionally NOT listed here.
  // Return.customer is a plain string ('Walk-in' / customer name), not a relation.
  // The Customer relation object on Sale is an object and will be caught by the object guard.
  'supplier',
  'product',
  'openedBy',
  'closedBy',
  'createdBy',
  'expense',
  'sale',
  'return',
  'movements',
  'collections',
  'users',
  // NOTE: 'shift' intentionally NOT listed here.
  // SupplierCollection.shift is a plain string ('morning'/'evening'), not a relation.
  // The Shift relation object on other models is an object and will be caught by the
  // object-type guard below (line ~136), so it never leaks into the payload.
]);

/** Local FK field → { uuidKey, parent entity type } */
const FK_MAP: Record<string, { uuidKey: string; entityType: string }> = {
  customerId: { uuidKey: 'customerUuid', entityType: 'Customer' },
  saleId: { uuidKey: 'saleUuid', entityType: 'Sale' },
  supplierId: { uuidKey: 'supplierUuid', entityType: 'Supplier' },
  productId: { uuidKey: 'productUuid', entityType: 'InventoryProduct' },
  shiftId: { uuidKey: 'shiftUuid', entityType: 'Shift' },
  userId: { uuidKey: 'userUuid', entityType: 'User' },
  createdById: { uuidKey: 'createdByUuid', entityType: 'User' },
  openedById: { uuidKey: 'openedByUuid', entityType: 'User' },
  closedById: { uuidKey: 'closedByUuid', entityType: 'User' },
  expenseId: { uuidKey: 'expenseUuid', entityType: 'Expense' },
  returnId: { uuidKey: 'returnUuid', entityType: 'Return' },
  cashPersonId: { uuidKey: 'cashPersonUuid', entityType: 'CashPerson' },
};

/** Columns Neon does not have (or must not receive from local) */
const DROP_FIELDS = new Set([
  'id', // cloud id is the mapping UUID injected at batch time
]);

function isPlainDate(value: unknown): value is Date {
  return Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN((value as Date).getTime());
}

export class SyncQueueService {
  static getDeviceId(): string {
    return getDeviceId();
  }

  static async getCloudMapping(
    entityType: string,
    localId: number,
    db: DbClient = prisma
  ): Promise<string | null> {
    const mapping = await db.localToCloudMapping.findUnique({
      where: {
        deviceId_entityType_localId: {
          deviceId: this.getDeviceId(),
          entityType,
          localId,
        },
      },
    });
    return mapping?.cloudUuid || null;
  }

  static async createCloudMapping(
    entityType: string,
    localId: number,
    cloudUuid?: string,
    db: DbClient = prisma
  ): Promise<string> {
    const uuid = cloudUuid || crypto.randomUUID();
    const deviceId = this.getDeviceId();

    const result = await db.localToCloudMapping.upsert({
      where: {
        deviceId_entityType_localId: {
          deviceId,
          entityType,
          localId,
        },
      },
      update: {
        ...(cloudUuid ? { cloudUuid } : {}),
      },
      create: {
        deviceId,
        entityType,
        localId,
        cloudUuid: uuid,
      },
    });

    return result.cloudUuid;
  }

  /** Get existing mapping or create one (for seeded masters that never went through enqueue). */
  static async ensureCloudMapping(
    entityType: string,
    localId: number | null | undefined,
    db: DbClient = prisma
  ): Promise<string | null> {
    if (localId == null) return null;
    const id = Number(localId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const existing = await this.getCloudMapping(entityType, id, db);
    if (existing) return existing;
    return this.createCloudMapping(entityType, id, undefined, db);
  }

  /**
   * Strip nested relations / local FKs and attach *_uuid fields for Neon + downstream.
   * Does not change business records — only the sync payload.
   */
  static async enrichPayload(
    entityType: string,
    payload: any,
    db: DbClient = prisma
  ): Promise<Record<string, any>> {
    if (!payload || typeof payload !== 'object') return {};

    const raw = payload as Record<string, any>;
    const out: Record<string, any> = {};

    for (const [key, value] of Object.entries(raw)) {
      if (NESTED_KEYS.has(key)) continue;
      if (DROP_FIELDS.has(key)) continue;
      if (value !== null && typeof value === 'object' && !isPlainDate(value) && !Array.isArray(value)) {
        // Skip unexpected relation objects
        continue;
      }
      if (Array.isArray(value)) continue;

      const fk = FK_MAP[key];
      if (fk) {
        const uuid = await this.ensureCloudMapping(fk.entityType, value as number, db);
        if (uuid) out[fk.uuidKey] = uuid;
        continue;
      }

      if (isPlainDate(value)) {
        out[key] = value.toISOString();
        continue;
      }

      out[key] = value;
    }

    // Entity-specific cleanups
    if (entityType === 'Sale') {
      delete out.tokenNumber;
    }

    return out;
  }

  static async getSyncQueue(limit: number = 50) {
    return await prisma.syncQueue.findMany({
      where: {
        status: 'PENDING',
        deviceId: this.getDeviceId(),
      },
      orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });
  }

  static async addSyncEvent(
    entityType: string,
    localId: number,
    cloudUuid: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    payload: any
  ) {
    const eventUuid = crypto.randomUUID();
    const enriched = await this.enrichPayload(entityType, payload, prisma);

    return await prisma.syncQueue.create({
      data: {
        eventUuid,
        deviceId: this.getDeviceId(),
        entityType,
        localId,
        cloudUuid,
        operation,
        payload: JSON.stringify(enriched),
        status: 'PENDING',
      },
    });
  }

  static async enqueue(
    db: DbClient,
    entityType: string,
    localId: number,
    cloudUuid: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPSERT',
    payload: any,
    layer: number = 0
  ) {
    const eventUuid = crypto.randomUUID();
    const enriched = await this.enrichPayload(entityType, payload, db);
    return await db.syncQueue.create({
      data: {
        eventUuid,
        deviceId: this.getDeviceId(),
        entityType,
        localId,
        cloudUuid,
        operation,
        payload: JSON.stringify(enriched),
        status: 'PENDING',
        layer,
        nextRetryAt: null,
      },
    });
  }

  static async enqueueCreate(
    db: DbClient,
    entityType: string,
    localId: number,
    payload: any,
    layer: number = 0
  ) {
    const cloudUuid = await this.createCloudMapping(entityType, localId, undefined, db);
    await this.enqueue(db, entityType, localId, cloudUuid, 'CREATE', payload, layer);
    return cloudUuid;
  }

  static async enqueueUpdate(
    db: DbClient,
    entityType: string,
    localId: number,
    payload: any,
    layer: number = 0,
    operation: 'UPDATE' | 'DELETE' | 'UPSERT' = 'UPDATE'
  ) {
    let cloudUuid = await this.getCloudMapping(entityType, localId, db);
    if (!cloudUuid) {
      cloudUuid = await this.createCloudMapping(entityType, localId, undefined, db);
    }
    await this.enqueue(db, entityType, localId, cloudUuid, operation, payload, layer);
    return cloudUuid;
  }

  static async markSyncing(eventUuid: string) {
    return await prisma.syncQueue.update({
      where: { eventUuid },
      data: { status: 'SYNCING' },
    });
  }

  static async markSynced(eventUuid: string) {
    return await prisma.syncQueue.update({
      where: { eventUuid },
      data: { status: 'SYNCED', error: null },
    });
  }

  static async markFailed(eventUuid: string, errorMsg: string) {
    return await prisma.syncQueue.update({
      where: { eventUuid },
      data: {
        status: 'FAILED',
        error: errorMsg,
        retryCount: { increment: 1 },
      },
    });
  }

  static async retryFailedSync(eventUuid: string) {
    return await prisma.syncQueue.update({
      where: { eventUuid },
      data: { status: 'PENDING', error: null },
    });
  }
}
