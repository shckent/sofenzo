import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Procedure } from '../store';
import { v4 as uuidv4 } from 'uuid';

interface ChatTabProps {
  onScheduleProcedures: (procedures: Procedure[]) => void;
  userId: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  isFunctionCall?: boolean;
  functionData?: any;
}

export function ChatTab({ onScheduleProcedures, userId }: ChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Привет! Я Sofenzo Assistant. Чем могу помочь? Хотите запланировать курс процедур?', sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          userId,
          history: messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }))
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: data.text, 
        sender: 'ai',
        isFunctionCall: !!data.functionCall,
        functionData: data.functionCall
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        text: '⚠️ Не удалось подключиться к серверу. Пожалуйста, попробуйте позже.\n\nСовет: Убедитесь, что сервер запущен (`npm start`).', 
        sender: 'ai' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSchedule = (functionData: any) => {
    const newProcedures: Procedure[] = functionData.args.calculatedDates.map((date: string) => ({
      id: uuidv4(),
      name: functionData.args.procedureName,
      date: date,
      completed: false
    }));
    
    onScheduleProcedures(newProcedures);
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: `Отлично! Я добавил ${newProcedures.length} процедур "${functionData.args.procedureName}" в ваш календарь.`,
      sender: 'ai'
    }]);
  };

  return (
    <div className="flex flex-col flex-1 h-full bg-gray-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={clsx("flex", msg.sender === 'user' ? "justify-end" : "justify-start")}>
            <div className={clsx(
              "max-w-[80%] rounded-2xl p-3 shadow-sm",
              msg.sender === 'user' 
                ? "bg-pink-500 text-white rounded-tr-sm" 
                : "bg-white text-gray-800 rounded-tl-sm border border-gray-100"
            )}>
              <div className="flex items-center gap-2 mb-1 opacity-70">
                {msg.sender === 'ai' ? <Bot size={14} /> : <User size={14} />}
                <span className="text-[10px] uppercase font-bold">{msg.sender === 'ai' ? 'Sofenzo' : 'Вы'}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              
              {msg.isFunctionCall && msg.functionData?.name === 'scheduleProcedures' && (
                <div className="mt-3 bg-pink-50 p-3 rounded-xl border border-pink-100">
                  <p className="text-xs font-medium text-pink-800 mb-2">Предлагаемый график:</p>
                  <ul className="text-xs text-pink-700 space-y-1 mb-3 max-h-24 overflow-y-auto">
                    {msg.functionData.args.calculatedDates.map((d: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-400"></div>
                        {d}
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={() => handleConfirmSchedule(msg.functionData)}
                    className="w-full py-2 bg-pink-500 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-pink-600 transition-colors"
                  >
                    Подтвердить и добавить в календарь
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-pink-500" />
              <span className="text-xs text-gray-400 font-medium">Печатает...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100 pb-safe">
        <div className="flex items-center gap-2 bg-gray-50 p-1 pl-4 rounded-full border border-gray-200 focus-within:border-pink-300 focus-within:ring-2 focus-within:ring-pink-100 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Спросите о бьюти-процедурах..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-pink-500 text-white rounded-full hover:bg-pink-600 disabled:opacity-50 disabled:hover:bg-pink-500 transition-colors shadow-sm"
          >
            <Send size={18} className="ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
