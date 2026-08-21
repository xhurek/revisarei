import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, X, Calendar as CalendarIcon } from 'lucide-react';
import { auth } from '../lib/firebase';
import { supabase, toValidUUID } from '../lib/supabase';
import { cn } from '../lib/utils';

export interface PlannerTask {
  id: string;
  text: string;
  completed: boolean;
}

export function PlannerWidget() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [daysWithPending, setDaysWithPending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Helper to format date to YYYY-MM-DD
  const formatDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Load all days with pending tasks for user
  const fetchDaysWithPending = async () => {
    if (!auth.currentUser) return;
    try {
      const { data, error } = await supabase
        .from('planner')
        .select('date_str, tasks')
        .eq('user_id', auth.currentUser.uid);

      if (!error && data) {
        const pendingSet = new Set<string>();
        data.forEach((row: any) => {
          const rowTasks = Array.isArray(row.tasks) ? row.tasks : [];
          if (rowTasks.some((t: any) => !t.completed && t.text && t.text.trim() !== '')) {
            pendingSet.add(row.date_str);
          }
        });
        setDaysWithPending(pendingSet);
      }
    } catch (e) {
      console.warn("Error fetching planner days with pending:", e);
    }
  };

  useEffect(() => {
    fetchDaysWithPending();
  }, [auth.currentUser]);

  // Load tasks for selected date
  useEffect(() => {
    if (!selectedDate || !auth.currentUser) return;
    let isMounted = true;
    setLoading(true);
    const dateStr = formatDateString(selectedDate);
    
    (async () => {
      try {
        const { data, error } = await supabase
          .from('planner')
          .select('tasks')
          .eq('user_id', auth.currentUser!.uid)
          .eq('date_str', dateStr)
          .maybeSingle();

        if (isMounted) {
          if (!error && data && Array.isArray(data.tasks)) {
            setTasks(data.tasks);
          } else {
            setTasks([]);
          }
        }
      } catch (err) {
        console.warn("Error loading planner tasks:", err);
        if (isMounted) setTasks([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  // Handle Ctrl+Q shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        if (selectedDate) {
          addTask();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate, tasks]);

  const saveTasks = async (newTasks: PlannerTask[]) => {
    if (!selectedDate || !auth.currentUser) return;
    const dateStr = formatDateString(selectedDate);
    const plannerId = toValidUUID(`${auth.currentUser.uid}_planner_${dateStr}`);
    
    try {
      await supabase.from('planner').upsert({
        id: plannerId,
        user_id: auth.currentUser.uid,
        date_str: dateStr,
        tasks: newTasks,
        updated_at: new Date().toISOString()
      });

      const hasUncompleted = newTasks.some(t => !t.completed && t.text.trim() !== '');
      setDaysWithPending(prev => {
        const next = new Set(prev);
        if (hasUncompleted) next.add(dateStr);
        else next.delete(dateStr);
        return next;
      });
    } catch (err) {
      console.error("Failed to save tasks to Supabase planner:", err);
    }
  };

  const addTask = () => {
    const newTasks = [...tasks, { id: Date.now().toString(), text: '', completed: false }];
    setTasks(newTasks);
    saveTasks(newTasks);
  };

  const updateTask = (id: string, text: string) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, text } : t);
    setTasks(newTasks);
    saveTasks(newTasks);
  };

  const toggleTask = (id: string) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(newTasks);
    saveTasks(newTasks);
  };

  const removeTask = (id: string) => {
    const newTasks = tasks.filter(t => t.id !== id);
    setTasks(newTasks);
    saveTasks(newTasks);
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDay = firstDayOfMonth.getDay(); // 0 is Sunday
    
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    
    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-5 h-5 sm:w-6 sm:h-6"></div>);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = formatDateString(d);
      const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
      const isToday = new Date().toDateString() === d.toDateString();
      const hasPending = daysWithPending.has(dateStr);
      
      days.push(
        <button
          key={i}
          onClick={() => setSelectedDate(d)}
          className={cn(
            "relative w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-[10px] sm:text-xs font-medium transition-colors cursor-pointer",
            isSelected ? "bg-indigo-600 text-white shadow-md" : "hover:bg-slate-100 text-slate-700",
            isToday && !isSelected && "border border-indigo-300 text-indigo-700 bg-indigo-50"
          )}
        >
          {i}
          {hasPending && (
            <div className={cn(
              "absolute top-0 right-0 w-2 h-2 rounded-full",
              isSelected ? "bg-white" : "bg-red-500"
            )} />
          )}
        </button>
      );
    }

    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm font-sans flex flex-col h-full min-h-[280px] justify-between">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-900 text-base capitalize">{monthNames[month]} {year}</h3>
          <div className="flex gap-1">
            <button 
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] font-bold text-slate-400">
          {dayNames.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch w-full">
      {renderCalendar()}
      
      <AnimatePresence mode="wait">
        {selectedDate ? (
          <motion.div 
            key={selectedDate.toDateString()}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-amber-50/90 rounded-2xl p-5 border border-amber-200 shadow-sm flex flex-col h-full min-h-[280px]"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Bloco de Notas</h3>
                <p className="text-xs text-slate-500 capitalize">
                  {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button 
                onClick={() => setSelectedDate(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-amber-100 rounded-md transition cursor-pointer"
                title="Fechar anotações"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] pr-2 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-full text-slate-400 py-8">
                  <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-6">
                  <p className="text-xs font-medium">Nenhum checklist para este dia.</p>
                  <p className="text-[11px] mt-1 text-slate-400">Pressione <kbd className="bg-amber-100/80 px-1 rounded text-slate-600 font-mono">Ctrl</kbd> + <kbd className="bg-amber-100/80 px-1 rounded text-slate-600 font-mono">Q</kbd> para adicionar.</p>
                </div>
              ) : (
                <AnimatePresence>
                  {tasks.map((task) => (
                    <motion.div 
                      key={task.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 bg-white/80 p-2 rounded-xl border border-amber-100 group"
                    >
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={cn(
                          "w-4 h-4 mt-1 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                          task.completed ? "bg-slate-400 border-slate-400" : "border-slate-300 hover:border-indigo-400"
                        )}
                      >
                        {task.completed && <Check className="w-2.5 h-2.5 text-white" />}
                      </button>
                      <input
                        type="text"
                        value={task.text}
                        onChange={(e) => updateTask(task.id, e.target.value)}
                        placeholder="Digite uma tarefa..."
                        className={cn(
                          "flex-1 bg-transparent border-none outline-none text-xs transition-colors py-0.5 min-w-0",
                          task.completed ? "line-through text-slate-400" : "text-slate-700 font-medium"
                        )}
                        autoFocus={task.text === ''}
                      />
                      <button
                        onClick={() => removeTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
            
            <button
              onClick={addTask}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-amber-200 text-amber-700 hover:bg-amber-100/80 hover:border-amber-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Item (Ctrl+Q)
            </button>
          </motion.div>
        ) : (
          <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center h-full min-h-[280px] text-center">
            <CalendarIcon className="w-8 h-8 mb-2 text-indigo-400 opacity-60" />
            <p className="font-bold text-sm text-slate-700">Selecione uma data</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Clique em qualquer dia do calendário para ver ou criar anotações.</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
