import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { getDeviceId } from '../utils/deviceId';
import crypto from 'crypto';

export class SyncQueueService {
  
  static getDeviceId(): string {
    return getDeviceId();
  }

  /**
   * Retrieves the cloud UUID mapped to a local entity.
   */
  static async getCloudMapping(entityType: string, localId: number, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<string | null> {
    const mapping = await db.localToCloudMapping.findUnique({
      where: {
        deviceId_entityType_localId: {
          deviceId: this.getDeviceId(),
          entityType,
          localId
        }
      }
    });
    return mapping?.cloudUuid || null;
  }

  /**
   * Creates a mapping between a local entity ID and a newly generated cloud UUID.
   */
  static async createCloudMapping(entityType: string, localId: number, cloudUuid?: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<string> {
    const uuid = cloudUuid || crypto.randomUUID();
    
    await db.localToCloudMapping.create({
      data: {
        deviceId: this.getDeviceId(),
        entityType,
        localId,
        cloudUuid: uuid
      }
    });
    
    return uuid;
  }

  /**
   * Retrieves pending items from the sync queue.
   */
  static async getSyncQueue(limit: number = 50) {
    return await prisma.syncQueue.findMany({
      where: {
        status: 'PENDING',
        deviceId: this.getDeviceId()
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
  }

  /**
   * Adds a new event to the sync queue.
   */
  static async addSyncEvent(
    entityType: string, 
    localId: number, 
    cloudUuid: string, 
    operation: 'CREATE' | 'UPDATE' | 'DELETE', 
    payload: any
  ) {
    const eventUuid = crypto.randomUUID();
    
    return await prisma.syncQueue.create({
      data: {
        eventUuid,
        deviceId: this.getDeviceId(),
        entityType,
        localId,
        cloudUuid,
        operation,
        payload: JSON.stringify(payload),
        status: 'PENDING'
      }
    });
  }

  /**
   * Transaction-safe enqueue.
   * Pass \`tx\` when calling from inside a $transaction.
   * Pass \`prisma\` when calling standalone.
   */
  static async enqueue(
    db: Prisma.TransactionClient | typeof prisma,
    entityType: string,
    localId: number,
    cloudUuid: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPSERT',
    payload: any,
    layer: number = 0
  ) {
    const eventUuid = crypto.randomUUID();
    return await db.syncQueue.create({
      data: {
        eventUuid,
        deviceId: this.getDeviceId(),
        entityType,
        localId,
        cloudUuid,
        operation,
        payload: JSON.stringify(payload),
        status: 'PENDING',
        layer,
        nextRetryAt: null
      }
    });
  }

  static async enqueueCreate(
    db: Prisma.TransactionClient | typeof prisma,
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
    db: Prisma.TransactionClient | typeof prisma,
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
      data: { status: 'SYNCING' }
    });
  }

  static async markSynced(eventUuid: string) {
    return await prisma.syncQueue.update({
      where: { eventUuid },
      data: { status: 'SYNCED', error: null }
    });
  }

  static async markFailed(eventUuid: string, errorMsg: string) {
    return await prisma.syncQueue.update({
      where: { eventUuid },
      data: { 
        status: 'FAILED',
        error: errorMsg,
        retryCount: { increment: 1 }
      }
    });
  }

  static async retryFailedSync(eventUuid: string) {
    return await prisma.syncQueue.update({
      where: { eventUuid },
      data: { status: 'PENDING', error: null }
    });
  }
}
