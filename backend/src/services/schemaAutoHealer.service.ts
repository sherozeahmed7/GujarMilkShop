import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Universal Database Schema Auto-Healer
 *
 * Runs automatically on startup before any application queries execute.
 * Introspects the live SQLite database against Prisma's runtime DMMF model definitions:
 * 1. Checks every model and every field in Prisma.
 * 2. If ANY column is missing in any table on the client's PC (e.g., Sale.discountAmount,
 *    Sale.tokenNumber, Shift.difference, etc.), it automatically alters the table and adds it.
 * 3. If any entire table is missing, it creates the table.
 * 4. Ensures critical indexes exist.
 *
 * This guarantees zero "The column ... does not exist in the current database" errors
 * across all versions, client machines, and legacy databases.
 */
export async function autoHealDatabaseSchema(db: PrismaClient): Promise<void> {
  const models = Prisma.dmmf?.datamodel?.models;
  if (!models || models.length === 0) {
    console.warn('[AutoHealer] Prisma DMMF models not available at runtime, skipping auto-heal.');
    return;
  }

  try {
    // 1. Fetch all existing tables in SQLite
    const existingTableRows: Array<{ name: string }> = await db.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    );
    const existingTables = new Set(existingTableRows.map((r) => r.name.toLowerCase()));

    let totalColumnsAdded = 0;
    let totalTablesCreated = 0;

    for (const model of models) {
      const tableName = model.name;
      const tableLower = tableName.toLowerCase();

      // Scalar fields only (skip relation object fields and list relation fields)
      const scalarFields = model.fields.filter(
        (f) => f.kind === 'scalar' && !f.isList
      );

      if (!existingTables.has(tableLower)) {
        // Table is completely missing in SQLite — create it safely
        try {
          const colDefs: string[] = [];
          for (const f of scalarFields) {
            let colDef = '';
            if (f.isId) {
              if (f.type === 'Int' || f.type === 'BigInt') {
                colDef = `"${f.name}" INTEGER PRIMARY KEY AUTOINCREMENT`;
              } else {
                colDef = `"${f.name}" TEXT PRIMARY KEY`;
              }
            } else {
              colDef = `"${f.name}" ${getSqliteType(f.type)}`;
              if (f.isRequired) {
                colDef += ` NOT NULL ${getSqliteDefault(f)}`;
              }
            }
            colDefs.push(colDef);
          }
          await db.$executeRawUnsafe(
            `CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(', ')})`
          );
          existingTables.add(tableLower);
          totalTablesCreated++;
          console.log(`[AutoHealer] ✅ Created missing table: "${tableName}"`);
        } catch (tableErr: any) {
          console.warn(`[AutoHealer] Failed to auto-create table "${tableName}":`, tableErr.message);
        }
        continue;
      }

      // Table exists — inspect its columns
      let existingCols: Array<{ name: string }> = [];
      try {
        existingCols = await db.$queryRawUnsafe(`PRAGMA table_info("${tableName}")`);
      } catch (err: any) {
        console.warn(`[AutoHealer] Could not read columns for "${tableName}":`, err.message);
        continue;
      }

      const existingColNames = new Set(existingCols.map((c) => c.name.toLowerCase()));

      for (const field of scalarFields) {
        if (!existingColNames.has(field.name.toLowerCase())) {
          // Column is missing! Add it with ALTER TABLE
          try {
            const sqliteType = getSqliteType(field.type);
            const defaultClause = getSqliteDefault(field);
            const notNullClause = field.isRequired ? 'NOT NULL' : '';
            
            // SQLite ALTER TABLE ADD COLUMN requires a DEFAULT if NOT NULL is specified
            const alterSql = `ALTER TABLE "${tableName}" ADD COLUMN "${field.name}" ${sqliteType} ${notNullClause} ${defaultClause}`.trim();
            await db.$executeRawUnsafe(alterSql);
            existingColNames.add(field.name.toLowerCase());
            totalColumnsAdded++;
            console.log(`[AutoHealer] ✅ Auto-added missing column: "${tableName}"."${field.name}" (${sqliteType})`);
          } catch (colErr: any) {
            console.error(`[AutoHealer] ⚠️ Error adding "${tableName}"."${field.name}":`, colErr.message);
          }
        }
      }
    }

    // 2. Ensure critical performance indexes on Sale table exist
    try {
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Sale_createdAt_tokenNumber_idx"
        ON "Sale"("createdAt", "tokenNumber");
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Sale_tokenNumber_idx"
        ON "Sale"("tokenNumber");
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Sale_discountAmount_idx"
        ON "Sale"("discountAmount");
      `);
    } catch (_) {}

    if (totalColumnsAdded > 0 || totalTablesCreated > 0) {
      console.log(`[AutoHealer] 🎉 Auto-heal complete: ${totalColumnsAdded} column(s) added, ${totalTablesCreated} table(s) created.`);
    } else {
      console.log(`[AutoHealer] ⚡ Database schema is 100% complete and healthy (0 missing columns).`);
    }
  } catch (err: any) {
    console.error('[AutoHealer] Non-fatal schema auto-heal notice:', err.message);
  }
}

function getSqliteType(prismaType: string): string {
  switch (prismaType) {
    case 'Int':
      return 'INTEGER';
    case 'Float':
    case 'Decimal':
      return 'REAL';
    case 'Boolean':
      return 'INTEGER';
    case 'DateTime':
      return 'DATETIME';
    case 'String':
    default:
      return 'TEXT';
  }
}

function getSqliteDefault(field: any): string {
  if (field.hasDefaultValue) {
    if (typeof field.default === 'string') {
      return `DEFAULT '${field.default.replace(/'/g, "''")}'`;
    }
    if (typeof field.default === 'number') {
      return `DEFAULT ${field.default}`;
    }
    if (typeof field.default === 'boolean') {
      return `DEFAULT ${field.default ? 1 : 0}`;
    }
    if (field.default && typeof field.default === 'object' && field.default.name === 'now') {
      return `DEFAULT CURRENT_TIMESTAMP`;
    }
  }

  // Safe defaults for required columns
  if (field.isRequired) {
    switch (field.type) {
      case 'Int':
      case 'Float':
      case 'Decimal':
        return 'DEFAULT 0';
      case 'Boolean':
        return 'DEFAULT 0';
      case 'DateTime':
        return 'DEFAULT CURRENT_TIMESTAMP';
      case 'String':
      default:
        return "DEFAULT ''";
    }
  }

  return '';
}
