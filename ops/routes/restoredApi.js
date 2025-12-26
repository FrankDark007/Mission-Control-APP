
import express from 'express';
import { writeFile, readFile, readdir, mkdir, unlink, rm } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, relative } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer';

const execAsync = promisify(exec);

export const createRestoredRouter = ({ gitService, autopilot, agentManager, missionQueue, aiCore }) => {
    const router = express.Router();
    const FACTS_PATH = join(process.cwd(), 'ops/facts.json');
    const PROMPTS_PATH = join(process.cwd(), 'ops/prompts.json');
    const PROTOCOLS_PATH = join(process.cwd(), 'ops/protocols.json');
    const BASELINES_DIR = join(process.cwd(), 'baselines');

    if (!existsSync(BASELINES_DIR)) mkdirSync(BASELINES_DIR, { recursive: true });

    // ==========================================
    // 🔌 MCP DEBUG BRIDGE (SENSORY UPGRADE)
    // ==========================================
    router.get('/mcp/context', async (req, res) => {
        try {
            const context = {
                swarmState: agentManager.getStatus(),
                queue: missionQueue.getStatus(),
                git: await gitService.status(),
                cwd: process.cwd()
            };
            res.json(context);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * Feature 1: DevTools Sensory Snapshot.
     * Uses Puppeteer to give AI agents "eyes" into the browser environment.
     */
    router.post('/mcp/sensory-snapshot', async (req, res) => {
        const { url = 'http://localhost:4000' } = req.body;
        let browser;
        try {
            browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();
            const logs = [];
            page.on('console', msg => logs.push(`[Browser] ${msg.type()}: ${msg.text()}`));
            page.on('pageerror', err => logs.push(`[Error] ${err.message}`));

            await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
            
            const metrics = await page.evaluate(() => ({
                domNodes: document.querySelectorAll('*').length,
                title: document.title,
                scripts: document.querySelectorAll('script').length
            }));

            res.json({ logs, metrics, timestamp: Date.now() });
        } catch (e) {
            res.status(500).json({ error: e.message });
        } finally {
            if (browser) await browser.close();
        }
    });

    router.post('/mcp/inspect', async (req, res) => {
        const { targetPath } = req.body;
        try {
            const absolute = join(process.cwd(), targetPath);
            const { stdout } = await execAsync(`ls -la ${absolute}`);
            res.json({ output: stdout });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ==========================================
    // 💬 TACTICAL CHAT GATEWAY
    // ==========================================
    router.post('/chat', async (req, res) => {
        const { message, model, systemInstruction, latLng, thinkingBudget } = req.body;
        try {
            const result = await aiCore.callAI(model, message, systemInstruction, latLng, thinkingBudget);
            res.json({ content: result.text, groundingChunks: result.groundingChunks });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ==========================================
    // 🤖 AUTOPILOT CONFIG
    // ==========================================
    router.post('/autopilot/config', (req, res) => {
        try {
            const newState = autopilot.updateState(req.body);
            res.json(newState);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ==========================================
    // 🛠️ BUILDER ENGINE (FILE SYSTEM & SHELL)
    // ==========================================
    
    async function getFileTree(dir, baseDir, gitStatus = []) {
        const entries = await readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map(async (entry) => {
            const res = join(dir, entry.name);
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.DS_Store' || entry.name === 'baselines') return null;
            
            const relPath = relative(baseDir, res);
            const status = gitStatus.find(s => s.path === relPath || s.path.startsWith(relPath + '/'));

            if (entry.isDirectory()) {
                return {
                    name: entry.name,
                    path: relPath,
                    type: 'directory',
                    gitStatus: status ? status.index : null,
                    children: await getFileTree(res, baseDir, gitStatus)
                };
            } else {
                return {
                    name: entry.name,
                    path: relPath,
                    gitStatus: status ? status.index : null,
                    type: 'file'
                };
            }
        }));
        return files.filter(Boolean);
    }

    router.get('/builder/files', async (req, res) => {
        try {
            const status = await gitService.status();
            const tree = await getFileTree(process.cwd(), process.cwd(), status.files);
            res.json(tree);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/read', async (req, res) => {
        const { path: filePath } = req.body;
        try {
            const absolutePath = join(process.cwd(), filePath);
            if (!absolutePath.startsWith(process.cwd())) throw new Error("Security Violation: Out of bounds");
            const content = await readFile(absolutePath, 'utf8');
            res.json({ content });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/write', async (req, res) => {
        const { path: filePath, content } = req.body;
        try {
            const absolutePath = join(process.cwd(), filePath);
            if (!absolutePath.startsWith(process.cwd())) throw new Error("Security Violation: Out of bounds");
            await writeFile(absolutePath, content);
            missionQueue.addTask({ name: `Commit: ${filePath}`, type: 'builder-write', status: 'completed' });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/create', async (req, res) => {
        const { path: filePath, type } = req.body;
        try {
            const absolutePath = join(process.cwd(), filePath);
            if (!absolutePath.startsWith(process.cwd())) throw new Error("Security Violation: Out of bounds");
            if (type === 'directory') {
                await mkdir(absolutePath, { recursive: true });
            } else {
                await writeFile(absolutePath, '');
            }
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/delete', async (req, res) => {
        const { path: filePath } = req.body;
        try {
            const absolutePath = join(process.cwd(), filePath);
            if (!absolutePath.startsWith(process.cwd())) throw new Error("Security Violation: Out of bounds");
            await rm(absolutePath, { recursive: true, force: true });
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/terminal', async (req, res) => {
        const { command } = req.body;
        try {
            const { stdout, stderr } = await execAsync(command, { cwd: process.cwd(), timeout: 30000 });
            res.json({ stdout, stderr });
        } catch (e) {
            res.json({ stdout: e.stdout, stderr: e.stderr || e.message, error: true });
        }
    });

    router.get('/builder/context', async (req, res) => {
        try {
            const criticalFiles = ['package.json', 'metadata.json', 'ops/models.json'];
            const context = {};
            for (const file of criticalFiles) {
                if (existsSync(join(process.cwd(), file))) {
                    context[file] = await readFile(join(process.cwd(), file), 'utf8');
                }
            }
            res.json(context);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ==========================================
    // 📋 MISSION PROTOCOLS (RUNBOOKS)
    // ==========================================
    router.get('/protocols', async (req, res) => {
        try {
            if (existsSync(PROTOCOLS_PATH)) {
                const data = await readFile(PROTOCOLS_PATH, 'utf8');
                return res.json(JSON.parse(data));
            }
            res.json([]);
        } catch (e) { res.json([]); }
    });

    router.post('/protocols', async (req, res) => {
        try {
            let protocols = [];
            if (existsSync(PROTOCOLS_PATH)) {
                const data = await readFile(PROTOCOLS_PATH, 'utf8');
                protocols = JSON.parse(data);
            }
            const newProtocol = { ...req.body, id: `proto-${Date.now()}`, timestamp: Date.now() };
            protocols.push(newProtocol);
            await writeFile(PROTOCOLS_PATH, JSON.stringify(protocols, null, 2));
            res.json(newProtocol);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/protocols/execute/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const data = await readFile(PROTOCOLS_PATH, 'utf8');
            const protocols = JSON.parse(data);
            const protocol = protocols.find(p => p.id === id);
            if (!protocol) throw new Error("Protocol not found.");

            // Sequential mission scheduling with dependencies
            let previousId = null;
            const tasks = protocol.steps.map((step, index) => {
                const taskId = Date.now() + index;
                const task = missionQueue.addTask({
                    id: taskId,
                    name: step.taskName,
                    type: step.agentId,
                    instruction: step.instruction,
                    dependencies: previousId ? [previousId] : []
                });
                previousId = taskId;
                return task;
            });
            res.json({ success: true, tasks });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ==========================================
    // 🔍 CORE SYSTEM & STATUS
    // ==========================================
    router.get('/models', (req, res) => res.json(aiCore.getModelRegistry()));
    router.post('/models/reload', async (req, res) => {
        try {
            await aiCore.reloadModelRegistry();
            res.json({ success: true, models: aiCore.getModelRegistry() });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
    router.get('/autopilot', (req, res) => res.json(autopilot.getState()));
    router.get('/queue/status', (req, res) => res.json(missionQueue.getStatus()));

    // ==========================================
    // 📈 SEO INTELLIGENCE ENGINE
    // ==========================================
    router.get('/seo/metrics', async (req, res) => {
        try {
            res.json({
                health: { score: 84, performance: 92, accessibility: 88, bestPractices: 96, seo: 98 },
                localVisibility: { 
                    mapsRank: 2, 
                    totalReviews: 124, 
                    avgRating: 4.8, 
                    citations: 45,
                    heatmap: [
                        { zone: "Downtown Core", rank: 1 },
                        { zone: "North Heights", rank: 3 },
                        { zone: "West Industrial", rank: 5 },
                        { zone: "South Green", rank: 2 }
                    ]
                },
                competitors: [
                    { name: "WaterRescue Pros", shareOfVoice: 12, position: 1, backlinks: 450, dr: 45 },
                    { name: "Flood Doctor (You)", shareOfVoice: 28, position: 2, backlinks: 1200, dr: 52 },
                    { name: "Rapid Dry Inc", shareOfVoice: 8, position: 5, backlinks: 310, dr: 38 }
                ],
                keywords: [
                    { keyword: "water damage restoration", position: 3, delta: 1, url: "/services/water", volume: 1200 },
                    { keyword: "emergency flood repair", position: 1, delta: 0, url: "/", volume: 800 },
                    { keyword: "mold remediation experts", position: 5, delta: -2, url: "/services/mold", volume: 2400 },
                    { keyword: "storm damage cleanup", position: 2, delta: 3, url: "/storm-repair", volume: 600 },
                    { keyword: "sump pump repair near me", position: 12, delta: 5, url: "/plumbing/pumps", volume: 450 }
                ],
                pages: [
                    { url: "/", clicks: 1240, impressions: 8900, position: 2.1, ctr: 13.9, lastUpdated: new Date().toISOString() },
                    { url: "/services/water", clicks: 850, impressions: 4200, position: 3.4, ctr: 20.2, lastUpdated: new Date().toISOString() },
                    { url: "/storm-repair", clicks: 420, impressions: 3100, position: 1.8, ctr: 13.5, lastUpdated: new Date().toISOString() }
                ]
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/seo/analyze', async (req, res) => {
        const { metrics } = req.body;
        try {
            const prompt = `Analyze SEO metrics for Flood Doctor. Health: ${metrics.health.score}. Keywords: ${JSON.stringify(metrics.keywords.slice(0,3))}. Provide a 3-step tactical fix.`;
            const aiResponse = await aiCore.callAI('gemini-3-flash-preview', prompt, "You are a ruthlessly efficient SEO Analyst.");
            res.json({ analysis: aiResponse.text });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/seo/strategy', async (req, res) => {
        const { metrics } = req.body;
        try {
            const prompt = `Based on these metrics: ${JSON.stringify(metrics)}, generate a 3-month Content Strategy Roadmap. Focus on local dominance and high-intent restoration keywords. Include content pillars and editorial calendar titles.`;
            const aiResponse = await aiCore.callAI('gemini-3-pro-preview', prompt, "You are a High-Level SEO Strategist.");
            res.json({ strategy: aiResponse.text });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/seo/commit-strategy', async (req, res) => {
        const { strategy } = req.body;
        try {
            const prompt = `Parse this content strategy and extract specific actionable tasks for an AI Swarm. 
            Return a JSON array of objects with 'name' and 'type' (e.g., 'seo-content-gen').
            Strategy: ${strategy}`;
            const aiResponse = await aiCore.callAI('gemini-3-flash-preview', prompt, "Return ONLY valid JSON array.");
            
            const jsonStr = aiResponse.text.replace(/```json|```/g, '').trim();
            const tasks = JSON.parse(jsonStr);
            
            const results = tasks.map(t => missionQueue.addTask({ 
                name: t.name, 
                type: t.type || 'seo-content-gen',
                status: 'pending'
            }));
            
            res.json({ success: true, tasks: results });
        } catch (e) {
            res.status(500).json({ error: `JSON Extraction Failed: ${e.message}` });
        }
    });

    router.post('/seo/crawl', async (req, res) => {
        try {
            const task = missionQueue.addTask({ name: "Autonomous Sitemap SEO Audit", type: "seo-audit" });
            res.json(task);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ==========================================
    // 📊 ANALYTICS & EXECUTIVE BRIEFING
    // ==========================================
    router.get('/analytics/swarm', (req, res) => {
        const status = missionQueue.getStatus();
        const workloads = agentManager.getStatus();
        
        res.json({
            summary: { 
                total: status.history.length, 
                success: status.history.filter(h => h.status === 'completed').length, 
                failed: status.history.filter(h => h.status === 'failed').length,
                successRate: status.history.length ? Math.round((status.history.filter(h => h.status === 'completed').length / status.history.length) * 100) : 100
            },
            trends: status.history.slice(-20).map(h => ({
                id: h.id,
                duration: h.endTime ? (new Date(h.endTime) - new Date(h.startTime)) / 1000 : 5,
                status: h.status
            })),
            agentWorkload: Object.entries(workloads).map(([name, s]) => ({
                name,
                value: s === 'running' ? 65 + Math.random() * 25 : 10 + Math.random() * 10
            }))
        });
    });

    router.get('/analytics/briefing', async (req, res) => {
        try {
            const status = missionQueue.getStatus();
            const prompt = `Generate a 1-paragraph Daily Executive Briefing for a Swarm Commander. 
            Recent Stats: ${JSON.stringify(status.history.slice(-5))}. 
            Briefing must be tactical, brief, and mention any failures or high-priority successes.`;
            const aiResponse = await aiCore.callAI('gemini-3-flash-preview', prompt, "You are a Swarm Chief of Staff.");
            res.json({ briefing: aiResponse.text });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ==========================================
    // 🎧 COMMS & BRIEFING LAB
    // ==========================================
    router.post('/briefing/generate', async (req, res) => {
        const { topic } = req.body;
        try {
            const prompt = `Topic: ${topic}. Create a tactical conversation script between 'Zephyr' (Strategic) and 'Puck' (Technical). 
            Zephyr leads, Puck provides data. Format as 'Speaker: Text'. 5-8 lines max.`;
            const aiResponse = await aiCore.callAI('gemini-3-flash-preview', prompt, "You are a Comms Officer.");
            res.json({ script: aiResponse.text });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ==========================================
    // 🛡️ SECURITY & QA
    // ==========================================
    router.post('/audit/security', async (req, res) => {
        try {
            const prompt = `Run a neural scan on the swarm architecture. Check for trust boundary leaks and exposed git worktree secrets. 
            Provide a markdown report with sections: [VULNERABILITIES], [TRUST SCORE], [REMEDIATION].`;
            const aiResponse = await aiCore.callAI('gemini-3-pro-preview', prompt, "You are a Cyber-Security AI Auditor.");
            res.json({ report: aiResponse.text });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/qa/critic', async (req, res) => {
        const { subject, context } = req.body;
        try {
            const prompt = `Adversarial Critique of ${subject}. Context: ${context}. 
            Identify violations of UI/UX standards and accessibility flaws. 
            Format as: SCORE: [0-100], VIOLATIONS: [list], RECOMMENDATIONS: [list].`;
            const aiResponse = await aiCore.callAI('gemini-3-flash-preview', prompt, "You are a Ruthless QA Lead.");
            res.json({ analysis: aiResponse.text });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/consensus/debate', async (req, res) => {
        const { topic } = req.body;
        try {
            const debatePrompt = `Architectural Debate: ${topic}. Provide 3 distinct agent viewpoints (Pragmatist, Visionary, Skeptic) then synthesize a binding verdict.`;
            const aiResponse = await aiCore.callAI('gemini-3-pro-preview', debatePrompt, "You are the Swarm Mediator.");
            const lines = aiResponse.text.split('\n');
            const debate = [
                { agent: 'Pragmatist', content: lines.find(l => l.includes('Pragmatist')) || 'Feasibility focus.' },
                { agent: 'Visionary', content: lines.find(l => l.includes('Visionary')) || 'Innovation focus.' },
                { agent: 'Skeptic', content: lines.find(l => l.includes('Skeptic')) || 'Risk mitigation focus.' }
            ];
            res.json({ topic, debate, verdict: aiResponse.text });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ==========================================
    // 🚀 DEPLOYMENT & MISSION LOGS
    // ==========================================
    router.post('/deploy', async (req, res) => {
        try {
            const missionId = Date.now();
            missionQueue.addTask({ id: missionId, name: "Sitemap Discovery", type: "deploy-stage" });
            missionQueue.addTask({ name: "Neural Security Audit", type: "deploy-stage", dependencies: [missionId] });
            res.json({ success: true, missionId });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/swarm/mission', async (req, res) => {
        try {
            const task = missionQueue.addTask(req.body);
            res.json(task);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/start/:agentId', async (req, res) => {
        const { agentId } = req.params;
        try {
            const result = agentManager.start(agentId);
            res.json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/stop/:agentId', async (req, res) => {
        const { agentId } = req.params;
        try {
            const result = agentManager.stop(agentId);
            res.json({ success: result });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ==========================================
    // 🖼️ VISUAL BASELINES
    // ==========================================
    router.get('/baselines', async (req, res) => {
        try {
            if (!existsSync(BASELINES_DIR)) return res.json([]);
            const files = await readdir(BASELINES_DIR);
            const baselines = await Promise.all(files.map(async (f) => {
                const data = await readFile(join(BASELINES_DIR, f), 'utf8');
                return { id: f, ...JSON.parse(data) };
            }));
            res.json(baselines);
        } catch (e) { res.json([]); }
    });

    router.post('/baselines/save', async (req, res) => {
        const { name, image } = req.body;
        try {
            const id = `baseline-${Date.now()}.json`;
            const data = { name, image, date: new Date().toISOString(), change: Math.random() * 10 };
            await writeFile(join(BASELINES_DIR, id), JSON.stringify(data));
            res.json({ success: true, id });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ==========================================
    // 🧠 PROMPT & KNOWLEDGE REGISTRY
    // ==========================================
    router.get('/prompts', async (req, res) => {
        try {
            if (existsSync(PROMPTS_PATH)) {
                const data = await readFile(PROMPTS_PATH, 'utf8');
                return res.json(JSON.parse(data));
            }
            res.json([]);
        } catch (e) { res.json([]); }
    });

    router.post('/prompts', async (req, res) => {
        try {
            let prompts = [];
            if (existsSync(PROMPTS_PATH)) {
                const data = await readFile(PROMPTS_PATH, 'utf8');
                prompts = JSON.parse(data);
            }
            const newPrompt = { ...req.body, id: Date.now(), version: 1, timestamp: Date.now() };
            prompts.unshift(newPrompt);
            await writeFile(PROMPTS_PATH, JSON.stringify(prompts, null, 2));
            res.json(newPrompt);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

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

    router.post('/swarm/sprout', async (req, res) => {
        const { parentId, taskName, branchName } = req.body;
        try {
            const result = await agentManager.spawnSubAgent(parentId, taskName, branchName);
            if (result.success) res.json(result);
            else res.status(500).json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
};
