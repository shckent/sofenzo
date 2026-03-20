import React, { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { CalendarTab } from './components/CalendarTab';
import { ChatTab } from './components/ChatTab';
import { AccountTab } from './components/AccountTab';
import { useStore } from './store';

export default function App() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'chat' | 'account'>('calendar');
  const { procedures, addProcedures, toggleProcedure, preferences, updatePreferences } = useStore();
  const [telegramUser, setTelegramUser] = useState<any>(null);

  useEffect(() => {
    // Initialize Telegram Web App
    WebApp.ready();
    WebApp.expand();
    
    // Set header color to match our app
    WebApp.setHeaderColor('#ec4899'); // pink-500
    
    if (WebApp.initDataUnsafe.user) {
      setTelegramUser(WebApp.initDataUnsafe.user);
    } else {
      // Mock user for local development
      setTelegramUser({
        id: 123456789,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'ru'
      });
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      <Header activeTab={activeTab} telegramUser={telegramUser} />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'calendar' && (
          <CalendarTab 
            procedures={procedures} 
            toggleProcedure={toggleProcedure} 
            addProcedures={addProcedures}
          />
        )}
        {activeTab === 'chat' && (
          <ChatTab 
            onScheduleProcedures={addProcedures} 
            userId={telegramUser?.id?.toString() || 'anonymous'} 
          />
        )}
        {activeTab === 'account' && (
          <AccountTab 
            preferences={preferences} 
            procedures={procedures} 
            telegramUser={telegramUser} 
            toggleProcedure={toggleProcedure}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
