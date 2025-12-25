
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import OpenAI from 'openai';

// Import modular services
import { GitService } from './services/gitService.js';
import { AutopilotService } from './services/autopilot.js';
import { AgentManager } from './services/agentManager.js';
import { MissionQueue } from './services/missionQueue.js';
import { createRestoredRouter } from './routes/restoredApi.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/screenshots', express.static(join(process.cwd(), 'screenshots')));

const PORT = process.env.PORT || 0;
const HOME = homedir();

// ==========================================
// 🧠 DYNAMIC MODEL REGISTRY & AI CORE
// ==========================================

let MODEL_REGISTRY = {};

async function loadModelRegistry() {
    try {
        const configPath = join(process.cwd(), 'ops/models.json');
        if (!existsSync(configPath)) return;
        const data = await readFile(configPath, 'utf8');
        const models = JSON.parse(data);
        
        MODEL_REGISTRY = models.reduce((acc, m) => {
            const apiKey = m.manualApiKey || process.env[m.apiKeyEnv] || process.env.API_KEY;
            if (apiKey) acc[m.id] = { ...m, apiKey };
            return acc;
        }, {});
    } catch (error) {
        console.error('❌ Failed to load model registry:', error);
    }
}

await loadModelRegistry();

/**
 * Central AI Gateway for all text-based tasks.
 */
async function callAI(modelKey, prompt, systemInstruction = "") {
    const config = MODEL_REGISTRY[modelKey];
    
    // Fallback to standard Gemini if model not in registry
    if (!config) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { systemInstruction }
        });
        return res.text;
    }

    if (config.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const res = await ai.models.generateContent({
            model: config.apiModelId || 'gemini-3-pro-preview',
            contents: prompt,
            config: { systemInstruction }
        });
        return res.text;
    }

    if (config.provider === 'openai' || config.provider === 'openai-compatible') {
        const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }],
            model: config.apiModelId,
        });
        return completion.choices[0].message.content;
    }
    throw new Error(`Provider ${config.provider} not implemented.`);
}

// ==========================================
// 🛠️ SERVICE INITIALIZATION
// ==========================================

const AGENT_REGISTRY = {
  design: {
    id: 'design',
    name: 'Design Agent',
    role: 'UI/UX & Components',
    path: join(HOME, '.claude-worktrees/flood-doctor/design-build'),
    command: 'claude',
    safeArgs: ['--chrome'],
  },
  seo: {
    id: 'seo',
    name: 'SEO Agent',
    role: 'Content & Strategy',
    path: join(HOME, '.claude-worktrees/flood-doctor/seo-content'),
    command: 'claude',
    safeArgs: ['--chrome'],
  }
};

const gitService = new GitService(process.cwd());
const autopilot = new AutopilotService(io);
const agentManager = new AgentManager(io, AGENT_REGISTRY);
const missionQueue = new MissionQueue(io);

// Mount Restored API with AI Core injected
const restoredRouter = createRestoredRouter({ 
    gitService, 
    autopilot, 
    agentManager, 
    missionQueue,
    aiCore: { callAI, getModelRegistry: () => Object.values(MODEL_REGISTRY) }
});

app.use('/api', restoredRouter);

// ==========================================
// 🔌 SOCKET.IO EVENTS
// ==========================================

io.on('connection', (socket) => {
    socket.emit('agent-registry', AGENT_REGISTRY);
    socket.emit('autopilot-state', autopilot.getState());
    socket.emit('queue-status', missionQueue.getStatus());
    agentManager.broadcastStatus();
});

const server = httpServer.listen(PORT, () => {
    const actualPort = server.address().port;
    const localUrl = `http://localhost:${actualPort}`;
    console.log(`\n************************************************`);
    console.log(`🚀 MISSION CONTROL ACTIVE`);
    console.log(`📡 URL: ${localUrl}`);
    console.log(`🛠️  API: ${localUrl}/api`);
    console.log(`************************************************\n`);
});
