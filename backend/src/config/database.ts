import { PrismaClient } from '@prisma/client';

// Instantiate PrismaClient to interact with SQLite database
export const prisma = new PrismaClient();

/**
 * Connects to the database and logs status details
 */
export async function connectDB() {
  try {
    // Attempt database connection
    await prisma.$connect();
    console.log("Database connected successfully")
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    process.exit(1);
  }
}
