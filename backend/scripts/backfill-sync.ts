import { PrismaClient } from '@prisma/client';
import { SyncQueueService } from '../src/services/syncQueue.service';

const prisma = new PrismaClient();

async function run() {
  console.log('Starting historical backfill for SyncQueue...');
  
  try {
    // 1. Backfill Sales with tokenNumber > 0
    const sales = await prisma.sale.findMany({
      where: {
        tokenNumber: {
          gt: 0
        }
      }
    });

    console.log(`Found ${sales.length} Sales with tokenNumber > 0. Queuing updates...`);
    for (const sale of sales) {
      await prisma.$transaction(async (tx) => {
        await SyncQueueService.enqueueUpdate(tx, 'Sale', sale.id, sale, 1, 'UPDATE');
      });
    }

    // 2. Backfill CashPerson records
    const cashPersons = await prisma.cashPerson.findMany();
    console.log(`Found ${cashPersons.length} CashPerson records. Queuing creations...`);
    for (const cp of cashPersons) {
      await prisma.$transaction(async (tx) => {
        await SyncQueueService.enqueueCreate(tx, 'CashPerson', cp.id, cp, 0);
      });
    }

    // 3. Backfill CashbookTransaction records
    const cashbookTxns = await prisma.cashbookTransaction.findMany();
    console.log(`Found ${cashbookTxns.length} CashbookTransaction records. Queuing creations...`);
    for (const txn of cashbookTxns) {
      await prisma.$transaction(async (tx) => {
        await SyncQueueService.enqueueCreate(tx, 'CashbookTransaction', txn.id, txn, 1);
      });
    }

    console.log('Backfill complete!');
  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
