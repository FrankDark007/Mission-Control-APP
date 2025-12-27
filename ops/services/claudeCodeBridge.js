/**
 * Mission Control V8 — Claude Code Bridge
 *
 * This service enables bidirectional communication between Mission Control
 * (AI Directors, Agents, Sub-agents) and Claude Code sessions.
 *
 * Flow:
 * 1. Directors/Agents create tasks with instructions
 * 2. Tasks get queued in the Claude Code inbox
 * 3. Claude Code polls/receives tasks and executes
 * 4. Claude Code reports progress back
 * 5. Artifacts from sub-agents are available for Claude Code to use
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BRIDGE_DIR = path.join(__dirname, '../state/claude-bridge');
const INBOX_FILE = path.join(BRIDGE_DIR, 'inbox.json');
const PROGRESS_FILE = path.join(BRIDGE_DIR, 'progress.json');
const ARTIFACTS_FILE = path.join(BRIDGE_DIR, 'artifacts.json');
const FEEDBACK_FILE = path.join(BRIDGE_DIR, 'feedback.json');

// Task status enum
const TaskStatus = {
  PENDING: 'pending',           // Waiting for Claude Code to pick up
  ACKNOWLEDGED: 'acknowledged', // Claude Code has seen it
  IN_PROGRESS: 'in_progress',   // Claude Code is working on it
  BLOCKED: 'blocked',           // Claude Code needs help/input
  COMPLETED: 'completed',       // Done
  FAILED: 'failed'              // Failed
};

// Task priority
const TaskPriority = {
  CRITICAL: 'critical',   // Do immediately
  HIGH: 'high',           // Do next
  NORMAL: 'normal',       // Queue order
  LOW: 'low'              // When free
};

// Artifact types that can be handed off
const ArtifactType = {
  SVG: 'svg',
  IMAGE: 'image',
  CONTENT: 'content',
  CODE: 'code',
  DATA: 'data',
  RESEARCH: 'research',
  DESIGN: 'design',
  CONFIG: 'config'
};

class ClaudeCodeBridge {
  constructor() {
    this.io = null;
    this.stateStore = null;
    this._ensureDirectories();
    this._loadState();
  }

  /**
   * Initialize with dependencies
   */
  init({ io, stateStore }) {
    this.io = io;
    this.stateStore = stateStore;
  }

  /**
   * Ensure bridge directories exist
   */
  _ensureDirectories() {
    fs.ensureDirSync(BRIDGE_DIR);

    if (!fs.existsSync(INBOX_FILE)) {
      fs.writeJsonSync(INBOX_FILE, { tasks: [] }, { spaces: 2 });
    }
    if (!fs.existsSync(PROGRESS_FILE)) {
      fs.writeJsonSync(PROGRESS_FILE, { updates: [] }, { spaces: 2 });
    }
    if (!fs.existsSync(ARTIFACTS_FILE)) {
      fs.writeJsonSync(ARTIFACTS_FILE, { artifacts: [] }, { spaces: 2 });
    }
    if (!fs.existsSync(FEEDBACK_FILE)) {
      fs.writeJsonSync(FEEDBACK_FILE, { feedback: [] }, { spaces: 2 });
    }
  }

  /**
   * Load state from files
   */
  _loadState() {
    try {
      this.inbox = fs.readJsonSync(INBOX_FILE);
      this.progress = fs.readJsonSync(PROGRESS_FILE);
      this.artifacts = fs.readJsonSync(ARTIFACTS_FILE);
      this.feedback = fs.readJsonSync(FEEDBACK_FILE);
    } catch (e) {
      console.error('[ClaudeCodeBridge] Failed to load state:', e.message);
      this.inbox = { tasks: [] };
      this.progress = { updates: [] };
      this.artifacts = { artifacts: [] };
      this.feedback = { feedback: [] };
    }
  }

  /**
   * Save state to files
   */
  _saveState() {
    try {
      fs.writeJsonSync(INBOX_FILE, this.inbox, { spaces: 2 });
      fs.writeJsonSync(PROGRESS_FILE, this.progress, { spaces: 2 });
      fs.writeJsonSync(ARTIFACTS_FILE, this.artifacts, { spaces: 2 });
      fs.writeJsonSync(FEEDBACK_FILE, this.feedback, { spaces: 2 });
    } catch (e) {
      console.error('[ClaudeCodeBridge] Failed to save state:', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TASK INBOX - Directors/Agents create tasks for Claude Code
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a task for Claude Code to execute
   * Called by Directors or Agents
   */
  createTask({
    projectId,
    title,
    instructions,
    priority = TaskPriority.NORMAL,
    createdBy,           // agentId or 'director'
    createdByModel,      // e.g., 'gemini-3-pro'
    context = {},        // Additional context (files, decisions, etc.)
    artifacts = [],      // Artifact IDs to include
    deadline = null,     // Optional deadline
    dependencies = []    // Task IDs that must complete first
  }) {
    const task = {
      id: `task_${uuidv4().slice(0, 8)}`,
      projectId,
      title,
      instructions,
      priority,
      status: TaskStatus.PENDING,
      createdBy,
      createdByModel,
      context,
      artifacts,
      dependencies,
      deadline,
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      startedAt: null,
      completedAt: null,
      progress: 0,
      progressNotes: [],
      result: null
    };

    this.inbox.tasks.push(task);
    this._saveState();
    this._emit('claude-task-created', task);

    console.log(`[ClaudeCodeBridge] Task created: ${task.id} - ${title}`);
    return task;
  }

  /**
   * Get all pending tasks for Claude Code
   */
  getPendingTasks(projectId = null) {
    let tasks = this.inbox.tasks.filter(t =>
      t.status === TaskStatus.PENDING || t.status === TaskStatus.ACKNOWLEDGED
    );

    if (projectId) {
      tasks = tasks.filter(t => t.projectId === projectId);
    }

    // Sort by priority then by creation time
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    tasks.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    return tasks;
  }

  /**
   * Get a specific task by ID
   */
  getTask(taskId) {
    return this.inbox.tasks.find(t => t.id === taskId);
  }

  /**
   * Get all tasks (with optional filters)
   */
  getAllTasks({ projectId, status, limit = 50 } = {}) {
    let tasks = [...this.inbox.tasks];

    if (projectId) {
      tasks = tasks.filter(t => t.projectId === projectId);
    }
    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }

    // Sort by creation time (newest first)
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return tasks.slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROGRESS REPORTING - Claude Code reports back to Mission Control
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Claude Code acknowledges receiving a task
   */
  acknowledgeTask(taskId) {
    const task = this.getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    task.status = TaskStatus.ACKNOWLEDGED;
    task.acknowledgedAt = new Date().toISOString();
    this._saveState();
    this._emit('claude-task-acknowledged', task);

    return { success: true, task };
  }

  /**
   * Claude Code starts working on a task
   */
  startTask(taskId) {
    const task = this.getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date().toISOString();
    this._saveState();
    this._emit('claude-task-started', task);

    return { success: true, task };
  }

  /**
   * Claude Code reports progress on a task
   */
  reportProgress(taskId, { progress, note, filesModified = [], blockers = [] }) {
    const task = this.getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    task.progress = Math.min(100, Math.max(0, progress));

    const update = {
      timestamp: new Date().toISOString(),
      progress,
      note,
      filesModified,
      blockers
    };

    task.progressNotes.push(update);

    // Also add to global progress log
    this.progress.updates.push({
      taskId,
      projectId: task.projectId,
      ...update
    });

    // Check if blocked
    if (blockers.length > 0) {
      task.status = TaskStatus.BLOCKED;
    }

    this._saveState();
    this._emit('claude-progress-update', { task, update });

    return { success: true, task };
  }

  /**
   * Claude Code completes a task
   */
  completeTask(taskId, { result, filesCreated = [], filesModified = [], summary }) {
    const task = this.getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    task.status = TaskStatus.COMPLETED;
    task.progress = 100;
    task.completedAt = new Date().toISOString();
    task.result = {
      summary,
      filesCreated,
      filesModified,
      data: result
    };

    this._saveState();
    this._emit('claude-task-completed', task);

    console.log(`[ClaudeCodeBridge] Task completed: ${taskId}`);
    return { success: true, task };
  }

  /**
   * Claude Code fails a task
   */
  failTask(taskId, { error, canRetry = false }) {
    const task = this.getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    task.status = TaskStatus.FAILED;
    task.completedAt = new Date().toISOString();
    task.result = { error, canRetry };

    this._saveState();
    this._emit('claude-task-failed', task);

    return { success: true, task };
  }

  /**
   * Claude Code requests help or input
   */
  requestHelp(taskId, { question, options = [], context }) {
    const task = this.getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    task.status = TaskStatus.BLOCKED;

    const helpRequest = {
      id: `help_${uuidv4().slice(0, 8)}`,
      taskId,
      projectId: task.projectId,
      question,
      options,
      context,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      response: null
    };

    this.feedback.feedback.push(helpRequest);
    this._saveState();
    this._emit('claude-help-requested', helpRequest);

    return { success: true, helpRequest };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTIFACT HANDOFF - Sub-agents provide artifacts for Claude Code
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register an artifact for Claude Code to use
   * Called by sub-agents (Refract, Creative, Research, etc.)
   */
  registerArtifact({
    projectId,
    taskId = null,
    type,                // ArtifactType
    name,
    description,
    filePath = null,     // Path where file is saved
    content = null,      // Or inline content
    metadata = {},       // Type-specific metadata
    createdBy,           // Agent ID
    instructions = null  // How Claude Code should use this
  }) {
    const artifact = {
      id: `artifact_${uuidv4().slice(0, 8)}`,
      projectId,
      taskId,
      type,
      name,
      description,
      filePath,
      content,
      metadata,
      createdBy,
      instructions,
      createdAt: new Date().toISOString(),
      usedAt: null,
      usedBy: null
    };

    this.artifacts.artifacts.push(artifact);
    this._saveState();
    this._emit('artifact-registered', artifact);

    console.log(`[ClaudeCodeBridge] Artifact registered: ${artifact.id} - ${name}`);
    return artifact;
  }

  /**
   * Get artifacts for a project
   */
  getArtifacts(projectId, { type, unused = false } = {}) {
    let artifacts = this.artifacts.artifacts.filter(a => a.projectId === projectId);

    if (type) {
      artifacts = artifacts.filter(a => a.type === type);
    }
    if (unused) {
      artifacts = artifacts.filter(a => !a.usedAt);
    }

    return artifacts;
  }

  /**
   * Get a specific artifact
   */
  getArtifact(artifactId) {
    return this.artifacts.artifacts.find(a => a.id === artifactId);
  }

  /**
   * Mark an artifact as used by Claude Code
   */
  markArtifactUsed(artifactId, { usedBy = 'claude-code', usedAt = null, usedHow = null }) {
    const artifact = this.getArtifact(artifactId);
    if (!artifact) return { success: false, error: 'Artifact not found' };

    artifact.usedAt = usedAt || new Date().toISOString();
    artifact.usedBy = usedBy;
    artifact.usedHow = usedHow;

    this._saveState();
    this._emit('artifact-used', artifact);

    return { success: true, artifact };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEEDBACK LOOP - Directors respond to Claude Code requests
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Director/Agent responds to a help request
   */
  respondToHelp(helpId, { response, decidedBy, reasoning = null }) {
    const helpRequest = this.feedback.feedback.find(f => f.id === helpId);
    if (!helpRequest) return { success: false, error: 'Help request not found' };

    helpRequest.resolvedAt = new Date().toISOString();
    helpRequest.response = response;
    helpRequest.decidedBy = decidedBy;
    helpRequest.reasoning = reasoning;

    // Unblock the task
    const task = this.getTask(helpRequest.taskId);
    if (task && task.status === TaskStatus.BLOCKED) {
      task.status = TaskStatus.IN_PROGRESS;
    }

    this._saveState();
    this._emit('help-responded', helpRequest);

    return { success: true, helpRequest };
  }

  /**
   * Get pending help requests
   */
  getPendingHelpRequests(projectId = null) {
    let requests = this.feedback.feedback.filter(f => !f.resolvedAt);
    if (projectId) {
      requests = requests.filter(f => f.projectId === projectId);
    }
    return requests;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIRECTOR COMMANDS - Directors issue high-level commands
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Director sends a direct instruction to Claude Code
   */
  sendDirectorCommand({
    projectId,
    command,              // The instruction
    priority = 'high',
    directorModel,
    context = {},
    expectedOutcome = null
  }) {
    return this.createTask({
      projectId,
      title: `[DIRECTOR] ${command.slice(0, 50)}...`,
      instructions: command,
      priority,
      createdBy: 'director',
      createdByModel: directorModel,
      context: {
        ...context,
        isDirectorCommand: true,
        expectedOutcome
      }
    });
  }

  /**
   * Get the current status for a project (for Director to monitor)
   */
  getProjectStatus(projectId) {
    const tasks = this.getAllTasks({ projectId });
    const artifacts = this.getArtifacts(projectId);
    const pendingHelp = this.getPendingHelpRequests(projectId);

    const stats = {
      totalTasks: tasks.length,
      pending: tasks.filter(t => t.status === TaskStatus.PENDING).length,
      inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      blocked: tasks.filter(t => t.status === TaskStatus.BLOCKED).length,
      failed: tasks.filter(t => t.status === TaskStatus.FAILED).length
    };

    const recentProgress = this.progress.updates
      .filter(u => u.projectId === projectId)
      .slice(-10);

    return {
      projectId,
      stats,
      activeTasks: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS),
      pendingTasks: tasks.filter(t => t.status === TaskStatus.PENDING),
      blockedTasks: tasks.filter(t => t.status === TaskStatus.BLOCKED),
      recentProgress,
      artifacts: {
        total: artifacts.length,
        unused: artifacts.filter(a => !a.usedAt).length,
        byType: this._groupBy(artifacts, 'type')
      },
      pendingHelp,
      lastUpdate: recentProgress[recentProgress.length - 1]?.timestamp || null
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  _emit(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  _groupBy(array, key) {
    return array.reduce((acc, item) => {
      const k = item[key];
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  }

  /**
   * Get bridge status summary
   */
  getStatus() {
    return {
      inbox: {
        total: this.inbox.tasks.length,
        pending: this.inbox.tasks.filter(t => t.status === TaskStatus.PENDING).length,
        inProgress: this.inbox.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
        blocked: this.inbox.tasks.filter(t => t.status === TaskStatus.BLOCKED).length
      },
      artifacts: {
        total: this.artifacts.artifacts.length,
        unused: this.artifacts.artifacts.filter(a => !a.usedAt).length
      },
      pendingHelp: this.feedback.feedback.filter(f => !f.resolvedAt).length,
      lastActivity: this.progress.updates[this.progress.updates.length - 1]?.timestamp || null
    };
  }
}

// Export singleton
export const claudeCodeBridge = new ClaudeCodeBridge();
export { TaskStatus, TaskPriority, ArtifactType };
export default claudeCodeBridge;
