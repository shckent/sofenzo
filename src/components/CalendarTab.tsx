import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Procedure } from '../store';
import { v4 as uuidv4 } from 'uuid';

interface CalendarTabProps {
  procedures: Procedure[];
  toggleProcedure: (id: string) => void;
  addProcedures: (procedures: Procedure[]) => void;
}

export function CalendarTab({ procedures, toggleProcedure, addProcedures }: CalendarTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [newProcedureName, setNewProcedureName] = useState('');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = monthStart;
  const endDate = monthEnd;

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const onDateClick = (day: Date) => setSelectedDate(day);

  const handleAddProcedure = () => {
    if (!newProcedureName.trim()) return;
    
    const newProc: Procedure = {
      id: uuidv4(),
      name: newProcedureName.trim(),
      date: format(selectedDate, 'yyyy-MM-dd'),
      completed: false
    };
    
    addProcedures([newProc]);
    setNewProcedureName('');
    setIsAdding(false);
  };

  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const proceduresForSelectedDate = procedures.filter(p => p.date === selectedDateString);

  // Get weekday names starting from Monday
  const weekDays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

  // Calculate empty cells before the first day of the month
  const startDayOfWeek = getDay(monthStart);
  const emptyDaysCount = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const emptyDays = Array.from({ length: emptyDaysCount }, (_, i) => i);

  return (
    <div className="flex-1 overflow-y-auto pb-24 bg-gray-50 w-full h-full">
      <div className="bg-white rounded-3xl shadow-sm m-4 p-4">
        <div className="flex justify-between items-center mb-6">
          <button onClick={prevMonth} className="p-2 text-pink-500 hover:bg-pink-50 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-lg font-bold text-gray-800 capitalize">
            {format(currentDate, dateFormat, { locale: ru })}
          </h2>
          <button onClick={nextMonth} className="p-2 text-pink-500 hover:bg-pink-50 rounded-full transition-colors">
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-semibold text-gray-400">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {emptyDays.map(i => (
            <div key={`empty-${i}`} className="h-10"></div>
          ))}
          {days.map(day => {
            const dateString = format(day, 'yyyy-MM-dd');
            const hasProcedures = procedures.some(p => p.date === dateString);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <div
                key={day.toString()}
                onClick={() => onDateClick(day)}
                className={clsx(
                  "h-10 flex items-center justify-center rounded-full cursor-pointer transition-all relative font-medium text-sm",
                  !isCurrentMonth ? "text-gray-300" : "text-gray-700",
                  isSelected ? "bg-pink-500 text-white shadow-md shadow-pink-200 scale-110 z-10" : "hover:bg-gray-100",
                  hasProcedures && !isSelected && "bg-pink-50 text-pink-600"
                )}
              >
                <span>{format(day, 'd')}</span>
                {hasProcedures && !isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 bg-pink-500 rounded-full"></span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-gray-600 font-medium text-sm">
            {format(selectedDate, 'EEEE, d MMMM', { locale: ru })}
          </h3>
          <button onClick={() => setIsAdding(true)} className="flex items-center gap-1 bg-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-md shadow-pink-200 hover:bg-pink-600 transition-colors">
            <Plus size={16} /> Добавить
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 min-h-[100px]">
          {proceduresForSelectedDate.length > 0 ? (
            <div className="space-y-3">
              {proceduresForSelectedDate.map(proc => (
                <div key={proc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleProcedure(proc.id)} className="focus:outline-none flex-shrink-0">
                      {proc.completed ? (
                        <CheckCircle2 size={24} className="text-pink-500" />
                      ) : (
                        <Circle size={24} className="text-gray-300" />
                      )}
                    </button>
                    <span className={clsx("font-medium", proc.completed ? "text-gray-400 line-through" : "text-gray-800")}>
                      {proc.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm py-8">
              Нет процедур на этот день
            </div>
          )}
        </div>
      </div>

      {/* Add Procedure Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800">Новая процедура</h3>
              <button onClick={() => { setIsAdding(false); setNewProcedureName(''); }} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5 font-medium">
              На {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
            </p>
            
            <input
              type="text"
              value={newProcedureName}
              onChange={(e) => setNewProcedureName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProcedure()}
              placeholder="Название процедуры (напр. Массаж лица)"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all text-sm"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => { setIsAdding(false); setNewProcedureName(''); }}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors text-sm"
              >
                Отмена
              </button>
              <button
                onClick={handleAddProcedure}
                disabled={!newProcedureName.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-pink-500 hover:bg-pink-600 disabled:opacity-50 transition-colors shadow-sm shadow-pink-200 text-sm"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
