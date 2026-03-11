import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_DIRECTUS_URL;
const token = process.env.VITE_DIRECTUS_TOKEN;

console.log(`📍 Testing permissions for: ${url}`);
console.log(`🗝️ Token: ${token.substring(0, 5)}...`);

async function test() {
  try {
    const res = await axios.get(`${url}/items/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Success! Can read "users" collection.');
    console.log(`Count: ${res.data.data.length} users found.`);
  } catch (error) {
    console.error('❌ Failed to read "users" collection.');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2) || error.message);
  }

  try {
    const res = await axios.get(`${url}/items/events`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Success! Can read "events" collection.');
  } catch (error) {
    console.error('❌ Failed to read "events" collection.', error.response?.status);
  }

  try {
    const res = await axios.get(`${url}/items/tasks`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Success! Can read "tasks" collection.');
  } catch (error) {
    console.error('❌ Failed to read "tasks" collection.', error.response?.status);
  }
}

test();
