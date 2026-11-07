import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration024CustomerCustomRate: Migration = {
  version: 24,
  name: 'add_customer_custom_rate',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    const cols: Array<{ name: string }> = await tx.$queryRawUnsafe(`PRAGMA table_info("Customer")`);
    const colNames = new Set(cols.map((c) => c.name));

    if (!colNames.has('customMilkRate')) {
      await tx.$executeRawUnsafe(
        `ALTER TABLE "Customer" ADD COLUMN "customMilkRate" REAL`
      );
      console.log('[MIGRATION v24] Added customMilkRate column to Customer.');
    } else {
      console.log('[MIGRATION v24] customMilkRate column already exists on Customer.');
    }
  },
};

