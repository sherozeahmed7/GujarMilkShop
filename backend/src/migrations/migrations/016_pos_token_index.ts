import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 016: POS Token Number Index
 *
 * Adds covering index on Sale(createdAt, tokenNumber) to make token lookup
 * at checkout instant (<0.5ms) without scanning the Sale table.
 */
export const migration016PosTokenIndex: Migration = {
  version: 16,
  name: 'pos_token_index',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_createdAt_tokenNumber_idx"
      ON "Sale"("createdAt", "tokenNumber");
    `);

    await tx.$executeRawUnsafe(`ANALYZE;`);
    console.log('[MIGRATION v16] POS token number index created successfully.');
  },
};
