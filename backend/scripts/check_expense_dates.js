require('dotenv').config();
const axios = require('axios');

async function main() {
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', { 
    email: 'admin@gujarmilkshop.com', 
    password: 'admin123' 
  });
  const token = loginRes.data.data?.accessToken;

  const res = await axios.get('http://localhost:5000/api/expenses?limit=10', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Sample expenses:', res.data.data?.slice(0, 5));
}

main().catch(console.error);
