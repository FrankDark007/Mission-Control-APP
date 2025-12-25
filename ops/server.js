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
const centralLogBuffer = [];
const MAX_BUFFER_SIZE = 5000;
let commandQueue = [];
let activeTasks = new Map(); 

const broadcastStatus = () => {
  const status = {};
  Object.keys(AGENT_CONFIG).forEach(id => status[id] = processes[id] ? 'running' : 'stopped');
  io.emit('status', status);
};
const broadcastRegistry = () => io.emit('agent-registry', AGENT_CONFIG);

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

// --- AGENT CONFIG MANAGEMENT ---
app.post('/api/agents/config', (req, res) => {
  const { id, config } = req.body;
  if (!id || !config) return res.status(400).json({ error: 'Missing agent id or config' });
  
  AGENT_CONFIG[id] = {
    ...config,
    safeArgs: Array.isArray(config.safeArgs) ? config.safeArgs : [],
    yoloArgs: Array.isArray(config.yoloArgs) ? config.yoloArgs : []
  };
  
  broadcastRegistry();
  broadcastStatus();
  res.json({ success: true, registry: AGENT_CONFIG });
});

app.delete('/api/agents/config/:id', (req, res) => {
  const { id } = req.params;
  if (AGENT_CONFIG[id]) {
    if (processes[id]) {
      processes[id].kill();
      processes[id] = null;
    }
    delete AGENT_CONFIG[id];
    broadcastRegistry();
    broadcastStatus();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Agent not found' });
  }
});

// --- MODEL DISCOVERY ---
app.get('/api/models', (req, res) => {
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
    const { prompt, models, synthesizer } = req.body;
    const responses = {};

    io.emit('log', { agentId: 'system', type: 'system', message: `⚔️ Council Convened. Active Members: ${models.join(', ')}`, timestamp: new Date().toISOString() });

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

    let consensus = "";
    let usedSynthesizer = "";

    try {
        let targetSynthesizer = synthesizer;
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
            Synthesize these arguments into a single, authoritative consensus solution. Critically evaluate the input. Provide a final verdict.
            Format in Markdown.`;

            consensus = await callAI(targetSynthesizer, synthesisPrompt, "You are the wise synthesizer.");
        } else {
            consensus = "No capable synthesizer available.";
        }
    } catch (e) {
        consensus = "Failed to generate consensus: " + e.message;
    }

    res.json({ individual_responses: responses, consensus, synthesizer: usedSynthesizer });
});

app.post('/api/chat', async (req, res) => {
    const { message, model } = req.body;
    try {
        let targetKey = model || 'gemini-3-pro';
        const responseText = await callAI(targetKey, message, "You are the Flood Doctor Mission Control AI.");
        res.json({ response: responseText });
    } catch (error) {
        res.status(500).json({ error: error.message, response: `System Error: ${error.message}` });
    }
});

app.post('/api/qa/visual', async (req, res) => {
    const targetUrl = req.body.url || 'http://localhost:5173';
    io.emit('log', { agentId: 'system', type: 'system', message: `📸 Visual Sentinel: Capturing screenshots of ${targetUrl}...`, timestamp: new Date().toISOString() });
    const screenshotsDir = join(process.cwd(), 'screenshots');

    try {
        if (!existsSync(screenshotsDir)) await mkdir(screenshotsDir, { recursive: true });
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        try { await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 }); } catch (e) {}
        await page.screenshot({ path: join(screenshotsDir, 'desktop.png') });
        await page.setViewport({ width: 375, height: 667, isMobile: true });
        await page.screenshot({ path: join(screenshotsDir, 'mobile.png') });
        await browser.close();
        io.emit('log', { agentId: 'system', type: 'system', message: `✅ Visual Sentinel: Screenshots captured.`, timestamp: new Date().toISOString() });
        const timestamp = Date.now();
        res.json({ success: true, results: { desktop: `/screenshots/desktop.png?t=${timestamp}`, mobile: `/screenshots/mobile.png?t=${timestamp}`, diff: 0 } });
    } catch (error) {
        io.emit('log', { agentId: 'system', type: 'stderr', message: `❌ Visual Sentinel Failed: ${error.message}`, timestamp: new Date().toISOString() });
        res.status(500).json({ error: error.message });
    }
});

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