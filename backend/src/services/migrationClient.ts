import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
import fs from 'fs';
import path from 'path';

export class MigrationClient {
  static async verifyBackup() {
    const dbPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev.db');
    const backupPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev_backup.db');
    
    if (!fs.existsSync(dbPath)) throw new Error('Active dev.db not found.');
    if (!fs.existsSync(backupPath)) throw new Error('dev_backup.db not found. Run backup first.');
    
    const stat = fs.statSync(backupPath);
    if (stat.size === 0) throw new Error('Backup is empty.');
    
    return true;
  }

  static async prepareDryRun() {
    console.log('\n==================================================');
    console.log('MIGRATION DRY RUN (Local Preparation)');
    console.log('==================================================');
    
    await this.verifyBackup();
    console.log('[OK] Backup verified.');

    const deviceId = SyncQueueService.getDeviceId();
    
    // Dependency Order
    const tables = [
      'user',
      'supplier',
      'inventoryProduct',
      'dailyRate',
      'customer',
      'shift',
      'supplierCollection',
      'supplierPayment',
      'sale',
      'saleItem',
      'payment',
      'expense',
      'expensePayment',
      'inventoryMovement',
      'milkProductTransaction',
      'butterGheeConversion',
      'milkProductDailyStock',
      'return',
      'returnItem',
      'auditRecord'
    ];

    let totalRecords = 0;
    const stats: any = {};
    const mappingCache: Record<string, string> = {};

    console.log('\n--- UUID Mapping & FK Validation ---');
    
    for (const table of tables) {
      // @ts-ignore
      const records = await prisma[table].findMany();
      stats[table] = records.length;
      totalRecords += records.length;

      for (const record of records) {
        // Ensure UUID exists
        const cloudUuid = await SyncQueueService.createCloudMapping(table, record.id);
        mappingCache[`${table}_${record.id}`] = cloudUuid;
      }
      if (records.length > 0) {
         console.log(`Mapped ${records.length} ${table} records.`);
      }
    }

    console.log(`\nTotal local records to migrate: ${totalRecords}`);
    
    // Validate FKs
    let fkErrors = 0;
    console.log('\n--- Foreign Key Resolution Check ---');
    
    const sales = await prisma.sale.findMany();
    for (const s of sales) {
      if (s.customerId && !mappingCache[`customer_${s.customerId}`]) {
        console.error(`[FK ERROR] Sale ${s.id} references missing Customer ${s.customerId}`);
        fkErrors++;
      }
    }

    const saleItems = await prisma.saleItem.findMany();
    for (const si of saleItems) {
      if (!mappingCache[`sale_${si.saleId}`]) {
        console.error(`[FK ERROR] SaleItem ${si.id} references missing Sale ${si.saleId}`);
        fkErrors++;
      }
    }

    if (fkErrors === 0) {
      console.log('[OK] All tested foreign keys resolve correctly to UUID mappings.');
    }

    // Totals Calculation
    console.log('\n--- Expected Cloud Totals (Financial & Inventory) ---');
    const salesAgg = await prisma.sale.aggregate({ _sum: { totalAmount: true, paidAmount: true } });
    console.log(`Total Sales Amount: ${salesAgg._sum.totalAmount || 0}`);
    console.log(`Total Sales Paid: ${salesAgg._sum.paidAmount || 0}`);

    const payAgg = await prisma.payment.aggregate({ _sum: { amount: true } });
    console.log(`Total Independent Payments: ${payAgg._sum.amount || 0}`);

    const suppColAgg = await prisma.supplierCollection.aggregate({ _sum: { amount: true, quantity: true } });
    console.log(`Supplier Collections Total Amount: ${suppColAgg._sum.amount || 0} | Qty: ${suppColAgg._sum.quantity || 0}`);

    const invAgg = await prisma.inventoryMovement.aggregate({ _sum: { quantity: true } });
    console.log(`Absolute Inventory Movements Sum: ${invAgg._sum.quantity || 0}`);

    console.log('\n==================================================');
    console.log('DRY RUN COMPLETE. NO DATA INSERTED TO NEON.');
    console.log('==================================================');
  }
}
