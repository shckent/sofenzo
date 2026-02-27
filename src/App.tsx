import { useState, useEffect, useRef, useCallback } from 'react';
import WebApp from '@twa-dev/sdk';
import {
  Calendar as CalendarIcon,
  MessageCircle,
  User as UserIcon,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Trash2,
  Clock,
} from 'lucide-react';
import logo from './logo.png';
import { directus } from './lib/directus';
import { readItems, createItem, updateItem, deleteItem } from '@directus/sdk';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  color?: string;
}

interface DailyTask {
  id: string;
  title: string;
  date: string;
  completed: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ProcedureStat {
  name: string;
  count: number;
  last_date: string;
}

interface UserProfile {
  dbId: number | null;
  careSummary: string;        // What care the user does, what products they use
  procedureStats: ProcedureStat[]; // History of procedures done
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateId = () => Math.random().toString(36).substring(2, 15);

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

interface DayData {
  day: number;
  monthOffset: number;
  dateStr: string;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const days: DayData[] = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const date = new Date(year, month - 1, d);
    days.push({ day: d, monthOffset: -1, dateStr: formatDateStr(date) });
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({ day: d, monthOffset: 0, dateStr: formatDateStr(date) });
  }

  const remainingCells = 42 - days.length;
  for (let d = 1; d <= remainingCells; d++) {
    const date = new Date(year, month + 1, d);
    days.push({ day: d, monthOffset: 1, dateStr: formatDateStr(date) });
  }

  return days;
}

function formatDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

const EVENT_COLORS = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c'];

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'chat' | 'account'>('calendar');

  // Telegram user
  const [tgUser, setTgUser] = useState<{
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    language_code?: string;
  } | null>(null);

  // User profile from Directus (persistent memory)
  const [userProfile, setUserProfile] = useState<UserProfile>({
    dbId: null,
    careSummary: '',
    procedureStats: [],
  });

  // Calendar
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDateStr(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventColor, setNewEventColor] = useState(EVENT_COLORS[0]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem('sfz_messages') || '[]'); } catch { return []; }
  });
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [showSplash, setShowSplash] = useState(true);

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
      const u = WebApp.initDataUnsafe.user;
      if (u) {
        setTgUser(u as any);
        syncUserAndFetchData(u as any);
      } else {
        const mockUser = { id: 12345, first_name: 'Тестовый', last_name: 'Пользователь', username: 'test_user' };
        setTgUser(mockUser as any);
        syncUserAndFetchData(mockUser as any);
      }
    } catch (e) {
      console.warn('Telegram WebApp init failed', e);
    }

    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Persist messages to localStorage
  useEffect(() => { localStorage.setItem('sfz_messages', JSON.stringify(messages)); }, [messages]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── User Sync & Data Fetch ──────────────────────────────────────────────

  const syncUserAndFetchData = async (user: any) => {
    try {
      const telegramId = String(user.id);

      // Find or create user in Directus
      const existing = await directus.request(readItems('users', {
        filter: { telegram_id: { _eq: telegramId } },
        limit: 1,
      })) as any[];

      let dbUser: any;

      if (existing.length === 0) {
        dbUser = await directus.request(createItem('users', {
          telegram_id: telegramId,
          first_name: user.first_name,
          last_name: user.last_name || null,
          username: user.username || null,
          language: user.language_code || 'ru',
          care_summary: '',
          procedure_stats: [],
        }));
        console.log('✅ Created new user in Directus');
      } else {
        dbUser = existing[0];
      }

      // Load user profile (persistent memory)
      setUserProfile({
        dbId: dbUser.id,
        careSummary: dbUser.care_summary || '',
        procedureStats: Array.isArray(dbUser.procedure_stats) ? dbUser.procedure_stats : [],
      });

      // Fetch events and tasks filtered by this user
      await fetchUserData(dbUser.id);

    } catch (e) {
      console.error('Failed to sync user with Directus', e);
    }
  };

  const fetchUserData = async (dbUserId: number) => {
    try {
      const [directusEvents, directusTasks] = await Promise.all([
        directus.request(readItems('events', {
          filter: { user_id: { _eq: dbUserId } },
          sort: ['date', 'time'],
        })) as Promise<any[]>,
        directus.request(readItems('tasks', {
          filter: { user_id: { _eq: dbUserId } },
          sort: ['date'],
        })) as Promise<any[]>,
      ]);

      setEvents((directusEvents || []).map((e: any) => ({
        id: String(e.id),
        title: e.title,
        date: e.date,
        time: e.time,
        description: e.description,
        color: e.color || EVENT_COLORS[0],
      })));

      setTasks((directusTasks || []).map((t: any) => ({
        id: String(t.id),
        title: t.title,
        date: t.date,
        completed: t.completed || false,
      })));

      console.log(`✅ Loaded ${directusEvents?.length || 0} events and ${directusTasks?.length || 0} tasks for user ${dbUserId}`);
    } catch (e) {
      console.error('Failed to fetch user data from Directus', e);
    }
  };

  // ─── Update user memory in Directus ─────────────────────────────────────

  const updateUserMemory = async (updates: Partial<{ care_summary: string; procedure_stats: ProcedureStat[] }>) => {
    if (!userProfile.dbId) return;
    try {
      await directus.request(updateItem('users', userProfile.dbId, updates));
      setUserProfile(prev => ({
        ...prev,
        careSummary: updates.care_summary ?? prev.careSummary,
        procedureStats: updates.procedure_stats ?? prev.procedureStats,
      }));
    } catch (e) {
      console.error('Failed to update user memory in Directus', e);
    }
  };

  // ─── Calendar handlers ───────────────────────────────────────────────────

  const prevMonth = () => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const addEvent = async () => {
    if (!newEventTitle.trim() || !userProfile.dbId) return;

    try {
      const response = await directus.request(createItem('events', {
        title: newEventTitle.trim(),
        date: selectedDate,
        time: newEventTime || null,
        color: newEventColor,
        user_id: userProfile.dbId,
      })) as any;

      setEvents(prev => [...prev, {
        id: String(response.id),
        title: newEventTitle.trim(),
        date: selectedDate,
        time: newEventTime || undefined,
        color: newEventColor,
      }]);

      // Auto-update procedure stats
      updateProcedureStats(newEventTitle.trim(), selectedDate);
    } catch (e) { console.error('Failed to save event to Directus', e); }

    setNewEventTitle('');
    setNewEventTime('');
    setShowAddEvent(false);
    try { WebApp.HapticFeedback.impactOccurred('medium'); } catch { }
  };

  const deleteEvent = async (id: string) => {
    try {
      await directus.request(deleteItem('events', id));
    } catch (e) { console.error('Failed to delete event from Directus', e); }
    setEvents(prev => prev.filter(e => e.id !== id));
    try { WebApp.HapticFeedback.notificationOccurred('warning'); } catch { }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !userProfile.dbId) return;

    try {
      const response = await directus.request(createItem('tasks', {
        title: newTaskTitle.trim(),
        date: selectedDate,
        completed: false,
        user_id: userProfile.dbId,
      })) as any;

      setTasks(prev => [...prev, {
        id: String(response.id),
        title: newTaskTitle.trim(),
        date: selectedDate,
        completed: false,
      }]);
    } catch (e) { console.error('Failed to save task to Directus', e); }

    setNewTaskTitle('');
    setShowAddTask(false);
    try { WebApp.HapticFeedback.impactOccurred('light'); } catch { }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      try {
        await directus.request(updateItem('tasks', id, { completed: !task.completed }));
      } catch (e) { console.error('Failed to update task in Directus', e); }
    }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    try { WebApp.HapticFeedback.impactOccurred('light'); } catch { }
  };

  const deleteTask = async (id: string) => {
    try {
      await directus.request(deleteItem('tasks', id));
    } catch (e) { console.error('Failed to delete task from Directus', e); }
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Auto-update procedure stats when an event is added
  const updateProcedureStats = (procedureName: string, date: string) => {
    setUserProfile(prev => {
      const stats = [...prev.procedureStats];
      const existing = stats.find(s => s.name.toLowerCase() === procedureName.toLowerCase());
      if (existing) {
        existing.count += 1;
        existing.last_date = date;
      } else {
        stats.push({ name: procedureName, count: 1, last_date: date });
      }
      // Persist to Directus
      updateUserMemory({ procedure_stats: stats });
      return { ...prev, procedureStats: stats };
    });
  };

  const eventsForDate = events.filter(e => e.date === selectedDate);
  const tasksForDate = tasks.filter(t => t.date === selectedDate);
  const todayStr = formatDateStr(new Date());

  // ─── Chat handlers ───────────────────────────────────────────────────────

  const parseGptActions = useCallback((text: string) => {
    const patterns = {
      ADD_EVENT: /\[ACTION:ADD_EVENT\]([\s\S]*?)\[\/ACTION\]/g,
      UPDATE_EVENT: /\[ACTION:UPDATE_EVENT\]([\s\S]*?)\[\/ACTION\]/g,
      DELETE_EVENT: /\[ACTION:DELETE_EVENT\]([\s\S]*?)\[\/ACTION\]/g,
      ADD_TASK: /\[ACTION:ADD_TASK\]([\s\S]*?)\[\/ACTION\]/g,
      UPDATE_TASK: /\[ACTION:UPDATE_TASK\]([\s\S]*?)\[\/ACTION\]/g,
      DELETE_TASK: /\[ACTION:DELETE_TASK\]([\s\S]*?)\[\/ACTION\]/g,
      UPDATE_CARE_SUMMARY: /\[ACTION:UPDATE_CARE_SUMMARY\]([\s\S]*?)\[\/ACTION\]/g,
      UPDATE_PROC_STATS: /\[ACTION:UPDATE_PROCEDURE_STATS\]([\s\S]*?)\[\/ACTION\]/g,
    };

    let match;
    const newEventsToAdd: CalendarEvent[] = [];
    const eventIdsToDelete: string[] = [];
    const eventsToUpdate: { id: string; data: any }[] = [];
    const newTasksToAdd: DailyTask[] = [];
    const taskIdsToDelete: string[] = [];
    const tasksToUpdate: { id: string; data: any }[] = [];

    while ((match = patterns.ADD_EVENT.exec(text)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        newEventsToAdd.push({
          id: generateId(),
          title: data.title || 'Процедура',
          date: data.date || selectedDate,
          time: data.time,
          description: data.description,
          color: EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)],
        });
      } catch (e) { console.error('Failed to parse ADD_EVENT data', e); }
    }

    while ((match = patterns.UPDATE_EVENT.exec(text)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        if (data.id) eventsToUpdate.push({ id: data.id, data });
      } catch (e) { console.error('Failed to parse UPDATE_EVENT data', e); }
    }

    while ((match = patterns.DELETE_EVENT.exec(text)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        if (data.id) eventIdsToDelete.push(data.id);
      } catch (e) { console.error('Failed to parse DELETE_EVENT data', e); }
    }

    while ((match = patterns.ADD_TASK.exec(text)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        newTasksToAdd.push({
          id: generateId(),
          title: data.title || 'Задача',
          date: data.date || selectedDate,
          completed: false,
        });
      } catch (e) { console.error('Failed to parse ADD_TASK data', e); }
    }

    while ((match = patterns.UPDATE_TASK.exec(text)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        if (data.id) tasksToUpdate.push({ id: data.id, data });
      } catch (e) { console.error('Failed to parse UPDATE_TASK data', e); }
    }

    while ((match = patterns.DELETE_TASK.exec(text)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        if (data.id) taskIdsToDelete.push(data.id);
      } catch (e) { console.error('Failed to parse DELETE_TASK data', e); }
    }

    // Update care summary (what care the user does, what products they use)
    while ((match = patterns.UPDATE_CARE_SUMMARY.exec(text)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        if (data.summary) {
          updateUserMemory({ care_summary: data.summary });
        }
      } catch (e) { console.error('Failed to parse UPDATE_CARE_SUMMARY data', e); }
    }

    // Update procedure stats (number + name of procedures)
    while ((match = patterns.UPDATE_PROC_STATS.exec(text)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        if (Array.isArray(data.stats)) {
          updateUserMemory({ procedure_stats: data.stats });
        }
      } catch (e) { console.error('Failed to parse UPDATE_PROCEDURE_STATS data', e); }
    }

    // Process all DB actions
    const processBatchUpdates = async () => {
      const dbUserId = userProfile.dbId;

      if (newEventsToAdd.length > 0 || eventIdsToDelete.length > 0 || eventsToUpdate.length > 0) {
        const createdEvents: CalendarEvent[] = [];
        try {
          for (const ev of newEventsToAdd) {
            const res = await directus.request(createItem('events', {
              title: ev.title,
              date: ev.date,
              time: ev.time || null,
              description: ev.description || null,
              color: ev.color,
              user_id: dbUserId,
            })) as any;
            createdEvents.push({ ...ev, id: String(res.id) });
            // Auto-update stats
            updateProcedureStats(ev.title, ev.date);
          }
          for (const id of eventIdsToDelete) {
            await directus.request(deleteItem('events', id)).catch(e => console.warn('Delete event error', e));
          }
          for (const { id, data } of eventsToUpdate) {
            await directus.request(updateItem('events', id, data)).catch(e => console.warn('Update event error', e));
          }
        } catch (e) { console.error('Failed to sync batch events to Directus', e); }

        setEvents(prev => {
          let updated = prev.filter(e => !eventIdsToDelete.includes(e.id));
          eventsToUpdate.forEach(({ id, data }) => {
            updated = updated.map(e => e.id === id ? { ...e, ...data } : e);
          });
          return [...updated, ...createdEvents];
        });
      }

      if (newTasksToAdd.length > 0 || taskIdsToDelete.length > 0 || tasksToUpdate.length > 0) {
        const createdTasks: DailyTask[] = [];
        try {
          for (const task of newTasksToAdd) {
            const res = await directus.request(createItem('tasks', {
              title: task.title,
              date: task.date,
              completed: task.completed,
              user_id: dbUserId,
            })) as any;
            createdTasks.push({ ...task, id: String(res.id) });
          }
          for (const id of taskIdsToDelete) {
            await directus.request(deleteItem('tasks', id)).catch(e => console.warn('Delete task error', e));
          }
          for (const { id, data } of tasksToUpdate) {
            await directus.request(updateItem('tasks', id, data)).catch(e => console.warn('Update task error', e));
          }
        } catch (e) { console.error('Failed to sync batch tasks to Directus', e); }

        setTasks(prev => {
          let updated = prev.filter(t => !taskIdsToDelete.includes(t.id));
          tasksToUpdate.forEach(({ id, data }) => {
            updated = updated.map(t => t.id === id ? { ...t, ...data } : t);
          });
          return [...updated, ...createdTasks];
        });
      }

      if (newEventsToAdd.length > 0 || newTasksToAdd.length > 0) {
        try { WebApp.HapticFeedback.notificationOccurred('success'); } catch { }
      }
    };

    processBatchUpdates();
  }, [selectedDate, userProfile.dbId]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsSending(true);

    try {
      // Build procedure stats summary for the AI
      const procStatsText = userProfile.procedureStats.length > 0
        ? userProfile.procedureStats.map(p => `${p.name}: ${p.count} раз(а), последний раз ${p.last_date}`).join('; ')
        : 'Нет истории процедур';

      const systemPrompt = `Ты — Sofenzo Assistant, умный и дружелюбный AI-ассистент 💆‍♀️✨.
Твоя цель — помогать пользователю управлять бьюти-календарём, давать советы по уходу за собой и ПОМНИТЬ всё о нём.

═══════════════════════════════════════
👤 ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (ТВОЯ ПАМЯТЬ):
Имя: ${tgUser?.first_name || 'Пользователь'}
Telegram ID: ${tgUser?.id}

📖 УХОД И ПРЕДПОЧТЕНИЯ:
${userProfile.careSummary || 'Пока неизвестно. Спроси о типе кожи и используемых средствах.'}

📊 ИСТОРИЯ ПРОЦЕДУР:
${procStatsText}

═══════════════════════════════════════
📅 ТЕКУЩИЙ КОНТЕКСТ:
- Сегодня: ${todayStr}
- Выбранная дата в UI: ${selectedDate}
- Предстоящие события: ${JSON.stringify(events.filter(e => e.date >= todayStr).slice(0, 10).map(e => ({ id: e.id, title: e.title, date: e.date, time: e.time })))}
- Список задач: ${JSON.stringify(tasks.filter(t => !t.completed).slice(0, 10).map(t => ({ id: t.id, title: t.title, date: t.date })))}

═══════════════════════════════════════
📋 ПРАВИЛА:
1. Ты ПОМНИШЬ всё из блока "ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ" выше — это твоя долгосрочная память о нём.
2. Если пользователь сообщает новое о себе (тип кожи, средства, аллергии, предпочтения) — ОБЯЗАТЕЛЬНО обнови память командой UPDATE_CARE_SUMMARY.
3. Когда пользователь говорит "добавь в календарь", "внеси", "запиши" — СРАЗУ генерируй блоки [ACTION] БЕЗ переспросов.
4. Блоки [ACTION] система скроет сама. Пиши просто: "Готово! Я добавила всё в ваш календарь ✅".
5. Когда добавляешь несколько событий (курс процедур) — создай блок для КАЖДОГО сеанса отдельно.
6. При удалении события используй его точный ID из списка выше.

═══════════════════════════════════════
⚡ ДОСТУПНЫЕ КОМАНДЫ:
[ACTION:ADD_EVENT]{"title":"...","date":"YYYY-MM-DD","time":"HH:MM","description":"..."}[/ACTION]
[ACTION:UPDATE_EVENT]{"id":"...","title":"...","date":"...","time":"..."}[/ACTION]
[ACTION:DELETE_EVENT]{"id":"..."}[/ACTION]
[ACTION:ADD_TASK]{"title":"...","date":"YYYY-MM-DD"}[/ACTION]
[ACTION:UPDATE_TASK]{"id":"...","title":"...","date":"...","completed":true}[/ACTION]
[ACTION:DELETE_TASK]{"id":"..."}[/ACTION]
[ACTION:UPDATE_CARE_SUMMARY]{"summary":"ПОЛНЫЙ обновлённый текст о пользователе: тип кожи, средства, предпочтения, аллергии"}[/ACTION]
[ACTION:UPDATE_PROCEDURE_STATS]{"stats":[{"name":"...","count":0,"last_date":"YYYY-MM-DD"}]}[/ACTION]

Отвечай на языке пользователя. Используй эмодзи. Будь тёплой и профессиональной.`;

      const chatHistory = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatHistory,
            { role: 'user', content: text },
          ],
        }),
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      const assistantContent = data.content || 'Извините, произошла ошибка.';

      // Parse and execute actions
      parseGptActions(assistantContent);

      // Strip action blocks from shown text
      const cleanContent = assistantContent
        .replace(/\[ACTION:.*?\][\s\S]*?\[\/ACTION\]/g, '')
        .trim();

      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: cleanContent || '✅ Готово!',
        timestamp: Date.now(),
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: '⚠️ Не удалось подключиться к серверу. Убедитесь, что бот запущен (`npm start`).',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('sfz_messages');
  };

  // ─── Render: Calendar Tab ────────────────────────────────────────────────

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const days = getMonthDays(year, month);

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-slate-50/50 scroll-smooth">
        {/* Header */}
        <div className="sfz-header sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl bg-white/20 p-1.5 shadow-inner" />
            <div className="flex-1">
              <h1 className="text-xl font-extrabold text-white tracking-tight">Sofenzo</h1>
              <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Beauty Assistant ✨</p>
            </div>
            <Sparkles className="w-5 h-5 text-white/60" />
          </div>
        </div>

        {/* Month Navigation & Grid */}
        <div className="bg-white border-b border-rose-100/30">
          <div className="flex items-center justify-between px-5 py-3">
            <button onClick={prevMonth} className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 transition-colors active:scale-90">
              <ChevronLeft className="w-5 h-5 text-rose-500" />
            </button>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              {MONTHS_RU[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 transition-colors active:scale-90">
              <ChevronRight className="w-5 h-5 text-rose-500" />
            </button>
          </div>

          <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm border border-rose-100/50 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-rose-50">
              {DAYS_RU.map(d => (
                <div key={d} className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((dayObj, i) => {
                const { day, monthOffset, dateStr } = dayObj;
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const isCurrentMonth = monthOffset === 0;
                const hasEvents = events.some(e => e.date === dateStr);
                const hasTasks = tasks.some(t => t.date === dateStr);

                return (
                  <button
                    key={`${dateStr}-${i}`}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`aspect-square flex flex-col items-center justify-center relative transition-all ${isSelected
                      ? 'bg-gradient-to-br from-rose-400 to-pink-500 text-white rounded-xl mx-0.5 my-0.5 shadow-lg shadow-rose-200 z-10'
                      : isToday
                        ? 'bg-rose-50 text-rose-600 rounded-xl mx-0.5 my-0.5'
                        : isCurrentMonth
                          ? 'text-slate-700 hover:bg-slate-50'
                          : 'text-slate-300 hover:bg-slate-50/50'
                      }`}
                  >
                    <span className={`text-sm font-semibold ${isSelected ? 'text-white' : ''}`}>{day}</span>
                    {(hasEvents || hasTasks) && (
                      <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-rose-400'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Day Content */}
        <div className="px-4 py-4 space-y-4">
          <div className="px-1 mt-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-600">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}
              </h3>
            </div>

            {/* Events */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">📅 Процедуры</span>
                <button onClick={() => setShowAddEvent(true)} className="sfz-btn-sm">
                  <Plus className="w-3.5 h-3.5" /> Добавить
                </button>
              </div>

              {eventsForDate.length === 0 ? (
                <div className="text-center py-4 bg-white/60 rounded-xl border border-dashed border-rose-200">
                  <p className="text-xs text-slate-400">Нет процедур на этот день</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {eventsForDate.map(ev => (
                    <div key={ev.id} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-rose-50">
                      <div className="w-1 h-10 rounded-full" style={{ backgroundColor: ev.color || '#f472b6' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{ev.title}</p>
                        {ev.time && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-400">{ev.time}</span>
                          </div>
                        )}
                        {ev.description && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{ev.description}</p>
                        )}
                      </div>
                      <button onClick={() => deleteEvent(ev.id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">☑️ Задачи на день</span>
                <button onClick={() => setShowAddTask(true)} className="sfz-btn-sm">
                  <Plus className="w-3.5 h-3.5" /> Добавить
                </button>
              </div>

              {tasksForDate.length === 0 ? (
                <div className="text-center py-4 bg-white/60 rounded-xl border border-dashed border-violet-200">
                  <p className="text-xs text-slate-400">Нет задач на этот день</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasksForDate.map(task => (
                    <div key={task.id} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-violet-50">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${task.completed
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm'
                          : 'border-2 border-slate-200'
                          }`}
                      >
                        {task.completed && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                      <span className={`text-sm flex-1 ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
                        {task.title}
                      </span>
                      <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Add Event Modal */}
          {showAddEvent && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end z-50">
              <div className="bg-white w-full rounded-t-3xl p-5 pt-3 animate-slide-up safe-bottom">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-4">Новая процедура</h3>
                <input
                  type="text"
                  placeholder="Название процедуры..."
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                  className="sfz-input mb-3"
                  autoFocus
                />
                <input
                  type="time"
                  value={newEventTime}
                  onChange={e => setNewEventTime(e.target.value)}
                  className="sfz-input mb-3"
                />
                <div className="flex gap-2 mb-4">
                  {EVENT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewEventColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${newEventColor === c ? 'ring-2 ring-offset-2 ring-rose-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAddEvent(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm">
                    Отмена
                  </button>
                  <button onClick={addEvent} className="flex-1 py-3 rounded-xl sfz-btn-primary text-sm font-bold">
                    Добавить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Task Modal */}
          {showAddTask && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end z-50">
              <div className="bg-white w-full rounded-t-3xl p-5 pt-3 animate-slide-up safe-bottom">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-4">Новая задача</h3>
                <input
                  type="text"
                  placeholder="Что нужно сделать..."
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="sfz-input mb-4"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowAddTask(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm">
                    Отмена
                  </button>
                  <button onClick={addTask} className="flex-1 py-3 rounded-xl sfz-btn-primary text-sm font-bold">
                    Добавить
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Render: Chat Tab ────────────────────────────────────────────────────

  const renderChat = () => {
    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <div className="sfz-header flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <img src={logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl bg-white/20 p-1.5 shadow-inner" />
            <div className="flex-1">
              <h1 className="text-xl font-extrabold text-white tracking-tight">Sofenzo Chat</h1>
              <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Smart Assistant ✨</p>
            </div>
            <button
              onClick={clearChat}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
              title="Очистить чат"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 pt-12">
              <div className="w-20 h-20 rounded-full sfz-gradient flex items-center justify-center mb-5 shadow-lg shadow-rose-200">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Привет, {tgUser?.first_name || 'красавица'}! 💆‍♀️
              </h3>
              <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                Я помогу вам составить план бьюти-процедур, внести их в календарь и запомню всё о вашем уходе.
              </p>
              {userProfile.procedureStats.length > 0 && (
                <div className="mt-4 w-full max-w-xs bg-white rounded-xl p-3 border border-rose-100 shadow-sm text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">📊 Ваши процедуры</p>
                  {userProfile.procedureStats.slice(0, 3).map(p => (
                    <p key={p.name} className="text-xs text-slate-600">• {p.name}: {p.count}×</p>
                  ))}
                </div>
              )}
              <div className="mt-4 space-y-2 w-full max-w-xs">
                {[
                  'Составь курс дарсонваля на 2 недели',
                  'Какие маски лучше для сухой кожи?',
                  'Добавь задачу: нанести увлажняющий крем',
                ].map((hint, i) => (
                  <button
                    key={i}
                    onClick={() => { setChatInput(hint); chatInputRef.current?.focus(); }}
                    className="w-full text-left px-4 py-3 bg-white rounded-xl border border-rose-100 text-sm text-slate-600 hover:bg-rose-50 transition-colors shadow-sm"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                  ? 'sfz-gradient text-white rounded-br-md'
                  : 'bg-white text-slate-700 border border-rose-100/70 rounded-bl-md'
                  }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-white/50' : 'text-slate-300'} text-right`}>
                  {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-md px-5 py-3 border border-rose-100/70 shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-rose-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-rose-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-rose-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="px-4 pb-3 pt-2 bg-white/80 backdrop-blur-lg border-t border-rose-100/50 safe-bottom">
          <div className="flex items-end gap-2">
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Спросите о бьюти-процедурах..."
              rows={1}
              className="flex-1 resize-none bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-300 border border-slate-100 transition-all max-h-24"
            />
            <button
              onClick={sendMessage}
              disabled={isSending || !chatInput.trim()}
              className={`p-3 rounded-xl transition-all ${chatInput.trim() && !isSending
                ? 'sfz-gradient text-white shadow-md shadow-rose-200 active:scale-90'
                : 'bg-slate-100 text-slate-300'
                }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render: Account Tab ─────────────────────────────────────────────────

  const renderAccount = () => {
    const totalEvents = events.length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
      <div className="flex flex-col h-full overflow-y-auto pb-4 bg-slate-50/50">
        <div className="sfz-header sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 px-6 pt-6 pb-8">
            <img src={logo} alt="Logo" className="w-16 h-16 object-contain rounded-2xl bg-white/20 p-2 shadow-inner border border-white/10" />
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                {tgUser?.first_name || 'Пользователь'}
              </h2>
              <p className="text-xs text-white/70 font-bold uppercase tracking-widest mt-0.5">
                {tgUser?.username ? `@${tgUser.username}` : 'Sofenzo Profile'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 -mt-6 space-y-3 relative z-20">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-rose-50">
              <p className="text-2xl font-bold text-rose-500">{totalEvents}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Процедуры</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-violet-50">
              <p className="text-2xl font-bold text-violet-500">{totalTasks}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Задачи</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-emerald-50">
              <p className="text-2xl font-bold text-emerald-500">{completionRate}%</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Выполнено</p>
            </div>
          </div>

          {/* Procedure Statistics */}
          {userProfile.procedureStats.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-50">
              <h3 className="text-sm font-bold text-slate-700 mb-3">📊 История процедур</h3>
              <div className="space-y-2">
                {userProfile.procedureStats
                  .sort((a, b) => b.count - a.count)
                  .map(stat => (
                    <div key={stat.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{stat.name}</p>
                        <p className="text-[10px] text-slate-400">Последний раз: {stat.last_date}</p>
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        <span className="text-sm font-bold text-rose-500">{stat.count}×</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Care Summary */}
          {userProfile.careSummary && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-violet-50">
              <h3 className="text-sm font-bold text-slate-700 mb-2">💆‍♀️ Мой уход</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{userProfile.careSummary}</p>
            </div>
          )}

          {/* Upcoming Procedures */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-50">
            <h3 className="text-sm font-bold text-slate-700 mb-3">📅 Ближайшие процедуры</h3>
            {events.filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Нет запланированных процедур</p>
            ) : (
              <div className="space-y-2">
                {events.filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                    <div className="w-1 h-8 rounded-full" style={{ backgroundColor: ev.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{ev.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(ev.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        {ev.time ? ` в ${ev.time}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 mb-3">ℹ️ О приложении</h3>
            <div className="space-y-2 text-sm text-slate-500">
              <div className="flex justify-between">
                <span>Версия</span>
                <span className="font-medium text-slate-700">2.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>Telegram ID</span>
                <span className="font-medium text-slate-700">{tgUser?.id || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Язык</span>
                <span className="font-medium text-slate-700">{tgUser?.language_code || 'ru'}</span>
              </div>
            </div>
          </div>

          <div className="text-center py-4">
            <p className="text-xs text-slate-300 font-medium">Made with 💖 by Sofenzo</p>
          </div>
        </div>
      </div>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────────────

  return (
    <div className="sfz-app flex flex-col h-screen bg-gradient-to-b from-rose-50 via-white to-violet-50/30 overflow-hidden relative">
      {showSplash && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white animate-fade-in">
          <div className="text-center animate-scale-in">
            <img src={logo} alt="Sofenzo Logo" className="w-40 h-40 object-contain mb-4 mx-auto" />
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-rose-400 to-pink-600 bg-clip-text text-transparent">
              Sofenzo
            </h1>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeTab === 'calendar' && renderCalendar()}
        {activeTab === 'chat' && renderChat()}
        {activeTab === 'account' && renderAccount()}
      </div>

      <nav className="sfz-nav flex items-center justify-around px-6 py-2 safe-bottom">
        <button onClick={() => setActiveTab('calendar')} className={`sfz-tab ${activeTab === 'calendar' ? 'sfz-tab-active' : ''}`}>
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-semibold mt-0.5">Календарь</span>
        </button>
        <button onClick={() => setActiveTab('chat')} className={`sfz-tab ${activeTab === 'chat' ? 'sfz-tab-active' : ''}`}>
          <MessageCircle className="w-6 h-6" />
          <span className="text-[10px] font-semibold mt-0.5">Чат</span>
        </button>
        <button onClick={() => setActiveTab('account')} className={`sfz-tab ${activeTab === 'account' ? 'sfz-tab-active' : ''}`}>
          <UserIcon className="w-6 h-6" />
          <span className="text-[10px] font-semibold mt-0.5">Аккаунт</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
