
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality } from "@google/genai";
import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

const PROJECT_ROOT = join(__dirname, '..');
const MODELS_JSON = join(PROJECT_ROOT, 'ops', 'models.json');
const FACTS_JSON = join(PROJECT_ROOT, 'facts.json');
const SCREENSHOTS_DIR = join(PROJECT_ROOT, 'screenshots');

if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

import { GitService } from './services/gitService.js';
import { AutopilotService } from './services/autopilotService.js';
import { AgentManager } from './services/agentManager.js';
import { MissionQueue } from './services/missionQueue.js';
import { AutopilotController } from './services/autopilotController.js';
import { createRestoredRouter } from './routes/restoredApi.js';
import { MCPServer } from './mcp/mcpServer.js';
import { Integrations } from './services/integrations/index.js';
import { stateStore } from './state/StateStore.js';
import projectService from './services/projectService.js';
import { claudeCodeBridge } from './services/claudeCodeBridge.js';
import claudeBridgeRouter from './routes/claudeBridge.js';
import { directorEngine } from './services/directorEngine.js';
import { sentinelAgent } from './services/sentinelAgent.js';
import sentinelRouter from './routes/sentinel.js';
import skillsRouter from './routes/skills.js';
import taskService from './services/taskService.js';
import artifactService from './services/artifactService.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, 'client/dist'), { index: 'index.html' }));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/mcp') || req.path.startsWith('/socket.io')) return next();
        res.sendFile(join(__dirname, 'client/dist/index.html'));
    });
}

const PORT = process.env.PORT || 3001;
const FRONTEND_PORT = 4000;
const IS_DOCKER = process.env.DOCKER_ENV === 'true';

const getTargetUrl = () => {
    if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
    return IS_DOCKER ? `http://localhost:${PORT}` : `http://localhost:${FRONTEND_PORT}`;
};

const getPuppeteerFlags = () => ({
    headless: "new",
    args: IS_DOCKER ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : [],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
});

let MODEL_REGISTRY = {};

async function loadModelRegistry() {
    try {
        if (!existsSync(MODELS_JSON)) return;
        const data = await readFile(MODELS_JSON, 'utf8');
        const models = JSON.parse(data);
        MODEL_REGISTRY = models.reduce((acc, m) => {
            const apiKey = m.manualApiKey || process.env[m.apiKeyEnv] || process.env.API_KEY;
            if (apiKey) acc[m.id] = { ...m, apiKey, ready: true };
            else acc[m.id] = { ...m, ready: false };
            return acc;
        }, {});
    } catch (error) {
        console.error('❌ Failed to load model registry:', error);
    }
}

await loadModelRegistry();

async function callAI(modelKey, prompt, systemInstruction = "", latLng = null, thinkingBudget = 0, agentId = 'commander', image = null, useSearch = false) {
    const config = MODEL_REGISTRY[modelKey];
    const provider = config?.provider || 'google';
    const apiKey = config?.apiKey || process.env.API_KEY;
    
    // Handle different providers
    if (provider === 'anthropic') {
        // Anthropic Claude models
        const modelId = config?.apiModelId || 'claude-sonnet-4-20250514';

        const messages = [];
        if (image) {
            // Claude vision format
            const imageData = image.startsWith('data:') ? image.split(',')[1] : image;
            const mediaType = image.startsWith('data:') ? image.split(';')[0].split(':')[1] : 'image/png';
            messages.push({
                role: 'user',
                content: [
                    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
                    { type: 'text', text: prompt }
                ]
            });
        } else {
            messages.push({ role: 'user', content: prompt });
        }

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: modelId,
                    max_tokens: 4096,
                    system: systemInstruction || undefined,
                    messages
                })
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message || 'Anthropic API error');
            }
            const text = data.content?.map(c => c.text).join('') || '';
            return { text, groundingChunks: [] };
        } catch (error) {
            console.error('[Anthropic] API Error:', error.message);
            throw error;
        }
    }

    if (provider === 'openai' || provider === 'openai-compatible') {
        // OpenAI and OpenAI-compatible (DeepSeek, etc.)
        const baseUrl = config?.baseUrl || 'https://api.openai.com/v1';
        const modelId = config?.apiModelId || 'gpt-4o';

        const messages = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        if (image) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: image } }
                ]
            });
        } else {
            messages.push({ role: 'user', content: prompt });
        }

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelId,
                    messages,
                    max_tokens: 4096
                })
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message || 'OpenAI API error');
            }
            return { text: data.choices?.[0]?.message?.content || '', groundingChunks: [] };
        } catch (error) {
            console.error(`[${provider}] API Error:`, error.message);
            throw error;
        }
    }
    
    // Default: Google Gemini
    const ai = new GoogleGenAI({ apiKey });
    // Use flash model for search grounding (required by Google)
    const modelToUse = useSearch ? 'gemini-2.5-flash' : (config?.apiModelId || (thinkingBudget > 0 ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview'));

    const genConfig = { systemInstruction };
    if (thinkingBudget > 0 && (modelToUse.includes('gemini-3') || modelToUse.includes('gemini-2.5'))) {
        genConfig.thinkingConfig = { thinkingBudget };
    }

    // Configure Google Search grounding tool
    if (useSearch) {
        genConfig.tools = [{ googleSearch: {} }];
    }

    // Configure Google Maps grounding (requires location)
    if (latLng) {
        genConfig.tools = genConfig.tools || [];
        genConfig.tools.push({ googleMaps: { location: latLng } });
    }

    let contents = prompt;
    if (image) {
        contents = { parts: [{ text: prompt }, { inlineData: { data: image.split(',')[1], mimeType: 'image/png' } }] };
    }

    const res = await ai.models.generateContent({ model: modelToUse, contents, config: genConfig });
    return { text: res.text, groundingChunks: res.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
}

const autopilotCtrl = new AutopilotController(callAI);
const gitService = new GitService(PROJECT_ROOT);
const autopilot = new AutopilotService(io);
const agentManager = new AgentManager(io, MODEL_REGISTRY, gitService, callAI);
const missionQueue = new MissionQueue(io, agentManager, autopilot);

// Initialize integrations
const integrations = new Integrations();
integrations.initialize().then(status => {
    console.log('📊 Integrations Status:', status);
}).catch(err => {
    console.error('❌ Integrations init error:', err.message);
});

// MCP Server for Claude Desktop
const mcpServer = new MCPServer({
    integrations,
    agentManager,
    callAI
});
app.use('/mcp', mcpServer.getRouter());

// OAuth callback route for GSC/GA4
app.get('/api/oauth/callback', async (req, res) => {
    const { code, state } = req.query;
    try {
        const service = state || 'gsc'; // default to GSC
        const result = await integrations.handleOAuthCallback(service, code);
        res.send(`<html><body><h1>✅ ${service.toUpperCase()} Authorization Complete</h1><p>You can close this window.</p></body></html>`);
    } catch (error) {
        res.status(500).send(`<html><body><h1>❌ Authorization Failed</h1><p>${error.message}</p></body></html>`);
    }
});

// Integration status endpoint
app.get('/api/integrations/status', (req, res) => {
    res.json(integrations.getStatus());
});

// OAuth URLs endpoint
app.get('/api/integrations/oauth-urls', (req, res) => {
    res.json(integrations.getOAuthUrls());
});

// Socket.io Global Handlers
io.on('connection', (socket) => {
    socket.on('swarm-mission', (task) => {
        missionQueue.addTask(task);
    });

    socket.on('agent-sprout', (data) => {
        agentManager.spawnSubAgent(data.parentId, data.taskName, data.branchName);
    });
});

// Sensory Daemon
const startSensoryDaemon = () => {
    setInterval(async () => {
        const state = autopilot.getState();
        if (state.enabled) {
            try {
                const browser = await puppeteer.launch(getPuppeteerFlags());
                const page = await browser.newPage();
                const logs = [];
                page.on('console', msg => { if (msg.type() === 'error') logs.push(msg.text()); });
                await page.goto(getTargetUrl(), { waitUntil: 'networkidle0' });
                if (logs.length > 0) {
                    const screenshotId = `failure-${Date.now()}.png`;
                    await page.screenshot({ path: join(SCREENSHOTS_DIR, screenshotId) });
                    const proposal = await autopilotCtrl.evaluateLog('BROWSER_UI', logs.join('\n'), state.model);
                    if (proposal.failure) {
                        io.emit('agent-deviation', { agentId: 'BROWSER_UI', ...proposal, screenshot: `/screenshots/${screenshotId}`, timestamp: Date.now() });
                    }
                }
                await browser.close();
            } catch (e) {}
        }
    }, 60000);
};

const restoredRouter = createRestoredRouter({ 
    gitService, autopilot, agentManager, missionQueue,
    aiCore: { callAI, getModelRegistry: () => Object.values(MODEL_REGISTRY), reloadModelRegistry: loadModelRegistry }
});

// --- Sensory Snapshot ---
app.post('/api/sensory/snapshot', async (req, res) => {
    try {
        const browser = await puppeteer.launch(getPuppeteerFlags());
        const page = await browser.newPage();
        await page.goto(getTargetUrl(), { waitUntil: 'networkidle2' });
        const buffer = await page.screenshot({ encoding: 'base64' });
        await browser.close();
        res.json({ image: `data:image/png;base64,${buffer}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Cloudflare Edge Sync ---
app.post('/api/edge/sync', async (req, res) => {
    const { key, data } = req.body;
    try {
        const response = await fetch('https://swarm-edge.flood-doctor.workers.dev/api/kv', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${process.env.CF_TOKEN}` 
            },
            body: JSON.stringify({ key, data, timestamp: Date.now() })
        });
        const result = await response.json();
        res.json(result);
    } catch (e) { 
        res.status(500).json({ error: "Edge Unreachable", fallback: true }); 
    }
});

app.get('/api/edge/status', async (req, res) => {
    try {
        const startTime = Date.now();
        const response = await fetch('https://swarm-edge.flood-doctor.workers.dev/api/health', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.CF_TOKEN}` },
            signal: AbortSignal.timeout(5000)
        });
        const latency = Date.now() - startTime;
        
        if (response.ok) {
            const data = await response.json();
            res.json({
                node: data.node || 'Edge-Primary',
                latency: `${latency}ms`,
                status: 'Connected',
                globalReplicas: data.replicas || ['LHR', 'NRT', 'FRA', 'CDG'],
                lastSync: new Date().toISOString()
            });
        } else {
            throw new Error('Edge health check failed');
        }
    } catch (e) {
        res.json({
            node: 'Offline',
            latency: 'N/A',
            status: 'Disconnected',
            globalReplicas: [],
            error: e.message
        });
    }
});

app.use('/api', restoredRouter);
app.use('/api/claude', claudeBridgeRouter);
app.use('/api/sentinel', sentinelRouter);
app.use('/api/skills', skillsRouter);


// Initialize State Store
await stateStore.init();

// V8: Initialize MCP Server delegation gate
mcpServer.initV8(stateStore);

// Initialize Claude Code Bridge with dependencies
claudeCodeBridge.init({ io, stateStore });

// Initialize Director Engine with dependencies (pass instance, not class)
directorEngine.init({ callAI, integrations, io, agentManager });

// Initialize Sentinel Agent with dependencies
sentinelAgent.init({ io, mcpClient: null, callAI });

// Initialize Project Service with dependencies
projectService.init({ stateStore, agentManager, io, directorEngine });

// Initialize Task Service with dependencies
taskService.init({ projectService, claudeCodeBridge, io });

// Initialize Artifact Service with dependencies
artifactService.init({ projectService, taskService, io });

// Emit projects on new socket connections
io.on('connection', (socket) => {
    socket.emit('projects-update', projectService.getAllProjects());
});

const server = httpServer.listen(PORT, () => {
    startSensoryDaemon();
    console.log(`🚀 MISSION CONTROL ACTIVE ON PORT: ${PORT}`);
});

// ==========================================
// 🔗 CLAUDE CODE BRIDGE API ROUTES
// ==========================================

// Get all tasks from Claude Code Bridge
app.get('/api/bridge/tasks', (req, res) => {
    const { projectId, status, limit } = req.query;
    const tasks = claudeCodeBridge.getAllTasks({
        projectId,
        status,
        limit: limit ? parseInt(limit) : 50
    });
    res.json({ tasks });
});

// Get pending tasks for Claude Code
app.get('/api/bridge/tasks/pending', (req, res) => {
    const { projectId } = req.query;
    const tasks = claudeCodeBridge.getPendingTasks(projectId);
    res.json({ tasks });
});

// Get a specific task
app.get('/api/bridge/tasks/:taskId', (req, res) => {
    const task = claudeCodeBridge.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
});

// Acknowledge a task
app.post('/api/bridge/tasks/:taskId/acknowledge', (req, res) => {
    const result = claudeCodeBridge.acknowledgeTask(req.params.taskId);
    res.json(result);
});

// Start a task
app.post('/api/bridge/tasks/:taskId/start', (req, res) => {
    const result = claudeCodeBridge.startTask(req.params.taskId);
    res.json(result);
});

// Report progress
app.post('/api/bridge/tasks/:taskId/progress', (req, res) => {
    const result = claudeCodeBridge.reportProgress(req.params.taskId, req.body);
    res.json(result);
});

// Complete a task
app.post('/api/bridge/tasks/:taskId/complete', (req, res) => {
    const result = claudeCodeBridge.completeTask(req.params.taskId, req.body);
    res.json(result);
});

// Get all artifacts
app.get('/api/bridge/artifacts', (req, res) => {
    const { projectId, type, unused } = req.query;
    const artifacts = claudeCodeBridge.getArtifacts(projectId, {
        type,
        unused: unused === 'true'
    });
    res.json({ artifacts });
});

// Get bridge status
app.get('/api/bridge/status', (req, res) => {
    res.json(claudeCodeBridge.getStatus());
});

// Get project status (for Director monitoring)
app.get('/api/bridge/projects/:projectId/status', (req, res) => {
    const status = claudeCodeBridge.getProjectStatus(req.params.projectId);
    res.json(status);
});

// ==========================================
// 🔫 ARMED MODE & TASK SPAWN ROUTES
// ==========================================

// Get armed mode status
app.get('/api/armed-mode', (req, res) => {
    res.json({
        armed: agentManager.isArmedMode(),
        stateStoreArmed: stateStore.getArmedMode?.() ?? false
    });
});

// Set armed mode
app.post('/api/armed-mode', (req, res) => {
    const { armed } = req.body;
    agentManager.setArmedMode(armed);
    if (stateStore.setArmedMode) {
        stateStore.setArmedMode(armed);
    }
    io.emit('armed-mode-changed', { armed });
    res.json({ success: true, armed });
});

// Spawn agent from inbox task - actually runs claude -p [prompt]
app.post('/api/tasks/:taskId/spawn', async (req, res) => {
    try {
        // Get task from Claude Code Bridge
        const task = claudeCodeBridge.getTask(req.params.taskId);
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        // Enable armed mode for this execution
        const wasArmed = agentManager.isArmedMode();
        agentManager.setArmedMode(true);

        // Build the prompt from task
        let prompt = task.instructions;
        if (task.title) {
            prompt = `# Task: ${task.title}\n\n${prompt}`;
        }
        if (task.context?.acceptanceCriteria?.length > 0) {
            prompt += `\n\n## Acceptance Criteria:\n${task.context.acceptanceCriteria.map((c, i) => `${i+1}. ${c}`).join('\n')}`;
        }

        // Spawn the agent
        const result = await agentManager.spawnAgentImmediate({
            missionId: task.projectId,
            taskId: task.id,
            taskName: task.title,
            prompt,
            model: 'claude-sonnet-4',
            autoPilot: true,
            riskLevel: task.priority === 'critical' ? 'high' : 'medium'
        }, {
            riskThreshold: 'high' // Allow up to high risk
        });

        // Restore armed mode if it wasn't enabled before
        if (!wasArmed) {
            agentManager.setArmedMode(false);
        }

        if (result.success) {
            // Update task status
            claudeCodeBridge.startTask(req.params.taskId);

            // Emit socket event
            io.emit('agent-spawned', {
                taskId: task.id,
                agentId: result.agentId,
                pid: result.pid
            });
        }

        res.json(result);
    } catch (error) {
        console.error('[Spawn Error]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 🤖 AGENT API ROUTES
// ==========================================

// Spawn a new Claude Code agent
app.post('/api/agents/spawn', async (req, res) => {
    try {
        const { task, workdir, autopilot = true } = req.body;
        const branchName = 'agent-' + Date.now();
        const result = await agentManager.spawnClaudeAgent({
            taskName: task || 'unnamed-task',
            branchName: branchName,
            prompt: task,
            autoPilot: autopilot
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List all agents
app.get('/api/agents', (req, res) => {
    try {
        const agents = agentManager.listAgents();
        res.json({ agents });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get agent status
app.get('/api/agents/:id/status', (req, res) => {
    try {
        const status = agentManager.getStatus(req.params.id);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send input to agent
app.post('/api/agents/:id/input', async (req, res) => {
    try {
        const { input } = req.body;
        await agentManager.sendInput(req.params.id, input);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get agent logs
app.get('/api/agents/:id/logs', (req, res) => {
    try {
        const lines = parseInt(req.query.lines) || 100;
        const logs = agentManager.getLogs(req.params.id, lines);
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop an agent
app.delete('/api/agents/:id', async (req, res) => {
    try {
        await agentManager.stopAgent(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// AI GENERATION ENDPOINT (Gemini Bridge)
// ============================================
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt, model = 'gemini-pro' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'GOOGLE_API_KEY not configured' });
    }
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    
    const data = await response.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ response: text, model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// V7 BUILDER ENDPOINT - Direct Claude Code Spawning
// ============================================
app.post('/api/v7/build', async (req, res) => {
  try {
    const { phase = 'auto', resume = true } = req.body;
    const handoffPath = join(__dirname, 'handoffs', 'latest.json');
    
    // Read current handoff state
    let handoff = { phase: '1', status: 'NOT_STARTED', completed: [], pending: [] };
    try {
      handoff = JSON.parse(await readFile(handoffPath, 'utf8'));
    } catch (e) { /* No handoff yet */ }
    
    // Determine which phase to run
    const targetPhase = phase === 'auto' ? handoff.phase : phase;
    
    // Build the prompt with full context
    const builderPrompt = `You are the Mission Control V7 Builder Agent.

RESUME FROM: Phase ${targetPhase}
HANDOFF STATE: ${JSON.stringify(handoff, null, 2)}

PROJECT ROOT: /Users/ghost/flood-doctor/Mission-Control-APP/ops

CRITICAL RULES:
1. Read the spec files FIRST: /Users/ghost/flood-doctor/Mission-Control-APP/ops/docs/
2. All state mutations go through StateStore
3. Write handoff to /Users/ghost/flood-doctor/Mission-Control-APP/ops/handoffs/latest.json after EVERY file created
4. Create atomic, reversible changes only
5. DO NOT modify server.js, .env, or OAuth configs
6. If you need human input, STOP and update handoff with blockedReason

PHASE ${targetPhase} OBJECTIVES:
${getPhaseObjectives(targetPhase)}

SESSION PROTOCOL:
- After every 3 files created, update handoffs/latest.json
- If context feels heavy, create checkpoint and report "HANDOFF READY"
- On any error, log to handoffs/latest.json and stop

START NOW. Read existing code first, then continue building.`;

    const branchName = `v7-build-phase${targetPhase}-${Date.now()}`;
    
    const result = await agentManager.spawnClaudeAgent({
      taskName: `V7 Build Phase ${targetPhase}`,
      branchName: branchName,
      prompt: builderPrompt,
      autoPilot: true
    });
    
    // Update handoff with spawn info
    handoff.lastSpawn = {
      agentId: result.agentId,
      branch: branchName,
      phase: targetPhase,
      timestamp: new Date().toISOString()
    };
    handoff.status = 'RUNNING';
    
    await writeFile(handoffPath, JSON.stringify(handoff, null, 2));
    
    res.json({
      success: true,
      message: `V7 Builder spawned for Phase ${targetPhase}`,
      agentId: result.agentId,
      branch: branchName,
      handoff: handoff
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get V7 build status
app.get('/api/v7/status', async (req, res) => {
  try {
    const handoffPath = join(__dirname, 'handoffs', 'latest.json');
    const handoff = JSON.parse(await readFile(handoffPath, 'utf8'));
    
    // Get agent status if running
    let agentStatus = null;
    if (handoff.lastSpawn?.agentId) {
      agentStatus = agentManager.getStatus(handoff.lastSpawn.agentId);
    }
    
    res.json({
      handoff,
      agentStatus,
      phases: {
        1: 'State Authority (StateStore, JsonStore, schemas, validators)',
        2: 'Mission Contracts (artifact gates, tool permissions)',
        3: 'Circuit Breaker (rate limits, cost estimator)',
        4: 'Agent Execution (spawn_agent, spawn_agent_immediate)',
        5: 'Task Graph (dependencies, task types)',
        6: 'Self-Healing (proposals, idempotency)',
        7: 'Watchdog (autonomous triggers)',
        8: 'MCP Tools (all tool scaffolding)',
        9: 'Integration Health (provider checks)'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Get phase objectives
function getPhaseObjectives(phase) {
  const objectives = {
    '1': `- Create ops/state/StateStore.js (if not exists)
- Create ops/state/storage/JsonStore.js
- Create ops/state/validators/missionValidator.js
- Create ops/state/validators/artifactValidator.js
- Ensure snapshots/ and audit/ directories exist`,
    '2': `- Add mission contract enforcement to StateStore
- Implement artifact gates (no completion without proof)
- Add tool permission matrix by missionClass
- Add destructive action gating`,
    '3': `- Create ops/services/rateLimitService.js
- Create ops/services/costEstimatorService.js
- Add circuit breaker logic to StateStore
- Implement budget limits and failure tracking`,
    '4': `- Update spawn_agent to return recipe only
- Implement spawn_agent_immediate with armed mode gate
- Add cooldown and rate limit enforcement
- Connect to StateStore for state tracking`,
    '5': `- Create ops/services/taskGraphService.js
- Implement dependency resolution
- Add task types (work, verification, finalization)
- Enforce task gates`,
    '6': `- Create ops/services/selfHealingService.js
- Implement failure analysis
- Add self_heal_proposal artifact generation
- Implement idempotency keys`,
    '7': `- Create ops/services/watchdogService.js
- Implement signal detection
- Add mission creation from signals
- Create rankingWatchdogService.js`,
    '8': `- Create all MCP tools in ops/mcp/tools/
- mission.tools.js, task.tools.js, agent.tools.js
- artifact.tools.js, safety.tools.js, server.tools.js
- ranking.tools.js, gsc.tools.js, ga4.tools.js`,
    '9': `- Add healthCheck() to all integration services
- Create provider.health endpoint
- Add connection test buttons to UI
- Implement quota tracking`
  };
  return objectives[phase] || objectives['1'];
}

// ==========================================
// 📁 PROJECT API ROUTES (V8)
// ==========================================

// Get all projects
app.get('/api/projects', (req, res) => {
  try {
    const projects = projectService.getAllProjects();
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project statistics
app.get('/api/projects/stats', (req, res) => {
  try {
    const stats = projectService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available director models
app.get('/api/projects/director-models', (req, res) => {
  try {
    const models = Object.values(MODEL_REGISTRY)
      .filter(m => m.ready)
      .map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        description: m.description || `${m.provider} ${m.name}`,
        capabilities: m.capabilities || [],
        available: m.ready
      }));
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new project
app.post('/api/projects', async (req, res) => {
  try {
    const { name, description, instructions, directorModel } = req.body;

    if (!name || !instructions || !directorModel) {
      return res.status(400).json({
        error: 'Missing required fields: name, instructions, directorModel'
      });
    }

    const result = await projectService.createProject({
      name,
      description,
      instructions,
      directorModel
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single project
app.get('/api/projects/:id', (req, res) => {
  try {
    const project = projectService.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update project status
app.patch('/api/projects/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await projectService.updateProjectStatus(req.params.id, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update project phase
app.patch('/api/projects/:id/phase', async (req, res) => {
  try {
    const { phase } = req.body;
    const result = await projectService.updateProjectPhase(req.params.id, phase);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Spawn director agent for project
app.post('/api/projects/:id/spawn-director', async (req, res) => {
  try {
    const { skipPlanning } = req.body || {};
    const projectId = req.params.id;

    // First, create task plan from project instructions
    let planResult = null;
    if (!skipPlanning) {
      console.log(`[API] Creating task plan for project: ${projectId}`);
      planResult = await directorEngine.createTaskPlan(projectId);
      console.log(`[API] Task plan created: ${planResult.tasks} tasks in ${planResult.phases} phases`);
    }

    // Then optionally start the autonomous director
    const { startAutonomous } = req.body || {};
    let directorResult = null;
    if (startAutonomous) {
      directorResult = await projectService.spawnDirectorAgent(projectId);
    }

    res.json({
      success: true,
      plan: planResult,
      director: directorResult,
      message: planResult
        ? `Created ${planResult.tasks} tasks across ${planResult.phases} phases`
        : 'Director started without planning'
    });
  } catch (error) {
    console.error('[API] spawn-director error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Director status for a project
app.get('/api/projects/:id/director', (req, res) => {
  try {
    const status = directorEngine.getDirectorStatus(req.params.id);
    if (!status) {
      return res.json({ active: false, message: 'No active director for this project' });
    }
    res.json({ active: true, ...status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message to Director
app.post('/api/projects/:id/director/message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const result = await directorEngine.sendMessage(req.params.id, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active Directors
app.get('/api/directors', (req, res) => {
  try {
    const directors = directorEngine.getActiveDirectors();
    res.json({ directors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const result = await projectService.deleteProject(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🔐 V8 EXECUTION AUTHORITY API ROUTES
// ==========================================

// V8: Session Resume
app.post('/api/v8/session/resume', async (req, res) => {
  try {
    const summary = await stateStore.resumeSession();
    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Session resume failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'RESUME_FAILED'
    });
  }
});

// V8: Get Execution Violations
app.get('/api/v8/violations', async (req, res) => {
  try {
    const { missionId } = req.query;

    if (missionId) {
      const violations = stateStore.getExecutionViolations(missionId);
      res.json({ success: true, violations, count: violations.length });
    } else {
      const count = stateStore.getViolationCount();
      res.json({ success: true, totalCount: count });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// V8: Record a Violation
app.post('/api/v8/violations/record', async (req, res) => {
  try {
    const { missionId, taskId, attemptedAction, attemptedBy } = req.body;

    if (!missionId || !attemptedAction) {
      return res.status(400).json({
        success: false,
        error: 'missionId and attemptedAction required'
      });
    }

    const artifact = await stateStore.recordExecutionViolation({
      missionId,
      taskId: taskId || null,
      attemptedAction,
      attemptedBy: attemptedBy || 'UNKNOWN',
      requiredAuthority: 'CLAUDE_CODE'
    });

    res.json({ success: true, artifact });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// V8: Status and Health
app.get('/api/v8/status', async (req, res) => {
  try {
    const stats = stateStore.getStats();
    const violationCount = stateStore.getViolationCount();

    res.json({
      success: true,
      v8: {
        enabled: true,
        delegationEnforced: true,
        violationCount,
        resumeManagerReady: !!stateStore.resumeManager
      },
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// V8: Get Mission with Authority Context
app.get('/api/v8/missions/:missionId/authority', async (req, res) => {
  try {
    const { missionId } = req.params;
    const missionWithAuth = await stateStore.getMissionWithAuthority(missionId);

    if (!missionWithAuth) {
      return res.status(404).json({
        success: false,
        error: 'Mission not found'
      });
    }

    res.json({ success: true, mission: missionWithAuth });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// V8: Create Mission with Bootstrap
app.post('/api/v8/missions/create', async (req, res) => {
  try {
    const missionData = req.body;
    const mission = await stateStore.createMissionWithBootstrap(missionData);

    res.json({
      success: true,
      mission,
      v8: {
        bootstrapCreated: !!mission.bootstrapArtifactId,
        executionAuthority: mission.executionAuthority,
        executionMode: mission.executionMode
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// V8: Check Execution Permission
app.post('/api/v8/check-permission', async (req, res) => {
  try {
    const { missionId, caller } = req.body;

    if (!missionId || !caller) {
      return res.status(400).json({
        success: false,
        error: 'missionId and caller required'
      });
    }

    const result = stateStore.checkExecutionPermission(missionId, caller);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 🏗️ ARCHITECTURE FIX API ROUTES
// ==========================================

const serverStartTime = Date.now();

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    timestamp: new Date().toISOString(),
    services: {
      stateStore: !!stateStore.isInitialized,
      taskService: true,
      artifactService: true,
      projectService: true
    }
  });
});

// System Status
app.get('/api/status', async (req, res) => {
  try {
    const tasks = taskService.getAllTasks();
    const artifacts = artifactService.getAllArtifacts();
    const projects = projectService.getAllProjects();

    res.json({
      projects: projects.length,
      tasks: tasks.length,
      artifacts: artifacts.length,
      agents: Object.keys(stateStore.state?.agents || {}).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// TASKS API
// ─────────────────────────────────────────────────────────────────

// Get all tasks with filters
app.get('/api/tasks', (req, res) => {
  try {
    const { projectId, status, phaseIndex, taskType, limit } = req.query;
    const tasks = taskService.getAllTasks({
      projectId,
      status,
      phaseIndex: phaseIndex !== undefined ? parseInt(phaseIndex) : undefined,
      taskType,
      limit: limit ? parseInt(limit) : undefined
    });
    res.json({ tasks, total: tasks.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single task with artifacts
app.get('/api/tasks/:taskId', async (req, res) => {
  try {
    const task = taskService.getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const artifacts = artifactService.getArtifactsByTask(task.id);
    res.json({ task, artifacts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const { projectId, title, description, phaseIndex, phaseName, deps, taskType, prompt, estimatedMinutes } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({ error: 'projectId and title required' });
    }

    const task = await taskService.createTask({
      projectId,
      title,
      description,
      phaseIndex,
      phaseName,
      deps,
      taskType,
      prompt,
      estimatedMinutes
    });

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.patch('/api/tasks/:taskId', async (req, res) => {
  try {
    const task = await taskService.updateTask(req.params.taskId, req.body);
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute task (send to Claude Code)
app.post('/api/tasks/:taskId/execute', async (req, res) => {
  try {
    const task = await taskService.executeTask(req.params.taskId);
    res.json({
      success: true,
      task,
      claudeCodeTaskId: task.claudeCodeTaskId,
      status: task.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete task
app.post('/api/tasks/:taskId/complete', async (req, res) => {
  try {
    const task = await taskService.completeTask(req.params.taskId, req.body);
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fail task
app.post('/api/tasks/:taskId/fail', async (req, res) => {
  try {
    const { error: errorMessage } = req.body;
    const task = await taskService.failTask(req.params.taskId, errorMessage);
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task artifacts
app.get('/api/tasks/:taskId/artifacts', (req, res) => {
  try {
    const artifacts = artifactService.getArtifactsByTask(req.params.taskId);
    res.json({ artifacts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// ARTIFACTS API
// ─────────────────────────────────────────────────────────────────

// Get all artifacts with filters
app.get('/api/artifacts', (req, res) => {
  try {
    const { projectId, taskId, type, limit } = req.query;
    const artifacts = artifactService.getAllArtifacts({
      projectId,
      taskId,
      type,
      limit: limit ? parseInt(limit) : undefined
    });
    res.json({ artifacts, total: artifacts.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single artifact with content
app.get('/api/artifacts/:artifactId', async (req, res) => {
  try {
    const artifact = artifactService.getArtifact(req.params.artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    const content = await artifactService.getArtifactContent(artifact.id);
    res.json({ artifact, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create artifact
app.post('/api/artifacts', async (req, res) => {
  try {
    const { projectId, taskId, type, label, content, payload, contentType, provenance } = req.body;

    if (!projectId || !type || !label) {
      return res.status(400).json({ error: 'projectId, type, and label required' });
    }

    const artifact = await artifactService.createArtifact({
      projectId,
      taskId,
      type,
      label,
      content,
      payload,
      contentType,
      provenance
    });

    res.json({ success: true, artifact });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get artifact preview
app.get('/api/artifacts/:artifactId/preview', async (req, res) => {
  try {
    const artifact = artifactService.getArtifact(req.params.artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    if (!artifact.previewable) {
      return res.status(400).json({ error: 'Artifact is not previewable' });
    }

    // Return preview HTML
    res.type('html').send(artifact.previewHtml || '<p>No preview available</p>');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get artifact content (full content)
app.get('/api/artifacts/:artifactId/content', async (req, res) => {
  try {
    const artifact = artifactService.getArtifact(req.params.artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const content = await artifactService.getArtifactContent(req.params.artifactId);
    res.json({ content, contentType: artifact.contentType });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete artifact
app.delete('/api/artifacts/:artifactId', async (req, res) => {
  try {
    const result = await artifactService.deleteArtifact(req.params.artifactId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// PROJECT TREE API
// ─────────────────────────────────────────────────────────────────

// Get project with full tree (phases → tasks → artifacts)
app.get('/api/projects/:id/tree', async (req, res) => {
  try {
    const tree = await projectService.getProjectWithTree(req.params.id);
    if (!tree) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project tasks grouped by phase
app.get('/api/projects/:id/tasks', (req, res) => {
  try {
    const phases = taskService.getTasksByPhaseGrouped(req.params.id);
    const stats = taskService.getProjectTaskStats(req.params.id);
    res.json({ phases, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project artifacts
app.get('/api/projects/:id/artifacts', (req, res) => {
  try {
    const artifacts = artifactService.getArtifactsByProject(req.params.id);
    const stats = artifactService.getProjectArtifactStats(req.params.id);
    res.json({ artifacts, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
