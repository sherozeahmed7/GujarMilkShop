import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
import {
  WALK_IN_CUSTOMER_CLOUD_UUID,
  WALK_IN_CUSTOMER_NAME,
  WALK_IN_CUSTOMER_TYPE,
} from '../config/walkInCustomer';

type DbClient = Prisma.TransactionClient | typeof prisma;

let cachedWalkInCustomer: any = null;

export async function getOrCreateWalkInCustomer(tx: DbClient) {
  if (cachedWalkInCustomer && cachedWalkInCustomer.id) {
    return cachedWalkInCustomer;
  }

  // 1. First attempt fast find
  let customer = await tx.customer.findFirst({
    where: { customerType: WALK_IN_CUSTOMER_TYPE },
    orderBy: { id: 'asc' },
  });

  if (!customer) {
    try {
      customer = await tx.customer.create({
        data: {
          name: WALK_IN_CUSTOMER_NAME,
          customerType: WALK_IN_CUSTOMER_TYPE,
          status: 'active',
          cloudUuid: WALK_IN_CUSTOMER_CLOUD_UUID,
        },
      });
      await SyncQueueService.enqueueCreate(tx, 'Customer', customer.id, customer, 0);
    } catch (err: any) {
      // If a concurrent thread already created it (triggering UNIQUE constraint), fetch the winner
      const isUniqueViolation =
        err?.code === 'P2002' ||
        String(err?.message || '').toLowerCase().includes('unique') ||
        String(err?.message || '').toLowerCase().includes('constraint');

      if (isUniqueViolation) {
        customer = await tx.customer.findFirst({
          where: { customerType: WALK_IN_CUSTOMER_TYPE },
          orderBy: { id: 'asc' },
        });
        if (!customer) {
          throw err;
        }
      } else {
        throw err;
      }
    }
  }

  // Ensure the canonical Walk-In cloudUuid is embedded on the row and re-fetch
  // so that the returned object always has cloudUuid populated.
  if (customer && customer.cloudUuid !== WALK_IN_CUSTOMER_CLOUD_UUID) {
    await SyncQueueService.createCloudMapping(
      'Customer',
      customer.id,
      WALK_IN_CUSTOMER_CLOUD_UUID,
      tx
    );
    // Re-fetch to get the updated cloudUuid in the returned object
    customer = await tx.customer.findFirst({
      where: { customerType: WALK_IN_CUSTOMER_TYPE },
      orderBy: { id: 'asc' },
    });
  }

  if (customer) {
    cachedWalkInCustomer = customer;
  }

  return customer!;
}
