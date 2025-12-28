/**
 * TaskInbox Component
 *
 * Floating panel showing pending Claude Code tasks created by Directors.
 * Allows viewing task details and initiating execution.
 */

import React, { useState, useEffect } from 'react';
import {
  Inbox, X, ChevronDown, ChevronUp, Play, Eye, Trash2,
  Clock, Brain, AlertCircle, CheckCircle, Loader2
} from 'lucide-react';

interface Task {
  id: string;
  projectId: string;
  title: string;
  instructions: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  status: 'pending' | 'acknowledged' | 'in_progress' | 'completed' | 'failed';
  createdBy: string;
  createdByModel: string;
  createdAt: string;
  context?: {
    artifactIds?: string[];
    acceptanceCriteria?: string[];
    phase?: string;
  };
}

interface TaskInboxProps {
  tasks: Task[];
  onExecute: (task: Task) => void;
  onDismiss: (taskId: string) => void;
  onViewDetails: (task: Task) => void;
  onClearAll?: () => void;
}

const priorityColors = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

const statusIcons = {
  pending: Clock,
  acknowledged: Eye,
  in_progress: Loader2,
  completed: CheckCircle,
  failed: AlertCircle
};

const TaskInbox: React.FC<TaskInboxProps> = ({
  tasks,
  onExecute,
  onDismiss,
  onViewDetails,
  onClearAll
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const pendingCount = pendingTasks.length;

  // Auto-expand when new tasks arrive
  useEffect(() => {
    if (pendingCount > 0 && isMinimized) {
      setIsMinimized(false);
    }
  }, [pendingCount]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-dark-800 border border-dark-600 rounded-full px-4 py-3 shadow-lg hover:bg-dark-700 transition-colors"
      >
        <Inbox size={20} className="text-google-blue" />
        {pendingCount > 0 && (
          <span className="bg-google-blue text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[500px] bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-600 bg-dark-700/50">
        <div className="flex items-center gap-3">
          <Inbox size={20} className="text-google-blue" />
          <span className="font-bold text-white">Claude Code Inbox</span>
          {pendingCount > 0 && (
            <span className="bg-google-blue text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-dark-600 rounded-lg transition-colors"
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-dark-600 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Task List */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto">
          {pendingTasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Inbox size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No pending tasks</p>
              <p className="text-xs mt-1">Director tasks will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-600">
              {pendingTasks.map((task) => {
                const StatusIcon = statusIcons[task.status];
                return (
                  <div
                    key={task.id}
                    className="p-4 hover:bg-dark-700/50 transition-colors"
                  >
                    {/* Task Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusIcon
                            size={14}
                            className={task.status === 'in_progress' ? 'animate-spin text-google-blue' : 'text-gray-400'}
                          />
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </span>
                        </div>
                        <h4 className="font-medium text-white text-sm truncate">
                          {task.title}
                        </h4>
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-3">
                      <Brain size={12} />
                      <span>{task.createdByModel || 'Director'}</span>
                      <span>•</span>
                      <Clock size={12} />
                      <span>{formatTimeAgo(task.createdAt)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onExecute(task)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-google-blue hover:bg-google-blue/80 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Play size={12} />
                        Execute
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          onViewDetails(task);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-600 hover:bg-dark-500 text-gray-300 text-xs font-medium rounded-lg transition-colors"
                      >
                        <Eye size={12} />
                        Details
                      </button>
                      <button
                        onClick={() => onDismiss(task.id)}
                        className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors ml-auto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {!isMinimized && pendingTasks.length > 0 && (
        <div className="p-3 border-t border-dark-600 bg-dark-700/30 flex items-center justify-between">
          <p className="text-[10px] text-gray-500">
            {pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''} pending
          </p>
          {onClearAll && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-medium rounded-lg transition-colors"
            >
              <Trash2 size={12} />
              Clear All
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskInbox;
