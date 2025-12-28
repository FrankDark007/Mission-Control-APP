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
const PROJECTS_DIR = path.join(BRIDGE_DIR, 'projects');

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
    fs.ensureDirSync(PROJECTS_DIR);

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
   * Get or create project directory structure
   */
  _getProjectDir(projectId) {
    const projectDir = path.join(PROJECTS_DIR, projectId);
    const artifactsDir = path.join(projectDir, 'artifacts');
    const researchDir = path.join(artifactsDir, 'research');
    const designDir = path.join(artifactsDir, 'design');
    const codeDir = path.join(artifactsDir, 'code');
    const contentDir = path.join(artifactsDir, 'content');
    const imagesDir = path.join(artifactsDir, 'images');

    // Ensure all directories exist
    fs.ensureDirSync(projectDir);
    fs.ensureDirSync(artifactsDir);
    fs.ensureDirSync(researchDir);
    fs.ensureDirSync(designDir);
    fs.ensureDirSync(codeDir);
    fs.ensureDirSync(contentDir);
    fs.ensureDirSync(imagesDir);

    return {
      root: projectDir,
      artifacts: artifactsDir,
      research: researchDir,
      design: designDir,
      code: codeDir,
      content: contentDir,
      images: imagesDir
    };
  }

  /**
   * Get the appropriate subfolder for an artifact type
   */
  _getArtifactSubfolder(type) {
    const typeMap = {
      'research': 'research',
      'data': 'research',
      'svg': 'design',
      'image': 'images',
      'design': 'design',
      'code': 'code',
      'config': 'code',
      'content': 'content'
    };
    return typeMap[type] || 'artifacts';
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

  /**
   * Clear all tasks from the inbox
   * Optionally filter by projectId or status
   */
  clearAllTasks({ projectId, status } = {}) {
    const originalCount = this.inbox.tasks.length;

    if (projectId && status) {
      this.inbox.tasks = this.inbox.tasks.filter(
        t => !(t.projectId === projectId && t.status === status)
      );
    } else if (projectId) {
      this.inbox.tasks = this.inbox.tasks.filter(t => t.projectId !== projectId);
    } else if (status) {
      this.inbox.tasks = this.inbox.tasks.filter(t => t.status !== status);
    } else {
      this.inbox.tasks = [];
    }

    const deletedCount = originalCount - this.inbox.tasks.length;
    this._saveState();

    // Emit socket event
    if (this.io) {
      this.io.emit('inbox-cleared', { deletedCount });
    }

    return { success: true, deletedCount };
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
   * Artifacts are organized into project folders by type
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
    const artifactId = `artifact_${uuidv4().slice(0, 8)}`;
    let projectFilePath = null;

    // If we have a projectId, organize into project folder
    if (projectId) {
      const dirs = this._getProjectDir(projectId);
      const subfolder = this._getArtifactSubfolder(type);
      const targetDir = dirs[subfolder] || dirs.artifacts;

      // Generate filename from name
      const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
      const ext = this._getExtensionForType(type, filePath, content);
      const filename = `${safeName}_${artifactId.slice(-6)}${ext}`;
      projectFilePath = path.join(targetDir, filename);

      // Save artifact content to project folder
      try {
        if (filePath && fs.existsSync(filePath)) {
          // Copy existing file to project folder
          fs.copySync(filePath, projectFilePath);
          console.log(`[ClaudeCodeBridge] Copied artifact to ${projectFilePath}`);
        } else if (content) {
          // Write content to project folder
          if (typeof content === 'object') {
            fs.writeJsonSync(projectFilePath, content, { spaces: 2 });
          } else {
            fs.writeFileSync(projectFilePath, content, 'utf-8');
          }
          console.log(`[ClaudeCodeBridge] Created artifact at ${projectFilePath}`);
        }
      } catch (err) {
        console.error(`[ClaudeCodeBridge] Failed to save artifact to project folder:`, err.message);
      }
    }

    const artifact = {
      id: artifactId,
      projectId,
      taskId,
      type,
      name,
      description,
      filePath: projectFilePath || filePath, // Prefer project path
      originalFilePath: filePath,            // Keep original for reference
      content: projectFilePath ? null : content, // Don't store content if saved to file
      metadata,
      createdBy,
      instructions,
      createdAt: new Date().toISOString(),
      usedAt: null,
      usedBy: null
    };

    this.artifacts.artifacts.push(artifact);
    this._saveState();

    // Also save artifact manifest to project folder
    if (projectId) {
      this._saveProjectManifest(projectId);
    }

    this._emit('artifact-registered', artifact);

    console.log(`[ClaudeCodeBridge] Artifact registered: ${artifact.id} - ${name}`);
    return artifact;
  }

  /**
   * Get file extension based on artifact type
   */
  _getExtensionForType(type, filePath, content) {
    // If we have an original file, use its extension
    if (filePath) {
      const ext = path.extname(filePath);
      if (ext) return ext;
    }

    // Map types to extensions
    const extMap = {
      'svg': '.svg',
      'image': '.png',
      'code': '.txt',
      'config': '.json',
      'content': '.md',
      'research': '.json',
      'data': '.json',
      'design': '.json'
    };

    return extMap[type] || '.txt';
  }

  /**
   * Save project artifact manifest
   */
  _saveProjectManifest(projectId) {
    const dirs = this._getProjectDir(projectId);
    const manifestPath = path.join(dirs.root, 'manifest.json');

    const projectArtifacts = this.artifacts.artifacts.filter(a => a.projectId === projectId);
    const manifest = {
      projectId,
      updatedAt: new Date().toISOString(),
      artifactCount: projectArtifacts.length,
      artifacts: projectArtifacts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        filePath: a.filePath,
        createdAt: a.createdAt,
        createdBy: a.createdBy
      })),
      byType: {
        research: projectArtifacts.filter(a => a.type === 'research' || a.type === 'data').length,
        design: projectArtifacts.filter(a => a.type === 'svg' || a.type === 'design' || a.type === 'image').length,
        code: projectArtifacts.filter(a => a.type === 'code' || a.type === 'config').length,
        content: projectArtifacts.filter(a => a.type === 'content').length
      }
    };

    try {
      fs.writeJsonSync(manifestPath, manifest, { spaces: 2 });
    } catch (err) {
      console.error(`[ClaudeCodeBridge] Failed to save manifest:`, err.message);
    }
  }

  /**
   * Get artifacts for a project (or all if no projectId)
   */
  getArtifacts(projectId, { type, unused = false } = {}) {
    let artifacts = [...this.artifacts.artifacts];

    // Only filter by projectId if provided
    if (projectId) {
      artifacts = artifacts.filter(a => a.projectId === projectId);
    }

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

  /**
   * Get project folder structure and contents
   */
  getProjectFolders(projectId) {
    if (!projectId) {
      // Return list of all project folders
      try {
        const projects = fs.readdirSync(PROJECTS_DIR).filter(f => {
          const stat = fs.statSync(path.join(PROJECTS_DIR, f));
          return stat.isDirectory();
        });
        return { success: true, projects };
      } catch (err) {
        return { success: true, projects: [] };
      }
    }

    const dirs = this._getProjectDir(projectId);
    const manifestPath = path.join(dirs.root, 'manifest.json');

    // Get folder contents
    const getFolderContents = (dir) => {
      try {
        return fs.readdirSync(dir).map(f => {
          const filePath = path.join(dir, f);
          const stat = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            isDirectory: stat.isDirectory(),
            size: stat.size,
            modified: stat.mtime
          };
        });
      } catch (err) {
        return [];
      }
    };

    let manifest = null;
    try {
      if (fs.existsSync(manifestPath)) {
        manifest = fs.readJsonSync(manifestPath);
      }
    } catch (err) {
      // Ignore
    }

    return {
      success: true,
      projectId,
      folders: {
        root: dirs.root,
        research: { path: dirs.research, files: getFolderContents(dirs.research) },
        design: { path: dirs.design, files: getFolderContents(dirs.design) },
        code: { path: dirs.code, files: getFolderContents(dirs.code) },
        content: { path: dirs.content, files: getFolderContents(dirs.content) },
        images: { path: dirs.images, files: getFolderContents(dirs.images) }
      },
      manifest
    };
  }

  /**
   * Migrate existing artifacts to project folders
   * Call this to reorganize artifacts that were created before project folders existed
   */
  migrateArtifactsToProjectFolders() {
    const migrated = [];
    const failed = [];

    for (const artifact of this.artifacts.artifacts) {
      // Skip if no projectId
      if (!artifact.projectId) {
        continue;
      }

      // Skip if already in a project folder
      if (artifact.filePath && artifact.filePath.includes('/projects/')) {
        continue;
      }

      const dirs = this._getProjectDir(artifact.projectId);
      const subfolder = this._getArtifactSubfolder(artifact.type);
      const targetDir = dirs[subfolder] || dirs.artifacts;

      // Generate filename
      const safeName = artifact.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
      const ext = this._getExtensionForType(artifact.type, artifact.filePath || artifact.originalFilePath, artifact.content);
      const filename = `${safeName}_${artifact.id.slice(-6)}${ext}`;
      const newPath = path.join(targetDir, filename);

      try {
        // If we have an original file path, copy it
        if (artifact.originalFilePath && fs.existsSync(artifact.originalFilePath)) {
          fs.copySync(artifact.originalFilePath, newPath);
          artifact.filePath = newPath;
          migrated.push({ id: artifact.id, name: artifact.name, newPath });
        }
        // If we have inline content, write it
        else if (artifact.content) {
          if (typeof artifact.content === 'object') {
            fs.writeJsonSync(newPath, artifact.content, { spaces: 2 });
          } else {
            fs.writeFileSync(newPath, artifact.content, 'utf-8');
          }
          artifact.filePath = newPath;
          artifact.content = null; // Clear content since it's now in file
          migrated.push({ id: artifact.id, name: artifact.name, newPath });
        }
        // If we have a filePath (not original), copy it
        else if (artifact.filePath && fs.existsSync(artifact.filePath)) {
          fs.copySync(artifact.filePath, newPath);
          artifact.originalFilePath = artifact.filePath;
          artifact.filePath = newPath;
          migrated.push({ id: artifact.id, name: artifact.name, newPath });
        }
      } catch (err) {
        failed.push({ id: artifact.id, name: artifact.name, error: err.message });
      }
    }

    // Save updated artifacts
    this._saveState();

    // Update all project manifests
    const projectIds = [...new Set(this.artifacts.artifacts.filter(a => a.projectId).map(a => a.projectId))];
    for (const pid of projectIds) {
      this._saveProjectManifest(pid);
    }

    console.log(`[ClaudeCodeBridge] Migration complete: ${migrated.length} migrated, ${failed.length} failed`);
    return { success: true, migrated, failed };
  }

  /**
   * Read artifact content from file
   */
  readArtifactContent(artifactId) {
    const artifact = this.getArtifact(artifactId);
    if (!artifact) {
      return { success: false, error: 'Artifact not found' };
    }

    // If content is inline, return it
    if (artifact.content) {
      return { success: true, content: artifact.content };
    }

    // Read from file
    if (artifact.filePath && fs.existsSync(artifact.filePath)) {
      try {
        const ext = path.extname(artifact.filePath).toLowerCase();
        if (['.json'].includes(ext)) {
          const content = fs.readJsonSync(artifact.filePath);
          return { success: true, content, format: 'json' };
        } else {
          const content = fs.readFileSync(artifact.filePath, 'utf-8');
          return { success: true, content, format: 'text' };
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'No content available' };
  }
}

// Export singleton
export const claudeCodeBridge = new ClaudeCodeBridge();
export { TaskStatus, TaskPriority, ArtifactType };
export default claudeCodeBridge;
