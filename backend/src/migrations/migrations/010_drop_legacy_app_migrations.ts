import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration010DropLegacyAppMigrations: Migration = {
  version: 10,
  name: 'drop_legacy_app_migrations',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // Drop obsolete legacy app_migrations table; AppMigration is the authoritative versioned ledger
    await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS "app_migrations"`);
  },
};
