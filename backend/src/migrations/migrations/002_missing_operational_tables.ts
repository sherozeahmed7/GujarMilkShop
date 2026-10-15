import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration002MissingOperationalTables: Migration = {
  version: 2,
  name: 'missing_operational_tables',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // 1. Create CashPerson table
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CashPerson" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "address" TEXT,
        "type" TEXT NOT NULL,
        "description" TEXT,
        "openingBalance" REAL NOT NULL DEFAULT 0,
        "customerType" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'Active',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create CashbookTransaction table
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CashbookTransaction" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "cashPersonId" INTEGER NOT NULL,
        "cashPersonName" TEXT NOT NULL,
        "transactionType" TEXT NOT NULL,
        "amount" REAL NOT NULL,
        "description" TEXT,
        "date" TEXT NOT NULL,
        "createdBy" TEXT NOT NULL DEFAULT 'Admin',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CashbookTransaction_cashPersonId_fkey" FOREIGN KEY ("cashPersonId") REFERENCES "CashPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Indexes for CashbookTransaction
    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CashbookTransaction_cashPersonId_idx" ON "CashbookTransaction"("cashPersonId")`
    );
    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "CashbookTransaction_date_idx" ON "CashbookTransaction"("date")`
    );

    // 3. Create Notification table
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "category" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "isRead" BOOLEAN NOT NULL DEFAULT 0,
        "metadata" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for Notification
    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Notification_isRead_idx" ON "Notification"("isRead")`
    );
    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt")`
    );

    // 4. Create ActivityLog table
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivityLog" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "user" TEXT NOT NULL,
        "userRole" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "module" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "entityId" TEXT,
        "ip" TEXT,
        "status" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for ActivityLog
    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ActivityLog_timestamp_idx" ON "ActivityLog"("timestamp")`
    );
    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ActivityLog_module_idx" ON "ActivityLog"("module")`
    );
    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ActivityLog_action_idx" ON "ActivityLog"("action")`
    );
  },
};
