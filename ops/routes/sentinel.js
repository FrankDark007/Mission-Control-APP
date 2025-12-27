/**
 * Mission Control V8 — Sentinel Agent API Routes
 *
 * Endpoints for managing visual comparison watches
 */

import express from 'express';
import { sentinelAgent } from '../services/sentinelAgent.js';

const router = express.Router();

// =============================================================================
// WATCH MANAGEMENT
// =============================================================================

/**
 * Create a new watch
 * POST /api/sentinel/watches
 */
router.post('/watches', async (req, res) => {
  try {
    const {
      projectId,
      name,
      referenceUrl,
      buildUrl,
      checkInterval,
      threshold,
      autoFix
    } = req.body;

    if (!referenceUrl || !buildUrl) {
      return res.status(400).json({
        success: false,
        error: 'referenceUrl and buildUrl are required'
      });
    }

    const result = sentinelAgent.createWatch({
      projectId,
      name,
      referenceUrl,
      buildUrl,
      checkInterval,
      threshold,
      autoFix
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all watches
 * GET /api/sentinel/watches
 */
router.get('/watches', (req, res) => {
  try {
    const { projectId } = req.query;
    const watches = projectId
      ? sentinelAgent.getProjectWatches(projectId)
      : sentinelAgent.getAllWatches();

    res.json({ success: true, watches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific watch
 * GET /api/sentinel/watches/:id
 */
router.get('/watches/:id', (req, res) => {
  try {
    const watch = sentinelAgent.getWatch(req.params.id);
    if (!watch) {
      return res.status(404).json({ success: false, error: 'Watch not found' });
    }
    res.json({ success: true, watch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Trigger manual comparison
 * POST /api/sentinel/watches/:id/compare
 */
router.post('/watches/:id/compare', async (req, res) => {
  try {
    const result = await sentinelAgent.triggerComparison(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Stop a watch
 * POST /api/sentinel/watches/:id/stop
 */
router.post('/watches/:id/stop', (req, res) => {
  try {
    const result = sentinelAgent.stopWatch(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Resume a stopped watch
 * POST /api/sentinel/watches/:id/resume
 */
router.post('/watches/:id/resume', (req, res) => {
  try {
    const watch = sentinelAgent.getWatch(req.params.id);
    if (!watch) {
      return res.status(404).json({ success: false, error: 'Watch not found' });
    }

    watch.status = 'active';
    sentinelAgent._startWatchLoop(req.params.id);

    res.json({ success: true, watch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a watch
 * DELETE /api/sentinel/watches/:id
 */
router.delete('/watches/:id', (req, res) => {
  try {
    const result = sentinelAgent.deleteWatch(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// COMPARISON HISTORY
// =============================================================================

/**
 * Get comparison history
 * GET /api/sentinel/history
 */
router.get('/history', (req, res) => {
  try {
    const { watchId, limit } = req.query;
    const history = sentinelAgent.getHistory(
      watchId,
      limit ? parseInt(limit) : 10
    );

    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// STATUS
// =============================================================================

/**
 * Get Sentinel status
 * GET /api/sentinel/status
 */
router.get('/status', (req, res) => {
  try {
    const watches = sentinelAgent.getAllWatches();
    const activeWatches = watches.filter(w => w.status === 'active');
    const recentHistory = sentinelAgent.getHistory(null, 5);

    res.json({
      success: true,
      status: {
        totalWatches: watches.length,
        activeWatches: activeWatches.length,
        totalComparisons: watches.reduce((sum, w) => sum + w.checksCompleted, 0),
        totalDiscrepancies: watches.reduce((sum, w) => sum + w.discrepanciesFound, 0),
        totalFixTasks: watches.reduce((sum, w) => sum + w.fixTasksCreated, 0),
        recentComparisons: recentHistory
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
