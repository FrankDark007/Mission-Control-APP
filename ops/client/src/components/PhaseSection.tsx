/**
 * PhaseSection Component
 * Collapsible section for a project phase containing tasks and artifacts
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle2, Clock, Play, XCircle,
  FileText, Layers
} from 'lucide-react';
import { PhaseData, Task, Artifact, TaskStatus } from '../types';
import TaskRow from './TaskRow';

interface PhaseSectionProps {
  phase: PhaseData;
  defaultExpanded?: boolean;
  onExecuteTask?: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  onViewArtifact?: (artifact: Artifact) => void;
}

const PhaseSection: React.FC<PhaseSectionProps> = ({
  phase,
  defaultExpanded = false,
  onExecuteTask,
  onViewArtifact
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Calculate phase stats
  const stats = useMemo(() => {
    const total = phase.tasks.length;
    const complete = phase.tasks.filter(t => t.status === 'complete').length;
    const running = phase.tasks.filter(t => t.status === 'running' || t.status === 'queued').length;
    const failed = phase.tasks.filter(t => t.status === 'failed').length;
    const ready = phase.tasks.filter(t => t.status === 'ready').length;
    const pending = phase.tasks.filter(t => t.status === 'pending' || t.status === 'blocked').length;

    const progress = total > 0 ? Math.round((complete / total) * 100) : 0;

    return { total, complete, running, failed, ready, pending, progress };
  }, [phase.tasks]);

  // Phase status based on tasks
  const phaseStatus = useMemo(() => {
    if (stats.total === 0) return 'empty';
    if (stats.complete === stats.total) return 'complete';
    if (stats.failed > 0) return 'has_failures';
    if (stats.running > 0) return 'running';
    if (stats.ready > 0) return 'ready';
    return 'pending';
  }, [stats]);

  const statusColors: Record<string, string> = {
    empty: 'text-gray-500',
    pending: 'text-gray-400',
    ready: 'text-google-blue',
    running: 'text-google-yellow',
    complete: 'text-google-green',
    has_failures: 'text-google-red'
  };

  const statusIcons: Record<string, React.ReactNode> = {
    empty: <Layers size={16} className="text-gray-500" />,
    pending: <Clock size={16} className="text-gray-400" />,
    ready: <Play size={16} className="text-google-blue" />,
    running: <Clock size={16} className="text-google-yellow animate-pulse" />,
    complete: <CheckCircle2 size={16} className="text-google-green" />,
    has_failures: <XCircle size={16} className="text-google-red" />
  };

  return (
    <div className="border border-dark-700 rounded-xl bg-dark-800 overflow-hidden">
      {/* Phase Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-dark-700/50 transition-colors"
      >
        {/* Expand Icon */}
        <div className="text-gray-500">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>

        {/* Status Icon */}
        {statusIcons[phaseStatus]}

        {/* Phase Label */}
        <div className="flex-1 text-left">
          <h3 className="text-sm font-bold text-white">
            Phase {phase.index + 1}: {phase.label}
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-gray-500">
              {stats.total} task{stats.total !== 1 ? 's' : ''}
            </span>
            {phase.artifacts.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <FileText size={10} />
                {phase.artifacts.length} artifact{phase.artifacts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Progress Indicator */}
        {stats.total > 0 && (
          <div className="flex items-center gap-3">
            {/* Mini Progress Bar */}
            <div className="w-24 h-1.5 bg-dark-600 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  phaseStatus === 'complete' ? 'bg-google-green' :
                  phaseStatus === 'has_failures' ? 'bg-google-red' :
                  'bg-google-blue'
                }`}
                style={{ width: `${stats.progress}%` }}
              />
            </div>

            {/* Progress Text */}
            <span className={`text-xs font-bold ${statusColors[phaseStatus]}`}>
              {stats.complete}/{stats.total}
            </span>
          </div>
        )}

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {stats.running > 0 && (
            <span className="px-2 py-0.5 bg-google-yellow/20 text-google-yellow text-[9px] font-bold rounded-full">
              {stats.running} running
            </span>
          )}
          {stats.ready > 0 && (
            <span className="px-2 py-0.5 bg-google-blue/20 text-google-blue text-[9px] font-bold rounded-full">
              {stats.ready} ready
            </span>
          )}
          {stats.failed > 0 && (
            <span className="px-2 py-0.5 bg-google-red/20 text-google-red text-[9px] font-bold rounded-full">
              {stats.failed} failed
            </span>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-dark-700">
          {/* Tasks */}
          {phase.tasks.length > 0 ? (
            <div className="p-4 space-y-3">
              {phase.tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  artifacts={phase.artifacts.filter(a => a.taskId === task.id)}
                  onExecute={onExecuteTask}
                  onViewArtifact={onViewArtifact}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Layers size={24} className="mx-auto text-gray-600 mb-2" />
              <p className="text-xs text-gray-500">No tasks in this phase</p>
            </div>
          )}

          {/* Phase-level Artifacts (not linked to specific tasks) */}
          {phase.artifacts.filter(a => !a.taskId).length > 0 && (
            <div className="border-t border-dark-700 p-4">
              <h4 className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-3">
                Phase Artifacts
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {phase.artifacts.filter(a => !a.taskId).map(artifact => (
                  <button
                    key={artifact.id}
                    onClick={() => onViewArtifact?.(artifact)}
                    className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors text-left"
                  >
                    <FileText size={14} className="text-google-blue shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white truncate">{artifact.label}</p>
                      <p className="text-[9px] text-gray-500 uppercase">{artifact.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PhaseSection;
