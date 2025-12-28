/**
 * Mission Control V8 — Claude Code Bridge API Routes
 *
 * These routes enable communication between Mission Control and Claude Code.
 *
 * For Directors/Agents (creating tasks, providing artifacts):
 *   POST /api/claude/tasks           - Create a task for Claude Code
 *   POST /api/claude/artifacts       - Register an artifact
 *   POST /api/claude/command         - Send director command
 *   GET  /api/claude/status/:projectId - Get project status for monitoring
 *
 * For Claude Code (receiving tasks, reporting progress):
 *   GET  /api/claude/inbox           - Get pending tasks
 *   POST /api/claude/tasks/:id/ack   - Acknowledge a task
 *   POST /api/claude/tasks/:id/start - Start a task
 *   POST /api/claude/tasks/:id/progress - Report progress
 *   POST /api/claude/tasks/:id/complete - Complete a task
 *   POST /api/claude/tasks/:id/fail  - Fail a task
 *   POST /api/claude/tasks/:id/help  - Request help
 *   GET  /api/claude/artifacts/:projectId - Get artifacts for project
 */

import express from 'express';
import { claudeCodeBridge, TaskPriority, ArtifactType } from '../services/claudeCodeBridge.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTOR/AGENT ROUTES - Creating tasks and providing data
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a task for Claude Code
 * Used by Directors and Agents to assign work
 */
router.post('/tasks', (req, res) => {
  try {
    const {
      projectId,
      title,
      instructions,
      priority,
      createdBy,
      createdByModel,
      context,
      artifacts,
      deadline,
      dependencies
    } = req.body;

    if (!projectId || !title || !instructions) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: projectId, title, instructions'
      });
    }

    const task = claudeCodeBridge.createTask({
      projectId,
      title,
      instructions,
      priority: priority || TaskPriority.NORMAL,
      createdBy: createdBy || 'unknown',
      createdByModel,
      context,
      artifacts,
      deadline,
      dependencies
    });

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Register an artifact for Claude Code to use
 * Used by sub-agents (Refract, Creative, Research, etc.)
 */
router.post('/artifacts', (req, res) => {
  try {
    const {
      projectId,
      taskId,
      type,
      name,
      description,
      filePath,
      content,
      metadata,
      createdBy,
      instructions
    } = req.body;

    if (!projectId || !type || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: projectId, type, name'
      });
    }

    const artifact = claudeCodeBridge.registerArtifact({
      projectId,
      taskId,
      type,
      name,
      description,
      filePath,
      content,
      metadata,
      createdBy: createdBy || 'unknown',
      instructions
    });

    res.json({ success: true, artifact });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Send a director command
 * High-priority direct instruction from the Director
 */
router.post('/command', (req, res) => {
  try {
    const {
      projectId,
      command,
      priority,
      directorModel,
      context,
      expectedOutcome
    } = req.body;

    if (!projectId || !command) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: projectId, command'
      });
    }

    const task = claudeCodeBridge.sendDirectorCommand({
      projectId,
      command,
      priority,
      directorModel,
      context,
      expectedOutcome
    });

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get project status for Director monitoring
 */
router.get('/status/:projectId', (req, res) => {
  try {
    const status = claudeCodeBridge.getProjectStatus(req.params.projectId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Respond to a help request from Claude Code
 */
router.post('/help/:helpId/respond', (req, res) => {
  try {
    const { response, decidedBy, reasoning } = req.body;

    if (!response) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: response'
      });
    }

    const result = claudeCodeBridge.respondToHelp(req.params.helpId, {
      response,
      decidedBy,
      reasoning
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLAUDE CODE ROUTES - Receiving tasks and reporting progress
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get Claude Code's task inbox
 * This is what Claude Code polls to get work
 */
router.get('/inbox', (req, res) => {
  try {
    const { projectId } = req.query;
    const tasks = claudeCodeBridge.getPendingTasks(projectId || null);
    const status = claudeCodeBridge.getStatus();

    res.json({
      success: true,
      tasks,
      summary: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Clear all tasks from the inbox
 * Optionally filter by projectId or status
 */
router.delete('/inbox', (req, res) => {
  try {
    const { projectId, status } = req.query;
    const result = claudeCodeBridge.clearAllTasks({
      projectId: projectId || undefined,
      status: status || undefined
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all tasks (with filters)
 */
router.get('/tasks', (req, res) => {
  try {
    const { projectId, status, limit } = req.query;
    const tasks = claudeCodeBridge.getAllTasks({
      projectId,
      status,
      limit: limit ? parseInt(limit) : 50
    });

    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific task
 */
router.get('/tasks/:taskId', (req, res) => {
  try {
    const task = claudeCodeBridge.getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Acknowledge a task
 */
router.post('/tasks/:taskId/ack', (req, res) => {
  try {
    const result = claudeCodeBridge.acknowledgeTask(req.params.taskId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Start working on a task
 */
router.post('/tasks/:taskId/start', (req, res) => {
  try {
    const result = claudeCodeBridge.startTask(req.params.taskId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Report progress on a task
 */
router.post('/tasks/:taskId/progress', (req, res) => {
  try {
    const { progress, note, filesModified, blockers } = req.body;

    if (progress === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: progress'
      });
    }

    const result = claudeCodeBridge.reportProgress(req.params.taskId, {
      progress,
      note,
      filesModified,
      blockers
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Complete a task
 */
router.post('/tasks/:taskId/complete', (req, res) => {
  try {
    const { result, filesCreated, filesModified, summary } = req.body;

    const taskResult = claudeCodeBridge.completeTask(req.params.taskId, {
      result,
      filesCreated,
      filesModified,
      summary
    });

    res.json(taskResult);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Fail a task
 */
router.post('/tasks/:taskId/fail', (req, res) => {
  try {
    const { error, canRetry } = req.body;

    const result = claudeCodeBridge.failTask(req.params.taskId, {
      error,
      canRetry
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Request help on a task
 */
router.post('/tasks/:taskId/help', (req, res) => {
  try {
    const { question, options, context } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: question'
      });
    }

    const result = claudeCodeBridge.requestHelp(req.params.taskId, {
      question,
      options,
      context
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get artifacts for a project
 */
router.get('/artifacts/:projectId', (req, res) => {
  try {
    const { type, unused } = req.query;
    const artifacts = claudeCodeBridge.getArtifacts(req.params.projectId, {
      type,
      unused: unused === 'true'
    });

    res.json({ success: true, artifacts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific artifact
 */
router.get('/artifact/:artifactId', (req, res) => {
  try {
    const artifact = claudeCodeBridge.getArtifact(req.params.artifactId);
    if (!artifact) {
      return res.status(404).json({ success: false, error: 'Artifact not found' });
    }
    res.json({ success: true, artifact });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Mark an artifact as used
 */
router.post('/artifact/:artifactId/used', (req, res) => {
  try {
    const { usedBy, usedHow } = req.body;

    const result = claudeCodeBridge.markArtifactUsed(req.params.artifactId, {
      usedBy,
      usedHow
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get pending help requests
 */
router.get('/help', (req, res) => {
  try {
    const { projectId } = req.query;
    const requests = claudeCodeBridge.getPendingHelpRequests(projectId || null);

    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get bridge status
 */
router.get('/bridge-status', (req, res) => {
  try {
    const status = claudeCodeBridge.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT FOLDER ROUTES - Artifact organization by project
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all project folders
 */
router.get('/projects', (req, res) => {
  try {
    const result = claudeCodeBridge.getProjectFolders();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get project folder structure and contents
 */
router.get('/projects/:projectId', (req, res) => {
  try {
    const result = claudeCodeBridge.getProjectFolders(req.params.projectId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Migrate existing artifacts to project folders
 */
router.post('/projects/migrate', (req, res) => {
  try {
    const result = claudeCodeBridge.migrateArtifactsToProjectFolders();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Read artifact content from file
 */
router.get('/artifact/:artifactId/content', (req, res) => {
  try {
    const result = claudeCodeBridge.readArtifactContent(req.params.artifactId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// V8: TASK EXECUTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Prepare a task for execution
 * Returns the full task instructions for Claude Code to execute
 */
router.post('/tasks/:taskId/execute', (req, res) => {
  try {
    const task = claudeCodeBridge.getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Mark task as acknowledged if pending
    if (task.status === 'pending') {
      claudeCodeBridge.acknowledgeTask(req.params.taskId);
    }

    // Get all artifacts associated with this task
    const artifacts = claudeCodeBridge.getArtifacts(task.projectId, {
      unused: false
    });

    // Filter artifacts that are relevant to this task
    const taskArtifacts = artifacts.filter(a =>
      a.taskId === task.id ||
      (task.context?.artifactIds || []).includes(a.id)
    );

    // Build execution context
    const executionContext = {
      task: {
        id: task.id,
        title: task.title,
        instructions: task.instructions,
        priority: task.priority,
        createdBy: task.createdBy,
        createdByModel: task.createdByModel,
        context: task.context
      },
      artifacts: taskArtifacts.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        description: a.description,
        filePath: a.filePath,
        instructions: a.instructions
      })),
      acceptanceCriteria: task.context?.acceptanceCriteria || [],
      readyForExecution: true,
      acknowledgedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      execution: executionContext,
      message: `Task "${task.title}" is ready for execution`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get execution-ready instructions for a task
 * This is what gets displayed in the Builder tab
 */
router.get('/tasks/:taskId/instructions', (req, res) => {
  try {
    const task = claudeCodeBridge.getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Build a formatted instruction block for Claude Code
    let instructions = `# Task: ${task.title}\n\n`;
    instructions += `## Instructions\n${task.instructions}\n\n`;

    if (task.context?.acceptanceCriteria?.length > 0) {
      instructions += `## Acceptance Criteria\n`;
      task.context.acceptanceCriteria.forEach((criteria, i) => {
        instructions += `${i + 1}. ${criteria}\n`;
      });
      instructions += '\n';
    }

    if (task.context?.phase) {
      instructions += `## Phase\n${task.context.phase}\n\n`;
    }

    // Get related artifacts
    const artifacts = claudeCodeBridge.getArtifacts(task.projectId, { unused: false });
    const taskArtifacts = artifacts.filter(a =>
      a.taskId === task.id ||
      (task.context?.artifactIds || []).includes(a.id)
    );

    if (taskArtifacts.length > 0) {
      instructions += `## Available Artifacts\n`;
      taskArtifacts.forEach(a => {
        instructions += `- **${a.name}** (${a.type}): ${a.description || 'No description'}\n`;
        if (a.filePath) {
          instructions += `  - File: ${a.filePath}\n`;
        }
        if (a.instructions) {
          instructions += `  - Instructions: ${a.instructions}\n`;
        }
      });
      instructions += '\n';
    }

    instructions += `## Metadata\n`;
    instructions += `- Created by: ${task.createdByModel || task.createdBy}\n`;
    instructions += `- Priority: ${task.priority}\n`;
    instructions += `- Task ID: ${task.id}\n`;

    res.json({
      success: true,
      taskId: task.id,
      title: task.title,
      instructions,
      raw: {
        task,
        artifacts: taskArtifacts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
