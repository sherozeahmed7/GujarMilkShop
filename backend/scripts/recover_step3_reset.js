require('dotenv').config();
const axios = require('axios');

async function main() {
  console.log('Logging in...');
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', { 
    email: 'admin@gujarmilkshop.com', 
    password: 'admin123' 
  }, { timeout: 15000 });
  
  const token = loginRes.data.data?.accessToken;
  console.log('Login successful.');

  console.log('\nCalling POST /api/sync/retry-failed...');
  const resetRes = await axios.post('http://localhost:5000/api/sync/retry-failed', {}, {
    headers: { 'Authorization': `Bearer ${token}` },
    timeout: 30000
  });

  console.log('Reset response:', resetRes.data);

  // Check sync status immediately
  const statusRes = await axios.get('http://localhost:5000/api/sync/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('\nSync Status after reset:');
  console.log('PENDING:', statusRes.data.pending);
  console.log('FAILED:', statusRes.data.failed);
  console.log('SYNCING:', statusRes.data.syncing);
  console.log('cloudConnected:', statusRes.data.cloudConnected);
}

main().catch(e => console.error('Error:', e.response?.data || e.message));
