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

export default router;
