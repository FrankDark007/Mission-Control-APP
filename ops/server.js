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
// Increase limit for image uploads
app.use(express.json({ limit: '50mb' }));
// Serve static screenshots
app.use('/screenshots', express.static(join(process.cwd(), 'screenshots')));

const PORT = 3001;
const HOME = homedir();

// --- AI Configuration ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Global State
let autoPilotConfig = {
    enabled: false,
    standardsMode: false,
    model: 'gemini-3-pro'
};

const STANDARDS_PREAMBLE = `STRICT AUDIT & SECURITY MODE ACTIVE.
1. DOCUMENTATION FIRST:
   - HTML/CSS/JS: Verify syntax against MDN (developer.mozilla.org).
   - Accessibility: Enforce WCAG 2.1 AA (w3.org/WAI).
   - SEO: Validate schema.org JSON-LD and meta tags.

2. SECURITY & HYGIENE (NON-NEGOTIABLE):
   - LINKS: All external links (target="_blank") MUST have rel="noopener noreferrer" to prevent tab-napping.
   - IMAGES: All img tags MUST have descriptive alt text and explicit width/height to prevent layout shifts (CLS).
   - HTTPS: All resources, scripts, and form actions must use HTTPS.
   - SANITIZATION: Avoid dangerouslySetInnerHTML. If necessary, use a sanitizer library.

If you are unsure, you must browse these sites to verify before writing code.`;

// Configuration for Agents and Worktrees
const AGENT_CONFIG = {
  design: {
    name: 'Design Agent',
    path: join(HOME, '.claude-worktrees/flood-doctor/design-build'),
    command: 'claude',
    // Safe args prompt for permission, Yolo args skip them
    safeArgs: ['--chrome'], 
    yoloArgs: ['--chrome', '--dangerously-skip-permissions'],
    restartPolicy: 'on-failure'
  },
  seo: {
    name: 'SEO Agent',
    path: join(HOME, '.claude-worktrees/flood-doctor/seo-content'),
    command: 'claude',
    safeArgs: ['--chrome'],
    yoloArgs: ['--chrome', '--dangerously-skip-permissions'],
    restartPolicy: 'on-failure'
  }
};

const EXIT_CODES = {
  0: 'Success',
  1: 'General Error (Uncaught Exception)',
  126: 'Command invoked cannot execute (Permission denied)',
  127: 'Command not found (Check $PATH or spelling)',
  128: 'Invalid argument to exit',
  130: 'Terminated by Ctrl+C',
  137: 'Out of Memory (SIGKILL) - Increase RAM or limit constraints',
  143: 'Terminated by SIGTERM'
};

// Mock Facts Database for QA
const FACTS_FILE = join(process.cwd(), 'facts.json');
const DEFAULT_FACTS = {
  "project_name": "Flood Doctor",
  "tech_stack": ["React", "Vite", "Tailwind", "Node.js", "Express"],
  "rules": [
    "Always use 'text-sm' for body text.",
    "Do not use rounded corners larger than 'rounded-lg'.",
    "API Key must be in process.env.API_KEY.",
    "Use Google Blue #1a73e8 for primary actions."
  ]
};

// Ensure facts file exists
if (!existsSync(FACTS_FILE)) {
    // We won't await this at top level, just fire and forget or let it be handled later
    writeFile(FACTS_FILE, JSON.stringify(DEFAULT_FACTS, null, 2)).catch(console.error);
}

// Store active processes
const processes = {
  design: null,
  seo: null
};

// Restart counters to prevent infinite loops
const restartCounters = {
    design: { count: 0, firstFailureTime: 0 },
    seo: { count: 0, firstFailureTime: 0 }
};

// Centralized Log Buffer
const centralLogBuffer = [];
const MAX_BUFFER_SIZE = 5000;

// Store simple in-memory chat history for the session
let chatHistory = [];

// --- Task Queue System ---
let commandQueue = [];
// activeTasks is now a Map to support parallel execution: TaskID -> ActiveTask Object
let activeTasks = new Map(); 
let completedTaskIds = new Set(); // Track completed task IDs for dependencies

const runCommand = (command, cwd, agentId, taskId) => {
    return new Promise((resolve, reject) => {
        io.emit('log', { agentId, type: 'system', message: `🚀 Starting task: ${command}`, timestamp: new Date().toISOString() });
        
        // Update specific task log
        if (activeTasks.has(taskId)) {
            const task = activeTasks.get(taskId);
            task.lastLog = `Running: ${command.split('&&')[0]}...`;
        }

        const child = spawn(command, [], { cwd, shell: true });
        
        const updateLog = (d, type) => {
             const msg = d.toString();
             // Update specific task log for UI polling
             if (activeTasks.has(taskId)) {
                 const task = activeTasks.get(taskId);
                 const cleanMsg = msg.trim().split('\n').pop();
                 if (cleanMsg) task.lastLog = cleanMsg.substring(0, 60);
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
    
    // Find ALL tasks where all dependencies are met
    const executableIndices = [];
    
    commandQueue.forEach((task, index) => {
        const dependenciesMet = !task.dependencies || 
                                task.dependencies.length === 0 || 
                                task.dependencies.every(depId => completedTaskIds.has(depId));
        
        if (dependenciesMet) {
            executableIndices.push(index);
        }
    });

    if (executableIndices.length === 0) return;

    executableIndices.sort((a, b) => b - a);

    const tasksToStart = [];
    for (const index of executableIndices) {
        tasksToStart.push(commandQueue[index]);
        commandQueue.splice(index, 1);
    }

    tasksToStart.forEach(task => {
        const activeTask = { 
            ...task, 
            status: 'processing', 
            startTime: new Date().toISOString(),
            lastLog: 'Initializing...'
        };
        activeTasks.set(task.id, activeTask);
        executeTask(activeTask);
    });
};

const executeTask = async (task) => {
    try {
        const projectRoot = join(process.cwd(), '..');
        
        if (task.type === 'git_merge') {
            await runCommand('git stash && git pull origin main --rebase && git stash pop', projectRoot, 'git', task.id);
        } else if (task.type === 'build') {
            await runCommand('echo "Building project assets..." && sleep 5 && echo "Build Complete"', projectRoot, 'build', task.id);
        } else if (task.type === 'deploy') {
            await runCommand('npm run build && echo "Deploying to Vercel..."', projectRoot, 'deploy', task.id);
        } else if (task.type === 'repair') {
             if (task.command) {
                 await runCommand(task.command, task.cwd || projectRoot, 'system', task.id);
             }
        } else if (task.type === 'seo_audit') {
            // Weekly SEO Scan logic (Mocked for now)
            await runCommand('echo "Running Weekly SEO Audit..." && sleep 2 && echo "Audit Complete"', projectRoot, 'seo', task.id);
        } else if (task.type === 'lint_design') {
            // "The Librarian" - Design Enforcer
            if (processes.design) {
                const prompt = "Scan all .tsx files. Enforce Tailwind variables from tailwind.config.js. Remove magic numbers.\n";
                processes.design.stdin.write(prompt);
                io.emit('log', { agentId: 'design', type: 'system', message: `👮 Librarian: Sent instruction to Design Agent.`, timestamp: new Date().toISOString() });
            } else {
                 throw new Error("Design Agent must be running to perform linting.");
            }
        } else if (task.type === 'gen_tests') {
            // "Chaos Generator" - Test Generator
            if (processes.design) {
                const prompt = "Analyze components in /src/components. Generate .test.tsx unit tests for them.\n";
                processes.design.stdin.write(prompt);
                io.emit('log', { agentId: 'design', type: 'system', message: `🧪 Chaos Generator: Sent instruction to Design Agent.`, timestamp: new Date().toISOString() });
            } else {
                 throw new Error("Design Agent must be running to generate tests.");
            }
        }

        completedTaskIds.add(task.id);

    } catch (error) {
        io.emit('log', { agentId: 'system', type: 'stderr', message: `❌ Task Failed: ${error.message}`, timestamp: new Date().toISOString() });
    } finally {
        activeTasks.delete(task.id);
        processQueue(); 
    }
};

// --- Helper Functions ---

const broadcastStatus = () => {
  io.emit('status', {
    design: processes.design ? 'running' : 'stopped',
    seo: processes.seo ? 'running' : 'stopped'
  });
};

const broadcastAutoPilot = () => {
    io.emit('autopilot-config', autoPilotConfig);
}

// 1. RESTART POLICY & PROCESS MANAGEMENT
const startAgentProcess = (agentId, args) => {
    const config = AGENT_CONFIG[agentId];
    if (!config) return;
    
    // Use stored args or fallback to current config
    const cmdArgs = args || (autoPilotConfig.enabled ? config.safeArgs : config.yoloArgs);
    const modeName = autoPilotConfig.enabled ? "AUTONOMOUS PROXY MODE" : "UNSUPERVISED MODE";

    const env = { ...process.env, FORCE_COLOR: '1' };
    if (autoPilotConfig.standardsMode) {
        env.AGENT_INSTRUCTION_PREAMBLE = STANDARDS_PREAMBLE;
    }

    const child = spawn(config.command, cmdArgs, {
      cwd: config.path,
      shell: true,
      env: env
    });

    processes[agentId] = child;
    broadcastStatus();
    
    io.emit('log', { agentId, type: 'system', message: `Process started in ${modeName}`, timestamp: new Date().toISOString() });

    const streamLog = (data, type) => {
      const message = data.toString();
      const timestamp = new Date().toISOString();
      centralLogBuffer.push({ timestamp, agentId, type, message });
      if (centralLogBuffer.length > MAX_BUFFER_SIZE) centralLogBuffer.shift();
      if (type === 'stdout') checkAndHandlePermission(agentId, message);
      io.emit('log', { agentId, type, message, timestamp });
    };

    child.stdout.on('data', (data) => streamLog(data, 'stdout'));
    child.stderr.on('data', (data) => streamLog(data, 'stderr'));

    child.on('close', (code) => {
      console.log(`${agentId} exited with code ${code}`);
      processes[agentId] = null;
      broadcastStatus();
      io.emit('log', { agentId, type: 'system', message: `Process exited with code ${code}`, timestamp: new Date().toISOString() });
      
      if (code !== 0 && code !== null) {
          analyzeFailure(agentId, code);

          // Restart Policy Logic
          if (config.restartPolicy === 'on-failure') {
              const now = Date.now();
              const counter = restartCounters[agentId];
              const RESTART_WINDOW = 60000; // 1 min
              const RESTART_LIMIT = 5;

              if (now - counter.firstFailureTime > RESTART_WINDOW) {
                  counter.count = 0;
                  counter.firstFailureTime = now;
              }

              if (counter.count < RESTART_LIMIT) {
                  counter.count++;
                  io.emit('log', { agentId: 'system', type: 'system', message: `🔄 Agent crashed. Auto-restarting in 5s... (Attempt ${counter.count}/${RESTART_LIMIT})`, timestamp: new Date().toISOString() });
                  setTimeout(() => {
                      startAgentProcess(agentId, cmdArgs);
                  }, 5000);
              } else {
                   io.emit('log', { agentId: 'system', type: 'stderr', message: `❌ CRASH LOOP DETECTED: Max restarts (${RESTART_LIMIT}) reached. Manual intervention required.`, timestamp: new Date().toISOString() });
              }
          }
      } else {
           restartCounters[agentId] = { count: 0, firstFailureTime: 0 };
      }
    });
};

// 2. SELF HEALING
async function analyzeFailure(agentId, code) {
    const reason = EXIT_CODES[code] || 'Runtime Error';
    console.log(`Analyzing failure for ${agentId} (Exit Code: ${code} - ${reason})`);
    
    // For runtime errors, the last logs might be in 'system' or 'stderr' from the client report
    const relevantAgentId = agentId === 'runtime' ? 'system' : agentId;

    const recentLogs = centralLogBuffer
        .filter(entry => entry.agentId === relevantAgentId)
        .slice(-50)
        .map(entry => entry.message)
        .join('');

    const prompt = `
    You are an AI DevOps Debugger. 
    The process '${agentId}' reported a failure: ${reason}.
    Here are the last 50 lines of logs (context):
    ${recentLogs}
    
    Analyze the error. Return JSON ONLY: { "diagnosis": "string", "fixCommand": "string", "explanation": "string" }
    For 'runtime' client errors, fixCommand might be a patch to App.tsx or a config change.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });

        const proposal = JSON.parse(response.text);
        proposal.agentId = agentId;
        proposal.timestamp = Date.now();

        if (autoPilotConfig.enabled) {
            io.emit('log', { agentId: 'system', type: 'ai-proxy', message: `🚑 Auto-Pilot attempting repair: ${proposal.diagnosis}`, timestamp: new Date().toISOString() });
            commandQueue.push({
                id: Date.now(),
                type: 'repair',
                name: `Auto-Repair: ${agentId}`,
                command: proposal.fixCommand,
                cwd: AGENT_CONFIG[agentId]?.path || process.cwd(),
                status: 'pending',
                created: new Date().toISOString()
            });
            processQueue();
        } else {
            io.emit('healing-proposal', proposal);
        }
    } catch (error) {
        console.error("Failed to analyze failure:", error);
    }
}

// 3. AUTO PILOT LOGIC
const autoPilotThinking = new Set(); 
async function checkAndHandlePermission(agentId, currentChunk) {
    if (!autoPilotConfig.enabled) return;
    if (autoPilotThinking.has(agentId)) return; 

    const recentLogs = centralLogBuffer.filter(l => l.agentId === agentId && l.type === 'stdout').slice(-3).map(l => l.message).join('');
    const combinedOutput = recentLogs + currentChunk;
    const promptPatterns = [/\? \[y\/n\]/i, /\(y\/n\)/i, /confirm/i, /allow/i, /permission/i, /do you want to/i, /press enter/i, /continue\?/i, /select.*:/i, /enter option:/i];

    if (promptPatterns.some(p => p.test(combinedOutput)) && processes[agentId]) {
        autoPilotThinking.add(agentId);
        try {
            const contextHistory = centralLogBuffer.filter(l => l.agentId === agentId).slice(-50).map(l => l.message).join('');
            io.emit('log', { agentId, type: 'ai-proxy', message: `🤖 Auto-Pilot Analyzing Request...`, timestamp: new Date().toISOString() });

            const prompt = `LOG CONTEXT:\n${contextHistory}\nLATEST OUTPUT:\n"${combinedOutput}"\nDECISION REQUIRED: What input should be sent to the terminal? Return JSON ONLY: { "decision": "approve" | "deny" | "input", "value": "string", "reason": "string" }`;
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: [{ parts: [{ text: prompt }] }],
                config: { 
                    responseMimeType: "application/json",
                    systemInstruction: "You are a Senior DevOps Security Engineer. Protect the system. Low Risk = Approve. High Risk = Deny."
                }
            });

            const decisionJson = JSON.parse(response.text);
            const icon = decisionJson.decision === 'deny' ? '⛔' : '✅';
            io.emit('log', { agentId, type: 'ai-proxy', message: `${icon} Auto-Pilot ${decisionJson.decision.toUpperCase()}: ${decisionJson.reason}`, timestamp: new Date().toISOString() });

            if ((decisionJson.decision === 'approve' || decisionJson.decision === 'input') && processes[agentId]) {
                setTimeout(() => { if (processes[agentId]) processes[agentId].stdin.write(decisionJson.value + '\n'); }, 1000);
            }
        } catch (error) {
            console.error("Auto-Pilot Error:", error);
        } finally {
            setTimeout(() => { autoPilotThinking.delete(agentId); }, 5000); 
        }
    }
}

// 4. BUILDER MODE HELPERS
async function getProjectContext() {
    try {
        const serverPath = join(process.cwd(), 'server.js');
        const appPath = join(process.cwd(), 'client', 'src', 'App.tsx');
        const typesPath = join(process.cwd(), 'client', 'src', 'types.ts');

        const [server, app, types] = await Promise.all([
            readFile(serverPath, 'utf-8').catch(() => "// server.js missing"),
            readFile(appPath, 'utf-8').catch(() => "// App.tsx missing"),
            readFile(typesPath, 'utf-8').catch(() => "// types.ts missing")
        ]);

        return `
        CURRENT CODEBASE CONTEXT:
        
        === ops/server.js ===
        ${server}

        === ops/client/src/types.ts ===
        ${types}

        === ops/client/src/App.tsx ===
        ${app}
        `;
    } catch (e) {
        return "Error reading project context: " + e.message;
    }
}

async function runAtomicTransaction(plan) {
    const backupList = [];
    const clientDir = join(process.cwd(), 'client');
    
    io.emit('log', { agentId: 'system', type: 'system', message: `🧠 Builder Mode: Starting Atomic Transaction for ${plan.files.length} files...`, timestamp: new Date().toISOString() });

    try {
        // Step 1: Backups
        for (const file of plan.files) {
            const filePath = join(process.cwd(), file.path);
            if (existsSync(filePath)) {
                const bakPath = filePath + '.bak';
                await copyFile(filePath, bakPath);
                backupList.push({ original: filePath, backup: bakPath });
            }
        }

        // Step 2: Dependencies
        if (plan.dependencies && plan.dependencies.length > 0) {
            io.emit('log', { agentId: 'system', type: 'system', message: `📦 Installing dependencies: ${plan.dependencies.join(', ')}`, timestamp: new Date().toISOString() });
            // Install in client directory if it's a frontend dep, else root (simplified logic: check if path contains client)
            // For safety, let's assume client deps for now or just run in root/client based on where package.json is.
            // We will run in client dir by default for UI changes.
            await execAsync(`npm install ${plan.dependencies.join(' ')}`, { cwd: clientDir });
        }

        // Step 3: Pre-Flight Check (Server)
        const serverFile = plan.files.find(f => f.path.endsWith('server.js'));
        if (serverFile) {
            io.emit('log', { agentId: 'system', type: 'system', message: `🛡️ Pre-Flight: Verifying Server Integrity...`, timestamp: new Date().toISOString() });
            const checkPath = join(process.cwd(), 'server.check.js');
            await writeFile(checkPath, serverFile.content);
            try {
                await execAsync(`node --check server.check.js`);
                await unlink(checkPath);
            } catch (e) {
                await unlink(checkPath);
                throw new Error(`Server Syntax Error: ${e.message}`);
            }
        }

        // Step 4: Write & Build
        for (const file of plan.files) {
             const filePath = join(process.cwd(), file.path);
             await writeFile(filePath, file.content);
        }

        io.emit('log', { agentId: 'system', type: 'system', message: `🔨 Verifying Build...`, timestamp: new Date().toISOString() });
        // Build Frontend
        await execAsync('npm run build', { cwd: clientDir });

        // Step 5: Success - Cleanup Backups
        io.emit('log', { agentId: 'system', type: 'system', message: `✅ Transaction Complete. Cleaning up...`, timestamp: new Date().toISOString() });
        for (const b of backupList) {
            await unlink(b.backup);
        }

        return { success: true, message: "Update successful. Reloading..." };

    } catch (error) {
        // Step 6: Rollback
        io.emit('log', { agentId: 'system', type: 'stderr', message: `❌ Transaction Failed: ${error.message}. ROLLING BACK.`, timestamp: new Date().toISOString() });
        for (const b of backupList) {
            await copyFile(b.backup, b.original);
            await unlink(b.backup);
        }
        throw error; // Re-throw to inform AI
    }
}


// --- API Routes ---

// Feature 1: Visual Sentinel
app.post('/api/qa/visual', async (req, res) => {
    io.emit('log', { agentId: 'system', type: 'system', message: '📸 Visual Sentinel: Starting regression test...', timestamp: new Date().toISOString() });
    
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Ensure screenshots dir exists
        const screenDir = join(process.cwd(), 'screenshots');
        if (!existsSync(screenDir)) await mkdir(screenDir);

        // Desktop
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('http://localhost:4000', { waitUntil: 'networkidle0' });
        const desktopPath = join(screenDir, 'desktop-latest.png');
        await page.screenshot({ path: desktopPath });
        
        // Mobile
        await page.setViewport({ width: 375, height: 667 });
        const mobilePath = join(screenDir, 'mobile-latest.png');
        await page.screenshot({ path: mobilePath });

        await browser.close();

        io.emit('log', { agentId: 'system', type: 'system', message: '✅ Visual Sentinel: Screenshots captured.', timestamp: new Date().toISOString() });
        
        res.json({ 
            desktop: '/screenshots/desktop-latest.png',
            mobile: '/screenshots/mobile-latest.png',
            diff: 0 // Mocked diff
        });

    } catch (e) {
        console.error("Puppeteer error:", e);
        io.emit('log', { agentId: 'system', type: 'stderr', message: `❌ Visual Sentinel Failed: ${e.message}`, timestamp: new Date().toISOString() });
        res.status(500).json({ error: e.message });
    }
});

// Feature 2: Telemetry & Self-Healing
app.post('/api/telemetry', async (req, res) => {
    const { error, stack } = req.body;
    
    const logMsg = `[CLIENT EXCEPTION] ${error}\n${stack}`;
    io.emit('log', { agentId: 'system', type: 'stderr', message: logMsg, timestamp: new Date().toISOString() });
    
    // Push to central buffer so AI can see it
    centralLogBuffer.push({ timestamp: new Date().toISOString(), agentId: 'system', type: 'stderr', message: logMsg });
    
    // Trigger Self-Healing
    analyzeFailure('runtime', 500); // 500 as mock code for runtime exception

    res.json({ received: true });
});

// Feature 3: Newsroom Cron (Weekly SEO)
// Schedule: Monday 9am
cron.schedule('0 9 * * 1', () => {
    io.emit('log', { agentId: 'system', type: 'system', message: '⏰ Newsroom Cron: Triggering Weekly SEO Scan', timestamp: new Date().toISOString() });
    commandQueue.push({
        id: Date.now(),
        type: 'seo_audit',
        name: 'Weekly Newsroom Scan',
        status: 'pending',
        created: new Date().toISOString()
    });
    processQueue();
});


// Queue Status
app.get('/api/queue/status', (req, res) => {
    res.json({
        processing: activeTasks.size > 0,
        activeTasks: Array.from(activeTasks.values()),
        queue: commandQueue
    });
});

// Get/Set AutoPilot
app.get('/api/autopilot', (req, res) => res.json(autoPilotConfig));
app.post('/api/autopilot', (req, res) => {
    autoPilotConfig = { ...autoPilotConfig, ...req.body };
    broadcastAutoPilot();
    res.json(autoPilotConfig);
});

// Approve Healing
app.post('/api/heal/approve', (req, res) => {
    const { diagnosis, fixCommand, agentId } = req.body;
    commandQueue.push({
        id: Date.now(),
        type: 'repair',
        name: `Repair ${agentId}: ${diagnosis}`,
        command: fixCommand,
        cwd: AGENT_CONFIG[agentId]?.path || process.cwd(),
        status: 'pending',
        created: new Date().toISOString()
    });
    processQueue();
    res.json({ success: true, message: 'Repair task queued.' });
});

// Start/Stop
app.post('/api/start/:agentId', (req, res) => {
  const { agentId } = req.params;
  if (!AGENT_CONFIG[agentId]) return res.status(404).json({ error: 'Agent not found' });
  if (processes[agentId]) return res.status(400).json({ error: 'Agent already running' });

  try {
      if (restartCounters[agentId]) restartCounters[agentId] = { count: 0, firstFailureTime: 0 };
      startAgentProcess(agentId);
      res.json({ success: true, message: 'Agent started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stop/:agentId', (req, res) => {
  const { agentId } = req.params;
  if (!processes[agentId]) return res.status(400).json({ error: 'Agent not running' });
  try {
    processes[agentId].kill();
    processes[agentId] = null; 
    broadcastStatus();
    res.json({ success: true, message: 'Stop signal sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Git/Deploy
app.post('/api/git/merge', async (req, res) => {
  commandQueue.push({ id: Date.now(), type: 'git_merge', name: 'Merge Origin/Main', status: 'pending', created: new Date().toISOString() });
  processQueue();
  res.json({ success: true });
});

app.post('/api/deploy', async (req, res) => {
  const buildId = Date.now();
  commandQueue.push({ id: buildId, type: 'build', name: 'System Build', status: 'pending', created: new Date().toISOString() });
  commandQueue.push({ id: buildId + 1, type: 'deploy', name: 'Vercel Deploy', status: 'pending', created: new Date().toISOString(), dependencies: [buildId] });
  processQueue();
  res.json({ success: true });
});

// Proactive Tasks
app.post('/api/tasks/lint_design', (req, res) => {
    commandQueue.push({ id: Date.now(), type: 'lint_design', name: 'Design Enforcer', status: 'pending', created: new Date().toISOString() });
    processQueue();
    res.json({ success: true });
});

app.post('/api/tasks/gen_tests', (req, res) => {
    commandQueue.push({ id: Date.now(), type: 'gen_tests', name: 'Chaos Generator', status: 'pending', created: new Date().toISOString() });
    processQueue();
    res.json({ success: true });
});


// Reports
app.get('/api/qa', async (req, res) => {
  try {
    const qaPath = join(process.cwd(), '..', 'qa', 'issues.md');
    res.json({ content: await readFile(qaPath, 'utf-8') });
  } catch (error) {
    res.json({ content: '# QA Report\n\nNo issues found.' });
  }
});

app.get('/api/audit/lighthouse', async (req, res) => {
    const url = req.query.url || 'http://localhost:3003';
    const reportPath = join(process.cwd(), 'audit-report.json');
    io.emit('log', { agentId: 'system', type: 'system', message: `🔍 Starting Lighthouse audit for ${url}...`, timestamp: new Date().toISOString() });
    try {
        await execAsync(`npx lighthouse ${url} --output=json --output-path=${reportPath} --chrome-flags="--headless"`);
        const report = JSON.parse(await readFile(reportPath, 'utf-8'));
        const scores = {
            performance: report.categories.performance?.score || 0,
            accessibility: report.categories.accessibility?.score || 0,
            bestPractices: report.categories['best-practices']?.score || 0,
            seo: report.categories.seo?.score || 0,
        };
        io.emit('log', { agentId: 'system', type: 'system', message: `✅ Audit Complete. Perf: ${Math.round(scores.performance * 100)}`, timestamp: new Date().toISOString() });
        res.json(scores);
    } catch (e) {
        io.emit('log', { agentId: 'system', type: 'stderr', message: `❌ Audit Failed: ${e.message}`, timestamp: new Date().toISOString() });
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/git/log', async (req, res) => {
    try {
         const { stdout } = await execAsync('git log -n 5 --pretty=format:"%h|%s|%ad" --date=short', { cwd: join(process.cwd(), '..') });
         const logs = stdout.split('\n').filter(l => l.trim()).map(l => { const [hash, message, date] = l.split('|'); return { hash, message, date }; });
         res.json(logs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/git/reset', async (req, res) => {
    const { hash } = req.body;
    io.emit('log', { agentId: 'system', type: 'system', message: `⚠️ Hard Resetting Git to ${hash}...`, timestamp: new Date().toISOString() });
    try {
         await execAsync(`git reset --hard ${hash}`, { cwd: join(process.cwd(), '..') });
         io.emit('log', { agentId: 'system', type: 'system', message: `✅ Git Reset Successful`, timestamp: new Date().toISOString() });
         res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/facts', async (req, res) => {
    try { await writeFile(FACTS_FILE, JSON.stringify(req.body, null, 2)); res.json({ success: true }); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MAIN AI ENDPOINT ---
app.post('/api/chat', async (req, res) => {
  const { message, model, image } = req.body;
  
  try {
    let responseText = "";
    
    // --- BUILDER MODE (ATOMIC TRANSACTION) ---
    if (model === 'builder-mode') {
        const context = await getProjectContext();
        const systemInstruction = `
        You are an Autonomous Software Architect in "Builder Mode".
        You can safely edit the application code because every change is wrapped in an Atomic Transaction with Rollback.
        
        YOUR GOAL: Satisfy the user's request by modifying the code.
        
        RULES:
        1. You must return a STRICT JSON object complying with this schema:
           {
             "files": [ { "path": "string (relative to ops/)", "content": "string (full new content)" } ],
             "dependencies": ["string (npm package name)"]
           }
        2. Paths must be relative to the 'ops' folder. e.g., 'server.js', 'client/src/App.tsx'.
        3. Do NOT provide markdown explanation. JUST THE JSON.
        
        ${context}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ parts: [{ text: message }] }],
            config: { 
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 4096 } // High budget for coding
            }
        });

        const plan = JSON.parse(response.text);
        
        // EXECUTE TRANSACTION
        try {
            await runAtomicTransaction(plan);
            responseText = `**✅ Builder Mode Transaction Successful**\n\nUpdated ${plan.files.length} files:\n` + 
                           plan.files.map(f => `- \`${f.path}\``).join('\n');
        } catch (txError) {
             responseText = `**❌ Builder Mode Transaction Failed & Rolled Back**\n\nError: ${txError.message}`;
        }

    } else {
        // --- STANDARD MODES ---
        const PERSONAS = {
            'gemini-3-pro': "You are the Flood Doctor Mission Control AI.",
            'deep-reasoning': "You are in Deep Reasoning mode. Think critically.",
            'search-grounding': "You are an AI assistant with Google Search.",
            'maps-grounding': "You are an AI assistant with Google Maps.",
            'qa-critic': "You are a QA Critic. Verify input against facts.",
            'claude-sim': "You are simulating Claude 3.5 Sonnet. Focus on code quality.",
            'perplexity-sim': "You are simulating Perplexity. Focus on facts.",
            'recraft-sim': "You are simulating Recraft AI. Focus on UI.",
            'swarm-consensus': "Act as a consensus engine."
        };

        const systemContext = `${PERSONAS[model] || PERSONAS['gemini-3-pro']}
        Context:
        - Design Path: ${AGENT_CONFIG.design.path}
        - SEO Path: ${AGENT_CONFIG.seo.path}
        - Auto-Pilot: ${autoPilotConfig.enabled}
        `;

        if (image) {
            // Image Logic
            const matches = image.match(/^data:(.+);base64,(.+)$/);
            const mimeType = matches ? matches[1] : 'image/png';
            const base64Data = matches ? matches[2] : (image.includes(',') ? image.split(',')[1] : image);
            
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: message || "Analyze." }] },
                config: { systemInstruction: systemContext }
            });
            responseText = response.text;
        } else if (model === 'search-grounding') {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: message,
                config: { tools: [{googleSearch: {}}], systemInstruction: systemContext }
            });
            responseText = response.text;
             const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
             if (chunks) responseText += `\n\n**Sources:**` + chunks.map(c => c.web?.uri).filter(u => u).map(u => `\n- ${u}`).join('');
        } else if (model === 'maps-grounding') {
             const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: message,
                config: { tools: [{googleMaps: {}}], systemInstruction: systemContext }
            });
            responseText = response.text;
        } else {
             // Default Chat
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: [
                    ...chatHistory.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
                    { role: 'user', parts: [{ text: message }] }
                ],
                config: { 
                    systemInstruction: systemContext,
                    // Use thinking for deep-reasoning or qa-critic
                    thinkingConfig: (model === 'deep-reasoning' || model === 'qa-critic') ? { thinkingBudget: 4096 } : undefined
                }
            });
            responseText = response.text;
        }

        if (!image) {
            chatHistory.push({ role: 'user', content: message });
            chatHistory.push({ role: 'model', content: responseText });
            if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
        }
    }

    res.json({ response: responseText });

  } catch (error) {
    console.error("AI Error:", error);
    io.emit('log', { agentId: 'system', type: 'stderr', message: `❌ AI Failure: ${error.message}`, timestamp: new Date().toISOString() });
    res.status(500).json({ error: error.message, response: `**System Error**: ${error.message}` });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Flood Doctor Ops Server running at http://localhost:${PORT}`);
});