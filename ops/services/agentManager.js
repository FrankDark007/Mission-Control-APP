
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Manages the lifecycle of multiple background AI agents and recursive sub-agents.
 */
export class AgentManager {
    constructor(io, registry, gitService) {
        this.io = io;
        this.registry = registry;
        this.gitService = gitService;
        this.processes = {};
        this.subAgents = {};
        this.approvals = {}; // Feature 9
    }

    start(agentId, args = null) {
        const config = this.registry[agentId];
        if (!config) throw new Error(`Agent ${agentId} not found in registry.`);
        if (this.processes[agentId]) return { success: false, message: 'Agent is already running.' };

        // Feature 8: Safe-args mapping
        const finalArgs = args || config.safeArgs || ['--chrome'];
        return this._spawnProcess(agentId, config.command, finalArgs, config.path, config.name);
    }

    resumeProcess(agentId) {
        if (this.approvals[agentId]) {
            this.io.emit('log', { agentId, type: 'system', message: '✅ Human approval received. Resuming mission...', timestamp: new Date().toISOString() });
            delete this.approvals[agentId];
            this.broadcastStatus();
        }
    }

    /**
     * Spawns a sub-agent in a clean worktree for recursive autonomy.
     */
    async spawnSubAgent(parentId, taskName, branchName) {
        const parentConfig = this.registry[parentId] || { command: 'claude', name: 'Sub-Agent' };
        const worktreePath = join(tmpdir(), `swarm-${Date.now()}`);
        const subId = `sub-${Date.now()}`;

        this.io.emit('log', { 
            agentId: parentId, 
            type: 'system', 
            message: `🌿 Branching mission: Initializing worktree at ${worktreePath}`, 
            timestamp: new Date().toISOString() 
        });

        try {
            await this.gitService.addWorktree(worktreePath, branchName);
            
            // Feature 8: Map sub-agent args based on parent role
            const subArgs = parentConfig.id === 'design' ? ['--chrome', '--css-framework tailwind'] : ['--chrome'];
            
            const process = this._spawnProcess(subId, parentConfig.command, subArgs, worktreePath, taskName, parentId);
            this.subAgents[subId] = { parentId, worktreePath, taskName };
            
            return { success: true, subId, path: worktreePath };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    _spawnProcess(id, command, args, path, name, parentId = null) {
        const finalArgs = [];
        const customEnv = {};
        
        args.forEach(arg => {
            if (typeof arg === 'string' && arg.includes('=') && !arg.startsWith('-')) {
                const [k, v] = arg.split('=');
                customEnv[k] = v;
            } else {
                finalArgs.push(arg);
            }
        });

        const env = { 
            ...process.env, 
            FORCE_COLOR: '1', 
            ...customEnv 
        };
        
        try {
            const child = spawn(command, finalArgs, { cwd: path, shell: true, env });
            this.processes[id] = child;
            this.broadcastStatus();

            this.io.emit('log', { 
                agentId: id, 
                type: 'system', 
                message: parentId ? `🌱 Sub-agent ${name} sprouted (Parent: ${parentId})` : `🚀 Spawned ${name} (PID: ${child.pid})`, 
                timestamp: new Date().toISOString() 
            });

            child.stdout.on('data', (d) => this._log(id, d, 'stdout'));
            child.stderr.on('data', (d) => this._log(id, d, 'stderr'));

            // Feature 9: Detect approval requirements (Mock logic)
            child.stdout.on('data', (d) => {
                if (d.toString().toLowerCase().includes('waiting for your approval')) {
                    this.approvals[id] = true;
                    this.broadcastStatus();
                }
            });

            child.on('close', async (code) => {
                delete this.processes[id];
                delete this.approvals[id];
                this.broadcastStatus();
                
                if (this.subAgents[id]) {
                    const { worktreePath } = this.subAgents[id];
                    try { await this.gitService.removeWorktree(worktreePath); } catch(e){}
                    delete this.subAgents[id];
                }

                this.io.emit('log', { 
                    agentId: id, 
                    type: 'system', 
                    message: `⏹️ Process exited with code ${code}`, 
                    timestamp: new Date().toISOString() 
                });
            });

            return { success: true, pid: child.pid };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    _log(agentId, data, type) {
        const log = data.toString();
        this.io.emit('log', { agentId, type, message: log, timestamp: new Date().toISOString() });
        // Feature 1: Signal to healing engine
        this.io.emit('agent-log-internal', { agentId, log });
    }

    stop(agentId) {
        if (this.processes[agentId]) {
            this.processes[agentId].kill();
            return true;
        }
        return false;
    }

    getStatus() {
        const status = {};
        const allIds = [...Object.keys(this.registry), ...Object.keys(this.subAgents)];
        allIds.forEach(id => { 
            if (this.approvals[id]) status[id] = 'waiting_approval';
            else status[id] = this.processes[id] ? 'running' : 'stopped'; 
        });
        return status;
    }

    broadcastStatus() {
        this.io.emit('status', this.getStatus());
    }
}
