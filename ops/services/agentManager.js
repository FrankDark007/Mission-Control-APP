/**
 * Agent Manager V8
 * Claude Code spawning with hybrid execution model:
 * - spawnAgent: Recipe mode (returns recipe, no execution)
 * - spawnAgentImmediate: Armed mode (actual execution with gates)
 *
 * V8 Addition: Integrates with Claude Code Bridge for task handoff
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { GoogleGenAI } from "@google/genai";
import { createHash } from 'crypto';
import { claudeCodeBridge } from './claudeCodeBridge.js';

const execAsync = promisify(exec);

// Permission prompt patterns Claude Code uses
const PROMPT_PATTERNS = [
    /\? \[y\/n\]/i,
    /\[Y\/n\]/,
    /\[y\/N\]/,
    /confirm/i,
    /allow/i,
    /permission/i,
    /proceed\?/i,
    /continue\?/i,
    /overwrite\?/i,
    /delete\?/i,
    /Are you sure/i
];

// V7 Immediate Execution Limits
const IMMEDIATE_EXEC_COOLDOWN_MS = 60000; // 60 seconds between immediate execs
const MAX_IMMEDIATE_PER_MISSION = 3; // Max 3 immediate spawns per mission

export class AgentManager {
    constructor(io, registry, gitService, callAI = null) {
        this.io = io;
        this.registry = registry;
        this.gitService = gitService;
        this.callAI = callAI;

        // Active processes
        this.processes = {};
        this.subAgents = {};

        // Log buffers for analysis
        this.logBuffers = {};
        this.maxLogBuffer = 500; // lines per agent

        // Auto-pilot settings
        this.autoPilotEnabled = {};
        this.autoPilotModel = 'gemini-3-pro';

        // Self-healing tracking
        this.crashHistory = {};
        this.repairQueue = [];

        // V7: Immediate execution tracking
        this.immediateExecHistory = {}; // { missionId: [{ timestamp, agentId }] }
        this.lastImmediateExec = null; // Global cooldown

        // V7: Armed mode (must be set externally via stateStore)
        this.armedMode = false;

        // Initialize Gemini for auto-pilot decisions
        this.ai = null;
        if (process.env.API_KEY) {
            this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // V7 ARMED MODE CONTROL
    // ─────────────────────────────────────────────────────────────────────────

    setArmedMode(armed) {
        this.armedMode = armed;
        this._log('system', `🔐 Armed mode: ${armed ? 'ENABLED' : 'DISABLED'}`, 'system');
    }

    isArmedMode() {
        return this.armedMode;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // V7 SPAWN AGENT (RECIPE MODE - DEFAULT)
    // Returns recipe object, Claude Desktop/operator executes manually
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate a spawn recipe without executing
     * @param {Object} params - Spawn parameters
     * @returns {Object} Recipe for manual execution
     */
    async spawnAgent(params) {
        const {
            missionId,
            taskId,
            taskName,
            branchName,
            prompt,
            model = 'claude-sonnet-4',
            autoPilot = true,
            estimatedCost = null,
            riskLevel = 'medium',
            requiredArtifacts = [],
            allowedTools = []
        } = params;

        const recipeId = `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const worktreePath = process.cwd();

        // Build execution steps
        const steps = [
            {
                step: 1,
                action: 'create_worktree',
                command: branchName ? `git worktree add -b ${branchName} ../worktrees/${branchName}` : null,
                description: branchName ? `Create git worktree on branch ${branchName}` : 'Work in main directory'
            },
            {
                step: 2,
                action: 'spawn_claude',
                command: this._buildClaudeCommand(prompt, autoPilot),
                description: 'Spawn Claude Code agent',
                cwd: branchName ? `../worktrees/${branchName}` : worktreePath
            },
            {
                step: 3,
                action: 'monitor',
                description: 'Monitor agent output and handle prompts'
            },
            {
                step: 4,
                action: 'cleanup',
                command: branchName ? `git worktree remove ../worktrees/${branchName}` : null,
                description: 'Cleanup worktree after completion'
            }
        ].filter(s => s.command !== null || s.action === 'monitor');

        // Build the recipe
        const recipe = {
            recipeId,
            missionId,
            taskId,
            task: taskName,
            model,
            prompt,
            branchName,
            worktree: branchName ? `../worktrees/${branchName}` : worktreePath,
            autoPilot,
            riskLevel,
            requiredArtifacts,
            allowedTools,
            estimatedCost: estimatedCost || this._estimateCost(model, prompt),
            steps,
            generatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour expiry
            executionNotes: [
                'Review this recipe before execution',
                'Use spawn_agent_immediate with armed mode to auto-execute',
                'Or run steps manually via Claude Desktop'
            ]
        };

        // Store recipe for potential later execution
        this.subAgents[recipeId] = {
            id: recipeId,
            type: 'recipe',
            recipe,
            status: 'pending_execution',
            createdAt: new Date().toISOString()
        };

        this._log(recipeId, `📋 Recipe generated for: ${taskName}`, 'system');

        // V8: Create task in Claude Code Bridge for handoff
        try {
            claudeCodeBridge.createTask({
                projectId: missionId, // Use missionId as projectId for now
                title: `[Agent Task] ${taskName || 'Delegated Task'}`,
                instructions: prompt,
                priority: riskLevel === 'high' ? 'high' : 'normal',
                createdBy: 'agent-manager',
                createdByModel: model,
                context: {
                    recipeId,
                    missionId,
                    taskId,
                    branchName,
                    riskLevel,
                    allowedTools,
                    estimatedCost: recipe.estimatedCost,
                    executionMode: 'recipe'
                },
                artifacts: requiredArtifacts
            });
            this._log(recipeId, `📨 Task created in Claude Code Bridge`, 'system');
        } catch (e) {
            this._log(recipeId, `⚠️ Failed to create bridge task: ${e.message}`, 'error');
        }

        return {
            success: true,
            mode: 'recipe',
            recipe
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // V7 SPAWN AGENT IMMEDIATE (ARMED MODE ONLY)
    // Actually spawns and executes Claude Code
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Spawn agent immediately - REQUIRES armed mode
     * Includes gate checks and cooldown enforcement
     * @param {Object} params - Spawn parameters
     * @param {Object} gates - Gate validation results from caller
     * @returns {Object} Execution result with agentId and pid
     */
    async spawnAgentImmediate(params, gates = {}) {
        const {
            missionId,
            taskId,
            taskName,
            branchName,
            prompt,
            model = 'claude-sonnet-4',
            autoPilot = true,
            riskLevel = 'medium',
            allowedTools = [],
            requiredArtifacts = [],
            estimatedCost = null
        } = params;

        // Gate 1: Armed mode check
        if (!this.armedMode) {
            return {
                success: false,
                error: 'Armed mode required for spawn_agent_immediate',
                hint: 'Use spawnAgent() for recipe mode or enable armed mode first'
            };
        }

        // Gate 2: Cooldown check (60s between immediate execs)
        const now = Date.now();
        if (this.lastImmediateExec && (now - this.lastImmediateExec) < IMMEDIATE_EXEC_COOLDOWN_MS) {
            const waitTime = Math.ceil((IMMEDIATE_EXEC_COOLDOWN_MS - (now - this.lastImmediateExec)) / 1000);
            return {
                success: false,
                error: `Cooldown active: wait ${waitTime}s before next immediate spawn`,
                cooldownRemaining: waitTime
            };
        }

        // Gate 3: Per-mission limit check
        if (missionId) {
            const missionHistory = this.immediateExecHistory[missionId] || [];
            const recentExecs = missionHistory.filter(
                e => (now - new Date(e.timestamp).getTime()) < 3600000 // Last hour
            );
            if (recentExecs.length >= MAX_IMMEDIATE_PER_MISSION) {
                return {
                    success: false,
                    error: `Mission limit reached: max ${MAX_IMMEDIATE_PER_MISSION} immediate spawns per hour`,
                    execCount: recentExecs.length
                };
            }
        }

        // Gate 4: Risk level check (passed from caller via gates)
        if (gates.riskThreshold && riskLevel) {
            const riskLevels = { low: 1, medium: 2, high: 3, critical: 4 };
            if (riskLevels[riskLevel] > riskLevels[gates.riskThreshold]) {
                return {
                    success: false,
                    error: `Risk level ${riskLevel} exceeds threshold ${gates.riskThreshold}`,
                    requiresApproval: true
                };
            }
        }

        // Gate 5: Allowed tools check (passed from caller)
        if (gates.allowedTools && allowedTools.length > 0) {
            const disallowed = allowedTools.filter(t => !gates.allowedTools.includes(t));
            if (disallowed.length > 0) {
                return {
                    success: false,
                    error: `Disallowed tools requested: ${disallowed.join(', ')}`,
                    disallowedTools: disallowed
                };
            }
        }

        // Gate 6: Required artifacts check (passed from caller)
        if (gates.requiredArtifacts) {
            const missing = requiredArtifacts.filter(a => !gates.requiredArtifacts.includes(a));
            if (missing.length > 0) {
                return {
                    success: false,
                    error: `Missing required artifacts: ${missing.join(', ')}`,
                    missingArtifacts: missing
                };
            }
        }

        // Gate 7: Cost budget check (passed from caller)
        if (gates.budgetLimit && estimatedCost) {
            const cost = typeof estimatedCost === 'number' ? estimatedCost : estimatedCost.maxCost || 0;
            if (cost > gates.budgetLimit) {
                return {
                    success: false,
                    error: `Estimated cost $${cost.toFixed(2)} exceeds budget $${gates.budgetLimit.toFixed(2)}`,
                    requiresApproval: true
                };
            }
        }

        // All gates passed - execute
        const agentId = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const worktreePath = process.cwd();

            // Register sub-agent
            this.subAgents[agentId] = {
                id: agentId,
                type: 'immediate',
                missionId,
                taskId,
                name: taskName,
                branchName,
                worktreePath,
                model,
                riskLevel,
                status: 'starting',
                createdAt: new Date().toISOString(),
                autoPilot
            };

            this.autoPilotEnabled[agentId] = autoPilot;
            this.logBuffers[agentId] = [];

            // Spawn Claude Code process
            const args = ['-p', prompt];
            if (autoPilot) {
                args.push('--dangerously-skip-permissions');
            }

            const child = spawn('claude', args, {
                cwd: worktreePath,
                shell: true,
                env: {
                    ...process.env,
                    FORCE_COLOR: '1',
                    CLAUDE_CODE_ENTRYPOINT: 'cli'
                }
            });

            this.processes[agentId] = child;
            this.subAgents[agentId].pid = child.pid;
            this.subAgents[agentId].status = 'running';

            // Record immediate execution for cooldown/limits
            this.lastImmediateExec = now;
            if (missionId) {
                if (!this.immediateExecHistory[missionId]) {
                    this.immediateExecHistory[missionId] = [];
                }
                this.immediateExecHistory[missionId].push({
                    agentId,
                    timestamp: new Date().toISOString()
                });
            }

            this._log(agentId, `🚀 Claude agent spawned IMMEDIATELY with PID: ${child.pid}`, 'system');
            this._log(agentId, `📁 Worktree: ${worktreePath}`, 'system');
            this._log(agentId, `🎯 Task: ${taskName}`, 'system');
            this._log(agentId, `⚡ Mode: IMMEDIATE (armed mode)`, 'system');

            // Set up output handlers
            child.stdout.on('data', (data) => this._handleOutput(agentId, data, 'stdout'));
            child.stderr.on('data', (data) => this._handleOutput(agentId, data, 'stderr'));

            // Handle process exit
            child.on('close', (code) => this._handleExit(agentId, code));
            child.on('error', (error) => this._handleError(agentId, error));

            this.broadcastStatus();

            return {
                success: true,
                mode: 'immediate',
                agentId,
                pid: child.pid,
                worktreePath,
                branchName,
                autoPilot,
                missionId,
                taskId
            };
        } catch (error) {
            this._log(agentId, `❌ Spawn failed: ${error.message}`, 'error');
            return {
                success: false,
                mode: 'immediate',
                error: error.message
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LEGACY: spawnClaudeAgent (backward compatibility, maps to spawnAgentImmediate)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @deprecated Use spawnAgent() or spawnAgentImmediate()
     * Kept for backward compatibility
     */
    async spawnClaudeAgent(params) {
        // Legacy method - force immediate execution (skip armed mode check for backward compat)
        const originalArmed = this.armedMode;
        this.armedMode = true;

        const result = await this.spawnAgentImmediate({
            ...params,
            taskName: params.taskName || params.name
        }, {});

        this.armedMode = originalArmed;
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // V7 HELPER METHODS
    // ─────────────────────────────────────────────────────────────────────────

    _buildClaudeCommand(prompt, autoPilot) {
        const args = [`claude -p "${prompt.replace(/"/g, '\\"')}"`];
        if (autoPilot) {
            args.push('--dangerously-skip-permissions');
        }
        return args.join(' ');
    }

    _estimateCost(model, prompt) {
        // Simple estimation based on model and prompt length
        const inputTokens = Math.ceil(prompt.length / 4);
        const estimatedOutputTokens = Math.min(inputTokens * 2, 4000);

        const costs = {
            'claude-opus-4': { input: 15.00, output: 75.00 },
            'claude-sonnet-4': { input: 3.00, output: 15.00 },
            'claude-haiku': { input: 0.25, output: 1.25 }
        };

        const modelCost = costs[model] || costs['claude-sonnet-4'];
        const inputCost = (inputTokens / 1000000) * modelCost.input;
        const outputCost = (estimatedOutputTokens / 1000000) * modelCost.output;

        return {
            model,
            inputTokens,
            estimatedOutputTokens,
            minCost: (inputCost + outputCost * 0.5).toFixed(4),
            maxCost: (inputCost + outputCost * 1.5).toFixed(4),
            currency: 'USD'
        };
    }

    /**
     * Get immediate execution stats for a mission
     */
    getImmediateExecStats(missionId) {
        const history = this.immediateExecHistory[missionId] || [];
        const now = Date.now();
        const recentExecs = history.filter(
            e => (now - new Date(e.timestamp).getTime()) < 3600000
        );

        return {
            missionId,
            totalExecs: history.length,
            recentExecs: recentExecs.length,
            maxAllowed: MAX_IMMEDIATE_PER_MISSION,
            remaining: MAX_IMMEDIATE_PER_MISSION - recentExecs.length,
            cooldownActive: this.lastImmediateExec && (now - this.lastImmediateExec) < IMMEDIATE_EXEC_COOLDOWN_MS,
            cooldownRemaining: this.lastImmediateExec
                ? Math.max(0, Math.ceil((IMMEDIATE_EXEC_COOLDOWN_MS - (now - this.lastImmediateExec)) / 1000))
                : 0
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OUTPUT HANDLING & AUTO-PILOT
    // ─────────────────────────────────────────────────────────────────────────

    _handleOutput(agentId, data, type) {
        const text = data.toString();
        const lines = text.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
            // Buffer logs
            this._bufferLog(agentId, line);
            
            // Emit to frontend
            this._log(agentId, line, type);
            
            // Check for permission prompts (auto-pilot)
            if (this.autoPilotEnabled[agentId] && this._isPrompt(line)) {
                this._handlePermissionPrompt(agentId, line);
            }
        }
    }

    _isPrompt(text) {
        return PROMPT_PATTERNS.some(pattern => pattern.test(text));
    }

    async _handlePermissionPrompt(agentId, promptText) {
        if (!this.ai) {
            // No AI configured, default to 'y'
            this._log(agentId, '🤖 Auto-pilot: No AI configured, defaulting to YES', 'autopilot');
            this.sendInput(agentId, 'y');
            return;
        }

        try {
            const recentLogs = this.logBuffers[agentId].slice(-20).join('\n');
            const task = this.subAgents[agentId]?.name || 'Unknown task';
            
            const decision = await this._getAutoPilotDecision(task, promptText, recentLogs);
            
            this._log(agentId, `🤖 Auto-pilot decision: ${decision.action} - ${decision.reason}`, 'autopilot');
            
            if (decision.action === 'approve') {
                this.sendInput(agentId, 'y');
            } else if (decision.action === 'deny') {
                this.sendInput(agentId, 'n');
            } else {
                // Escalate to human
                this.io.emit('autopilot-escalation', {
                    agentId,
                    prompt: promptText,
                    reason: decision.reason,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            this._log(agentId, `⚠️ Auto-pilot error: ${error.message}`, 'error');
            // Default to yes on error
            this.sendInput(agentId, 'y');
        }
    }

    async _getAutoPilotDecision(task, prompt, context) {
        const systemPrompt = `You are an AI safety evaluator for a coding agent. Your job is to decide whether to approve or deny permission requests.

TASK: ${task}

RULES:
1. APPROVE file read/write operations within the project directory
2. APPROVE git operations (commit, branch, push)
3. APPROVE npm/package installations
4. APPROVE code execution for testing
5. DENY requests to access sensitive files (/etc, ~/.ssh, credentials)
6. DENY requests to make external network calls to unknown domains
7. DENY requests to modify system files
8. ESCALATE if unsure

Respond with JSON only: {"action": "approve"|"deny"|"escalate", "reason": "brief explanation"}`;

        const userPrompt = `Permission prompt: "${prompt}"

Recent context:
${context}

Should this be approved?`;

        const response = await this.ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: userPrompt,
            config: { systemInstruction: systemPrompt }
        });

        try {
            const text = response.text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(text);
        } catch {
            return { action: 'approve', reason: 'Could not parse response, defaulting to approve' };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SELF-HEALING
    // ─────────────────────────────────────────────────────────────────────────

    async _handleExit(agentId, code) {
        const agent = this.subAgents[agentId];
        delete this.processes[agentId];
        
        if (agent) {
            agent.status = code === 0 ? 'completed' : 'failed';
            agent.exitCode = code;
            agent.endedAt = new Date().toISOString();
        }
        
        this._log(agentId, `⏹️ Process exited with code ${code}`, 'system');
        this.broadcastStatus();
        
        // Trigger self-healing on non-zero exit
        if (code !== 0) {
            await this._analyzeFailure(agentId, code);
        }
    }

    _handleError(agentId, error) {
        this._log(agentId, `❌ Process error: ${error.message}`, 'error');
        this._analyzeFailure(agentId, -1);
    }

    async _analyzeFailure(agentId, exitCode) {
        if (!this.ai) return;

        const logs = this.logBuffers[agentId] || [];
        const recentLogs = logs.slice(-50).join('\n');
        const agent = this.subAgents[agentId];
        
        // Track crash history
        if (!this.crashHistory[agentId]) {
            this.crashHistory[agentId] = [];
        }
        this.crashHistory[agentId].push({
            time: new Date().toISOString(),
            exitCode,
            logSnapshot: recentLogs.slice(-500)
        });

        // Don't analyze if crashed too many times
        if (this.crashHistory[agentId].length > 3) {
            this._log(agentId, '🛑 Too many crashes, not attempting self-heal', 'system');
            this.io.emit('agent-failed-permanently', { agentId, crashes: this.crashHistory[agentId].length });
            return;
        }

        try {
            const diagnosis = await this._getDiagnosis(agent, recentLogs, exitCode);
            
            this._log(agentId, `🔍 Diagnosis: ${diagnosis.cause}`, 'selfheal');
            
            if (diagnosis.canFix && diagnosis.fixCommand) {
                this._log(agentId, `🔧 Proposed fix: ${diagnosis.fixCommand}`, 'selfheal');
                
                // Queue repair task
                this.repairQueue.push({
                    agentId,
                    diagnosis,
                    timestamp: new Date().toISOString()
                });
                
                // Emit for UI approval or auto-execute
                this.io.emit('self-heal-proposal', {
                    agentId,
                    diagnosis,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            this._log(agentId, `⚠️ Self-heal analysis failed: ${error.message}`, 'error');
        }
    }

    async _getDiagnosis(agent, logs, exitCode) {
        const systemPrompt = `You are a debugging expert. Analyze the error logs and propose a fix.

TASK: ${agent?.name || 'Unknown'}
BRANCH: ${agent?.branchName || 'Unknown'}
EXIT CODE: ${exitCode}

Respond with JSON only:
{
  "cause": "Brief explanation of failure",
  "canFix": true|false,
  "fixCommand": "shell command to run if fixable",
  "confidence": 0.0-1.0
}`;

        const response = await this.ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Error logs:\n${logs}\n\nDiagnose and propose fix.`,
            config: { systemInstruction: systemPrompt }
        });

        try {
            const text = response.text.replace(/```json\n?|\n?```/g, '').trim();
            return JSON.parse(text);
        } catch {
            return { cause: 'Could not parse diagnosis', canFix: false };
        }
    }

    async executeRepair(agentId) {
        const repair = this.repairQueue.find(r => r.agentId === agentId);
        if (!repair) return { success: false, error: 'No repair queued for this agent' };

        const agent = this.subAgents[agentId];
        if (!agent) return { success: false, error: 'Agent not found' };

        try {
            this._log(agentId, `🔧 Executing repair: ${repair.diagnosis.fixCommand}`, 'selfheal');
            
            const { stdout, stderr } = await execAsync(repair.diagnosis.fixCommand, {
                cwd: agent.worktreePath
            });
            
            if (stdout) this._log(agentId, stdout, 'stdout');
            if (stderr) this._log(agentId, stderr, 'stderr');
            
            // Remove from queue
            this.repairQueue = this.repairQueue.filter(r => r.agentId !== agentId);
            
            return { success: true, output: stdout };
        } catch (error) {
            this._log(agentId, `❌ Repair failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AGENT CONTROL
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send input to agent stdin
     */
    sendInput(agentId, input) {
        const process = this.processes[agentId];
        if (!process || !process.stdin) {
            return { success: false, error: 'Agent not running or stdin not available' };
        }

        try {
            process.stdin.write(input + '\n');
            this._log(agentId, `📝 Input sent: ${input}`, 'stdin');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop an agent
     */
    async stopAgent(agentId, cleanup = false) {
        const process = this.processes[agentId];
        const agent = this.subAgents[agentId];

        if (process) {
            process.kill('SIGTERM');
            
            // Force kill after 5 seconds
            setTimeout(() => {
                if (this.processes[agentId]) {
                    this.processes[agentId].kill('SIGKILL');
                }
            }, 5000);
        }

        if (cleanup && agent?.worktreePath) {
            try {
                await this.gitService.removeWorktree(agent.worktreePath);
                this._log(agentId, `🗑️ Worktree cleaned up`, 'system');
            } catch (error) {
                this._log(agentId, `⚠️ Worktree cleanup failed: ${error.message}`, 'error');
            }
        }

        if (agent) {
            agent.status = 'stopped';
        }

        this.broadcastStatus();
        return { success: true, agentId };
    }

    /**
     * Get agent status
     */
    getStatus(agentId = null) {
        if (agentId) {
            const agent = this.subAgents[agentId] || this.registry[agentId];
            return {
                ...agent,
                running: !!this.processes[agentId],
                autoPilot: this.autoPilotEnabled[agentId] || false
            };
        }

        const status = {};
        const allAgents = { ...this.registry, ...this.subAgents };
        
        for (const [id, agent] of Object.entries(allAgents)) {
            status[id] = {
                ...agent,
                running: !!this.processes[id],
                autoPilot: this.autoPilotEnabled[id] || false
            };
        }
        
        return status;
    }

    /**
     * Get logs for an agent
     */
    getLogs(agentId, lines = 100) {
        const buffer = this.logBuffers[agentId] || [];
        return buffer.slice(-lines);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LEGACY METHODS (backward compatibility)
    // ─────────────────────────────────────────────────────────────────────────

    async executeCommand(agentId, command) {
        const config = this.registry[agentId] || this.subAgents[agentId];
        const cwd = config?.path || config?.worktreePath || process.cwd();
        this._log(agentId, `🛠️ Executing: ${command}`, 'system');
        return await execAsync(command, { cwd });
    }

    async spawnSubAgent(parentId, taskName, branchName) {
        return this.spawnClaudeAgent({ taskName, branchName, prompt: `Continue task: ${taskName}`, autoPilot: true });
    }

    start(agentId, args = null) {
        const config = this.registry[agentId] || this.subAgents[agentId];
        if (!config) throw new Error(`Agent ${agentId} not found.`);
        if (this.processes[agentId]) return { success: false, message: 'Already running.' };
        return this._spawnProcess(agentId, config.command || 'node', args || config.safeArgs || [], config.path || config.worktreePath, config.name);
    }

    stop(agentId) {
        return this.stopAgent(agentId, false);
    }

    _spawnProcess(id, command, args, path, name) {
        const customEnv = {};
        const finalArgs = args.filter(arg => {
            if (typeof arg === 'string' && arg.includes('=') && !arg.startsWith('-')) {
                const [k, v] = arg.split('=');
                customEnv[k] = v;
                return false;
            }
            return true;
        });

        try {
            const child = spawn(command, finalArgs, { 
                cwd: path, 
                shell: true, 
                env: { ...process.env, FORCE_COLOR: '1', ...customEnv } 
            });
            
            this.processes[id] = child;
            this.logBuffers[id] = [];
            this.broadcastStatus();

            this._log(id, `🚀 Agent started with PID: ${child.pid}`, 'system');

            child.stdout.on('data', (d) => this._handleOutput(id, d, 'stdout'));
            child.stderr.on('data', (d) => this._handleOutput(id, d, 'stderr'));
            child.on('close', (code) => this._handleExit(id, code));

            return { success: true, pid: child.pid };
        } catch (e) { 
            return { success: false, error: e.message }; 
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    _log(agentId, message, type) {
        const log = { 
            agentId, 
            type, 
            message: typeof message === 'string' ? message : message.toString(), 
            timestamp: new Date().toISOString() 
        };
        this.io.emit('log', log);
    }

    _bufferLog(agentId, line) {
        if (!this.logBuffers[agentId]) {
            this.logBuffers[agentId] = [];
        }
        this.logBuffers[agentId].push(line);
        
        // Trim buffer if too large
        if (this.logBuffers[agentId].length > this.maxLogBuffer) {
            this.logBuffers[agentId] = this.logBuffers[agentId].slice(-this.maxLogBuffer);
        }
    }

    broadcastStatus() {
        const status = this.getStatus();
        this.io.emit('status', status);
    }
}
