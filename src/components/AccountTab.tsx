import React from 'react';
import { UserPreferences, Procedure } from '../store';
import { format, isAfter, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Settings, Info, Calendar as CalendarIcon, CheckCircle2, Clock, Circle } from 'lucide-react';
import { clsx } from 'clsx';

interface AccountTabProps {
  preferences: UserPreferences;
  procedures: Procedure[];
  telegramUser: any;
  toggleProcedure: (id: string) => void;
}

export function AccountTab({ preferences, procedures, telegramUser, toggleProcedure }: AccountTabProps) {
  const totalProcedures = procedures.length;
  const completedProcedures = procedures.filter(p => p.completed).length;
  const completionRate = totalProcedures > 0 ? Math.round((completedProcedures / totalProcedures) * 100) : 0;

  const today = new Date();
  const upcomingProcedures = procedures
    .filter(p => isAfter(new Date(p.date), today) || isToday(new Date(p.date)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto pb-24 bg-gray-50 w-full h-full">
      <div className="bg-gradient-to-b from-pink-500 to-purple-600 p-6 pt-8 pb-12 rounded-b-[40px] text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-xl border-4 border-white/20">
            {telegramUser?.photo_url ? (
              <img src={telegramUser.photo_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="text-pink-500 font-bold text-3xl">
                {telegramUser?.first_name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{telegramUser?.first_name || 'Пользователь'}</h2>
            <p className="text-pink-100 font-medium opacity-90">@{telegramUser?.username || 'username'}</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-20">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center transition-transform hover:scale-105">
            <span className="text-2xl font-black text-pink-500 mb-1">{totalProcedures}</span>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Процедуры</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center transition-transform hover:scale-105">
            <span className="text-2xl font-black text-purple-500 mb-1">{completedProcedures}</span>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Задачи</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center transition-transform hover:scale-105">
            <span className="text-2xl font-black text-emerald-500 mb-1">{completionRate}%</span>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Выполнено</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-5 border-b border-gray-50 flex items-center gap-3">
            <div className="p-2 bg-pink-50 rounded-xl text-pink-500">
              <CalendarIcon size={20} />
            </div>
            <h3 className="font-bold text-gray-800">Ближайшие процедуры</h3>
          </div>
          <div className="p-5">
            {upcomingProcedures.length > 0 ? (
              <div className="space-y-4">
                {upcomingProcedures.map(proc => (
                  <div key={proc.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-pink-50 group-hover:text-pink-500 transition-colors">
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{proc.name}</p>
                        <p className="text-xs text-gray-500 font-medium">
                          {format(new Date(proc.date), 'd MMMM, EEEE', { locale: ru })}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => toggleProcedure(proc.id)} className="focus:outline-none flex-shrink-0">
                      {proc.completed ? (
                        <CheckCircle2 size={24} className="text-emerald-500" />
                      ) : (
                        <Circle size={24} className="text-gray-300" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm py-4 font-medium">Нет запланированных процедур</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-5 border-b border-gray-50 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-500">
              <Info size={20} />
            </div>
            <h3 className="font-bold text-gray-800">О приложении</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium text-sm">Версия</span>
              <span className="text-gray-900 font-bold text-sm">1.0.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium text-sm">Telegram ID</span>
              <span className="text-gray-900 font-mono text-sm bg-gray-50 px-2 py-1 rounded-md">{telegramUser?.id || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium text-sm">Язык</span>
              <span className="text-gray-900 font-bold text-sm uppercase">{telegramUser?.language_code || 'ru'}</span>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 font-medium py-4">
          Made with <span className="text-pink-500">♥</span> by Sofenzo
        </div>
      </div>
    </div>
  );
}
