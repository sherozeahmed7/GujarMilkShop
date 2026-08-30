import { MigrationClient } from './services/migrationClient';
import { prisma } from './config/database';

async function run() {
  await MigrationClient.prepareDryRun();
}

run().finally(() => prisma.$disconnect());
