import { Check, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { useState } from 'react';

interface TaskListProps {
  onSendTasks?: (formattedTasks: string) => void;
}

export default function TaskList({ onSendTasks }: TaskListProps) {
  const { tasks, addTask, toggleTask, removeTask, clearCompletedTasks } = useStore();
  const [newTask, setNewTask] = useState('');

  const handleAddTask = () => {
    if (newTask.trim()) {
      addTask(newTask.trim());
      setNewTask('');
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const pendingTasks = tasks.filter((t) => !t.completed);

  const handleSendTasks = () => {
    if (pendingTasks.length === 0) return;
    
    // Format tasks as structured list (numbered)
    const formattedTasks = pendingTasks
      .map((task, index) => `${index + 1}. ${task.content}`)
      .join('\n');
    
    if (onSendTasks) {
      onSendTasks(formattedTasks);
    }
  };

  return (
    <div className="flex flex-col">
      {totalCount > 0 && (
        <div className="px-3 py-1.5 text-xs text-muted">
          {completedCount} / {totalCount} completed
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
        {tasks.length === 0 ? (
          <div className="text-center text-muted opacity-50 text-xs py-4">
            No tasks yet. Add one below!
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-start gap-2 p-2 rounded-md hover:bg-white/5 transition-colors ${
                task.completed ? 'opacity-60' : ''
              }`}
            >
              <button
                onClick={() => toggleTask(task.id)}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  task.completed
                    ? 'bg-accent border-accent text-white'
                    : 'border-border hover:border-accent'
                }`}
              >
                {task.completed && <Check className="w-3 h-3" />}
              </button>
              <span
                className={`flex-1 text-xs leading-relaxed ${
                  task.completed
                    ? 'line-through text-muted'
                    : 'text-foreground'
                }`}
              >
                {task.content}
              </span>
              <button
                onClick={() => removeTask(task.id)}
                className="p-1 hover:bg-white/10 rounded text-muted hover:text-rose-400 transition-colors shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="pt-2 space-y-1.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
            placeholder="Add a task..."
            className="flex-1 px-2 py-1.5 bg-white/5 border border-border rounded text-xs text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleAddTask}
            className="px-2 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/30 rounded text-xs flex items-center text-accent transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-1.5">
          {completedCount > 0 && (
            <button
              onClick={clearCompletedTasks}
              className="flex-1 px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-border rounded text-xs text-muted transition-colors"
            >
              Clear Completed ({completedCount})
            </button>
          )}
          {pendingTasks.length > 0 && (
            <button
              onClick={handleSendTasks}
              disabled={pendingTasks.length === 0}
              className="flex-1 px-2 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/30 rounded text-xs text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              title="Send tasks to agent"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
              Send ({pendingTasks.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
