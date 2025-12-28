/**
 * Mission Control — Task Service
 * Manages tasks with project linking, dependency resolution, and Claude Code execution
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASKS_FILE = path.join(__dirname, '../state/tasks.json');

// Task Status flow: pending → ready → queued → running → complete/failed
const TaskStatus = {
  PENDING: 'pending',     // Waiting for dependencies
  READY: 'ready',         // Dependencies met, can be executed
  QUEUED: 'queued',       // Sent to execution queue
  RUNNING: 'running',     // Currently being executed
  COMPLETE: 'complete',   // Successfully completed
  FAILED: 'failed',       // Failed after retries
  BLOCKED: 'blocked'      // Blocked by dependency
};

const TaskType = {
  RESEARCH: 'research',
  GENERATION: 'generation',
  BUILD: 'build',
  QA: 'qa',
  DEPLOYMENT: 'deployment'
};

class TaskService extends EventEmitter {
  constructor() {
    super();
    this.tasks = {};
    this.projectService = null;
    this.claudeCodeBridge = null;
    this.io = null;
    this._loadTasks();
  }

  /**
   * Initialize with dependencies
   */
  init({ projectService, claudeCodeBridge, io }) {
    this.projectService = projectService;
    this.claudeCodeBridge = claudeCodeBridge;
    this.io = io;
  }

  /**
   * Load tasks from persistent storage
   */
  _loadTasks() {
    try {
      if (fs.existsSync(TASKS_FILE)) {
        this.tasks = fs.readJsonSync(TASKS_FILE);
      } else {
        this.tasks = {};
        this._saveTasks();
      }
    } catch (e) {
      console.error('[TaskService] Failed to load tasks:', e.message);
      this.tasks = {};
    }
  }

  /**
   * Save tasks to persistent storage
   */
  _saveTasks() {
    try {
      fs.ensureDirSync(path.dirname(TASKS_FILE));
      fs.writeJsonSync(TASKS_FILE, this.tasks, { spaces: 2 });
    } catch (e) {
      console.error('[TaskService] Failed to save tasks:', e.message);
    }
  }

  /**
   * Emit task updates via socket
   */
  _emitUpdate(eventName, task) {
    if (this.io) {
      this.io.emit('task-update', { event: eventName, task });
    }
    this.emit(eventName, task);
  }

  /**
   * Create a new task
   */
  async createTask(taskData) {
    const taskId = `task_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const task = {
      id: taskId,
      projectId: taskData.projectId,
      phaseIndex: taskData.phaseIndex || 0,
      phaseName: taskData.phaseName || 'Default',
      title: taskData.title,
      description: taskData.description || '',
      taskType: taskData.taskType || TaskType.BUILD,
      status: TaskStatus.PENDING,
      assignedAgent: null,
      executionMode: taskData.executionMode || 'claude_code',
      deps: taskData.deps || [],
      blockedBy: null,
      artifactIds: [],
      outputSummary: null,
      claudeCodeTaskId: null,
      prompt: taskData.prompt || null,
      estimatedMinutes: taskData.estimatedMinutes || null,
      actualMinutes: null,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      retryCount: 0,
      maxRetries: taskData.maxRetries || 3,
      createdAt: now,
      updatedAt: now,
      _stateVersion: 1
    };

    this.tasks[taskId] = task;
    this._saveTasks();

    // Link to project
    if (this.projectService && task.projectId) {
      await this.projectService.linkTask(task.projectId, taskId);
    }

    // Check if task is ready (no deps or all deps complete)
    await this.checkTaskReady(taskId);

    this._emitUpdate('task:created', task);
    return task;
  }

  /**
   * Create multiple tasks at once
   */
  async createTaskBatch(projectId, tasksData) {
    const created = [];
    for (const data of tasksData) {
      const task = await this.createTask({ ...data, projectId });
      created.push(task);
    }
    return created;
  }

  /**
   * Get task by ID
   */
  getTask(taskId) {
    return this.tasks[taskId] || null;
  }

  /**
   * Get all tasks for a project
   */
  getTasksByProject(projectId) {
    return Object.values(this.tasks)
      .filter(t => t.projectId === projectId)
      .sort((a, b) => {
        if (a.phaseIndex !== b.phaseIndex) return a.phaseIndex - b.phaseIndex;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }

  /**
   * Get tasks for a specific phase
   */
  getTasksByPhase(projectId, phaseIndex) {
    return this.getTasksByProject(projectId)
      .filter(t => t.phaseIndex === phaseIndex);
  }

  /**
   * Get tasks that are ready to execute
   */
  getReadyTasks(projectId = null) {
    let tasks = Object.values(this.tasks).filter(t => t.status === TaskStatus.READY);
    if (projectId) {
      tasks = tasks.filter(t => t.projectId === projectId);
    }
    return tasks;
  }

  /**
   * Get all tasks with optional filters
   */
  getAllTasks(filters = {}) {
    let tasks = Object.values(this.tasks);

    if (filters.projectId) {
      tasks = tasks.filter(t => t.projectId === filters.projectId);
    }
    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters.phaseIndex !== undefined) {
      tasks = tasks.filter(t => t.phaseIndex === filters.phaseIndex);
    }
    if (filters.taskType) {
      tasks = tasks.filter(t => t.taskType === filters.taskType);
    }

    // Sort by phase then creation time
    tasks.sort((a, b) => {
      if (a.phaseIndex !== b.phaseIndex) return a.phaseIndex - b.phaseIndex;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    if (filters.limit) {
      tasks = tasks.slice(0, filters.limit);
    }

    return tasks;
  }

  /**
   * Update a task
   */
  async updateTask(taskId, updates) {
    const task = this.tasks[taskId];
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const previousStatus = task.status;

    Object.assign(task, updates, {
      updatedAt: new Date().toISOString(),
      _stateVersion: task._stateVersion + 1
    });

    this.tasks[taskId] = task;
    this._saveTasks();

    // Update project counts if status changed
    if (updates.status && updates.status !== previousStatus) {
      if (this.projectService) {
        await this.projectService.updateTaskCounts(task.projectId);
      }
      this._emitUpdate(`task:${updates.status}`, task);
    } else {
      this._emitUpdate('task:updated', task);
    }

    return task;
  }

  /**
   * Check if a task is ready to run (all dependencies complete)
   */
  async checkTaskReady(taskId) {
    const task = this.tasks[taskId];
    if (!task || task.status !== TaskStatus.PENDING) return;

    // If no dependencies, task is ready
    if (!task.deps || task.deps.length === 0) {
      await this.updateTask(taskId, { status: TaskStatus.READY });
      return;
    }

    // Check if all dependencies are complete
    const allDepsComplete = task.deps.every(depId => {
      const dep = this.tasks[depId];
      return dep && dep.status === TaskStatus.COMPLETE;
    });

    if (allDepsComplete) {
      await this.updateTask(taskId, { status: TaskStatus.READY, blockedBy: null });
    } else {
      // Find which dep is blocking
      const blockedBy = task.deps.find(depId => {
        const dep = this.tasks[depId];
        return !dep || dep.status !== TaskStatus.COMPLETE;
      });
      await this.updateTask(taskId, { status: TaskStatus.BLOCKED, blockedBy });
    }
  }

  /**
   * Execute a task (send to Claude Code)
   */
  async executeTask(taskId) {
    const task = this.tasks[taskId];
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    if (task.status !== TaskStatus.READY) {
      throw new Error(`Task not ready: current status is ${task.status}`);
    }

    await this.updateTask(taskId, {
      status: TaskStatus.QUEUED,
      startedAt: new Date().toISOString()
    });

    // Send to Claude Code Bridge
    if (this.claudeCodeBridge) {
      const claudeTask = this.claudeCodeBridge.createTask({
        projectId: task.projectId,
        title: task.title,
        instructions: task.prompt || task.description,
        priority: task.phaseIndex === 0 ? 'high' : 'normal',
        createdBy: 'task_service',
        createdByModel: 'system',
        context: {
          taskId: task.id,
          phaseIndex: task.phaseIndex,
          phaseName: task.phaseName,
          taskType: task.taskType
        }
      });

      await this.updateTask(taskId, {
        status: TaskStatus.RUNNING,
        claudeCodeTaskId: claudeTask.id
      });
    } else {
      await this.updateTask(taskId, { status: TaskStatus.RUNNING });
    }

    this._emitUpdate('task:executing', task);
    return this.tasks[taskId];
  }

  /**
   * Complete a task
   */
  async completeTask(taskId, result = {}) {
    const task = this.tasks[taskId];
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const startTime = task.startedAt ? new Date(task.startedAt).getTime() : Date.now();
    const actualMinutes = Math.round((Date.now() - startTime) / 60000);

    await this.updateTask(taskId, {
      status: TaskStatus.COMPLETE,
      completedAt: new Date().toISOString(),
      outputSummary: result.summary || null,
      actualMinutes: result.actualMinutes || actualMinutes
    });

    // Check if any blocked tasks can now run
    const dependentTasks = Object.values(this.tasks)
      .filter(t => t.deps && t.deps.includes(taskId));

    for (const depTask of dependentTasks) {
      await this.checkTaskReady(depTask.id);
    }

    return this.tasks[taskId];
  }

  /**
   * Fail a task
   */
  async failTask(taskId, error) {
    const task = this.tasks[taskId];
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.retryCount < task.maxRetries) {
      // Retry
      await this.updateTask(taskId, {
        status: TaskStatus.READY,
        retryCount: task.retryCount + 1,
        errorMessage: error
      });
    } else {
      // Final failure
      await this.updateTask(taskId, {
        status: TaskStatus.FAILED,
        completedAt: new Date().toISOString(),
        errorMessage: error
      });
    }

    return this.tasks[taskId];
  }

  /**
   * Link an artifact to a task
   */
  async linkArtifact(taskId, artifactId) {
    const task = this.tasks[taskId];
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!task.artifactIds.includes(artifactId)) {
      task.artifactIds.push(artifactId);
      await this.updateTask(taskId, { artifactIds: task.artifactIds });
    }
  }

  /**
   * Get task statistics for a project
   */
  getProjectTaskStats(projectId) {
    const tasks = this.getTasksByProject(projectId);
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === TaskStatus.PENDING).length,
      ready: tasks.filter(t => t.status === TaskStatus.READY).length,
      running: tasks.filter(t => t.status === TaskStatus.RUNNING).length,
      complete: tasks.filter(t => t.status === TaskStatus.COMPLETE).length,
      failed: tasks.filter(t => t.status === TaskStatus.FAILED).length,
      blocked: tasks.filter(t => t.status === TaskStatus.BLOCKED).length
    };
  }

  /**
   * Get tasks grouped by phase
   */
  getTasksByPhaseGrouped(projectId) {
    const tasks = this.getTasksByProject(projectId);
    const phases = {};

    for (const task of tasks) {
      const key = task.phaseIndex;
      if (!phases[key]) {
        phases[key] = {
          index: task.phaseIndex,
          name: task.phaseName,
          tasks: [],
          status: 'pending'
        };
      }
      phases[key].tasks.push(task);
    }

    // Calculate phase status
    for (const phase of Object.values(phases)) {
      const allComplete = phase.tasks.every(t => t.status === TaskStatus.COMPLETE);
      const anyRunning = phase.tasks.some(t => t.status === TaskStatus.RUNNING || t.status === TaskStatus.QUEUED);
      const anyFailed = phase.tasks.some(t => t.status === TaskStatus.FAILED);

      if (allComplete) {
        phase.status = 'complete';
      } else if (anyFailed) {
        phase.status = 'failed';
      } else if (anyRunning) {
        phase.status = 'active';
      } else {
        phase.status = 'pending';
      }
    }

    return Object.values(phases).sort((a, b) => a.index - b.index);
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    if (!this.tasks[taskId]) {
      return { success: false, error: 'Task not found' };
    }

    delete this.tasks[taskId];
    this._saveTasks();
    this._emitUpdate('task:deleted', { id: taskId });

    return { success: true };
  }
}

// Export singleton instance
const taskService = new TaskService();
export default taskService;
export { TaskService, TaskStatus, TaskType };
