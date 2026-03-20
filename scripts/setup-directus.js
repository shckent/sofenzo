import 'dotenv/config';
import axios from 'axios';

const url = process.env.VITE_DIRECTUS_URL;
const token = process.env.VITE_DIRECTUS_TOKEN;

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function createCollection(name, fields = []) {
  console.log(`\n🛠 Processing collection: ${name}...`);
  try {
    // Try creating collection
    try {
      await axios.post(`${url}/collections`, {
        collection: name,
        schema: {},
        meta: { show_in_navigation: true },
      }, { headers });
      console.log(`✅ Collection "${name}" created.`);
    } catch (e) {
      if (e.response?.data?.errors?.[0]?.extensions?.code === 'INVALID_PAYLOAD' && 
          e.response?.data?.errors?.[0]?.message?.includes('already exists')) {
        console.log(`ℹ️ Collection "${name}" already exists.`);
      } else {
        throw e;
      }
    }

    // Create fields
    for (const field of fields) {
      console.log(`  - Creating field: ${field.field}...`);
      try {
        await axios.post(`${url}/fields/${name}`, field, { headers });
        console.log(`    ✅ Field "${field.field}" created.`);
      } catch (e) {
        if (e.response?.data?.errors?.[0]?.extensions?.code === 'INVALID_PAYLOAD' || 
            (e.response?.data?.errors?.[0]?.message?.includes('already exists'))) {
          console.log(`    ℹ️ Field "${field.field}" already exists.`);
        } else {
          console.error(`    ❌ Failed to create field "${field.field}":`, e.response?.data || e.message);
        }
      }
    }
  } catch (e) {
    console.error(`❌ Failed to process collection "${name}":`, e.response?.data || e.message);
  }
}

async function setup() {
  console.log('🚀 Starting Directus Setup...');
  console.log(`📍 Target: ${url}`);

  // 1. Users Extension
  await createCollection('users', [
    { field: 'telegram_id', type: 'string', meta: { interface: 'input' } },
    { field: 'first_name', type: 'string', meta: { interface: 'input' } },
    { field: 'last_name', type: 'string', meta: { interface: 'input' } },
    { field: 'username', type: 'string', meta: { interface: 'input' } },
    { field: 'language', type: 'string', meta: { interface: 'input', options: { placeholder: 'ru' } } },
    { field: 'profile_summary', type: 'text', meta: { interface: 'input-multiline' } },
    { field: 'care_summary', type: 'text', meta: { interface: 'input-multiline' } },
    { field: 'procedure_stats', type: 'json', meta: { interface: 'input-code' } },
  ]);

  // 2. Events
  await createCollection('events', [
    { field: 'title', type: 'string', meta: { interface: 'input' } },
    { field: 'date', type: 'date', meta: { interface: 'datetime' } },
    { field: 'time', type: 'string', meta: { interface: 'input', options: { placeholder: 'HH:MM' } } },
    { field: 'description', type: 'text', meta: { interface: 'input-multiline' } },
    { field: 'color', type: 'string', meta: { interface: 'select-color' } },
    { field: 'user_id', type: 'integer', meta: { interface: 'input' } },
  ]);

  // 3. Tasks
  await createCollection('tasks', [
    { field: 'title', type: 'string', meta: { interface: 'input' } },
    { field: 'date', type: 'date', meta: { interface: 'datetime' } },
    { field: 'completed', type: 'boolean', meta: { interface: 'boolean' } },
    { field: 'user_id', type: 'integer', meta: { interface: 'input' } },
  ]);

  console.log('\n✨ Setup process finished.');
}

setup();
