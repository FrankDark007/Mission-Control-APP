
import express from 'express';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { GoogleGenAI } from "@google/genai";
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

/**
 * Creates and exports the restored API router.
 */
export const createRestoredRouter = ({ gitService, autopilot, agentManager, missionQueue, aiCore }) => {
    const router = express.Router();
    const FACTS_PATH = join(process.cwd(), 'ops/facts.json');
    const QA_PATH = join(process.cwd(), 'ops/qa_results.json');
    const MODELS_PATH = join(process.cwd(), 'ops/models.json');

    // --- Core Data Endpoints ---
    
    router.get('/models', (req, res) => {
        res.json(aiCore.getModelRegistry());
    });

    router.get('/autopilot', (req, res) => {
        res.json(autopilot.getState());
    });

    router.post('/autopilot', (req, res) => {
        try {
            const updated = autopilot.updateState(req.body);
            res.json(updated);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/models', async (req, res) => {
        try {
            const newModel = req.body;
            let currentModels = [];
            if (existsSync(MODELS_PATH)) {
                const data = await readFile(MODELS_PATH, 'utf8');
                currentModels = JSON.parse(data);
            }
            
            // Check if model already exists (update) or add new
            const index = currentModels.findIndex(m => m.id === newModel.id);
            if (index !== -1) {
                currentModels[index] = newModel;
            } else {
                currentModels.push(newModel);
            }

            await writeFile(MODELS_PATH, JSON.stringify(currentModels, null, 2));
            await aiCore.reloadModelRegistry();
            
            autopilot.io.emit('log', {
                agentId: 'system',
                type: 'system',
                message: `🤖 AI Registry Updated: ${newModel.name} configured.`,
                timestamp: new Date().toISOString()
            });
            
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/models/:id', async (req, res) => {
        try {
            const { id } = req.params;
            if (!existsSync(MODELS_PATH)) return res.json({ success: true });
            
            const data = await readFile(MODELS_PATH, 'utf8');
            let currentModels = JSON.parse(data);
            
            const filtered = currentModels.filter(m => m.id !== id);
            await writeFile(MODELS_PATH, JSON.stringify(filtered, null, 2));
            await aiCore.reloadModelRegistry();
            
            autopilot.io.emit('log', {
                agentId: 'system',
                type: 'system',
                message: `🗑️ AI Registry: Model ${id} removed.`,
                timestamp: new Date().toISOString()
            });
            
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/facts', async (req, res) => {
        try {
            if (existsSync(FACTS_PATH)) {
                const data = await readFile(FACTS_PATH, 'utf8');
                res.json(JSON.parse(data));
            } else {
                res.json([]);
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/facts', async (req, res) => {
        try {
            const facts = req.body;
            let currentFacts = [];
            if (existsSync(FACTS_PATH)) {
                const data = await readFile(FACTS_PATH, 'utf8');
                currentFacts = JSON.parse(data);
            }
            const updatedFacts = [...currentFacts, { ...facts, timestamp: new Date().toISOString() }];
            await writeFile(FACTS_PATH, JSON.stringify(updatedFacts, null, 2));
            
            autopilot.io.emit('log', {
                agentId: 'system',
                type: 'system',
                message: `📚 Grounding Context Updated: New facts ingested.`,
                timestamp: new Date().toISOString()
            });
            
            res.json({ success: true, count: updatedFacts.length });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // --- AI Operation Endpoints ---

    router.post('/chat', async (req, res) => {
        const { message, model } = req.body;
        try {
            const response = await aiCore.callAI(model || 'gemini-3-flash-preview', message);
            res.json({ response });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/swarm/council', async (req, res) => {
        const { prompt, models, synthesizer } = req.body;
        const responses = {};
        const startTime = new Date().toISOString();
        
        autopilot.io.emit('log', { agentId: 'system', type: 'system', message: '🏛️ Convening Council of Agents...', timestamp: startTime });
        
        const promises = models.map(async (modelKey) => {
            try {
                const output = await aiCore.callAI(modelKey, prompt, "Provide a specialized technical perspective.");
                responses[modelKey] = output;
            } catch (e) { responses[modelKey] = `Error: ${e.message}`; }
        });
        
        await Promise.all(promises);
        
        const synthesisPrompt = `The following agents have provided perspectives: ${JSON.stringify(responses)}. Provide a final verdict.`;
        try {
            const consensus = await aiCore.callAI(synthesizer || models[0], synthesisPrompt, "Chief Justice Synthesizer");
            autopilot.io.emit('log', { agentId: 'system', type: 'system', message: '⚖️ Council Consensus reached.', timestamp: new Date().toISOString() });
            res.json({ individual_responses: responses, consensus, synthesizer: synthesizer || models[0] });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    router.post('/ai/vision', async (req, res) => {
        const { prompt, imageData, mimeType } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: {
                    parts: [
                        { inlineData: { data: imageData, mimeType: mimeType || 'image/jpeg' } },
                        { text: prompt || "Analyze this image for mission anomalies." }
                    ]
                }
            });
            res.json({ text: response.text });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/ai/query', async (req, res) => {
        const { prompt, useSearch, useMaps, useThinking, location } = req.body;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        try {
            const config = {};
            let model = 'gemini-3-flash-preview';

            if (useThinking) {
                model = 'gemini-3-pro-preview';
                config.thinkingConfig = { thinkingBudget: 32768 };
            }
            if (useSearch) config.tools = [{ googleSearch: {} }];
            if (useMaps) {
                model = 'gemini-2.5-flash';
                config.tools = config.tools ? [...config.tools, { googleMaps: {} }] : [{ googleMaps: {} }];
                if (location) {
                    config.toolConfig = { retrievalConfig: { latLng: { latitude: location.latitude, longitude: location.longitude } } };
                }
            }

            const response = await ai.models.generateContent({ model, contents: prompt, config });
            const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            res.json({ text: response.text, grounding });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Automation & System Endpoints ---

    router.get('/audit/lighthouse', async (req, res) => {
        const { url } = req.query;
        const targetUrl = url || 'http://localhost:5173';
        try {
            const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
            const options = { logLevel: 'info', output: 'json', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], port: chrome.port };
            const runnerResult = await lighthouse(targetUrl, options);
            const report = runnerResult.lhr;
            await chrome.kill();
            res.json({ 
                url: report.requestedUrl, 
                scores: { 
                    performance: report.categories.performance.score * 100, 
                    accessibility: report.categories.accessibility.score * 100, 
                    bestPractices: report.categories['best-practices'].score * 100, 
                    seo: report.categories.seo.score * 100 
                } 
            });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    router.post('/tasks/:taskType', (req, res) => {
        const { taskType } = req.params;
        missionQueue.addTask({ name: taskType.replace('_', ' ').toUpperCase(), type: 'automation' });
        autopilot.io.emit('log', { agentId: 'system', type: 'system', message: `🤖 Queued task: ${taskType}`, timestamp: new Date().toISOString() });
        res.json({ success: true });
    });

    router.post('/system/restart', (req, res) => {
        autopilot.io.emit('log', { agentId: 'system', type: 'system', message: '♻️ SYSTEM RESTART INITIATED.', timestamp: new Date().toISOString() });
        res.json({ success: true });
        setTimeout(() => process.exit(0), 1000);
    });

    // --- Lifecycle & Git Endpoints ---

    router.post('/start/:agentId', (req, res) => {
        try {
            const result = agentManager.start(req.params.agentId, req.body.args);
            res.json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/stop/:agentId', (req, res) => {
        const stopped = agentManager.stop(req.params.agentId);
        res.json({ success: stopped });
    });

    router.post('/deploy', async (req, res) => {
        autopilot.io.emit('log', { agentId: 'system', type: 'system', message: '🚀 Starting Deployment Routine...', timestamp: new Date().toISOString() });
        try {
            await gitService.pull();
            const pushResult = await gitService.push();
            autopilot.io.emit('log', { agentId: 'system', type: 'system', message: '✅ Deployment Successful.', timestamp: new Date().toISOString() });
            res.json({ success: true, details: pushResult });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/heal/approve', (req, res) => {
        autopilot.io.emit('log', { agentId: 'system', type: 'system', message: '🛠️ Heal proposal APPROVED. Applying fix...', timestamp: new Date().toISOString() });
        res.json({ success: true });
    });

    router.post('/telemetry', (req, res) => {
        res.json({ success: true });
    });

    return router;
};
