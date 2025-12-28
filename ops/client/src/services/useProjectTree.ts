/**
 * useProjectTree Hook
 * Fetches and manages project tree state with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ProjectTree, Task, Artifact, TaskStatus } from '../types';

interface UseProjectTreeOptions {
  projectId: string;
  socket?: Socket | null;
}

interface UseProjectTreeResult {
  tree: ProjectTree | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  executeTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  getTaskStatus: (taskId: string) => TaskStatus | null;
}

export function useProjectTree({ projectId, socket }: UseProjectTreeOptions): UseProjectTreeResult {
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    if (!projectId) {
      setError('No project ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/tree`);
      if (!response.ok) {
        throw new Error(`Failed to fetch project tree: ${response.statusText}`);
      }

      const data = await response.json();
      setTree(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project tree');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleTaskUpdate = (data: { task: Task }) => {
      setTree(prev => {
        if (!prev) return prev;

        // Update the task in the appropriate phase
        const updatedPhases = prev.phases.map(phase => ({
          ...phase,
          tasks: phase.tasks.map(t =>
            t.id === data.task.id ? data.task : t
          )
        }));

        return { ...prev, phases: updatedPhases };
      });
    };

    const handleArtifactCreated = (data: { artifact: Artifact }) => {
      if (data.artifact.projectId !== projectId) return;

      setTree(prev => {
        if (!prev) return prev;

        // Add artifact to the appropriate phase
        const updatedPhases = prev.phases.map(phase => {
          if (phase.index === data.artifact.phaseIndex) {
            return {
              ...phase,
              artifacts: [...phase.artifacts, data.artifact]
            };
          }
          return phase;
        });

        return {
          ...prev,
          artifactIds: [...prev.artifactIds, data.artifact.id],
          phases: updatedPhases
        };
      });
    };

    const handleTaskCreated = (data: { task: Task }) => {
      if (data.task.projectId !== projectId) return;

      setTree(prev => {
        if (!prev) return prev;

        // Add task to the appropriate phase
        const updatedPhases = prev.phases.map(phase => {
          if (phase.index === data.task.phaseIndex) {
            // Check if task already exists
            if (phase.tasks.some(t => t.id === data.task.id)) {
              return phase;
            }
            return {
              ...phase,
              tasks: [...phase.tasks, data.task]
            };
          }
          return phase;
        });

        return {
          ...prev,
          taskIds: [...prev.taskIds, data.task.id],
          phases: updatedPhases
        };
      });
    };

    socket.on('task-update', handleTaskUpdate);
    socket.on('task:updated', handleTaskUpdate);
    socket.on('artifact-update', handleArtifactCreated);
    socket.on('artifact:created', handleArtifactCreated);
    socket.on('task:created', handleTaskCreated);

    return () => {
      socket.off('task-update', handleTaskUpdate);
      socket.off('task:updated', handleTaskUpdate);
      socket.off('artifact-update', handleArtifactCreated);
      socket.off('artifact:created', handleArtifactCreated);
      socket.off('task:created', handleTaskCreated);
    };
  }, [socket, projectId]);

  const executeTask = useCallback(async (taskId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || 'Failed to execute task' };
      }

      const data = await response.json();

      // Update local state optimistically
      setTree(prev => {
        if (!prev) return prev;

        const updatedPhases = prev.phases.map(phase => ({
          ...phase,
          tasks: phase.tasks.map(t =>
            t.id === taskId ? { ...t, status: 'queued' as TaskStatus } : t
          )
        }));

        return { ...prev, phases: updatedPhases };
      });

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to execute task'
      };
    }
  }, []);

  const getTaskStatus = useCallback((taskId: string): TaskStatus | null => {
    if (!tree) return null;

    for (const phase of tree.phases) {
      const task = phase.tasks.find(t => t.id === taskId);
      if (task) return task.status;
    }

    return null;
  }, [tree]);

  return {
    tree,
    loading,
    error,
    refetch: fetchTree,
    executeTask,
    getTaskStatus
  };
}

export default useProjectTree;
