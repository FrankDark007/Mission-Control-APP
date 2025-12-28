/**
 * Mission Control V8 — Sentinel Agent
 *
 * PURPOSE: Automated visual comparison agent that monitors build quality
 * by comparing built pages against reference/example pages.
 *
 * WORKFLOW:
 * 1. User provides reference URL (the example page to match)
 * 2. Sentinel captures screenshots of both reference and built page
 * 3. Uses Claude Chrome Extension (via MCP) to analyze visual differences
 * 4. Reports discrepancies as specific tasks for Claude Code to fix
 * 5. Continues monitoring until visual match is achieved
 *
 * INTEGRATION POINTS:
 * - Claude Chrome Extension: Provides vision/analysis of page layouts
 * - Claude Desktop: Provides local system access via MCP
 * - Claude Code Bridge: Receives fix tasks from Sentinel
 * - VisualDiff: Stores baselines and comparison results
 */

import { v4 as uuidv4 } from 'uuid';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { claudeCodeBridge } from './claudeCodeBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots/sentinel');

// Ensure screenshot directory exists
fs.ensureDirSync(SCREENSHOTS_DIR);

/**
 * Comparison result structure
 */
const ComparisonStatus = {
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  MATCH: 'match',
  DISCREPANCY: 'discrepancy',
  ERROR: 'error'
};

/**
 * Sentinel Agent - Automated Visual Comparison
 */
class SentinelAgent {
  constructor() {
    this.activeWatches = new Map();  // projectId -> watch config
    this.comparisonHistory = [];
    this.io = null;
    this.mcpClient = null;  // Claude Chrome Extension MCP client
    this.callAI = null;     // AI caller for vision analysis
  }

  /**
   * Initialize with dependencies
   */
  init({ io, mcpClient, callAI }) {
    this.io = io;
    this.mcpClient = mcpClient;
    this.callAI = callAI;
    console.log('[SentinelAgent] Initialized');
  }

  /**
   * Create a watch for a project
   * Monitors a built page against a reference URL
   *
   * @param {Object} config - Watch configuration
   * @returns {Object} Watch info
   */
  createWatch(config) {
    const {
      projectId,
      name,
      referenceUrl,      // The example page to match
      buildUrl,          // The page we're building
      checkInterval = 60000,  // How often to check (ms)
      threshold = 5,     // Acceptable difference percentage
      autoFix = true     // Whether to create fix tasks automatically
    } = config;

    const watchId = `watch_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const watch = {
      id: watchId,
      projectId,
      name: name || `Watch: ${referenceUrl}`,
      referenceUrl,
      buildUrl,
      checkInterval,
      threshold,
      autoFix,
      status: 'active',
      createdAt: now,
      lastCheckAt: null,
      lastResult: null,
      checksCompleted: 0,
      discrepanciesFound: 0,
      fixTasksCreated: 0,
      referenceScreenshot: null,
      buildScreenshot: null
    };

    this.activeWatches.set(watchId, watch);

    // Start the watch loop
    this._startWatchLoop(watchId);

    // Create sanitized copy without intervalId for serialization
    const sanitizedWatch = { ...watch };
    delete sanitizedWatch.intervalId;

    this._emit('sentinel-watch-created', { watch: sanitizedWatch });

    return { success: true, watch: sanitizedWatch };
  }

  /**
   * Start the watch loop for continuous monitoring
   */
  _startWatchLoop(watchId) {
    const watch = this.activeWatches.get(watchId);
    if (!watch) return;

    // Run first check immediately
    this.runComparison(watchId);

    // Set up interval for continuous monitoring
    watch.intervalId = setInterval(() => {
      if (watch.status === 'active') {
        this.runComparison(watchId);
      }
    }, watch.checkInterval);
  }

  /**
   * Run a comparison between reference and build
   *
   * @param {string} watchId - Watch ID
   * @returns {Object} Comparison result
   */
  async runComparison(watchId) {
    const watch = this.activeWatches.get(watchId);
    if (!watch) {
      return { success: false, error: 'Watch not found' };
    }

    const comparisonId = `cmp_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    watch.lastCheckAt = now;
    watch.status = 'checking';
    this._emit('sentinel-comparison-started', { watchId, comparisonId });

    try {
      // 1. Capture screenshots of both pages
      const [refScreenshot, buildScreenshot] = await Promise.all([
        this._captureScreenshot(watch.referenceUrl, `${watchId}_reference`),
        this._captureScreenshot(watch.buildUrl, `${watchId}_build`)
      ]);

      watch.referenceScreenshot = refScreenshot;
      watch.buildScreenshot = buildScreenshot;

      // 2. Analyze differences using AI vision
      const analysis = await this._analyzeWithVision(refScreenshot, buildScreenshot, watch);

      // 3. Process the analysis result
      const result = {
        id: comparisonId,
        watchId,
        timestamp: now,
        referenceUrl: watch.referenceUrl,
        buildUrl: watch.buildUrl,
        referenceScreenshot: refScreenshot,
        buildScreenshot: buildScreenshot,
        analysis,
        discrepancies: analysis.discrepancies || [],
        matchScore: analysis.matchScore || 0,
        status: analysis.matchScore >= (100 - watch.threshold)
          ? ComparisonStatus.MATCH
          : ComparisonStatus.DISCREPANCY
      };

      // Store result
      watch.lastResult = result;
      watch.checksCompleted++;
      watch.status = 'active';

      this.comparisonHistory.push(result);

      // 4. If discrepancies found and autoFix enabled, create fix tasks
      if (result.status === ComparisonStatus.DISCREPANCY && watch.autoFix) {
        watch.discrepanciesFound++;
        await this._createFixTasks(watch, result);
      }

      this._emit('sentinel-comparison-complete', { watchId, result });

      return { success: true, result };

    } catch (error) {
      console.error('[SentinelAgent] Comparison failed:', error);
      watch.status = 'error';
      watch.lastError = error.message;

      return { success: false, error: error.message };
    }
  }

  /**
   * Capture a screenshot of a URL
   */
  async _captureScreenshot(url, name) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait a bit for any animations to settle
      await new Promise(r => setTimeout(r, 1000));

      const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      return screenshotPath;
    } finally {
      await browser.close();
    }
  }

  /**
   * Analyze screenshots using AI vision (Claude Chrome Extension or Gemini)
   */
  async _analyzeWithVision(refScreenshot, buildScreenshot, watch) {
    // If we have access to Claude Chrome Extension via MCP, use it
    if (this.mcpClient) {
      return await this._analyzeWithChromeExtension(refScreenshot, buildScreenshot, watch);
    }

    // Fallback: Use Gemini or other vision model
    if (this.callAI) {
      return await this._analyzeWithGeminiVision(refScreenshot, buildScreenshot, watch);
    }

    // No vision available - return basic result
    return {
      matchScore: 0,
      discrepancies: [{
        type: 'unknown',
        description: 'Vision analysis not available',
        severity: 'medium',
        location: 'unknown'
      }],
      summary: 'Unable to analyze - no vision model available'
    };
  }

  /**
   * Analyze using Claude Chrome Extension (has full page access)
   */
  async _analyzeWithChromeExtension(refScreenshot, buildScreenshot, watch) {
    // TODO: Implement MCP call to Claude Chrome Extension
    // The extension can:
    // - Open both URLs in tabs
    // - Analyze the actual DOM structure
    // - Compare layouts element-by-element
    // - Report specific CSS/HTML differences

    // For now, create a placeholder that will work when MCP is connected
    console.log('[SentinelAgent] Claude Chrome Extension analysis requested');

    return {
      matchScore: 75,
      discrepancies: [
        {
          type: 'layout',
          description: 'Chrome Extension analysis pending MCP connection',
          severity: 'info',
          location: 'page'
        }
      ],
      summary: 'Awaiting Claude Chrome Extension MCP connection for detailed analysis'
    };
  }

  /**
   * Analyze using Gemini Vision
   */
  async _analyzeWithGeminiVision(refScreenshot, buildScreenshot, watch) {
    try {
      // Read screenshots as base64
      const refImage = fs.readFileSync(refScreenshot, { encoding: 'base64' });
      const buildImage = fs.readFileSync(buildScreenshot, { encoding: 'base64' });

      const prompt = `You are a visual QA agent comparing two web page screenshots.

REFERENCE IMAGE: The target design we want to match
BUILD IMAGE: The page we have built

Analyze both images and provide a detailed comparison:

1. MATCH SCORE: Give a percentage (0-100) of how closely the build matches the reference
2. DISCREPANCIES: List specific visual differences found
3. FIX INSTRUCTIONS: For each discrepancy, provide specific CSS/HTML changes needed

Format your response as JSON:
{
  "matchScore": 85,
  "summary": "Overall assessment...",
  "discrepancies": [
    {
      "type": "layout|typography|color|spacing|image|component",
      "description": "What's different",
      "location": "Where on the page (header, hero, footer, etc.)",
      "severity": "high|medium|low",
      "fixInstructions": "Specific CSS/HTML changes needed"
    }
  ]
}`;

      // Call Gemini with both images
      const response = await this.callAI('gemini-3-flash', prompt, 'You are a visual QA expert.', null, 0, 'sentinel', `data:image/png;base64,${refImage}`);

      // Parse the JSON response
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('[SentinelAgent] Failed to parse vision response:', e);
      }

      return {
        matchScore: 50,
        discrepancies: [{
          type: 'analysis',
          description: response.text,
          severity: 'medium',
          location: 'page'
        }],
        summary: response.text
      };

    } catch (error) {
      console.error('[SentinelAgent] Gemini vision analysis failed:', error);
      throw error;
    }
  }

  /**
   * Create fix tasks for Claude Code based on discrepancies
   */
  async _createFixTasks(watch, result) {
    const highPriorityFixes = result.discrepancies.filter(d => d.severity === 'high');
    const mediumPriorityFixes = result.discrepancies.filter(d => d.severity === 'medium');
    const lowPriorityFixes = result.discrepancies.filter(d => d.severity === 'low');

    // Create a consolidated task for Claude Code
    const taskInstructions = `## Sentinel Agent: Visual Discrepancy Report

**Reference URL:** ${watch.referenceUrl}
**Build URL:** ${watch.buildUrl}
**Match Score:** ${result.matchScore}%
**Target Threshold:** ${100 - watch.threshold}%

### Discrepancies Found

${result.discrepancies.map((d, i) => `
#### ${i + 1}. ${d.type.toUpperCase()} - ${d.severity.toUpperCase()}
**Location:** ${d.location}
**Issue:** ${d.description}
${d.fixInstructions ? `**Fix:** ${d.fixInstructions}` : ''}
`).join('\n')}

### Your Task
Please fix these visual discrepancies to make the build page match the reference more closely.

After making changes, the Sentinel will automatically re-check and report progress.

**Priority:**
- HIGH severity items first (${highPriorityFixes.length} items)
- MEDIUM severity next (${mediumPriorityFixes.length} items)
- LOW severity if time permits (${lowPriorityFixes.length} items)`;

    const task = claudeCodeBridge.createTask({
      projectId: watch.projectId,
      title: `[Sentinel] Visual fixes needed - ${result.matchScore}% match`,
      instructions: taskInstructions,
      priority: highPriorityFixes.length > 0 ? 'high' : 'normal',
      createdBy: 'sentinel',
      createdByModel: 'sentinel-agent',
      context: {
        watchId: watch.id,
        comparisonId: result.id,
        referenceUrl: watch.referenceUrl,
        buildUrl: watch.buildUrl,
        matchScore: result.matchScore,
        discrepancyCount: result.discrepancies.length
      },
      artifacts: [
        { type: 'screenshot', name: 'Reference', path: result.referenceScreenshot },
        { type: 'screenshot', name: 'Build', path: result.buildScreenshot }
      ]
    });

    watch.fixTasksCreated++;
    this._emit('sentinel-fix-task-created', { watchId: watch.id, task });

    return task;
  }

  /**
   * Stop a watch
   */
  stopWatch(watchId) {
    const watch = this.activeWatches.get(watchId);
    if (!watch) {
      return { success: false, error: 'Watch not found' };
    }

    if (watch.intervalId) {
      clearInterval(watch.intervalId);
    }

    watch.status = 'stopped';
    this._emit('sentinel-watch-stopped', { watchId });

    return { success: true };
  }

  /**
   * Delete a watch
   */
  deleteWatch(watchId) {
    this.stopWatch(watchId);
    this.activeWatches.delete(watchId);
    return { success: true };
  }

  /**
   * Sanitize watch for JSON serialization (removes intervalId)
   */
  _sanitizeWatch(watch) {
    if (!watch) return null;
    const sanitized = { ...watch };
    delete sanitized.intervalId;
    return sanitized;
  }

  /**
   * Get watch status
   */
  getWatch(watchId) {
    const watch = this.activeWatches.get(watchId);
    return this._sanitizeWatch(watch);
  }

  /**
   * Get all watches
   */
  getAllWatches() {
    return Array.from(this.activeWatches.values()).map(w => this._sanitizeWatch(w));
  }

  /**
   * Get watches for a project
   */
  getProjectWatches(projectId) {
    return this.getAllWatches().filter(w => w.projectId === projectId);
  }

  /**
   * Get comparison history
   */
  getHistory(watchId, limit = 10) {
    return this.comparisonHistory
      .filter(c => !watchId || c.watchId === watchId)
      .slice(-limit);
  }

  /**
   * Manually trigger a comparison
   */
  async triggerComparison(watchId) {
    return this.runComparison(watchId);
  }

  /**
   * Emit socket event
   */
  _emit(event, data) {
    if (this.io) {
      // Sanitize data to avoid circular references (intervalId is a Timer object)
      const sanitized = JSON.parse(JSON.stringify(data, (key, value) => {
        if (key === 'intervalId') return undefined;
        return value;
      }));
      this.io.emit(event, sanitized);
    }
  }
}

// Export singleton
export const sentinelAgent = new SentinelAgent();
export default sentinelAgent;
