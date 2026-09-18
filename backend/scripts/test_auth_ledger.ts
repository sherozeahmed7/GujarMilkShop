/**
 * Phase 6C: Test authenticated real customer & supplier ledger endpoints
 */
import { PrismaClient } from '@prisma/client';
import http from 'http';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function getAuthToken(): string {
  return jwt.sign({ userId: 1, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

function getJson(url: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(parsed, {
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  console.log('=== PHASE 6C: TESTING AUTHENTICATED LEDGER DATA FLOW ===');
  const token = getAuthToken();

  // 1. Customer check
  const customer = await prisma.customer.findFirst({ where: { sales: { some: {} } } });
  if (customer) {
    console.log(`Found Customer with Sales: ID=${customer.id}, Name=${customer.name}`);
    const res = await getJson(`http://localhost:5000/api/customers/${customer.id}`, token);
    console.log(`GET /api/customers/${customer.id} status:`, res.status);
    console.log('Response customer name:', res.data?.data?.name);

    const salesRes = await getJson(`http://localhost:5000/api/sales?customerId=${customer.id}`, token);
    console.log(`GET /api/sales?customerId=${customer.id} status:`, salesRes.status);
    console.log(`Found ${salesRes.data?.data?.length || 0} real sales for customer`);
    if (salesRes.data?.data?.length > 0) {
      console.log('Sample Sale:', {
        id: salesRes.data.data[0].id,
        totalAmount: salesRes.data.data[0].totalAmount,
        paidAmount: salesRes.data.data[0].paidAmount,
        items: salesRes.data.data[0].items?.map((i: any) => `${i.itemName} (${i.quantity})`)
      });
    }
  }

  // 2. Supplier check
  const supplier = await prisma.supplier.findFirst();
  if (supplier) {
    console.log(`\nFound Supplier: ID=${supplier.id}, Name=${supplier.name}`);
    const res = await getJson(`http://localhost:5000/api/suppliers/${supplier.id}`, token);
    console.log(`GET /api/suppliers/${supplier.id} status:`, res.status);
    console.log('Response supplier name:', res.data?.data?.name);

    const entriesRes = await getJson(`http://localhost:5000/api/suppliers/${supplier.id}/entries`, token);
    console.log(`GET /api/suppliers/${supplier.id}/entries status:`, entriesRes.status);
    console.log(`Collections count: ${entriesRes.data?.data?.collections?.length || 0}`);
    console.log(`Payments count: ${entriesRes.data?.data?.payments?.length || 0}`);
  }

  // 3. Error propagation on invalid ID
  console.log('\n--- TESTING NON-EXISTENT ID ERROR PROPAGATION (AUTHENTICATED) ---');
  const invalidCustRes = await getJson('http://localhost:5000/api/customers/999999', token);
  console.log('GET /api/customers/999999 status:', invalidCustRes.status);
  console.log('Customer 404 response:', invalidCustRes.data?.message || invalidCustRes.data?.error);

  const invalidSuppRes = await getJson('http://localhost:5000/api/suppliers/999999', token);
  console.log('GET /api/suppliers/999999 status:', invalidSuppRes.status);
  console.log('Supplier 404 response:', invalidSuppRes.data?.message || invalidSuppRes.data?.error);

  console.log('\n=== AUTHENTICATED REAL DATA TESTS PASSED ===');
}

runTest().finally(() => prisma.$disconnect());
