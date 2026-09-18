/**
 * Phase 6C: Test real customer & supplier ledger endpoints
 */
import { PrismaClient } from '@prisma/client';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('=== PHASE 6C: TESTING LEDGER REAL DATA FLOW ===');

  // 1. Customer check
  const customer = await prisma.customer.findFirst();
  if (customer) {
    console.log(`Found Customer: ID=${customer.id}, Name=${customer.name}`);
    const res = await getJson(`http://localhost:5000/api/customers/${customer.id}`);
    console.log(`GET /api/customers/${customer.id} status:`, res.status);
    console.log('Response customer name:', res.data?.data?.name);

    const salesRes = await getJson(`http://localhost:5000/api/sales?customerId=${customer.id}`);
    console.log(`GET /api/sales?customerId=${customer.id} status:`, salesRes.status);
    console.log(`Found ${salesRes.data?.data?.length || 0} real sales for customer`);
  }

  // 2. Supplier check
  const supplier = await prisma.supplier.findFirst();
  if (supplier) {
    console.log(`\nFound Supplier: ID=${supplier.id}, Name=${supplier.name}`);
    const res = await getJson(`http://localhost:5000/api/suppliers/${supplier.id}`);
    console.log(`GET /api/suppliers/${supplier.id} status:`, res.status);
    console.log('Response supplier name:', res.data?.data?.name);

    const entriesRes = await getJson(`http://localhost:5000/api/suppliers/${supplier.id}/entries`);
    console.log(`GET /api/suppliers/${supplier.id}/entries status:`, entriesRes.status);
    console.log(`Collections count: ${entriesRes.data?.data?.collections?.length || 0}`);
    console.log(`Payments count: ${entriesRes.data?.data?.payments?.length || 0}`);
  }

  // 3. Invalid ID check (Error Propagation)
  console.log('\n--- TESTING NON-EXISTENT ID ERROR PROPAGATION ---');
  const invalidCustRes = await getJson('http://localhost:5000/api/customers/999999');
  console.log('GET /api/customers/999999 status:', invalidCustRes.status);
  console.log('Non-existent customer error message:', invalidCustRes.data?.message || invalidCustRes.data);

  const invalidSuppRes = await getJson('http://localhost:5000/api/suppliers/999999');
  console.log('GET /api/suppliers/999999 status:', invalidSuppRes.status);
  console.log('Non-existent supplier error message:', invalidSuppRes.data?.message || invalidSuppRes.data);

  console.log('\n=== LEDGER REAL DATA TESTS COMPLETE ===');
}

runTest().finally(() => prisma.$disconnect());
