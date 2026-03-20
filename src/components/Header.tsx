import React from 'react';

interface HeaderProps {
  activeTab: 'calendar' | 'chat' | 'account';
  telegramUser: any;
}

export function Header({ activeTab, telegramUser }: HeaderProps) {
  let title = 'Sofenzo';
  let subtitle = 'BEAUTY ASSISTANT ✨';

  if (activeTab === 'chat') {
    title = 'Sofenzo Chat';
    subtitle = 'SMART ASSISTANT ✨';
  } else if (activeTab === 'account' && telegramUser) {
    title = telegramUser.first_name || 'User';
    subtitle = `@${telegramUser.username || 'username'}`;
  }

  return (
    <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-4 text-white flex items-center rounded-b-3xl shadow-md z-10 relative">
      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-4 overflow-hidden shadow-sm">
        <div className="relative w-full h-full flex items-center justify-center bg-gray-50">
           <span className="font-bold text-black text-[10px] absolute top-0.5 left-1">F</span>
           <span className="font-bold text-black text-[10px] absolute top-0.5 right-1">N</span>
           <span className="font-bold text-black text-[10px] absolute bottom-0.5 left-1">S</span>
           <span className="font-bold text-black text-[10px] absolute bottom-0.5 right-1">O</span>
           <div className="w-4 h-4 bg-black rounded-full z-10"></div>
        </div>
      </div>
      <div>
        <h1 className="font-bold text-xl leading-tight">{title}</h1>
        <p className="text-[10px] uppercase tracking-wider opacity-90 font-medium">{subtitle}</p>
      </div>
    </div>
  );
}
