require('dotenv').config();
const axios = require('axios');

async function main() {
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', { 
    email: 'admin@gujarmilkshop.com', 
    password: 'admin123' 
  }, { timeout: 15000 });
  
  const token = loginRes.data.data?.accessToken;

  // 1. Diagnostics
  const diagRes = await axios.get('http://localhost:5000/api/sync/failed-diagnostics', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('=== FAILED DIAGNOSTICS FROM LIVE BACKEND ===');
  console.log(JSON.stringify(diagRes.data, null, 2));

  // 2. Queue view
  const qRes = await axios.get('http://localhost:5000/api/sync/queue?limit=100', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('\n=== SYNC QUEUE SAMPLE ===');
  console.log('Total in response:', qRes.data.data?.length || qRes.data.length);
  const items = qRes.data.data || qRes.data;
  if (Array.isArray(items)) {
    const failedItems = items.filter(i => i.status === 'FAILED');
    console.log(`Failed items in this batch (${failedItems.length}):`);
    failedItems.slice(0, 10).forEach(i => console.log(`  [${i.entityType}] ${i.error} (retryCount: ${i.retryCount})`));
  }
}

main().catch(e => console.error('Error:', e.response?.data || e.message));
