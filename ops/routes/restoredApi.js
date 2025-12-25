
import express from 'express';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { GoogleGenAI } from "@google/genai";
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

export const createRestoredRouter = ({ gitService, autopilot, agentManager, missionQueue, aiCore }) => {
    const router = express.Router();
    const MODELS_PATH = join(process.cwd(), 'ops/models.json');
    const FACTS_PATH = join(process.cwd(), 'ops/facts.json');

    // --- Core Data Endpoints ---
    router.get('/models', (req, res) => res.json(aiCore.getModelRegistry()));
    router.get('/autopilot', (req, res) => res.json(autopilot.getState()));
    router.get('/queue/status', (req, res) => res.json(missionQueue.getStatus()));

    router.post('/autopilot', (req, res) => {
        try {
            const updated = autopilot.updateState(req.body);
            res.json(updated);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Git Pulse ---
    router.get('/git/log', async (req, res) => {
        try {
            const logs = await gitService.log(20);
            const status = await gitService.status();
            res.json({ logs, status });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Grounding / Facts CRUD ---
    router.get('/facts', async (req, res) => {
        try {
            if (existsSync(FACTS_PATH)) {
                const data = await readFile(FACTS_PATH, 'utf8');
                return res.json(JSON.parse(data));
            }
            res.json([]);
        } catch (e) { res.json([]); }
    });

    router.post('/facts', async (req, res) => {
        try {
            let facts = [];
            if (existsSync(FACTS_PATH)) {
                const data = await readFile(FACTS_PATH, 'utf8');
                facts = JSON.parse(data);
            }
            const newFact = { ...req.body, id: Date.now(), timestamp: new Date().toISOString() };
            facts.push(newFact);
            await writeFile(FACTS_PATH, JSON.stringify(facts, null, 2));
            res.json(newFact);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/facts/:id', async (req, res) => {
        try {
            if (existsSync(FACTS_PATH)) {
                const data = await readFile(FACTS_PATH, 'utf8');
                let facts = JSON.parse(data);
                facts = facts.filter(f => f.id != req.params.id);
                await writeFile(FACTS_PATH, JSON.stringify(facts, null, 2));
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- SEO Lab Mocks (Simulated Data) ---
    router.get('/seo/metrics', (req, res) => {
        res.json({
            keywords: [
                { keyword: 'flood restoration near me', position: 3, delta: 2, url: '/services/restoration' },
                { keyword: 'water damage repair', position: 1, delta: 0, url: '/' },
                { keyword: 'emergency plumbing', position: 8, delta: -3, url: '/emergency' }
            ],
            pages: [
                { url: '/', clicks: 1200, impressions: 45000, ctr: 2.6, position: 4.2 },
                { url: '/services', clicks: 450, impressions: 12000, ctr: 3.7, position: 6.1 }
            ]
        });
    });

    // --- Swarm Consensus ---
    router.post('/swarm/consensus', async (req, res) => {
        const { prompt, results } = req.body;
        const mediatorPrompt = `
            Analyze the following responses from multiple AI models regarding: "${prompt}"
            
            ${results.map(r => `Model [${r.model}]: ${r.text}`).join('\n\n')}
            
            Identify areas of agreement, resolve conflicts, and provide a single "Consensus Recommendation" for the user.
        `;
        try {
            const consensus = await aiCore.callAI('gemini-3-flash-preview', mediatorPrompt, "You are the Swarm Mediator.");
            res.json({ consensus });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Recursive Swarm Endpoint ---
    router.post('/swarm/spawn', async (req, res) => {
        const { parentId, taskName, branchName } = req.body;
        try {
            const result = await agentManager.spawnSubAgent(parentId, taskName, branchName || `mission-${Date.now()}`);
            missionQueue.addTask({ 
                name: `Sub: ${taskName}`, 
                type: 'swarm-thread', 
                parentId: parentId 
            });
            res.json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Intelligence / Swarm Council ---
    router.post('/swarm/council', async (req, res) => {
        const { prompt, models } = req.body;
        try {
            const results = await Promise.all(models.map(async (m) => {
                const response = await aiCore.callAI(m, prompt, "Provide a concise technical perspective.");
                return { model: m, text: response };
            }));
            res.json({ results });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- QA / Lighthouse ---
    router.get('/qa/audit', async (req, res) => {
        const { url } = req.query;
        try {
            const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
            const options = { logLevel: 'info', output: 'json', onlyCategories: ['performance', 'accessibility'], port: chrome.port };
            const runnerResult = await lighthouse(url || 'http://localhost:5173', options);
            const report = runnerResult.lhr;
            await chrome.kill();
            res.json({
                performance: report.categories.performance.score * 100,
                accessibility: report.categories.accessibility.score * 100,
                timestamp: new Date().toISOString()
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Feature 5 Restoration: Batch Audit simulation
    router.get('/qa/batch-audit', async (req, res) => {
        // Simulate crawling a project sitemap
        const sitemap = [
            { url: '/', name: 'Home' },
            { url: '/services', name: 'Services' },
            { url: '/contact', name: 'Contact' },
            { url: '/emergency', name: 'Emergency' }
        ];
        
        const results = sitemap.map(page => ({
            ...page,
            performance: Math.floor(Math.random() * 20) + 80,
            accessibility: Math.floor(Math.random() * 10) + 90,
            status: 'completed'
        }));
        
        res.json({ results, timestamp: new Date().toISOString() });
    });

    // --- AI Operation Endpoints ---
    router.post('/chat', async (req, res) => {
        const { message, model } = req.body;
        try {
            const response = await aiCore.callAI(model || 'gemini-3-flash-preview', message);
            res.json({ response });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Enhanced Deployment ---
    router.post('/deploy', async (req, res) => {
        autopilot.io.emit('log', { agentId: 'system', type: 'system', message: '🚀 Swarm Deployment: Consolidating parallel worktrees...', timestamp: new Date().toISOString() });
        try {
            await gitService.pull();
            const pushResult = await gitService.push();
            autopilot.io.emit('log', { agentId: 'system', type: 'system', message: '✅ Swarm Sync Complete.', timestamp: new Date().toISOString() });
            res.json({ success: true, details: pushResult });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Healing Approvals ---
    router.post('/heal/approve', async (req, res) => {
        const { agentId, fixCommand } = req.body;
        autopilot.io.emit('log', { 
            agentId: 'system', 
            type: 'system', 
            message: `🛠️ Healing Approved for ${agentId}. Executing fix: ${fixCommand}`, 
            timestamp: new Date().toISOString() 
        });
        res.json({ success: true });
    });

    // --- Lifecycle ---
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

    return router;
};
