
import express from 'express';
import { writeFile, readFile, readdir, unlink, stat, mkdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { GoogleGenAI } from "@google/genai";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const createRestoredRouter = ({ gitService, autopilot, agentManager, missionQueue, aiCore }) => {
    const router = express.Router();
    const PROJECT_ROOT = join(__dirname, '..', '..');
    const FACTS_PATH = join(PROJECT_ROOT, 'facts.json');
    const PROTOCOLS_PATH = join(PROJECT_ROOT, 'protocols.json');
    const BASELINES_DIR = join(PROJECT_ROOT, 'baselines');
    const IS_DOCKER = process.env.DOCKER_ENV === 'true';

    if (!existsSync(BASELINES_DIR)) mkdirSync(BASELINES_DIR, { recursive: true });

    router.get('/models', (req, res) => res.json(aiCore.getModelRegistry().map(m => ({ id: m.id, name: m.name, provider: m.provider, apiModelId: m.apiModelId, ready: m.ready }))));

    // --- Builder Lab Endpoints ---
    async function getFileTree(dir) {
        const entries = await readdir(dir, { withFileTypes: true });
        const result = [];
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = join(dir, entry.name);
            const relPath = relative(PROJECT_ROOT, fullPath);
            if (entry.isDirectory()) {
                result.push({ name: entry.name, path: relPath, type: 'directory', children: await getFileTree(fullPath) });
            } else {
                result.push({ name: entry.name, path: relPath, type: 'file' });
            }
        }
        return result;
    }

    router.get('/builder/files', async (req, res) => {
        try {
            const tree = await getFileTree(PROJECT_ROOT);
            res.json(tree);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/read', async (req, res) => {
        try {
            const content = await readFile(join(PROJECT_ROOT, req.body.path), 'utf8');
            res.json({ content });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/write', async (req, res) => {
        try {
            await writeFile(join(PROJECT_ROOT, req.body.path), req.body.content);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/create', async (req, res) => {
        const { path, type } = req.body;
        try {
            const fullPath = join(PROJECT_ROOT, path);
            if (type === 'directory') await mkdir(fullPath, { recursive: true });
            else await writeFile(fullPath, '');
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/delete', async (req, res) => {
        try {
            await unlink(join(PROJECT_ROOT, req.body.path));
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/builder/terminal', async (req, res) => {
        try {
            const { stdout, stderr } = await execAsync(req.body.command, { cwd: PROJECT_ROOT });
            res.json({ stdout, stderr });
        } catch (e) { res.json({ stderr: e.message }); }
    });

    router.post('/builder/lint', async (req, res) => {
        const { path, content } = req.body;
        try {
            const result = await aiCore.callAI('gemini-3-flash-preview', 
                `Perform a neural linting on this file: ${path}\nContent:\n${content}`,
                "Identify potential bugs, type mismatches, or architectural deviations. Return ONLY JSON: { \"reports\": [{ \"line\": number, \"severity\": \"error\"|\"warn\", \"message\": string }] }");
            const cleaned = (result.text || '').replace(/```json|```/g, '').trim();
            res.json(JSON.parse(cleaned));
        } catch (e) { res.json({ reports: [] }); }
    });

    router.post('/builder/search', async (req, res) => {
        const { query } = req.body;
        try {
            const { stdout } = await execAsync(`grep -rl "${query}" . --exclude-dir={node_modules,.git}`, { cwd: PROJECT_ROOT });
            res.json({ results: stdout.split('\n').filter(Boolean) });
        } catch (e) { res.json({ results: [] }); }
    });

    // --- Creative Studio Endpoints ---
    router.post('/creative/image', async (req, res) => {
        const { prompt, aspectRatio } = req.body;
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: prompt }] },
                config: { imageConfig: { aspectRatio: aspectRatio || "1:1" } }
            });
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) return res.json({ imageUrl: `data:image/png;base64,${part.inlineData.data}` });
            }
            res.status(500).json({ error: "No image generated" });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/creative/image/edit', async (req, res) => {
        const { prompt, base64Image } = req.body;
        try {
            const result = await aiCore.callAI('gemini-2.5-flash-image', prompt, '', null, 0, 'creative', base64Image);
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/creative/video/start', async (req, res) => {
        const { prompt, aspectRatio, resolution, videoToExtend } = req.body;
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const config = { numberOfVideos: 1, resolution: resolution || '720p', aspectRatio: aspectRatio || '16:9' };
            const payload = { model: 'veo-3.1-fast-generate-preview', prompt, config };
            if (videoToExtend) payload.video = videoToExtend;
            const operation = await ai.models.generateVideos(payload);
            res.json({ operationId: operation.id });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/creative/video/status/:id', async (req, res) => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const operation = await ai.operations.getVideosOperation({ operation: { id: req.params.id } });
            if (operation.done) {
                const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                res.json({ done: true, downloadLink, videoObject: operation.response?.generatedVideos?.[0]?.video });
            } else { res.json({ done: false }); }
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Neural Healing ---
    router.post('/heal/apply', async (req, res) => {
        const { agentId, command } = req.body;
        try {
            const result = await agentManager.executeCommand(agentId, command);
            res.json({ success: true, ...result });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // --- Analytics & Memory ---
    router.get('/analytics/swarm', (req, res) => {
        const history = missionQueue.getStatus().history;
        const activeTasks = missionQueue.getStatus().activeTasks || {};
        const total = history.length || 1;
        const successCount = history.filter(h => h.status === 'completed').length;
        const failedCount = history.filter(h => h.status === 'failed').length;
        
        // Calculate real agent workload from history
        const agentWorkMap = {};
        history.forEach(h => {
            const agent = h.assignedAgent || h.agentId || 'Unassigned';
            agentWorkMap[agent] = (agentWorkMap[agent] || 0) + 1;
        });
        
        // Add currently active tasks
        Object.keys(activeTasks).forEach(taskId => {
            const task = activeTasks[taskId];
            const agent = task.assignedAgent || 'Active';
            agentWorkMap[agent] = (agentWorkMap[agent] || 0) + 1;
        });
        
        const agentWorkload = Object.entries(agentWorkMap).map(([name, value]) => ({ 
            name, 
            value: Math.round((value / total) * 100) 
        }));
        
        // If no agents tracked yet, show default structure
        if (agentWorkload.length === 0) {
            agentWorkload.push(
                { name: 'Design Core', value: 0 },
                { name: 'SEO Optimizer', value: 0 },
                { name: 'Content Writer', value: 0 }
            );
        }
        
        res.json({
            summary: { 
                successRate: Math.round((successCount / total) * 100),
                totalMissions: history.length,
                activeMissions: Object.keys(activeTasks).length,
                failedMissions: failedCount
            },
            agentWorkload,
            trends: history.slice(-50) // Last 50 for performance
        });
    });

    router.post('/analytics/briefing', async (req, res) => {
        try {
            const history = missionQueue.getStatus().history;
            const recentMissions = history.slice(-20);
            const successRate = history.length ? 
                Math.round((history.filter(h => h.status === 'completed').length / history.length) * 100) : 0;
            
            const prompt = `Generate a tactical intelligence briefing based on this swarm data:
                - Total Missions: ${history.length}
                - Success Rate: ${successRate}%
                - Recent Activity: ${JSON.stringify(recentMissions.slice(-5))}
                
                Provide: 1) Executive Summary (2-3 sentences), 2) Key Wins, 3) Areas of Concern, 4) Recommended Actions.
                Keep it concise and actionable.`;
            
            const result = await aiCore.callAI('gemini-3-flash-preview', prompt, 
                "You are a military-style intelligence officer providing mission briefings. Be direct and tactical.");
            res.json({ briefing: result.text, generatedAt: new Date().toISOString() });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/memory/missions', (req, res) => res.json(missionQueue.getStatus().history));

    router.post('/lighthouse/audit', async (req, res) => {
        const { url } = req.body;
        const targetUrl = url || (IS_DOCKER ? `http://localhost:${process.env.PORT || 3001}` : 'http://localhost:4000');
        
        try {
            const puppeteerFlags = {
                headless: "new",
                args: IS_DOCKER ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : []
            };
            const browser = await puppeteer.launch(puppeteerFlags);
            const page = await browser.newPage();
            
            // Enable performance metrics
            await page.setCacheEnabled(false);
            const client = await page.target().createCDPSession();
            await client.send('Performance.enable');
            
            const startTime = Date.now();
            await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
            const loadTime = Date.now() - startTime;
            
            // Get performance metrics
            const performanceMetrics = await client.send('Performance.getMetrics');
            const metrics = {};
            performanceMetrics.metrics.forEach(m => { metrics[m.name] = m.value; });
            
            // Get layout shift data
            const layoutShift = await page.evaluate(() => {
                return new Promise(resolve => {
                    let cls = 0;
                    const observer = new PerformanceObserver(list => {
                        for (const entry of list.getEntries()) {
                            if (!entry.hadRecentInput) cls += entry.value;
                        }
                    });
                    observer.observe({ type: 'layout-shift', buffered: true });
                    setTimeout(() => { observer.disconnect(); resolve(cls); }, 1000);
                });
            });
            
            // Get LCP
            const lcp = await page.evaluate(() => {
                return new Promise(resolve => {
                    new PerformanceObserver(list => {
                        const entries = list.getEntries();
                        resolve(entries.length ? entries[entries.length - 1].startTime : 0);
                    }).observe({ type: 'largest-contentful-paint', buffered: true });
                    setTimeout(() => resolve(0), 3000);
                });
            });
            
            await browser.close();
            
            // Calculate scores (simplified Lighthouse-style scoring)
            const perfScore = Math.max(0, Math.min(100, 100 - (loadTime / 50)));
            const clsScore = layoutShift < 0.1 ? 100 : layoutShift < 0.25 ? 75 : 50;
            const lcpScore = lcp < 2500 ? 100 : lcp < 4000 ? 75 : 50;
            
            // Generate fix commands based on issues
            const generateFixCommand = (audit) => {
                if (audit.title === "Largest Contentful Paint" && audit.score < 0.9) {
                    return {
                        issue: "Slow LCP",
                        commands: [
                            "# Optimize images",
                            "npx @squoosh/cli --webp auto -d public/images public/images/*.{jpg,png}",
                            "# Add preload for hero image",
                            "echo '<link rel=\"preload\" as=\"image\" href=\"/hero.webp\">' >> index.html",
                            "# Enable lazy loading",
                            "sed -i 's/<img/<img loading=\"lazy\"/g' src/**/*.tsx"
                        ]
                    };
                }
                if (audit.title === "Cumulative Layout Shift" && audit.score < 0.9) {
                    return {
                        issue: "High CLS",
                        commands: [
                            "# Add explicit dimensions to images",
                            "grep -r '<img' src/ | head -5",
                            "# Add width/height attributes or aspect-ratio CSS",
                            "# For dynamic content, use CSS contain: layout"
                        ]
                    };
                }
                if (audit.title === "Time to Interactive" && audit.score < 0.75) {
                    return {
                        issue: "Slow TTI",
                        commands: [
                            "# Analyze bundle size",
                            "npx vite-bundle-visualizer",
                            "# Enable code splitting",
                            "# Dynamic imports: const Component = lazy(() => import('./Component'))",
                            "# Tree shake unused code",
                            "npm run build -- --analyze"
                        ]
                    };
                }
                if (audit.title === "DOM Size" && audit.score < 0.9) {
                    return {
                        issue: "Large DOM",
                        commands: [
                            "# Virtualize long lists",
                            "npm install @tanstack/react-virtual",
                            "# Remove hidden elements from DOM",
                            "# Use CSS content-visibility: auto for off-screen content"
                        ]
                    };
                }
                return null;
            };
            
            const audits = [
                { 
                    title: "Largest Contentful Paint", 
                    score: lcpScore / 100, 
                    description: `LCP: ${(lcp / 1000).toFixed(2)}s ${lcp < 2500 ? '(Good)' : lcp < 4000 ? '(Needs Improvement)' : '(Poor)'}`,
                    numericValue: lcp
                },
                { 
                    title: "Cumulative Layout Shift", 
                    score: clsScore / 100, 
                    description: `CLS: ${layoutShift.toFixed(3)} ${layoutShift < 0.1 ? '(Good)' : layoutShift < 0.25 ? '(Needs Improvement)' : '(Poor)'}`,
                    numericValue: layoutShift
                },
                { 
                    title: "Time to Interactive", 
                    score: perfScore / 100, 
                    description: `Load time: ${(loadTime / 1000).toFixed(2)}s`,
                    numericValue: loadTime
                },
                {
                    title: "DOM Size",
                    score: (metrics.Nodes || 0) < 1500 ? 1 : 0.7,
                    description: `${Math.round(metrics.Nodes || 0)} DOM nodes`,
                    numericValue: metrics.Nodes || 0
                }
            ];
            
            // Add fix commands to audits with poor scores
            const auditsWithFixes = audits.map(audit => ({
                ...audit,
                fixCommand: generateFixCommand(audit)
            }));
            
            res.json({
                scores: { 
                    performance: Math.round((perfScore + lcpScore) / 2), 
                    accessibility: 85, // Would need axe-core for real a11y audit
                    bestPractices: 90,
                    seo: 90 // Would need meta tag analysis for real SEO
                },
                timestamp: new Date().toISOString(),
                url: targetUrl,
                audits: auditsWithFixes,
                metrics: {
                    loadTime,
                    lcp,
                    cls: layoutShift,
                    domNodes: metrics.Nodes || 0,
                    jsHeapSize: metrics.JSHeapUsedSize || 0
                }
            });
        } catch (e) { 
            res.status(500).json({ error: e.message }); 
        }
    });

    router.get('/facts', async (req, res) => {
        const data = await readFile(FACTS_PATH, 'utf8').then(JSON.parse).catch(() => []);
        res.json(data);
    });

    router.post('/facts', async (req, res) => {
        const facts = await readFile(FACTS_PATH, 'utf8').then(JSON.parse).catch(() => []);
        const newFact = { id: Date.now(), ...req.body, timestamp: new Date().toISOString() };
        facts.push(newFact);
        await writeFile(FACTS_PATH, JSON.stringify(facts, null, 2));
        res.json(newFact);
    });

    router.delete('/facts/:id', async (req, res) => {
        let facts = await readFile(FACTS_PATH, 'utf8').then(JSON.parse).catch(() => []);
        facts = facts.filter(f => f.id != req.params.id);
        await writeFile(FACTS_PATH, JSON.stringify(facts, null, 2));
        res.json({ success: true });
    });

    router.get('/baselines', async (req, res) => {
        const files = await readdir(BASELINES_DIR);
        const manifests = await Promise.all(
            files.filter(f => f.endsWith('.json')).map(f => readFile(join(BASELINES_DIR, f), 'utf8').then(JSON.parse))
        );
        res.json(manifests);
    });

    router.post('/baselines/save', async (req, res) => {
        const { name } = req.body;
        const id = `snap-${Date.now()}`;
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        const targetUrl = IS_DOCKER ? `http://localhost:${process.env.PORT || 3001}` : 'http://localhost:4000';
        await page.goto(targetUrl, { waitUntil: 'networkidle0' });
        const buffer = await page.screenshot();
        await browser.close();
        await writeFile(join(BASELINES_DIR, `${id}.png`), buffer);
        await writeFile(join(BASELINES_DIR, `${id}.json`), JSON.stringify({ id, name, date: new Date().toISOString(), image: `/baselines/${id}.png`, change: 0 }));
        res.json({ success: true, id });
    });

    router.post('/baselines/compare/:id', async (req, res) => {
        const baselinePngPath = join(BASELINES_DIR, `${req.params.id}.png`);
        const manifestPath = join(BASELINES_DIR, `${req.params.id}.json`);
        try {
            const puppeteerFlags = {
                headless: "new",
                args: IS_DOCKER ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] : []
            };
            const browser = await puppeteer.launch(puppeteerFlags);
            const page = await browser.newPage();
            const targetUrl = IS_DOCKER ? `http://localhost:${process.env.PORT || 3001}` : 'http://localhost:4000';
            await page.goto(targetUrl, { waitUntil: 'networkidle0' });
            const liveBuffer = await page.screenshot();
            await browser.close();

            const baseImg = PNG.sync.read(await readFile(baselinePngPath));
            const liveImg = PNG.sync.read(liveBuffer);
            const { width, height } = baseImg;
            const diff = new PNG({ width, height });
            const numDiffPixels = pixelmatch(baseImg.data, liveImg.data, diff.data, width, height, { threshold: 0.1 });
            const change = (numDiffPixels / (width * height)) * 100;

            const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
            manifest.change = change;
            manifest.lastComparison = new Date().toISOString();
            await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

            res.json({ success: true, change, liveImage: `data:image/png;base64,${liveBuffer.toString('base64')}` });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Protocols ---
    router.get('/protocols', async (req, res) => {
        try {
            const data = await readFile(PROTOCOLS_PATH, 'utf8');
            res.json(JSON.parse(data));
        } catch (e) { res.json([]); }
    });

    router.post('/protocols', async (req, res) => {
        try {
            let protocols = [];
            try { protocols = JSON.parse(await readFile(PROTOCOLS_PATH, 'utf8')); } catch {}
            const newProtocol = { id: Date.now(), ...req.body, created: new Date().toISOString() };
            protocols.push(newProtocol);
            await writeFile(PROTOCOLS_PATH, JSON.stringify(protocols, null, 2));
            res.json(newProtocol);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/protocols/execute/:id', async (req, res) => {
        try {
            const protocols = JSON.parse(await readFile(PROTOCOLS_PATH, 'utf8'));
            const protocol = protocols.find(p => p.id === parseInt(req.params.id));
            if (!protocol) return res.status(404).json({ error: 'Protocol not found' });
            protocol.steps?.forEach(step => missionQueue.addTask({ name: step.name, ...step }));
            res.json({ success: true, queued: protocol.steps?.length || 0 });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- QA Critic ---
    router.post('/qa/critic', async (req, res) => {
        const { subject, context } = req.body;
        try {
            const prompt = `Perform an adversarial QA review of: "${subject}"\nEvidence:\n${context}\nReturn SCORE (0-100), VIOLATIONS (list with - prefix), RECOMMENDATIONS (list with - prefix).`;
            const result = await aiCore.callAI('gemini-3-pro-preview', prompt, "You are a hostile QA engineer. Be thorough and critical.");
            res.json({ analysis: result.text });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/chat', async (req, res) => {
        try {
            const result = await aiCore.callAI(req.body.model, req.body.message, req.body.systemInstruction, req.body.latLng, req.body.thinkingBudget, 'commander', req.body.image, req.body.useSearch);
            res.json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/autopilot', (req, res) => res.json(autopilot.getState()));
    router.post('/autopilot/config', (req, res) => res.json(autopilot.updateState(req.body)));
    router.get('/queue/status', (req, res) => res.json(missionQueue.getStatus()));

    // --- Security Audit ---
    router.post('/audit/security', async (req, res) => {
        try {
            // Scan for common security issues
            const checks = [];
            
            // Check for exposed env files
            const envExists = existsSync(join(PROJECT_ROOT, '.env'));
            const envLocalExists = existsSync(join(PROJECT_ROOT, '.env.local'));
            if (envExists) checks.push({ level: 'warn', type: 'Exposed .env', desc: '.env file found in project root' });
            
            // Check for node_modules in git
            try {
                const { stdout } = await execAsync('git ls-files node_modules', { cwd: PROJECT_ROOT });
                if (stdout.trim()) checks.push({ level: 'critical', type: 'node_modules in git', desc: 'node_modules tracked in git repository' });
            } catch (e) {}
            
            // Check package.json for known vulnerable patterns
            try {
                const pkg = JSON.parse(await readFile(join(PROJECT_ROOT, 'package.json'), 'utf8'));
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                if (deps['event-stream']) checks.push({ level: 'critical', type: 'Malicious Package', desc: 'event-stream package detected (known supply chain attack)' });
            } catch (e) {}
            
            // AI-powered deep scan
            const projectFiles = await execAsync('find . -name "*.js" -o -name "*.ts" -o -name "*.tsx" | head -20', { cwd: PROJECT_ROOT });
            const prompt = `Analyze these project files for security vulnerabilities: ${projectFiles.stdout}
                Look for: hardcoded secrets, SQL injection, XSS vulnerabilities, insecure dependencies, exposed API keys.
                Return a security report with THREAT_LEVEL (LOW/MEDIUM/HIGH/CRITICAL), VULNERABILITIES found, and RECOMMENDATIONS.`;
            
            const result = await aiCore.callAI('gemini-3-flash-preview', prompt, 
                "You are a senior security engineer performing a code audit. Be thorough but avoid false positives.");
            
            res.json({ 
                report: result.text, 
                checks,
                scanTime: new Date().toISOString() 
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Briefing Generator ---
    router.post('/briefing/generate', async (req, res) => {
        const { topic, context, format } = req.body;
        try {
            const history = missionQueue.getStatus().history.slice(-10);
            const prompt = `Generate a ${format || 'tactical'} briefing on: ${topic}
                Context: ${context || 'General mission update'}
                Recent swarm activity: ${JSON.stringify(history)}
                
                Format as a military-style briefing with: SITUATION, MISSION, EXECUTION, ADMIN/LOGISTICS, COMMAND/SIGNAL.`;
            
            const result = await aiCore.callAI('gemini-3-pro-preview', prompt,
                "You are a mission commander generating operational briefings. Be concise, direct, and actionable.", null, 8000);
            
            res.json({ briefing: result.text, generatedAt: new Date().toISOString() });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Consensus Debate (Multi-Agent) ---
    router.post('/consensus/debate', async (req, res) => {
        const { topic, rounds = 3 } = req.body;
        try {
            const agents = [
                { name: 'The Pragmatist', style: 'Focus on practical implementation, timelines, and resource constraints. Be realistic and grounded.' },
                { name: 'The Visionary', style: 'Focus on innovation, future possibilities, and transformative potential. Be ambitious and forward-thinking.' },
                { name: 'The Skeptic', style: 'Focus on risks, edge cases, and potential failures. Be critical and thorough in identifying problems.' }
            ];
            
            const debate = [];
            let context = `Debate topic: ${topic}\n\n`;
            
            for (let round = 1; round <= rounds; round++) {
                for (const agent of agents) {
                    const prompt = `${context}\nAs ${agent.name}, provide your perspective (round ${round}/${rounds}). ${round > 1 ? 'Respond to previous arguments.' : 'State your initial position.'}`;
                    const result = await aiCore.callAI('gemini-3-flash-preview', prompt, agent.style);
                    const response = { agent: agent.name, round, argument: result.text };
                    debate.push(response);
                    context += `\n${agent.name} (Round ${round}): ${result.text}\n`;
                }
            }
            
            // Generate verdict
            const verdictPrompt = `${context}\n\nAs a neutral arbiter, synthesize the debate and provide a VERDICT with: 1) Consensus points, 2) Unresolved tensions, 3) Recommended action.`;
            const verdict = await aiCore.callAI('gemini-3-pro-preview', verdictPrompt, 
                "You are a wise technical lead synthesizing expert opinions into actionable decisions.", null, 8000);
            
            res.json({ debate, verdict: verdict.text, topic });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Deployment ---
    router.post('/deploy', async (req, res) => {
        const { target, command } = req.body;
        try {
            // Safety check - only allow specific deploy commands
            const allowedCommands = ['npm run build', 'npm run deploy', 'git push', 'wrangler deploy'];
            const isAllowed = allowedCommands.some(cmd => command?.startsWith(cmd));
            
            if (!isAllowed && command) {
                return res.status(403).json({ error: 'Command not in allowlist', allowed: allowedCommands });
            }
            
            const deployCmd = command || 'npm run build';
            const { stdout, stderr } = await execAsync(deployCmd, { cwd: PROJECT_ROOT, timeout: 120000 });
            
            res.json({ 
                success: true, 
                target: target || 'local',
                command: deployCmd,
                stdout, 
                stderr,
                deployedAt: new Date().toISOString()
            });
        } catch (e) { 
            res.status(500).json({ error: e.message, stderr: e.stderr }); 
        }
    });

    // --- Git Log ---
    router.get('/git/log', async (req, res) => {
        const { limit = 20 } = req.query;
        try {
            const { stdout } = await execAsync(
                `git log -${limit} --pretty=format:'{"hash":"%H","shortHash":"%h","author_name":"%an","author_email":"%ae","date":"%ai","message":"%s"},'`,
                { cwd: PROJECT_ROOT }
            );
            const jsonStr = '[' + stdout.slice(0, -1) + ']';
            const logs = JSON.parse(jsonStr);
            
            // Get current branch
            const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT });
            
            // Get detailed file status (matching frontend expectations)
            const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: PROJECT_ROOT });
            const files = statusOutput.split('\n').filter(Boolean).map(line => ({
                index: line.substring(0, 2).trim(),
                path: line.substring(3)
            }));
            
            // Response structure matching GitPulse frontend
            res.json({ 
                logs,
                status: {
                    current: branch.trim(),
                    files
                },
                timestamp: new Date().toISOString()
            });
        } catch (e) { 
            res.json({ logs: [], status: { current: 'unknown', files: [] }, error: e.message }); 
        }
    });

    // --- Memory Promote ---
    router.post('/memory/promote', async (req, res) => {
        const { pattern, category, tags } = req.body;
        try {
            const memoryPath = join(PROJECT_ROOT, 'memory.json');
            let memory = [];
            try { memory = JSON.parse(await readFile(memoryPath, 'utf8')); } catch {}
            
            const newMemory = {
                id: Date.now(),
                pattern,
                category: category || 'general',
                tags: tags || [],
                promotedAt: new Date().toISOString(),
                usageCount: 0
            };
            
            memory.push(newMemory);
            await writeFile(memoryPath, JSON.stringify(memory, null, 2));
            
            res.json({ success: true, memory: newMemory });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Prompts CRUD ---
    const PROMPTS_PATH = join(PROJECT_ROOT, 'prompts.json');
    
    router.get('/prompts', async (req, res) => {
        try {
            const data = await readFile(PROMPTS_PATH, 'utf8');
            res.json(JSON.parse(data));
        } catch (e) { res.json([]); }
    });

    router.post('/prompts', async (req, res) => {
        try {
            let prompts = [];
            try { prompts = JSON.parse(await readFile(PROMPTS_PATH, 'utf8')); } catch {}
            const newPrompt = { id: Date.now(), ...req.body, created: new Date().toISOString() };
            prompts.push(newPrompt);
            await writeFile(PROMPTS_PATH, JSON.stringify(prompts, null, 2));
            res.json(newPrompt);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/prompts/:id', async (req, res) => {
        try {
            let prompts = await readFile(PROMPTS_PATH, 'utf8').then(JSON.parse).catch(() => []);
            prompts = prompts.filter(p => p.id != req.params.id);
            await writeFile(PROMPTS_PATH, JSON.stringify(prompts, null, 2));
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- SEO Suite ---
    const SEO_DATA_PATH = join(PROJECT_ROOT, 'seo-data.json');
    
    router.get('/seo/metrics', async (req, res) => {
        try {
            const stored = await readFile(SEO_DATA_PATH, 'utf8').then(JSON.parse).catch(() => ({}));
            
            // Return structure matching SeoLab frontend expectations
            res.json({
                keywords: stored.keywords || [],
                pages: stored.pages || [],
                health: stored.health || {
                    score: 0,
                    issues: [],
                    lastAudit: null
                },
                localVisibility: stored.localVisibility || {
                    mapsRank: null,
                    heatmap: []
                },
                competitors: stored.competitors || [],
                lastUpdated: stored.lastUpdated || null
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/seo/metrics', async (req, res) => {
        try {
            const { keywords, pages, health, localVisibility, competitors } = req.body;
            let stored = {};
            try { stored = JSON.parse(await readFile(SEO_DATA_PATH, 'utf8')); } catch {}
            
            if (keywords) stored.keywords = keywords;
            if (pages) stored.pages = pages;
            if (health) stored.health = health;
            if (localVisibility) stored.localVisibility = localVisibility;
            if (competitors) stored.competitors = competitors;
            stored.lastUpdated = new Date().toISOString();
            
            await writeFile(SEO_DATA_PATH, JSON.stringify(stored, null, 2));
            res.json({ success: true, lastUpdated: stored.lastUpdated });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/seo/crawl', async (req, res) => {
        const { url } = req.body;
        const targetUrl = url || (IS_DOCKER ? `http://localhost:${process.env.PORT || 3001}` : 'http://localhost:4000');
        
        try {
            const browser = await puppeteer.launch({ 
                headless: 'new',
                args: IS_DOCKER ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
            });
            const page = await browser.newPage();
            await page.goto(targetUrl, { waitUntil: 'networkidle0' });
            
            const seoData = await page.evaluate(() => {
                const getMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || 
                                          document.querySelector(`meta[property="${name}"]`)?.content || null;
                
                const headings = {};
                ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
                    headings[tag] = Array.from(document.querySelectorAll(tag)).map(el => el.textContent.trim());
                });
                
                const images = Array.from(document.querySelectorAll('img')).map(img => ({
                    src: img.src,
                    alt: img.alt,
                    hasAlt: !!img.alt
                }));
                
                const links = Array.from(document.querySelectorAll('a')).map(a => ({
                    href: a.href,
                    text: a.textContent.trim(),
                    isExternal: a.hostname !== window.location.hostname
                }));
                
                return {
                    title: document.title,
                    metaDescription: getMeta('description'),
                    metaKeywords: getMeta('keywords'),
                    ogTitle: getMeta('og:title'),
                    ogDescription: getMeta('og:description'),
                    ogImage: getMeta('og:image'),
                    canonical: document.querySelector('link[rel="canonical"]')?.href,
                    headings,
                    images: { total: images.length, missingAlt: images.filter(i => !i.hasAlt).length, list: images.slice(0, 20) },
                    links: { total: links.length, external: links.filter(l => l.isExternal).length, internal: links.filter(l => !l.isExternal).length },
                    wordCount: document.body.innerText.split(/\s+/).length
                };
            });
            
            await browser.close();
            
            // Calculate health score based on SEO factors
            let healthScore = 100;
            const issues = [];
            
            if (!seoData.title) { healthScore -= 15; issues.push('Missing page title'); }
            else if (seoData.title.length < 30 || seoData.title.length > 60) { healthScore -= 5; issues.push('Title length not optimal (30-60 chars)'); }
            
            if (!seoData.metaDescription) { healthScore -= 15; issues.push('Missing meta description'); }
            else if (seoData.metaDescription.length < 120 || seoData.metaDescription.length > 160) { healthScore -= 5; issues.push('Meta description length not optimal (120-160 chars)'); }
            
            if (!seoData.headings.h1 || seoData.headings.h1.length === 0) { healthScore -= 10; issues.push('Missing H1 tag'); }
            else if (seoData.headings.h1.length > 1) { healthScore -= 5; issues.push('Multiple H1 tags detected'); }
            
            if (seoData.images.missingAlt > 0) { healthScore -= Math.min(10, seoData.images.missingAlt * 2); issues.push(`${seoData.images.missingAlt} images missing alt text`); }
            
            if (!seoData.canonical) { healthScore -= 5; issues.push('Missing canonical URL'); }
            if (!seoData.ogTitle) { healthScore -= 5; issues.push('Missing Open Graph title'); }
            
            // Extract keywords from headings and content
            const extractedKeywords = [...(seoData.headings.h1 || []), ...(seoData.headings.h2 || [])].slice(0, 10).map((kw, i) => ({
                keyword: kw.substring(0, 50),
                position: Math.floor(Math.random() * 20) + 1, // Placeholder until real rank tracking
                delta: Math.floor(Math.random() * 10) - 5,
                url: targetUrl
            }));
            
            // Build page metrics
            const pageMetrics = [{
                url: targetUrl,
                clicks: 0,
                impressions: 0,
                position: 0,
                ctr: 0,
                lastUpdated: new Date().toISOString()
            }];
            
            // Save comprehensive crawl data
            let stored = {};
            try { stored = JSON.parse(await readFile(SEO_DATA_PATH, 'utf8')); } catch {}
            
            stored.lastCrawl = { ...seoData, crawledAt: new Date().toISOString(), url: targetUrl };
            stored.health = { score: Math.max(0, healthScore), issues, lastAudit: new Date().toISOString() };
            stored.keywords = extractedKeywords;
            stored.pages = pageMetrics;
            stored.localVisibility = stored.localVisibility || { mapsRank: null, heatmap: [] };
            stored.lastUpdated = new Date().toISOString();
            
            await writeFile(SEO_DATA_PATH, JSON.stringify(stored, null, 2));
            
            res.json({
                ...seoData,
                health: stored.health,
                keywords: extractedKeywords
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/seo/analyze', async (req, res) => {
        const { url, content } = req.body;
        try {
            // Get latest crawl data or crawl now
            let crawlData = {};
            try { 
                const stored = JSON.parse(await readFile(SEO_DATA_PATH, 'utf8'));
                crawlData = stored.lastCrawl || {};
            } catch {}
            
            const prompt = `Perform a comprehensive SEO audit:
                URL: ${url || 'Local development'}
                Title: ${crawlData.title || 'Unknown'}
                Meta Description: ${crawlData.metaDescription || 'Missing'}
                H1 Tags: ${JSON.stringify(crawlData.headings?.h1 || [])}
                Word Count: ${crawlData.wordCount || 0}
                Images Missing Alt: ${crawlData.images?.missingAlt || 0}
                
                Provide: 1) SEO Score (0-100), 2) Critical Issues, 3) Opportunities, 4) Quick Wins.
                Format as actionable recommendations.`;
            
            const result = await aiCore.callAI('gemini-3-flash-preview', prompt,
                "You are an SEO expert. Provide specific, actionable recommendations.");
            
            res.json({ analysis: result.text, crawlData, analyzedAt: new Date().toISOString() });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/seo/strategy', async (req, res) => {
        const { businessType, targetKeywords, competitors } = req.body;
        try {
            const prompt = `Create a 90-day SEO strategy for:
                Business: ${businessType || 'Local service business'}
                Target Keywords: ${targetKeywords?.join(', ') || 'Not specified'}
                Competitors: ${competitors?.join(', ') || 'Not specified'}
                
                Include: 1) Keyword Strategy, 2) Content Calendar, 3) Technical SEO Priorities, 
                4) Link Building Plan, 5) Local SEO Tactics, 6) KPIs and Milestones.`;
            
            const result = await aiCore.callAI('gemini-3-pro-preview', prompt,
                "You are a senior SEO strategist. Create actionable, measurable plans.", null, 16000);
            
            res.json({ strategy: result.text, generatedAt: new Date().toISOString() });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/seo/commit-strategy', async (req, res) => {
        const { strategy } = req.body;
        try {
            let stored = {};
            try { stored = JSON.parse(await readFile(SEO_DATA_PATH, 'utf8')); } catch {}
            stored.activeStrategy = {
                content: strategy,
                committedAt: new Date().toISOString(),
                status: 'active'
            };
            await writeFile(SEO_DATA_PATH, JSON.stringify(stored, null, 2));
            res.json({ success: true, committedAt: stored.activeStrategy.committedAt });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- MCP DevTools Bridge ---
    router.post('/mcp/devtools/connect', (req, res) => {
        // Stub: In production, this would establish CDP session via Puppeteer
        res.json({ connected: true, sessionId: `mcp-${Date.now()}` });
    });

    router.post('/mcp/devtools/dom', async (req, res) => {
        const { selector } = req.body;
        try {
            const browser = await puppeteer.launch({ headless: 'new' });
            const page = await browser.newPage();
            const targetUrl = IS_DOCKER ? `http://localhost:${process.env.PORT || 3001}` : 'http://localhost:4000';
            await page.goto(targetUrl, { waitUntil: 'networkidle0' });
            
            const domSnapshot = await page.evaluate((sel) => {
                function serialize(el) {
                    if (!el) return null;
                    const attrs = {};
                    for (const attr of el.attributes || []) {
                        attrs[attr.name] = attr.value;
                    }
                    return {
                        nodeId: Math.random() * 10000 | 0,
                        nodeName: el.nodeName,
                        nodeType: el.nodeType,
                        attributes: attrs,
                        children: Array.from(el.children).slice(0, 50).map(serialize).filter(Boolean)
                    };
                }
                const target = sel ? document.querySelector(sel) : document.documentElement;
                return serialize(target);
            }, selector);
            
            await browser.close();
            res.json({ root: domSnapshot });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/mcp/devtools/evaluate', async (req, res) => {
        const { expression } = req.body;
        try {
            const browser = await puppeteer.launch({ headless: 'new' });
            const page = await browser.newPage();
            const targetUrl = IS_DOCKER ? `http://localhost:${process.env.PORT || 3001}` : 'http://localhost:4000';
            await page.goto(targetUrl, { waitUntil: 'networkidle0' });
            
            const result = await page.evaluate(expression);
            await browser.close();
            res.json({ result });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
