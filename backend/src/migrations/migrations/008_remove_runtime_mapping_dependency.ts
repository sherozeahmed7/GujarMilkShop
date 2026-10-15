import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration008RemoveRuntimeMappingDependency: Migration = {
  version: 8,
  name: 'remove_runtime_mapping_dependency',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    console.log('[MIGRATION v8] Stamping runtime transition to embedded cloudUuid architecture...');
    // In migration 008, all active runtime paths (SyncQueueService, DownstreamSyncWorker,
    // SyncRestore, and controllers) now read/write directly from businessTable.cloudUuid.
    // LocalToCloudMapping remains intact in the database as rollback safety evidence.
    console.log('[MIGRATION v8] Runtime mapping dependency decoupled successfully.');
  },
};
