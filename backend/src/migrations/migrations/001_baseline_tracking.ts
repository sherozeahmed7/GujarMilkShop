import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration001BaselineTracking: Migration = {
  version: 1,
  name: 'baseline_tracking',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // Ensure AppMigration table exists (created by runner, but verified here)
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AppMigration" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "version" INTEGER NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "checksum" TEXT
      )
    `);

    // Also ensure legacy app_migrations table exists for backward compatibility
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "app_migrations" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "migration_key" TEXT NOT NULL UNIQUE,
        "version" INTEGER NOT NULL,
        "applied_at" DATETIME,
        "status" TEXT NOT NULL
      )
    `);
  },
};
