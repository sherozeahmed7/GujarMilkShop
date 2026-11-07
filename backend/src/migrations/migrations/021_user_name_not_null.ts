import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 021: Enforce User.name NOT NULL with backfill
 *
 * Aligns the local SQLite User schema with business logic, backend validations,
 * and Neon schema by backfilling any null/empty names and enforcing non-null
 * constraints via database triggers without dropping the User table.
 */
export const migration021UserNameNotNull: Migration = {
  version: 21,
  name: 'user_name_not_null',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // 1. Backfill any missing or empty names deterministically
    await tx.$executeRawUnsafe(`
      UPDATE "User"
      SET "name" = COALESCE(
        NULLIF(TRIM("name"), ''),
        CASE
          WHEN INSTR("email", '@') > 1 THEN SUBSTR("email", 1, INSTR("email", '@') - 1)
          ELSE 'User'
        END
      )
      WHERE "name" IS NULL OR TRIM("name") = '';
    `);

    console.log('[MIGRATION v21] User names backfilled successfully.');

    // 2. Enforce NOT NULL at SQLite database level via triggers (zero FK disruption)
    await tx.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS "trg_user_name_not_null_insert"
      BEFORE INSERT ON "User"
      FOR EACH ROW
      WHEN NEW.name IS NULL OR TRIM(NEW.name) = ''
      BEGIN
        SELECT RAISE(ABORT, 'User name is required and cannot be null or empty');
      END;
    `);

    await tx.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS "trg_user_name_not_null_update"
      BEFORE UPDATE OF name ON "User"
      FOR EACH ROW
      WHEN NEW.name IS NULL OR TRIM(NEW.name) = ''
      BEGIN
        SELECT RAISE(ABORT, 'User name is required and cannot be null or empty');
      END;
    `);

    console.log('[MIGRATION v21] User name NOT NULL triggers created successfully.');
  },
};
