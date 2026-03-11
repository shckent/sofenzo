import 'dotenv/config';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDirectus, rest, staticToken, readItems, createItem } from '@directus/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;
const directusUrl = process.env.VITE_DIRECTUS_URL || process.env.DIRECTUS_URL;
const directusToken = process.env.VITE_DIRECTUS_TOKEN || process.env.DIRECTUS_TOKEN;
const PORT = process.env.PORT || 3001;

// ─── Directus Setup ───────────────────────────────────────────────────────
if (!directusUrl) {
  console.error('\n❌ CRITICAL ERROR: VITE_DIRECTUS_URL or DIRECTUS_URL is not defined!');
  console.error('If you are on Railway, please add these variables to your environment settings.');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('\n❌ CRITICAL ERROR: OPENAI_API_KEY is not defined!');
  process.exit(1);
}

if (!telegramToken) {
  console.error('\n❌ CRITICAL ERROR: TELEGRAM_BOT_TOKEN is not defined!');
  process.exit(1);
}

const directus = createDirectus(directusUrl)
  .with(staticToken(directusToken))
  .with(rest());

console.log('🗝️ OpenAI API Key loaded:', `Yes (${openaiApiKey.substring(0, 8)}...)`);
console.log('📦 Directus Connection:', `Targeting ${directusUrl}`);
console.log('🤖 Telegram Bot Token:', `Loaded (${telegramToken.substring(0, 10)}...)`);

// Global Error Handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// ─── Express Setup ─────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.send('OK'));

// ─── GPT Chat Proxy ────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  if (!openaiApiKey) {
    console.log('⚠️ No OpenAI API key - using Demo Mode');
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();
    const demoResponse = generateDemoResponse(lastUserMsg?.content || '');
    console.log('📤 Sending Demo response');
    return res.json({ content: demoResponse });
  }

  console.log('🤖 Sending request to OpenAI...');

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('✅ OpenAI Response received');
    const content = response.data.choices?.[0]?.message?.content || 'Не удалось получить ответ.';
    res.json({ content });
  } catch (error) {
    console.error('❌ OpenAI API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Ошибка при обращении к AI',
      content: '⚠️ Извините, не удалось получить ответ от AI. Попробуйте позже.',
    });
  }
});

// ─── Demo Response Generator ───────────────────────────────────────────────

function generateDemoResponse(userMessage) {
  const msg = userMessage.toLowerCase();
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  if (msg.includes('дарсонваль') || msg.includes('курс')) {
    if (msg.includes('да') || msg.includes('ок') || msg.includes('подходит') || msg.includes('согласен') || msg.includes('yes')) {
      return `Отлично! ✅ Я добавил первые сеансы в ваш календарь.

[ACTION:ADD_EVENT]{"title":"Дарсонваль — сеанс 1","date":"${today}","time":"20:00","description":"Первый сеанс дарсонвализации, 10 минут"}[/ACTION]
[ACTION:ADD_EVENT]{"title":"Дарсонваль — сеанс 2","date":"${tomorrow}","time":"20:00","description":"Второй сеанс дарсонвализации"}[/ACTION]
[ACTION:ADD_TASK]{"title":"Подготовить кожу: очистить лицо","date":"${today}"}[/ACTION]
[ACTION:ADD_TASK]{"title":"Нанести увлажняющий крем после процедуры","date":"${today}"}[/ACTION]

Вы можете увидеть их во вкладке Календарь. Хотите добавить что-то еще? 🌸`;
    }

    return `Отличный выбор! 💆‍♀️ Давайте составим курс дарсонвализации.

📋 **Рекомендуемый курс:**
- Продолжительность: 10 сеансов
- Периодичность: через день
- Сеанс: 10 минут вечром

Я предлагаю начать сегодня (${today}) в 20:00 и продолжить завтра (${tomorrow}) в то же время.

**Подходят ли вам эти даты?** Если да, я сразу внесу их в ваш календарь! ✨`;
  }

  if (msg.includes('маск') || msg.includes('кожа') || msg.includes('сухая') || msg.includes('сухой')) {
    if (msg.includes('да') || msg.includes('добавь') || msg.includes('подходит')) {
      return `Задачи на сегодня добавлены! ✨ Не забудьте их выполнить для лучшего эффекта.

[ACTION:ADD_TASK]{"title":"Сделать медовую маску для лица (15-20 мин)","date":"${today}"}[/ACTION]

Что-нибудь еще? 💖`;
    }

    return `Для сухой кожи отлично подойдет **медовая маска** 🧖‍♀️.
Я могу добавить задачу "Сделать медвую маску" на сегодня (${today}).

**Добавить её в ваш список дел?** 🌸`;
  }

  if (msg.includes('задач') || msg.includes('добавь') || msg.includes('список')) {
    return `Конечно! ✅ Добавляю в ваш список дел:

[ACTION:ADD_TASK]{"title":"Утренний уход: очищение + тоник + крем","date":"${today}"}[/ACTION]
[ACTION:ADD_TASK]{"title":"Вечерний уход: демакияж + сыворотка + крем","date":"${today}"}[/ACTION]

Задачи добавлены! Не забудьте отметить их после выполнения 💪`;
  }

  return `Спасибо за ваш вопрос! 💖 Я — помощник Sofenzo.
Я могу помочь вам спланировать бьюти-процедуры и управлять календарем.

Например, вы можете сказать: "Создай курс дарсонваля" или "Что посоветуешь для сухой кожи?".

Просто скажите, что нужно сделать! 🌸`;
}

// ─── Directus Proxy (CORS fix) ──────────────────────────────────────────────
app.use('/api/directus', async (req, res) => {
  const innerPath = req.path.replace(/^\//, '');
  const method = req.method;
  const query = req.query;
  const body = req.body;

  if (!directusUrl) {
    return res.status(500).json({ error: 'Directus URL not configured' });
  }

  console.log(`📡 Proxying ${method} to Directus: ${innerPath}`);
  
  try {
    const config = {
      method,
      url: `${directusUrl}/${innerPath}`,
      params: query,
      headers: {
        'Authorization': `Bearer ${directusToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 seconds
    };

    // Only attach body for methods that should have one
    if (['POST', 'PATCH', 'PUT'].includes(method.toUpperCase()) && body && Object.keys(body).length > 0) {
      config.data = body;
    }

    const response = await axios(config);
    console.log(`✅ Directus Proxy Success: ${method} ${innerPath} (${response.status})`);
    res.status(response.status).json(response.data);
  } catch (error) {
    if (innerPath !== 'health') {
      console.error(`❌ Directus Proxy Error [${method} ${innerPath}]:`, error.response?.data || error.message);
    }
    const status = error.code === 'ECONNABORTED' ? 504 : (error.response?.status || 500);
    const message = error.code === 'ECONNABORTED' ? { error: 'Directus request timed out' } : (error.response?.data || { error: error.message });
    res.status(status).json(message);
  }
});

// ─── Directus Logic ────────────────────────────────────────────────────────

async function getOrUpdateUser(tgUserData) {
  if (!directusUrl) return null;

  try {
    const telegramId = String(tgUserData.id);

    const users = await directus.request(
      readItems('users', {
        filter: { telegram_id: { _eq: telegramId } },
        limit: 1
      })
    );

    if (users && users.length > 0) {
      return users[0];
    }

    const newUser = await directus.request(
      createItem('users', {
        telegram_id: telegramId,
        first_name: tgUserData.first_name,
        last_name: tgUserData.last_name,
        username: tgUserData.username,
        language: tgUserData.language_code || 'ru',
        profile_summary: '',
      })
    );
    console.log(`✅ Created new user in Directus: ${tgUserData.id}`);
    return newUser;
  } catch (error) {
    console.error('❌ Directus error (getOrUpdateUser):', error.message);
    return null;
  }
}

// ─── Serve Static & Routing ────────────────────────────────────────────────

// Serve static files from the React dist folder
app.use(express.static(path.join(__dirname, 'dist')));

// Health Check
app.get('/health', (req, res) => res.send('OK'));

// Proxy routes (GPT and Directus) should be defined before the catch-all
// ... (the /api/chat and /api/directus routes are already defined above)

// Catch-all route to serve index.html for client-side routing
app.get(/.*/, (req, res) => {
  // If the request is for an API route that wasn't matched, don't serve index.html
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌸 Sofenzo Assistant server running on port ${PORT}`);
  console.log(`🌍 Serving frontend from /dist folder`);
});

// ─── Telegram Bot (Long Polling) ───────────────────────────────────────────

let lastUpdateId = 0;

async function handleUpdates() {
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
    const response = await axios.get(url, { timeout: 40000 });
    const updates = response.data.result;

    if (!Array.isArray(updates)) return;

    for (const update of updates) {
      lastUpdateId = update.update_id;

      if (update.message?.text === '/start') {
        const userData = update.message.from;
        const firstName = userData.first_name || '';

        await getOrUpdateUser(userData);

        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          chat_id: update.message.chat.id,
          text: `Привет, ${firstName}! 💆‍♀️✨\n\n` +
            `Добро пожаловать в <b>Sofenzo Assistant</b> — вашего умного бьюти-планировщика!\n\n` +
            `🗓 Планируйте курсы бьюти-процедур\n` +
            `💬 Получайте советы от AI-ассистента\n` +
            `✅ Ведите список ежедневных задач\n` +
            `🔔 Получайте напоминания о процедурах\n\n` +
            `Нажмите <b>кнопку меню</b> 📱 внизу, чтобы открыть приложение и начать!`,
          parse_mode: 'HTML',
        });
      }
    }
  } catch (error) {
    if (error.code !== 'ECONNRESET' && error.code !== 'ETIMEDOUT') {
      console.error('Error getting updates:', error.message);
      if (error.response?.status === 401) {
        console.warn('⚠️ Telegram token is invalid. Stopping bot updates...');
        return;
      }
    }
  }
  setTimeout(handleUpdates, 1000);
}

async function initBot() {
  try {
    console.log('🤖 Clearing Telegram webhook...');
    await axios.post(`https://api.telegram.org/bot${telegramToken}/deleteWebhook`, { drop_pending_updates: true });
    console.log('✅ Webhook cleared. Starting long polling...');
    await new Promise(r => setTimeout(r, 2000));
    handleUpdates();
  } catch (error) {
    console.error('Failed to initialize bot:', error.message);
    setTimeout(handleUpdates, 5000);
  }
}

if (telegramToken && telegramToken !== 'undefined') {
  initBot();
} else {
  console.log('ℹ️ Telegram token not found, bot features disabled.');
}

console.log('🌸 Sofenzo Assistant Bot started!');
