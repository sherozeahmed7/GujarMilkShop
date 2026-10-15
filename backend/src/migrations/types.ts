import { Prisma } from '@prisma/client';

export interface Migration {
  version: number;
  name: string;
  up(tx: Prisma.TransactionClient): Promise<void>;
}
