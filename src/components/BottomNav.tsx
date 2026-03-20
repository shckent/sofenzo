import React from 'react';
import { Calendar, MessageCircle, User } from 'lucide-react';
import { clsx } from 'clsx';

interface BottomNavProps {
  activeTab: 'calendar' | 'chat' | 'account';
  setActiveTab: (tab: 'calendar' | 'chat' | 'account') => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const tabs = [
    { id: 'calendar', icon: Calendar, label: 'Календарь' },
    { id: 'chat', icon: MessageCircle, label: 'Чат' },
    { id: 'account', icon: User, label: 'Аккаунт' },
  ] as const;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around pb-safe pt-2 px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex flex-col items-center p-2 rounded-xl transition-all duration-200",
              isActive ? "text-pink-500 scale-110" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className={clsx(
              "p-2 rounded-xl mb-1",
              isActive ? "bg-pink-50" : "bg-transparent"
            )}>
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
