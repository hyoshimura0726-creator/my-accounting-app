import React, { useState, useEffect, useRef } from 'react';
import { Check, Plus, Trash2, RotateCcw, X, Target, Pencil, Flag, ArrowUpDown, Repeat, CalendarPlus, CalendarDays, BarChart3, Trophy, Calendar, AlertCircle, GripVertical, Bell, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Priority = 'low' | 'medium' | 'high';
type SortMode = 'creation' | 'priority' | 'completion';
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

type Period = 'am' | 'pm' | 'none';

type Task = {
  id: string;
  text: string;
  completed: boolean;
  priority?: Priority;
  recurrence?: Recurrence;
  dueDate?: string;
  reminderTime?: string; // HH:mm format
  progress?: number;
  period?: 'am' | 'pm';
};

type HistoryEntry = {
  id: string;
  taskId: string;
  text: string;
  completedAt: string;
  sourceKey: string;
};

type WeekData = {
  [key: string]: Task[];
};

const MONTHLY_GOAL_KEY = '毎月の目標';
const WEEKLY_GOAL_KEY = '今週の目標';
const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];
const ALL_KEYS = [MONTHLY_GOAL_KEY, WEEKLY_GOAL_KEY, ...DAYS];

const initialData: WeekData = ALL_KEYS.reduce((acc, key) => {
  acc[key] = [];
  return acc;
}, {} as WeekData);

export default function App() {
  const [weekData, setWeekData] = useState<WeekData>(() => {
    const saved = localStorage.getItem('weeklyTasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with initialData to ensure new keys (like WEEKLY_GOAL_KEY) exist
        const merged = { ...initialData };
        for (const key of ALL_KEYS) {
          if (parsed[key]) {
            merged[key] = parsed[key];
          }
        }
        return merged;
      } catch (e) {
        return initialData;
      }
    }
    return initialData;
  });

  const [newTaskText, setNewTaskText] = useState<{ [key: string]: string }>({});
  const [newTaskPriority, setNewTaskPriority] = useState<{ [key: string]: Priority }>({});
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<{ [key: string]: Recurrence }>({});
  const [newTaskDueDate, setNewTaskDueDate] = useState<{ [key: string]: string }>({});
  const [newTaskReminder, setNewTaskReminder] = useState<{ [key: string]: string }>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<{key: string, id: string} | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskReminder, setEditTaskReminder] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState<Priority>('low');
  const [editTaskRecurrence, setEditTaskRecurrence] = useState<Recurrence>('none');
  const [activeTab, setActiveTab] = useState<'tasks' | 'history'>('tasks');
  const [draggedItem, setDraggedItem] = useState<{key: string, index: number} | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{key: string, index: number} | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('weeklyTasksHistory');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });
  const [sortModes, setSortModes] = useState<{ [key: string]: SortMode }>(() => {
    const saved = localStorage.getItem('weeklySortModes');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });
  const notifiedTasks = useRef<Set<string>>(new Set());
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeTab === 'tasks') {
      const todayIndex = (new Date().getDay() + 6) % 7;
      const todayKey = DAYS[todayIndex];
      
      // Scroll to today's card after a short delay to ensure rendering
      setTimeout(() => {
        if (cardRefs.current[todayKey]) {
          cardRefs.current[todayKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [activeTab]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHours}:${currentMinutes}`;
      const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      ALL_KEYS.forEach(key => {
        weekData[key].forEach(task => {
          if (!task.completed && task.dueDate === currentDate && task.reminderTime === currentTime) {
            const notificationKey = `${task.id}-${currentDate}-${currentTime}`;
            if (!notifiedTasks.current.has(notificationKey)) {
              new Notification('タスクのリマインダー', {
                body: task.text,
                icon: '/favicon.ico' // Optional: add an icon if you have one
              });
              notifiedTasks.current.add(notificationKey);
            }
          }
        });
      });
    };

    const intervalId = setInterval(checkReminders, 60000); // Check every minute
    checkReminders(); // Initial check
    
    return () => clearInterval(intervalId);
  }, [weekData]);

  const cyclePriority = (current?: Priority): Priority => {
    if (current === 'low') return 'medium';
    if (current === 'medium') return 'high';
    return 'low';
  };

  const getPriorityColor = (priority?: Priority) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-amber-500';
      case 'low': default: return 'text-blue-400';
    }
  };

  const cycleRecurrence = (current?: Recurrence): Recurrence => {
    if (!current || current === 'none') return 'daily';
    if (current === 'daily') return 'weekly';
    if (current === 'weekly') return 'monthly';
    return 'none';
  };

  const getRecurrenceColor = (r?: Recurrence) => {
    if (r === 'daily') return 'text-blue-500 bg-blue-50';
    if (r === 'weekly') return 'text-emerald-500 bg-emerald-50';
    if (r === 'monthly') return 'text-purple-500 bg-purple-50';
    return 'text-stone-300 hover:bg-stone-100';
  };

  const getRecurrenceLabel = (r?: Recurrence) => {
    if (r === 'daily') return '毎日';
    if (r === 'weekly') return '毎週';
    if (r === 'monthly') return '毎月';
    return '繰り返しなし';
  };

  useEffect(() => {
    localStorage.setItem('weeklyTasks', JSON.stringify(weekData));
  }, [weekData]);

  useEffect(() => {
    localStorage.setItem('weeklySortModes', JSON.stringify(sortModes));
  }, [sortModes]);

  useEffect(() => {
    localStorage.setItem('weeklyTasksHistory', JSON.stringify(history));
  }, [history]);

  const addTask = (key: string, period: Period = 'none') => {
    const inputKey = period === 'none' ? key : `${key}-${period}`;
    const text = newTaskText[inputKey]?.trim();
    if (!text) return;
    const priority = newTaskPriority[inputKey] || 'low';
    const recurrence = newTaskRecurrence[inputKey] || 'none';
    const dueDate = newTaskDueDate[inputKey] || undefined;
    const reminderTime = newTaskReminder[inputKey] || undefined;

    setWeekData(prev => ({
      ...prev,
      [key]: [...prev[key], { 
        id: crypto.randomUUID(), 
        text, 
        completed: false, 
        priority, 
        recurrence, 
        dueDate, 
        reminderTime,
        period: period !== 'none' ? period : undefined 
      }]
    }));
    setNewTaskText(prev => ({ ...prev, [inputKey]: '' }));
    setNewTaskPriority(prev => ({ ...prev, [inputKey]: 'low' }));
    setNewTaskRecurrence(prev => ({ ...prev, [inputKey]: 'none' }));
    setNewTaskDueDate(prev => ({ ...prev, [inputKey]: '' }));
    setNewTaskReminder(prev => ({ ...prev, [inputKey]: '' }));
  };

  const toggleTask = (key: string, taskId: string) => {
    const task = weekData[key].find(t => t.id === taskId);
    if (!task) return;
    
    const newCompleted = !task.completed;
    
    if (newCompleted) {
      setHistory(prev => [...prev, {
        id: crypto.randomUUID(),
        taskId: task.id,
        text: task.text,
        completedAt: new Date().toISOString(),
        sourceKey: key
      }]);
    } else {
      setHistory(prev => prev.filter(entry => entry.taskId !== taskId));
    }

    setWeekData(prev => ({
      ...prev,
      [key]: prev[key].map(t => 
        t.id === taskId ? { ...t, completed: newCompleted } : t
      )
    }));
  };

  const cycleTaskPriority = (key: string, taskId: string) => {
    setWeekData(prev => ({
      ...prev,
      [key]: prev[key].map(task => 
        task.id === taskId ? { ...task, priority: cyclePriority(task.priority || 'low') } : task
      )
    }));
  };

  const cycleTaskRecurrence = (key: string, taskId: string) => {
    setWeekData(prev => ({
      ...prev,
      [key]: prev[key].map(task => 
        task.id === taskId ? { ...task, recurrence: cycleRecurrence(task.recurrence) } : task
      )
    }));
  };

  const deleteTask = (key: string, taskId: string) => {
    setWeekData(prev => ({
      ...prev,
      [key]: prev[key].filter(task => task.id !== taskId)
    }));
  };

  const getTodayKey = () => {
    const today = new Date().getDay();
    const dayMap = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    return dayMap[today];
  };

  const copyToToday = (task: Task) => {
    const todayKey = getTodayKey();
    setWeekData(prev => ({
      ...prev,
      [todayKey]: [
        ...prev[todayKey],
        { ...task, id: crypto.randomUUID(), completed: false }
      ]
    }));
  };

  const saveEdit = (key: string, taskId: string) => {
    if (!editTaskText.trim()) {
      setEditingTask(null);
      return;
    }
    setWeekData(prev => ({
      ...prev,
      [key]: prev[key].map(task => 
        task.id === taskId ? { 
          ...task, 
          text: editTaskText.trim(), 
          dueDate: editTaskDueDate || undefined,
          priority: editTaskPriority,
          recurrence: editTaskRecurrence,
          reminderTime: editTaskReminder || undefined
        } : task
      )
    }));
    setEditingTask(null);
  };

  const startNewWeek = () => {
    setWeekData(prev => {
      const newData = { ...prev };
      ALL_KEYS.forEach(key => {
        newData[key] = newData[key]
          .filter(task => task.recurrence && task.recurrence !== 'none')
          .map(task => ({ ...task, completed: false }));
      });
      return newData;
    });
    setIsModalOpen(false);
  };

  const clearAbsolutelyAllTasks = () => {
    setWeekData(initialData);
    setIsModalOpen(false);
  };

  const uncheckAllTasks = () => {
    setWeekData(prev => {
      const newData = { ...prev };
      ALL_KEYS.forEach(key => {
        newData[key] = newData[key].map(task => ({ ...task, completed: false }));
      });
      return newData;
    });
    setIsModalOpen(false);
  };

  const getProgress = (key: string) => {
    const tasks = weekData[key];
    if (!tasks || tasks.length === 0) return 0;
    
    if (key === MONTHLY_GOAL_KEY) {
      const total = tasks.reduce((acc, t) => acc + (t.progress ?? (t.completed ? 100 : 0)), 0);
      return Math.round(total / tasks.length);
    }
    
    const completed = tasks.filter(t => t.completed).length;
    return Math.round((completed / tasks.length) * 100);
  };

  const updateTaskProgress = (key: string, taskId: string, progress: number) => {
    setWeekData(prev => ({
      ...prev,
      [key]: prev[key].map(t =>
        t.id === taskId ? { ...t, progress, completed: progress === 100 } : t
      )
    }));
  };

  const priorityWeight = (p?: Priority) => {
    if (p === 'high') return 3;
    if (p === 'medium') return 2;
    return 1;
  };

  const getSortedTasks = (key: string, tasks: Task[]) => {
    const mode = sortModes[key] || 'creation';
    if (mode === 'creation') return tasks;
    
    return [...tasks].sort((a, b) => {
      if (mode === 'priority') {
        const diff = priorityWeight(b.priority) - priorityWeight(a.priority);
        if (diff !== 0) return diff;
        return 0;
      }
      if (mode === 'completion') {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
      }
      return 0;
    });
  };

  const handleDragStart = (e: React.DragEvent, key: string, index: number) => {
    setDraggedItem({ key, index });
  };

  const handleDragEnter = (e: React.DragEvent, key: string, index: number) => {
    e.preventDefault();
    if (draggedItem?.key === key) {
      setDragOverItem({ key, index });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, key: string, index: number) => {
    e.preventDefault();
    if (draggedItem && draggedItem.key === key && draggedItem.index !== index) {
      setWeekData(prev => {
        const list = [...prev[key]];
        const [removed] = list.splice(draggedItem.index, 1);
        list.splice(index, 0, removed);
        return { ...prev, [key]: list };
      });
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const renderTaskItem = (task: Task, key: string, type: 'monthly' | 'weekly' | 'daily', index: number, period: Period = 'none') => {
    const isMonthlyGoal = type === 'monthly';
    const isWeeklyGoal = type === 'weekly';
    const isEditing = editingTask?.key === key && editingTask?.id === task.id;
    const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
    const isDraggable = !sortModes[key] || sortModes[key] === 'creation';
    const isDragged = draggedItem?.key === key && draggedItem?.index === index;
    const isDragOver = dragOverItem?.key === key && dragOverItem?.index === index;

    return (
      <motion.div 
        layout
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: task.completed ? 0.6 : 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
        transition={{ duration: 0.2 }}
        key={task.id} 
        draggable={isDraggable}
        onDragStart={(e) => isDraggable && handleDragStart(e, key, index)}
        onDragEnter={(e) => isDraggable && handleDragEnter(e, key, index)}
        onDragOver={handleDragOver}
        onDrop={(e) => isDraggable && handleDrop(e, key, index)}
        onDragEnd={handleDragEnd}
        className={`group flex items-start gap-3 p-2 rounded-lg transition-colors ${
          isDragged ? 'opacity-30 bg-stone-100' : 'hover:bg-stone-50'
        } ${
          isDragOver ? (draggedItem!.index < index ? 'border-b-2 border-b-blue-400' : 'border-t-2 border-t-blue-400') : ''
        }`}
      >
        {isDraggable && (
          <div className="mt-1 flex-shrink-0 text-stone-300 cursor-grab active:cursor-grabbing transition-opacity">
            <GripVertical size={14} />
          </div>
        )}
        <motion.button 
          whileTap={{ scale: 0.8 }}
          onClick={() => toggleTask(key, task.id)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            task.completed 
              ? (isWeeklyGoal ? 'bg-orange-400 border-orange-400 text-white' : 'bg-emerald-400 border-emerald-400 text-white')
              : `border-stone-300 text-stone-100/0 ${isWeeklyGoal ? 'hover:border-orange-400' : 'hover:border-emerald-400'}`
          }`}
        >
          <motion.div
            initial={false}
            animate={{ 
              scale: task.completed ? [0.5, 1.2, 1] : 0.5, 
              opacity: task.completed ? 1 : 0 
            }}
            transition={{ duration: 0.3 }}
          >
            <Check size={14} strokeWidth={3} />
          </motion.div>
        </motion.button>
        
        <button 
          onClick={() => cycleTaskPriority(key, task.id)}
          className={`mt-0.5 p-1 rounded hover:bg-stone-200 transition-colors flex-shrink-0 ${
            task.completed ? 'text-stone-300' : getPriorityColor(task.priority || 'low')
          }`}
          title="優先度を変更 (低・中・高)"
        >
          <Flag size={14} className={task.priority === 'high' ? 'fill-current' : ''} />
        </button>

        <button 
          onClick={() => cycleTaskRecurrence(key, task.id)}
          className={`mt-0.5 p-1 rounded transition-colors flex-shrink-0 flex items-center ${
            task.completed ? 'text-stone-300' : getRecurrenceColor(task.recurrence)
          }`}
          title={`繰り返し: ${getRecurrenceLabel(task.recurrence)}`}
        >
          <Repeat size={14} />
          {task.recurrence && task.recurrence !== 'none' && (
            <span className="text-[9px] font-bold ml-0.5 leading-none">
              {task.recurrence === 'daily' ? '日' : task.recurrence === 'weekly' ? '週' : '月'}
            </span>
          )}
        </button>

        {isEditing ? (
          <div className="flex-1 flex flex-col gap-2">
            <input
              type="text"
              value={editTaskText}
              onChange={(e) => setEditTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(key, task.id);
                if (e.key === 'Escape') setEditingTask(null);
              }}
              autoFocus
              className={`w-full bg-white border ${isWeeklyGoal ? 'focus:border-orange-400' : 'focus:border-emerald-400'} focus:ring-0 text-sm rounded px-2 py-1 outline-none`}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditTaskPriority(prev => cyclePriority(prev))}
                className={`p-1.5 rounded transition-colors hover:bg-stone-100 flex-shrink-0 ${getPriorityColor(editTaskPriority)}`}
                title="優先度を設定 (低・中・高)"
              >
                <Flag size={14} className={editTaskPriority === 'high' ? 'fill-current' : ''} />
              </button>
              <button
                type="button"
                onClick={() => setEditTaskRecurrence(prev => cycleRecurrence(prev))}
                className={`p-1.5 rounded transition-colors flex items-center flex-shrink-0 ${getRecurrenceColor(editTaskRecurrence)}`}
                title={`繰り返し: ${getRecurrenceLabel(editTaskRecurrence)}`}
              >
                <Repeat size={14} />
                {editTaskRecurrence && editTaskRecurrence !== 'none' && (
                  <span className="text-[9px] font-bold ml-0.5 leading-none">
                    {editTaskRecurrence === 'daily' ? '日' : editTaskRecurrence === 'weekly' ? '週' : '月'}
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
                <input
                  type="date"
                  value={editTaskDueDate}
                  onChange={(e) => setEditTaskDueDate(e.target.value)}
                  className="text-xs border border-stone-200 rounded px-2 py-1 outline-none focus:border-stone-400"
                  title="期限を設定"
                />
                {editTaskDueDate && (
                  <div className="flex items-center gap-1 border border-stone-200 rounded px-2 py-1 bg-white">
                    <Bell size={12} className="text-stone-400" />
                    <input
                      type="time"
                      value={editTaskReminder}
                      onChange={(e) => setEditTaskReminder(e.target.value)}
                      className="text-xs outline-none focus:ring-0 bg-transparent"
                      title="リマインダー時間を設定"
                    />
                  </div>
                )}
                <button 
                  onClick={() => saveEdit(key, task.id)}
                  className="text-xs bg-stone-800 text-white px-3 py-1 rounded hover:bg-stone-700 transition-colors ml-auto"
                >
                  保存
                </button>
                <button 
                  onClick={() => setEditingTask(null)}
                  className="text-xs bg-stone-200 text-stone-700 px-3 py-1 rounded hover:bg-stone-300 transition-colors"
                >
                  キャンセル
                </button>
              </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <span className={`block text-sm leading-relaxed transition-all ${
                task.completed ? 'text-stone-400 line-through' : 'text-stone-700'
              }`}>
                {task.text}
              </span>
              {task.dueDate && (
                <div className={`text-[10px] mt-1 flex items-center gap-1 font-medium ${isOverdue ? 'text-red-500' : 'text-stone-400'}`}>
                  <Calendar size={10} />
                  {task.dueDate}
                  {task.reminderTime && (
                    <span className="flex items-center gap-0.5 ml-1">
                      <Bell size={10} />
                      {task.reminderTime}
                    </span>
                  )}
                  {isOverdue && <AlertCircle size={10} />}
                </div>
              )}
              {isMonthlyGoal && (
                <div className="w-full mt-2 flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={task.progress ?? (task.completed ? 100 : 0)}
                    onChange={(e) => updateTaskProgress(key, task.id, parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs text-stone-500 w-8 text-right">{task.progress ?? (task.completed ? 100 : 0)}%</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 transition-all flex-shrink-0">
              {isWeeklyGoal && (
                <button 
                  onClick={() => copyToToday(task)}
                  className="text-stone-300 hover:text-emerald-500 p-1"
                  title="今日のタスクにコピー"
                >
                  <CalendarPlus size={14} />
                </button>
              )}
              <button 
                onClick={() => {
                  setEditingTask({ key, id: task.id });
                  setEditTaskText(task.text);
                  setEditTaskDueDate(task.dueDate || '');
                  setEditTaskReminder(task.reminderTime || '');
                  setEditTaskPriority(task.priority || 'low');
                  setEditTaskRecurrence(task.recurrence || 'none');
                }}
                className="text-stone-300 hover:text-blue-400 p-1"
                aria-label="編集"
              >
                <Pencil size={14} />
              </button>
              <button 
                onClick={() => deleteTask(key, task.id)}
                className="text-stone-300 hover:text-red-400 p-1"
                aria-label="削除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </motion.div>
    );
  };

  const renderTaskInput = (key: string, type: 'monthly' | 'weekly' | 'daily', period: Period = 'none') => {
    const inputKey = period === 'none' ? key : `${key}-${period}`;
    return (
      <div className="mb-2 pb-2 border-b border-stone-100/50">
        <form 
          onSubmit={(e) => { e.preventDefault(); addTask(key, period); }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setNewTaskPriority(prev => ({ ...prev, [inputKey]: cyclePriority(prev[inputKey] || 'low') }))}
              className={`p-1.5 rounded-lg transition-colors hover:bg-stone-100 flex-shrink-0 ${getPriorityColor(newTaskPriority[inputKey] || 'low')}`}
              title="優先度を設定 (低・中・高)"
            >
              <Flag size={14} className={newTaskPriority[inputKey] === 'high' ? 'fill-current' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setNewTaskRecurrence(prev => ({ ...prev, [inputKey]: cycleRecurrence(prev[inputKey]) }))}
              className={`p-1.5 rounded-lg transition-colors flex items-center flex-shrink-0 ${getRecurrenceColor(newTaskRecurrence[inputKey])}`}
              title={`繰り返し: ${getRecurrenceLabel(newTaskRecurrence[inputKey])}`}
            >
              <Repeat size={14} />
              {newTaskRecurrence[inputKey] && newTaskRecurrence[inputKey] !== 'none' && (
                <span className="text-[9px] font-bold ml-0.5 leading-none">
                  {newTaskRecurrence[inputKey] === 'daily' ? '日' : newTaskRecurrence[inputKey] === 'weekly' ? '週' : '月'}
                </span>
              )}
            </button>
            <input
              type="text"
              placeholder="タスクを追加..."
              value={newTaskText[inputKey] || ''}
              onChange={(e) => setNewTaskText(prev => ({ ...prev, [inputKey]: e.target.value }))}
              className="flex-1 bg-white/50 border-transparent focus:bg-white focus:border-stone-300 focus:ring-0 text-xs rounded-lg px-2 py-1.5 transition-all outline-none border min-w-0"
            />
            <button 
              type="submit"
              disabled={!newTaskText[inputKey]?.trim()}
              className="p-1.5 text-stone-400 hover:text-stone-700 disabled:opacity-50 transition-colors rounded-lg hover:bg-stone-100 flex-shrink-0"
            >
              <Plus size={16} />
            </button>
          </div>
          {newTaskText[inputKey]?.trim() && (
            <div className="flex items-center pl-8 pr-8 animate-in fade-in slide-in-from-top-2 duration-200 gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-white/80 border border-stone-200 rounded px-1.5 py-0.5">
                <Calendar size={10} className="text-stone-400" />
                <input
                  type="date"
                  value={newTaskDueDate[inputKey] || ''}
                  onChange={(e) => setNewTaskDueDate(prev => ({ ...prev, [inputKey]: e.target.value }))}
                  className="text-[10px] bg-transparent outline-none text-stone-600"
                  title="期限を設定"
                />
                {newTaskDueDate[inputKey] && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewTaskDueDate(prev => ({ ...prev, [inputKey]: '' }));
                      setNewTaskReminder(prev => ({ ...prev, [inputKey]: '' }));
                    }}
                    className="text-stone-400 hover:text-stone-600 ml-1"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
              {newTaskDueDate[inputKey] && (
                <div className="flex items-center gap-1 bg-white/80 border border-stone-200 rounded px-1.5 py-0.5 animate-in fade-in slide-in-from-left-2 duration-200">
                  <Bell size={10} className="text-stone-400" />
                  <input
                    type="time"
                    value={newTaskReminder[inputKey] || ''}
                    onChange={(e) => setNewTaskReminder(prev => ({ ...prev, [inputKey]: e.target.value }))}
                    className="text-[10px] bg-transparent outline-none text-stone-600"
                    title="リマインダー時間を設定"
                  />
                  {newTaskReminder[inputKey] && (
                    <button
                      type="button"
                      onClick={() => setNewTaskReminder(prev => ({ ...prev, [inputKey]: '' }))}
                      className="text-stone-400 hover:text-stone-600 ml-1"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    );
  };

  const renderCard = (key: string, type: 'monthly' | 'weekly' | 'daily' = 'daily') => {
    const progress = getProgress(key);
    const tasks = weekData[key] || [];
    const sortedTasks = getSortedTasks(key, tasks);
    
    const isMonthlyGoal = type === 'monthly';
    const isWeeklyGoal = type === 'weekly';
    const isDaily = type === 'daily';

    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysLeft = lastDay.getDate() - today.getDate();
    
    const todayIndex = (today.getDay() + 6) % 7;
    const todayKey = DAYS[todayIndex];
    const isToday = isDaily && key === todayKey;
    
    const amTasks = sortedTasks.filter(t => t.period === 'am' || !t.period);
    const pmTasks = sortedTasks.filter(t => t.period === 'pm');
    
    const amProgress = amTasks.length > 0 ? Math.round((amTasks.filter(t => t.completed).length / amTasks.length) * 100) : 0;
    const pmProgress = pmTasks.length > 0 ? Math.round((pmTasks.filter(t => t.completed).length / pmTasks.length) * 100) : 0;

    return (
      <div 
        key={key} 
        ref={(el) => cardRefs.current[key] = el}
        className={`bg-white rounded-2xl shadow-sm border p-4 flex flex-col transition-all duration-300 ${
          isMonthlyGoal
            ? 'border-blue-200 bg-blue-50/30 w-full mb-6'
            : isWeeklyGoal 
              ? 'border-orange-200 bg-orange-50/30 lg:h-[calc(100vh-12rem)] lg:sticky lg:top-8' 
              : isToday
                ? 'border-blue-400 ring-4 ring-blue-50 h-full'
                : 'border-stone-100 h-full'
        }`}
      >
        <div className="flex justify-between items-center mb-3">
          <h2 className={`text-lg font-semibold flex items-center gap-2 ${isMonthlyGoal ? 'text-blue-800' : isWeeklyGoal ? 'text-orange-800' : isToday ? 'text-blue-700' : 'text-stone-800'}`}>
            {isMonthlyGoal && <CalendarDays size={20} className="text-blue-500" />}
            {isWeeklyGoal && <Target size={20} className="text-orange-500" />}
            {key}
            {isToday && (
              <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full animate-pulse shadow-sm">
                Today
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={sortModes[key] || 'creation'}
                onChange={(e) => setSortModes(prev => ({ ...prev, [key]: e.target.value as SortMode }))}
                className={`appearance-none text-xs font-medium bg-transparent border border-transparent hover:border-stone-200 rounded px-2 py-1 pr-5 outline-none cursor-pointer transition-colors ${isMonthlyGoal ? 'text-blue-600 hover:bg-blue-100/50' : isWeeklyGoal ? 'text-orange-600 hover:bg-orange-100/50' : 'text-stone-500 hover:bg-stone-50'}`}
                title="並び替え"
              >
                <option value="creation">追加順</option>
                <option value="priority">優先度順</option>
                <option value="completion">未完了順</option>
              </select>
              <ArrowUpDown size={12} className={`absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none ${isMonthlyGoal ? 'text-blue-400' : isWeeklyGoal ? 'text-orange-400' : 'text-stone-400'}`} />
            </div>
            {!isMonthlyGoal && !isDaily && <span className={`text-xs font-medium ${isWeeklyGoal ? 'text-orange-500' : 'text-stone-400'}`}>{progress}%</span>}
          </div>
        </div>
        
        {isMonthlyGoal ? (
          <div className="flex items-center gap-5 mb-4 bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-stone-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-blue-500 transition-all duration-1000" strokeDasharray={`${progress}, 100`} strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-stone-800">{progress}%</span>
              </div>
            </div>
            <div>
              <p className="text-stone-600 font-medium text-sm">今月も残り<span className="text-blue-600 font-bold text-lg mx-1">{daysLeft}</span>日です。</p>
              <p className="text-xs text-stone-500 mt-1">{progress >= 100 ? '目標達成おめでとうございます！🎉' : '目標達成まであと少し！'}</p>
            </div>
          </div>
        ) : !isDaily ? (
          <div className={`w-full rounded-full h-1.5 mb-4 overflow-hidden ${isWeeklyGoal ? 'bg-orange-100' : 'bg-stone-100'}`}>
            <div 
              className={`h-1.5 rounded-full transition-all duration-500 ease-out ${isWeeklyGoal ? 'bg-orange-400' : 'bg-emerald-400'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        ) : null}

        {isDaily ? (
          <div className="flex-1 flex flex-col gap-3">
            {/* AM Section */}
            <div className="flex-1 flex flex-col bg-amber-50/40 rounded-xl p-2.5 border border-amber-100/50">
              <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <Sun size={14} className="text-amber-500" /> 午前 (AM)
                </h3>
                <span className="text-[10px] font-bold text-amber-700/70">AM達成率: {amProgress}% {amProgress === 100 && '🎉'}</span>
              </div>
              <div className="w-full bg-amber-100/50 rounded-full h-2 mb-3 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ease-out ${amProgress === 100 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-amber-300 to-orange-400'}`}
                  style={{ width: `${amProgress}%` }}
                ></div>
              </div>
              {renderTaskInput(key, type, 'am')}
              <div className="flex-1 overflow-y-auto space-y-1.5 mb-2 min-h-[100px]">
                {amTasks.length === 0 ? (
                  <p className="text-[10px] text-amber-600/50 text-center py-2">タスクがありません</p>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {amTasks.map((task, index) => renderTaskItem(task, key, type, index, 'am'))}
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* PM Section */}
            <div className="flex-1 flex flex-col bg-indigo-50/40 rounded-xl p-2.5 border border-indigo-100/50">
              <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                  <Moon size={14} className="text-indigo-500" /> 午後 (PM)
                </h3>
                <span className="text-[10px] font-bold text-indigo-700/70">PM達成率: {pmProgress}% {pmProgress === 100 && '🎉'}</span>
              </div>
              <div className="w-full bg-indigo-100/50 rounded-full h-2 mb-3 overflow-hidden">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ease-out ${pmProgress === 100 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-indigo-400 to-purple-500'}`}
                  style={{ width: `${pmProgress}%` }}
                ></div>
              </div>
              {renderTaskInput(key, type, 'pm')}
              <div className="flex-1 overflow-y-auto space-y-1.5 mb-2 min-h-[100px]">
                {pmTasks.length === 0 ? (
                  <p className="text-[10px] text-indigo-600/50 text-center py-2">タスクがありません</p>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {pmTasks.map((task, index) => renderTaskItem(task, key, type, index, 'pm'))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {renderTaskInput(key, type, 'none')}
            {/* Task List for Monthly/Weekly */}
            <div className={`flex-1 overflow-y-auto mb-3 space-y-2 ${isMonthlyGoal ? 'min-h-[100px]' : 'min-h-[150px]'}`}>
              {sortedTasks.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-4">タスクがありません</p>
              ) : (
                <AnimatePresence mode="popLayout">
                  {sortedTasks.map((task, index) => renderTaskItem(task, key, type, index, 'none'))}
                </AnimatePresence>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => {
    const groupedHistory = history.reduce((acc, entry) => {
      const d = new Date(entry.completedAt);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(entry);
      return acc;
    }, {} as Record<string, HistoryEntry[]>);
    
    const sortedDateKeys = Object.keys(groupedHistory).sort((a, b) => b.localeCompare(a));
    
    const last7Days = Array.from({length: 7}).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 6 + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    
    const chartData = last7Days.map(date => ({
      date,
      displayDate: new Date(date).toLocaleDateString('ja-JP', { day: 'numeric' }),
      count: groupedHistory[date]?.length || 0
    }));
    const maxCount = Math.max(...chartData.map(d => d.count), 1);
    const totalLast7Days = chartData.reduce((sum, d) => sum + d.count, 0);

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-100 p-2 rounded-xl text-orange-600">
              <BarChart3 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-800">最近の達成状況</h3>
              <p className="text-sm text-stone-500">過去7日間のクリア数: <span className="font-bold text-stone-800 text-lg">{totalLast7Days}</span> タスク</p>
            </div>
          </div>
          
          <div className="flex items-end justify-between h-32 gap-2 mt-4">
            {chartData.map((data) => (
              <div key={data.date} className="flex flex-col items-center flex-1 gap-2">
                <div className="w-full relative flex justify-center h-full items-end group">
                  <div 
                    className="w-full max-w-[40px] bg-emerald-400 rounded-t-md transition-all duration-500 group-hover:bg-emerald-500"
                    style={{ height: `${(data.count / maxCount) * 100}%`, minHeight: data.count > 0 ? '4px' : '0' }}
                  ></div>
                  <div className="absolute -top-8 bg-stone-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {data.count} タスク
                  </div>
                </div>
                <span className="text-xs text-stone-400 font-medium">{data.displayDate}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
          <h3 className="text-lg font-bold text-stone-800 mb-6 flex items-center gap-2">
            <CalendarDays size={20} className="text-stone-400" />
            完了履歴
          </h3>
          
          <div className="space-y-8">
            {sortedDateKeys.length === 0 ? (
              <p className="text-center text-stone-400 py-8">まだ完了したタスクがありません</p>
            ) : (
              sortedDateKeys.map(dateKey => {
                const d = new Date(dateKey);
                const displayDate = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
                const entries = groupedHistory[dateKey];
                
                return (
                  <div key={dateKey} className="relative">
                    <div className="sticky top-0 bg-white/90 backdrop-blur py-2 mb-3 border-b border-stone-100 z-10">
                      <h4 className="font-bold text-stone-700">{displayDate}</h4>
                    </div>
                    <div className="space-y-2 pl-2">
                      {entries.map(entry => (
                        <div key={entry.id} className="flex items-start gap-3 p-2 hover:bg-stone-50 rounded-lg transition-colors">
                          <div className="mt-0.5 text-emerald-500">
                            <Check size={16} strokeWidth={3} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-stone-800">{entry.text}</p>
                            <p className="text-xs text-stone-400 mt-0.5">{entry.sourceKey}</p>
                          </div>
                          <div className="ml-auto text-xs text-stone-300">
                            {new Date(entry.completedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-stone-800 font-sans selection:bg-stone-200">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">Weekly Tasks</h1>
            <p className="text-stone-500 mt-1">1週間のやる事リスト</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-stone-200 shadow-sm hover:bg-stone-50 text-stone-700 px-4 py-2.5 rounded-full text-sm font-medium transition-colors"
          >
            <RotateCcw size={16} />
            新しい週を始める
          </button>
        </header>

        <div className="flex space-x-6 mb-8 border-b border-stone-200">
          <button 
            className={`pb-3 px-2 border-b-2 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === 'tasks' ? 'border-stone-800 text-stone-800' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
            onClick={() => setActiveTab('tasks')}
          >
            <Target size={16} />
            タスク管理
          </button>
          <button 
            className={`pb-3 px-2 border-b-2 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-stone-800 text-stone-800' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
            onClick={() => setActiveTab('history')}
          >
            <Trophy size={16} />
            記録・振り返り
          </button>
        </div>

        {activeTab === 'tasks' ? (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Monthly Goals Top Bar */}
            <div className="w-full">
              {renderCard(MONTHLY_GOAL_KEY, 'monthly')}
            </div>
            
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Weekly Goals Sidebar */}
              <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
                {renderCard(WEEKLY_GOAL_KEY, 'weekly')}
              </div>
              
              {/* Days Grid */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {DAYS.map(day => renderCard(day, 'daily'))}
              </div>
            </div>
          </div>
        ) : (
          renderHistory()
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-stone-900">新しい週を始める</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-full hover:bg-stone-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-stone-500 text-sm mb-6">
                新しい週に向けてタスクをリセットします。どのようにリセットしますか？
              </p>
              <div className="space-y-3">
                <button 
                  onClick={uncheckAllTasks}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium py-3 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} />
                  チェックのみ外す（タスクは残す）
                </button>
                <button 
                  onClick={startNewWeek}
                  className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium py-3 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Repeat size={16} />
                  新しい週を始める（繰り返しタスク以外を削除）
                </button>
                <button 
                  onClick={clearAbsolutelyAllTasks}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium py-3 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  すべてのタスクを完全に削除する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
