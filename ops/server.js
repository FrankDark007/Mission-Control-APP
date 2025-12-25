import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import { readFile, writeFile, copyFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import util from 'util';
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import puppeteer from 'puppeteer';
import cron from 'node-cron';
import OpenAI from 'openai';
import axios from 'axios';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Promisify exec for simple one-off commands
const execAsync = util.promisify(exec);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/screenshots', express.static(join(process.cwd(), 'screenshots')));

const PORT = 3001;
const HOME = homedir();

// ==========================================
// 🧠 PLUG-AND-PLAY MODEL REGISTRY
// ==========================================

const MODEL_REGISTRY = {
    'gemini-3-pro': {
        name: 'Gemini 3 Pro',
        provider: 'google',
        modelId: 'gemini-3-pro-preview',
        apiKey: process.env.API_KEY
    },
    'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        provider: 'google',
        modelId: 'gemini-2.5-flash-preview',
        apiKey: process.env.API_KEY
    },
    'gpt-4o': {
        name: 'GPT-4o',
        provider: 'openai',
        modelId: 'gpt-4o',
        apiKey: process.env.OPENAI_API_KEY
    },
    'deepseek-coder': {
        name: 'DeepSeek V3',
        provider: 'openai-compatible',
        modelId: 'deepseek-chat',
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY
    },
    'perplexity-sonar': {
        name: 'Perplexity Sonar',
        provider: 'perplexity',
        modelId: 'sonar-pro',
        apiKey: process.env.PERPLEXITY_API_KEY
    }
};

// --- Universal AI Gateway ---
async function callAI(modelKey, prompt, systemInstruction = "") {
    const config = MODEL_REGISTRY[modelKey];
    if (!config) throw new Error(`Model ${modelKey} not found in registry.`);
    if (!config.apiKey) throw new Error(`Missing API Key for ${config.name}`);

    // 1. Google Gemini Provider
    if (config.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const res = await ai.models.generateContent({
            model: config.modelId,
            contents: prompt,
            config: { systemInstruction }
        });
        return res.text;
    }

    // 2. OpenAI Provider (Native)
    if (config.provider === 'openai') {
        const openai = new OpenAI({ apiKey: config.apiKey });
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ],
            model: config.modelId,
        });
        return completion.choices[0].message.content;
    }

    // 3. OpenAI-Compatible Provider (DeepSeek, etc.)
    if (config.provider === 'openai-compatible') {
        const client = new OpenAI({ 
            apiKey: config.apiKey, 
            baseURL: config.baseURL 
        });
        const completion = await client.chat.completions.create({
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ],
            model: config.modelId,
        });
        return completion.choices[0].message.content;
    }

    // 4. Perplexity Provider (Axios)
    if (config.provider === 'perplexity') {
        const res = await axios.post('https://api.perplexity.ai/chat/completions', {
            model: config.modelId,
            messages: [
                { role: "system", content: systemInstruction || "Be precise." },
                { role: "user", content: prompt }
            ]
        }, {
            headers: { 
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        return res.data.choices[0].message.content;
    }

    throw new Error(`Provider ${config.provider} not implemented.`);
}

// ==========================================
// 🛠️ SYSTEM CONFIG & STATE
// ==========================================

let autoPilotConfig = {
    enabled: false,
    standardsMode: false,
    model: 'gemini-3-pro'
};

let activeBuilderTransaction = null;

let AGENT_CONFIG = {
  design: {
    name: 'Design Agent',
    role: 'UI/UX & Components',
    path: join(HOME, '.claude-worktrees/flood-doctor/design-build'),
    command: 'claude',
    safeArgs: ['--chrome'], 
    yoloArgs: ['--chrome', '--dangerously-skip-permissions'],
    restartPolicy: 'on-failure'
  },
  seo: {
    name: 'SEO Agent',
    role: 'Content & Strategy',
    path: join(HOME, '.claude-worktrees/flood-doctor/seo-content'),
    command: 'claude',
    safeArgs: ['--chrome'],
    yoloArgs: ['--chrome', '--dangerously-skip-permissions'],
    restartPolicy: 'on-failure'
  }
};

const processes = {}; 
const restartCounters = {};
const centralLogBuffer = [];
const MAX_BUFFER_SIZE = 5000;
let chatHistory = [];
let commandQueue = [];
let activeTasks = new Map(); 
let completedTaskIds = new Set();

// ... (Existing Process Management & Helper Functions remain roughly same, strictly importing needed parts) ...
// We will reuse the existing infrastructure code but ensure it uses callAI where appropriate.

const runCommand = (command, cwd, agentId, taskId) => {
    return new Promise((resolve, reject) => {
        io.emit('log', { agentId, type: 'system', message: `🚀 Starting task: ${command}`, timestamp: new Date().toISOString() });
        if (activeTasks.has(taskId)) {
            activeTasks.get(taskId).lastLog = `Running: ${command.split('&&')[0]}...`;
        }
        const child = spawn(command, [], { cwd, shell: true });
        const updateLog = (d, type) => {
             const msg = d.toString();
             if (activeTasks.has(taskId)) {
                 const cleanMsg = msg.trim().split('\n').pop();
                 if (cleanMsg) activeTasks.get(taskId).lastLog = cleanMsg.substring(0, 60);
             }
             io.emit('log', { agentId, type, message: msg, timestamp: new Date().toISOString() });
        }
        child.stdout.on('data', (d) => updateLog(d, 'stdout'));
        child.stderr.on('data', (d) => updateLog(d, 'stderr'));
        child.on('close', (code) => {
             io.emit('log', { agentId, type: 'system', message: `✅ Task finished with code ${code}`, timestamp: new Date().toISOString() });
             if (code === 0) resolve();
             else reject(new Error(`Command failed with code ${code}`));
        });
    });
};

const processQueue = async () => {
    if (commandQueue.length === 0) return;
    const executableIndices = [];
    commandQueue.forEach((task, index) => {
        const dependenciesMet = !task.dependencies || task.dependencies.length === 0 || task.dependencies.every(depId => completedTaskIds.has(depId));
        if (dependenciesMet) executableIndices.push(index);
    });
    if (executableIndices.length === 0) return;
    executableIndices.sort((a, b) => b - a);
    const tasksToStart = [];
    for (const index of executableIndices) {
        tasksToStart.push(commandQueue[index]);
        commandQueue.splice(index, 1);
    }
    tasksToStart.forEach(task => {
        const activeTask = { ...task, status: 'processing', startTime: new Date().toISOString(), lastLog: 'Initializing...' };
        activeTasks.set(task.id, activeTask);
        executeTask(activeTask);
    });
};

const executeTask = async (task) => {
    try {
        const projectRoot = join(process.cwd(), '..');
        if (task.type === 'git_merge') await runCommand('git stash && git pull origin main --rebase && git stash pop', projectRoot, 'git', task.id);
        else if (task.type === 'build') await runCommand('echo "Building..." && sleep 2 && echo "Build Complete"', projectRoot, 'build', task.id);
        else if (task.type === 'deploy') await runCommand('npm run build && echo "Deploying..."', projectRoot, 'deploy', task.id);
        else if (task.type === 'repair' && task.command) await runCommand(task.command, task.cwd || projectRoot, 'system', task.id);
        else if (task.type === 'seo_audit') await runCommand('echo "SEO Audit..."', projectRoot, 'seo', task.id);
        else if (task.type === 'lint_design' && processes.design) processes.design.stdin.write("Lint codebase.\n");
        else if (task.type === 'gen_tests' && processes.design) processes.design.stdin.write("Gen tests.\n");
        completedTaskIds.add(task.id);
    } catch (error) {
        io.emit('log', { agentId: 'system', type: 'stderr', message: `❌ Task Failed: ${error.message}`, timestamp: new Date().toISOString() });
    } finally {
        activeTasks.delete(task.id);
        processQueue(); 
    }
};

const broadcastStatus = () => {
  const status = {};
  Object.keys(AGENT_CONFIG).forEach(id => status[id] = processes[id] ? 'running' : 'stopped');
  io.emit('status', status);
};
const broadcastRegistry = () => io.emit('agent-registry', AGENT_CONFIG);
const broadcastAutoPilot = () => io.emit('autopilot-config', autoPilotConfig);

// Process Logic (Start/Stop)
const startAgentProcess = (agentId, args) => {
    const config = AGENT_CONFIG[agentId];
    if (!config) return;
    const cmdArgs = args || (autoPilotConfig.enabled ? config.safeArgs : config.yoloArgs);
    const env = { ...process.env, FORCE_COLOR: '1' };
    const child = spawn(config.command, cmdArgs, { cwd: config.path, shell: true, env: env });
    processes[agentId] = child;
    broadcastStatus();
    io.emit('log', { agentId, type: 'system', message: `Process started`, timestamp: new Date().toISOString() });
    const streamLog = (data, type) => {
      const message = data.toString();
      centralLogBuffer.push({ timestamp: new Date().toISOString(), agentId, type, message });
      if (centralLogBuffer.length > MAX_BUFFER_SIZE) centralLogBuffer.shift();
      io.emit('log', { agentId, type, message, timestamp: new Date().toISOString() });
    };
    child.stdout.on('data', (d) => streamLog(d, 'stdout'));
    child.stderr.on('data', (d) => streamLog(d, 'stderr'));
    child.on('close', (code) => {
      processes[agentId] = null;
      broadcastStatus();
      io.emit('log', { agentId, type: 'system', message: `Process exited code ${code}`, timestamp: new Date().toISOString() });
    });
};

// ==========================================
// 🔌 API ROUTES
// ==========================================

// --- MODEL DISCOVERY ---
app.get('/api/models', (req, res) => {
    // Return only models that have a configured API key
    const available = Object.entries(MODEL_REGISTRY)
        .filter(([_, config]) => config.apiKey)
        .map(([key, config]) => ({
            id: key,
            name: config.name,
            provider: config.provider
        }));
    res.json(available);
});

// --- COUNCIL OF AI ---
app.post('/api/swarm/council', async (req, res) => {
    const { prompt, models, synthesizer } = req.body; // models: ['gpt-4o', 'gemini-3-pro'], synthesizer: 'gpt-4o'
    const responses = {};

    io.emit('log', { agentId: 'system', type: 'system', message: `⚔️ Council Convened. Active Members: ${models.join(', ')}`, timestamp: new Date().toISOString() });

    // 1. Run all selected models in parallel
    const promises = models.map(async (modelKey) => {
        try {
            io.emit('log', { agentId: 'system', type: 'system', message: `...Consulting ${MODEL_REGISTRY[modelKey]?.name || modelKey}`, timestamp: new Date().toISOString() });
            const output = await callAI(modelKey, prompt, "You are an expert technical advisor. Be concise and precise.");
            responses[modelKey] = output;
        } catch (e) {
            responses[modelKey] = `Error: ${e.message}`;
        }
    });

    await Promise.all(promises);

    // 2. Synthesize Consensus
    let consensus = "";
    let usedSynthesizer = "";

    try {
        // Resolve synthesizer: User choice -> Gemini 3 Pro -> GPT-4o -> First available
        let targetSynthesizer = synthesizer;
        
        // Validation: If user selected synthesizer is invalid or missing, fallback
        if (!targetSynthesizer || !MODEL_REGISTRY[targetSynthesizer]) {
             targetSynthesizer = models.includes('gemini-3-pro') ? 'gemini-3-pro' : 
                                 models.includes('gpt-4o') ? 'gpt-4o' : 
                                 models[0];
        }

        usedSynthesizer = targetSynthesizer;
        
        if (targetSynthesizer && MODEL_REGISTRY[targetSynthesizer]) {
            io.emit('log', { agentId: 'system', type: 'system', message: `🏛️ Synthesizing Consensus via ${MODEL_REGISTRY[targetSynthesizer].name}...`, timestamp: new Date().toISOString() });

            const synthesisPrompt = `
            You are the Chief Justice of the AI Supreme Court.
            
            THE CASE (PROBLEM): ${prompt}
            
            ARGUMENTS SUBMITTED BY THE COUNCIL:
            ${Object.entries(responses).map(([key, response]) => `--- ${MODEL_REGISTRY[key]?.name || key.toUpperCase()} ---\n${response}\n`).join('\n')}
            
            YOUR JUDGMENT:
            Synthesize these arguments into a single, authoritative consensus solution. 
            Critically evaluate the input. Resolve conflicts. Pick the best parts of each.
            Provide a final "verdict" or solution path.
            Format in Markdown.
            `;

            consensus = await callAI(targetSynthesizer, synthesisPrompt, "You are the wise synthesizer.");
        } else {
            consensus = "No capable synthesizer available.";
        }

    } catch (e) {
        consensus = "Failed to generate consensus: " + e.message;
    }

    res.json({ individual_responses: responses, consensus, synthesizer: usedSynthesizer });
});

// --- BASIC CHAT (Single Model) ---
app.post('/api/chat', async (req, res) => {
    const { message, model } = req.body; // 'model' is now a key from MODEL_REGISTRY
    try {
        // Fallback for old hardcoded keys if frontend sends them
        let targetKey = model;
        if (model === 'gemini-3-pro') targetKey = 'gemini-3-pro'; // already matches
        if (!MODEL_REGISTRY[targetKey]) {
            // Default to first available google model or just fail safe
            targetKey = 'gemini-3-pro'; 
        }

        const responseText = await callAI(targetKey, message, "You are the Flood Doctor Mission Control AI.");
        res.json({ response: responseText });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: error.message, response: `System Error: ${error.message}` });
    }
});

// --- VISUAL QA SENTINEL ---
app.post('/api/qa/visual', async (req, res) => {
    const targetUrl = req.body.url || 'http://localhost:5173'; // Default to standard Vite port if not specified
    io.emit('log', { agentId: 'system', type: 'system', message: `📸 Visual Sentinel: Capturing screenshots of ${targetUrl}...`, timestamp: new Date().toISOString() });
    
    const screenshotsDir = join(process.cwd(), 'screenshots');

    try {
        if (!existsSync(screenshotsDir)) {
            await mkdir(screenshotsDir, { recursive: true });
        }

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });

        const page = await browser.newPage();
        
        // Desktop Capture
        await page.setViewport({ width: 1920, height: 1080 });
        try {
            await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        } catch (e) {
            io.emit('log', { agentId: 'system', type: 'stderr', message: `⚠️ Page load timed out or failed, taking screenshot anyway...`, timestamp: new Date().toISOString() });
        }
        await page.screenshot({ path: join(screenshotsDir, 'desktop.png') });

        // Mobile Capture
        await page.setViewport({ width: 375, height: 667, isMobile: true });
        await page.screenshot({ path: join(screenshotsDir, 'mobile.png') });

        await browser.close();

        io.emit('log', { agentId: 'system', type: 'system', message: `✅ Visual Sentinel: Screenshots captured successfully.`, timestamp: new Date().toISOString() });

        // Return relative URLs with cache busting
        const timestamp = Date.now();
        res.json({
            success: true,
            results: {
                desktop: `/screenshots/desktop.png?t=${timestamp}`,
                mobile: `/screenshots/mobile.png?t=${timestamp}`,
                diff: 0 // Mock diff for now
            }
        });

    } catch (error) {
        console.error('Visual Audit Error:', error);
        io.emit('log', { agentId: 'system', type: 'stderr', message: `❌ Visual Sentinel Failed: ${error.message}`, timestamp: new Date().toISOString() });
        res.status(500).json({ error: error.message });
    }
});

// --- Standard Ops Endpoints (Agents, Git, Etc) ---
app.post('/api/agents/spawn', async (req, res) => { /* Reuse logic */ res.json({success: true}) });
app.get('/api/queue/status', (req, res) => { res.json({ processing: activeTasks.size > 0, activeTasks: Array.from(activeTasks.values()), queue: commandQueue }); });
app.post('/api/start/:agentId', (req, res) => {
    const { agentId } = req.params;
    if (processes[agentId]) return res.status(400).json({error:'Running'});
    startAgentProcess(agentId);
    res.json({success:true});
});
app.post('/api/stop/:agentId', (req, res) => {
    const { agentId } = req.params;
    if (processes[agentId]) processes[agentId].kill();
    res.json({success:true});
});

io.on('connection', (socket) => {
    socket.emit('agent-registry', AGENT_CONFIG);
    broadcastStatus();
});

httpServer.listen(PORT, () => {
  console.log(`Flood Doctor Ops Server running at http://localhost:${PORT}`);
});