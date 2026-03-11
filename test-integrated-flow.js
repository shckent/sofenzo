import 'dotenv/config';
import axios from 'axios';
import { createDirectus, rest, staticToken, createItem, readItems, deleteItem } from '@directus/sdk';

const directus = createDirectus(process.env.VITE_DIRECTUS_URL)
  .with(staticToken(process.env.VITE_DIRECTUS_TOKEN))
  .with(rest());

const systemPrompt = `Ты — Sofenzo Assistant. Твоя цель — помогать пользователю управлять бьюти-календарём.
Сегодня: 2026-03-11

ДОСТУПНЫЕ КОМАНДЫ:
[ACTION:ADD_EVENT]{"title":"...","date":"YYYY-MM-DD","time":"HH:MM"}[/ACTION]
`;

async function testIntegratedFlow() {
  console.log('🧪 Starting Integrated Flow Test...');
  
  const testUserId = 1; // shckent
  const testTitle = `Test Event ${Math.floor(Math.random() * 10000)}`;

  try {
    // 1. Send chat message to OpenAI directly
    console.log('💬 Sending chat message to OpenAI...');
    const chatRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `добавь ${testTitle} на завтра в 10:00` }
      ]
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });

    const content = chatRes.data.choices[0].message.content;
    console.log('🤖 GPT Response:', content);

    // 2. Parse Actions (Logic from App.tsx)
    const pattern = /\[ACTION:ADD_EVENT\]([\s\S]*?)\[\/ACTION\]/g;
    let match;
    const actions = [];
    while ((match = pattern.exec(content)) !== null) {
      actions.push(JSON.parse(match[1].trim()));
    }

    if (actions.length === 0) {
      console.error('❌ No action found in GPT response');
      return;
    }

    console.log('✅ Found Action:', actions[0]);

    // 3. Save to Directus (Logic from App.tsx)
    console.log('📦 Saving to Directus...');
    const directusRes = await directus.request(createItem('events', {
      title: actions[0].title,
      date: actions[0].date,
      time: actions[0].time || null,
      user_id: testUserId
    }));

    console.log('✅ Saved to Directus with ID:', directusRes.id);

    // 4. Verify in Directus
    console.log('🔍 Verifying entry in Directus...');
    const verifyRes = await directus.request(readItems('events', {
      filter: { id: { _eq: directusRes.id } }
    }));

    if (verifyRes.length > 0 && verifyRes[0].title === actions[0].title) {
      console.log('✨ Integrated Flow SUCCESS: Event verified in Directus!');
      
      // Cleanup
      console.log('🧹 Cleaning up test event...');
      await directus.request(deleteItem('events', directusRes.id));
      console.log('✅ Cleanup done.');
    } else {
      console.error('❌ Integrated Flow FAILED: Could not verify event in Directus.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testIntegratedFlow();
