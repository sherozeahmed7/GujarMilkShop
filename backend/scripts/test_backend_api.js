require('dotenv').config();
const axios = require('axios');

async function main() {
  // Login
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', { 
    email: 'admin@gujarmilkshop.com', 
    password: 'admin123' 
  }, { timeout: 15000 });
  
  const token = loginRes.data.data?.accessToken;
  console.log('Logged in as:', loginRes.data.data?.user?.name, '| Role:', loginRes.data.data?.user?.role);

  // Get customers
  const custRes = await axios.get('http://localhost:5000/api/customers', { 
    headers: { 'Authorization': `Bearer ${token}` },
    timeout: 10000 
  });
  const customers = custRes.data.data || custRes.data;
  console.log('\n=== Customer count from LIVE backend:', Array.isArray(customers) ? customers.length : typeof customers);
  if (Array.isArray(customers) && customers.length > 0) {
    console.log('Sample customers:');
    customers.slice(0, 3).forEach(c => console.log(' -', c.name, '| id:', c.id));
  }

  // Get sales count
  try {
    const salesRes = await axios.get('http://localhost:5000/api/sales?limit=1', { 
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000 
    });
    const total = salesRes.data.total || salesRes.data.pagination?.total || 'unknown';
    console.log('\n=== Sales count from LIVE backend:', total);
    const sales = salesRes.data.data || salesRes.data;
    if (Array.isArray(sales) && sales.length > 0) {
      console.log('Latest sale:', JSON.stringify(sales[0]).substring(0, 200));
    }
  } catch(e) {
    console.log('Sales endpoint error:', e.message);
  }

  // Try sync status
  try {
    const syncRes = await axios.get('http://localhost:5000/api/sync/status', { 
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 10000 
    });
    console.log('\n=== Sync Status:', JSON.stringify(syncRes.data).substring(0, 1000));
  } catch(e) {
    console.log('\nNo sync/status endpoint, trying /api/sync/queue-stats...');
    try {
      const syncRes2 = await axios.get('http://localhost:5000/api/sync/queue-stats', { 
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 10000 
      });
      console.log('Queue stats:', JSON.stringify(syncRes2.data).substring(0, 1000));
    } catch(e2) {
      console.log('No queue-stats either:', e2.message);
    }
  }
}

main().catch(e => { 
  console.error('Error:', e.message); 
  if (e.response) console.error('Response:', JSON.stringify(e.response.data).substring(0, 300));
});
