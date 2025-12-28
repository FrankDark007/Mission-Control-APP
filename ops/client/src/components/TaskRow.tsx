/**
 * TaskRow Component
 * Displays a single task with status, dependencies, and execute button
 */

import React, { useState } from 'react';
import {
  Play, CheckCircle2, XCircle, Clock, Loader2,
  ChevronDown, ChevronRight, Link2, FileText
} from 'lucide-react';
import { Task, TaskStatus, Artifact } from '../types';

interface TaskRowProps {
  task: Task;
  artifacts?: Artifact[];
  onExecute?: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  onViewArtifact?: (artifact: Artifact) => void;
}

const statusConfig: Record<TaskStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  pending: {
    color: 'text-gray-400',
    bg: 'bg-gray-800',
    icon: <Clock size={12} />,
    label: 'Pending'
  },
  ready: {
    color: 'text-google-blue',
    bg: 'bg-google-blue/20',
    icon: <Play size={12} />,
    label: 'Ready'
  },
  queued: {
    color: 'text-google-yellow',
    bg: 'bg-google-yellow/20',
    icon: <Clock size={12} />,
    label: 'Queued'
  },
  running: {
    color: 'text-google-blue',
    bg: 'bg-google-blue/20',
    icon: <Loader2 size={12} className="animate-spin" />,
    label: 'Running'
  },
  complete: {
    color: 'text-google-green',
    bg: 'bg-google-green/20',
    icon: <CheckCircle2 size={12} />,
    label: 'Complete'
  },
  failed: {
    color: 'text-google-red',
    bg: 'bg-google-red/20',
    icon: <XCircle size={12} />,
    label: 'Failed'
  },
  blocked: {
    color: 'text-orange-400',
    bg: 'bg-orange-400/20',
    icon: <Link2 size={12} />,
    label: 'Blocked'
  }
};

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  artifacts = [],
  onExecute,
  onViewArtifact
}) => {
  const [expanded, setExpanded] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = statusConfig[task.status];
  const canExecute = task.status === 'ready' || task.status === 'pending';
  const taskArtifacts = artifacts.filter(a => a.taskId === task.id);

  const handleExecute = async () => {
    if (!onExecute || executing) return;

    setExecuting(true);
    setError(null);

    try {
      const result = await onExecute(task.id);
      if (!result.success) {
        setError(result.error || 'Execution failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="border border-dark-700 rounded-lg bg-dark-800/50 overflow-hidden">
      {/* Main Row */}
      <div className="flex items-center gap-3 p-3">
        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-dark-700 rounded transition-colors"
        >
          {expanded ? (
            <ChevronDown size={14} className="text-gray-500" />
          ) : (
            <ChevronRight size={14} className="text-gray-500" />
          )}
        </button>

        {/* Status Badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bg} ${config.color}`}>
          {config.icon}
          <span className="text-[9px] font-bold uppercase tracking-wider">
            {config.label}
          </span>
        </div>

        {/* Task Title */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white truncate">
            {task.title}
          </h4>
          {task.deps || [].length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <Link2 size={10} className="text-gray-500" />
              <span className="text-[9px] text-gray-500">
                {task.deps || [].length} dependencies
              </span>
            </div>
          )}
        </div>

        {/* Artifact Count */}
        {taskArtifacts.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-dark-700 rounded-full">
            <FileText size={10} className="text-gray-400" />
            <span className="text-[9px] text-gray-400 font-medium">
              {taskArtifacts.length}
            </span>
          </div>
        )}

        {/* Execute Button */}
        {canExecute && onExecute && (
          <button
            onClick={handleExecute}
            disabled={executing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
              executing
                ? 'bg-dark-700 text-gray-500 cursor-not-allowed'
                : 'bg-google-blue text-white hover:bg-google-blue/80 shadow-lg shadow-google-blue/20'
            }`}
          >
            {executing ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Queueing...
              </>
            ) : (
              <>
                <Play size={12} />
                Execute
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-dark-700 bg-dark-900/50">
          {/* Instructions */}
          <div className="p-3">
            <h5 className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-2">
              Instructions
            </h5>
            <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
              {task.instructions}
            </p>
          </div>

          {/* Dependencies */}
          {task.deps || [].length > 0 && (
            <div className="px-3 pb-3">
              <h5 className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                Dependencies
              </h5>
              <div className="flex flex-wrap gap-1">
                {task.deps || [].map(depId => (
                  <span
                    key={depId}
                    className="px-2 py-0.5 bg-dark-700 rounded text-[9px] text-gray-400 font-mono"
                  >
                    {depId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Artifacts */}
          {taskArtifacts.length > 0 && (
            <div className="px-3 pb-3">
              <h5 className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                Artifacts
              </h5>
              <div className="space-y-1">
                {taskArtifacts.map(artifact => (
                  <button
                    key={artifact.id}
                    onClick={() => onViewArtifact?.(artifact)}
                    className="w-full flex items-center gap-2 p-2 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors text-left"
                  >
                    <FileText size={12} className="text-google-blue" />
                    <span className="text-xs text-white flex-1 truncate">
                      {artifact.label}
                    </span>
                    <span className="text-[9px] text-gray-500 uppercase">
                      {artifact.contentType}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Execution Log */}
          {task.executionLog.length > 0 && (
            <div className="px-3 pb-3">
              <h5 className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                Execution Log
              </h5>
              <div className="bg-black/30 rounded-lg p-2 max-h-32 overflow-y-auto">
                {task.executionLog.map((log, idx) => (
                  <div key={idx} className="text-[10px] text-gray-400 font-mono">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 p-2 bg-google-red/10 border border-google-red/30 rounded-lg">
                <XCircle size={12} className="text-google-red" />
                <span className="text-xs text-google-red">{error}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskRow;
