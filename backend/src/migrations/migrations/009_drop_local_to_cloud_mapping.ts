import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration009DropLocalToCloudMapping: Migration = {
  version: 9,
  name: 'drop_local_to_cloud_mapping',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    console.log('[MIGRATION v9] Dropping obsolete LocalToCloudMapping table from SQLite...');
    await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS "LocalToCloudMapping"`);
    console.log('[MIGRATION v9] Dropped table "LocalToCloudMapping" and its indexes.');
  },
};
