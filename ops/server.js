
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Import modular services
import { GitService } from './services/gitService.js';
import { AutopilotService } from './services/autopilot.js';
import { AgentManager } from './services/agentManager.js';
import { MissionQueue } from './services/missionQueue.js';
import { AutopilotController } from './services/autopilotController.js';
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

// Ensure storage directories exist
const BASELINES_DIR = join(process.cwd(), 'baselines');
if (!existsSync(BASELINES_DIR)) mkdirSync(BASELINES_DIR, { recursive: true });

// ==========================================
// 🧠 DYNAMIC MODEL REGISTRY & AI CORE
// ==========================================

let MODEL_REGISTRY = {};
const autopilotCtrl = new AutopilotController(process.env.API_KEY);

async function loadModelRegistry() {
    try {
        const configPath = join(process.cwd(), 'ops/models.json');
        if (!existsSync(configPath)) return;
        const data = await readFile(configPath, 'utf8');
        const models = JSON.parse(data);
        
        MODEL_REGISTRY = models.reduce((acc, m) => {
            const apiKey = m.manualApiKey || process.env[m.apiKeyEnv] || process.env.API_KEY;
            if (apiKey) acc[m.id] = { ...m, apiKey };
            else acc[m.id] = { ...m };
            return acc;
        }, {});
    } catch (error) {
        console.error('❌ Failed to load model registry:', error);
    }
}

await loadModelRegistry();

/**
 * Feature 4: Central AI Gateway with Grounding and Thinking Support.
 */
async function callAI(modelKey, prompt, systemInstruction = "", latLng = null, thinkingBudget = 0) {
    const config = MODEL_REGISTRY[modelKey];
    const isGrounded = prompt.toLowerCase().includes('search') || prompt.toLowerCase().includes('news') || prompt.toLowerCase().includes('current');
    const isMaps = prompt.toLowerCase().includes('location') || prompt.toLowerCase().includes('nearby') || prompt.toLowerCase().includes('restaurant') || prompt.toLowerCase().includes('where is');
    
    if (!config || config.provider === 'google' || isGrounded || isMaps) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const tools = [];
        
        let modelToUse = isGrounded ? 'gemini-3-pro-preview' : (config?.apiModelId || 'gemini-3-flash-preview');
        
        if (isGrounded) tools.push({ googleSearch: {} });
        if (isMaps) {
            tools.push({ googleMaps: {} });
            modelToUse = 'gemini-2.5-flash'; 
        }

        const genConfig = { 
            systemInstruction,
            tools: tools.length > 0 ? tools : undefined
        };

        // Add thinking budget if requested for compatible models
        if (thinkingBudget > 0 && (modelToUse.includes('gemini-3') || modelToUse.includes('gemini-2.5'))) {
            genConfig.thinkingConfig = { thinkingBudget };
        }

        if (isMaps && latLng) {
            genConfig.toolConfig = {
                retrievalConfig: {
                    latLng: {
                        latitude: latLng.latitude,
                        longitude: latLng.longitude
                    }
                }
            };
        }

        const res = await ai.models.generateContent({
            model: modelToUse,
            contents: prompt,
            config: genConfig
        });

        return {
            text: res.text,
            groundingChunks: res.candidates?.[0]?.groundingMetadata?.groundingChunks || []
        };
    }

    if (config.provider === 'openai' || config.provider === 'openai-compatible') {
        const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }],
            model: config.apiModelId,
        });
        return { text: completion.choices[0].message.content };
    }
    throw new Error(`Provider ${config.provider} not implemented.`);
}

// ==========================================
// 🎨 CREATIVE TOOLS ENDPOINTS
// ==========================================

app.post('/api/creative/image', async (req, res) => {
    const { prompt, aspectRatio = "1:1" } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: { imageConfig: { aspectRatio } },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return res.json({ imageUrl: `data:image/png;base64,${part.inlineData.data}` });
            }
        }
        res.status(500).json({ error: "No image generated" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/creative/image/edit', async (req, res) => {
    const { prompt, base64Image, mimeType = 'image/png' } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType } },
                    { text: prompt }
                ]
            }
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return res.json({ imageUrl: `data:image/png;base64,${part.inlineData.data}` });
            }
        }
        res.status(500).json({ error: "No image generated during edit" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/creative/video/start', async (req, res) => {
    const { prompt, aspectRatio = "16:9", resolution = "720p", videoToExtend = null } = req.body;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const videoParams = {
            model: videoToExtend ? 'veo-3.1-generate-preview' : 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution,
                aspectRatio
            }
        };

        if (videoToExtend) {
            videoParams.video = videoToExtend;
        }

        let operation = await ai.models.generateVideos(videoParams);
        res.json({ operationId: operation.name });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/creative/video/status/:operationId', async (req, res) => {
    const { operationId } = req.params;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const operation = await ai.operations.getVideosOperation({ operation: { name: operationId } });
        
        if (operation.done) {
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            const videoObject = operation.response?.generatedVideos?.[0]?.video;
            return res.json({ done: true, downloadLink, videoObject });
        }
        res.json({ done: false });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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
    safeArgs: ['--chrome', '--css-framework tailwind'],
  },
  seo: {
    id: 'seo',
    name: 'SEO Agent',
    role: 'Content & Strategy',
    path: join(HOME, '.claude-worktrees/flood-doctor/seo-content'),
    command: 'claude',
    safeArgs: ['--chrome', '--search-grounding'],
  }
};

const gitService = new GitService(process.cwd());
const autopilot = new AutopilotService(io);
const agentManager = new AgentManager(io, AGENT_REGISTRY, gitService);
const missionQueue = new MissionQueue(io);

io.on('connection', (socket) => {
    socket.on('agent-log-internal', async ({ agentId, log }) => {
        if (autopilot.getState().enabled && (log.includes('error') || log.includes('fail'))) {
            const proposal = await autopilotCtrl.evaluateLog(agentId, log);
            if (proposal.failure) {
                io.emit('agent-deviation', { 
                    agentId, 
                    ...proposal, 
                    timestamp: Date.now() 
                });
            }
        }
    });
});

app.post('/api/heal/apply', async (req, res) => {
    const { agentId, command } = req.body;
    const config = AGENT_REGISTRY[agentId] || agentManager.subAgents[agentId];
    
    if (!config) return res.status(404).json({ error: 'Agent context not found.' });
    
    io.emit('log', { 
        agentId: 'system', 
        type: 'system', 
        message: `🛠️ Applying neural fix to ${agentId}: "${command}"`, 
        timestamp: new Date().toISOString() 
    });

    try {
        const { stdout, stderr } = await execAsync(command, { cwd: config.path || config.worktreePath });
        io.emit('log', { agentId: 'system', type: 'system', message: `✅ Fix applied successfully.`, timestamp: new Date().toISOString() });
        res.json({ success: true, stdout, stderr });
    } catch (e) {
        io.emit('log', { agentId: 'system', type: 'system', message: `❌ Fix application failed: ${e.message}`, timestamp: new Date().toISOString() });
        res.status(500).json({ error: e.message });
    }
});

const restoredRouter = createRestoredRouter({ 
    gitService, 
    autopilot, 
    agentManager, 
    missionQueue,
    aiCore: { 
        callAI, 
        getModelRegistry: () => Object.values(MODEL_REGISTRY),
        reloadModelRegistry: loadModelRegistry
    }
});

app.use('/api', restoredRouter);

io.on('connection', (socket) => {
    socket.emit('agent-registry', AGENT_REGISTRY);
    socket.emit('autopilot-state', autopilot.getState());
    socket.emit('queue-status', missionQueue.getStatus());
    agentManager.broadcastStatus();

    socket.on('approve-action', ({ agentId }) => {
        agentManager.resumeProcess(agentId);
    });
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
