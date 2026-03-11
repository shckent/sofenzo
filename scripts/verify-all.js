import 'dotenv/config';
import axios from 'axios';
import { createDirectus, rest, staticToken, readCollections } from '@directus/sdk';

async function runVerification() {
    console.log('🚀 Starting Full System Verification...\n');

    // 1. Environment Variables
    console.log('📋 Checking .env variables:');
    const required = ['OPENAI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'VITE_DIRECTUS_URL', 'VITE_DIRECTUS_TOKEN'];
    required.forEach(key => {
        console.log(`- ${key}: ${process.env[key] ? '✅ Found' : '❌ MISSING'}`);
    });

    // 2. Directus Connection
    console.log('\n📦 Checking Directus:');
    try {
        const directus = createDirectus(process.env.VITE_DIRECTUS_URL)
            .with(staticToken(process.env.VITE_DIRECTUS_TOKEN))
            .with(rest());

        // Test collection access
        const collections = await directus.request(readCollections());
        const names = collections.map(c => c.collection);
        const expected = ['users', 'events', 'tasks'];
        expected.forEach(name => {
            console.log(`- Collection "${name}": ${names.includes(name) ? '✅ OK' : '❌ NOT FOUND'}`);
        });
    } catch (e) {
        console.error('❌ Directus Connection failed:', e.message);
    }

    // 3. OpenAI API
    console.log('\n🤖 Checking OpenAI:');
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5
        }, {
            headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
        });
        console.log('- API Connection: ✅ OK');
    } catch (e) {
        console.error('❌ OpenAI API failed:', e.response?.data?.error?.message || e.message);
    }

    // 4. Telegram Bot
    console.log('\n📱 Checking Telegram Bot:');
    try {
        const res = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
        console.log(`- Bot "${res.data.result.first_name}" (@${res.data.result.username}): ✅ OK`);
    } catch (e) {
        console.error('❌ Telegram Bot failed (401 means invalid token):', e.response?.data?.description || e.message);
    }

    console.log('\n✨ Verification complete.');
}

runVerification();
