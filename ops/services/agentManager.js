
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Manages the lifecycle of multiple background AI agents and recursive sub-agents.
 * Restored: Robust environment variable parsing for virtualized agent contexts.
 */
export class AgentManager {
    constructor(io, registry, gitService) {
        this.io = io;
        this.registry = registry;
        this.gitService = gitService;
        this.processes = {};
        this.subAgents = {}; // Track recursive spawns
    }

    start(agentId, args = null) {
        const config = this.registry[agentId];
        if (!config) throw new Error(`Agent ${agentId} not found in registry.`);
        if (this.processes[agentId]) return { success: false, message: 'Agent is already running.' };

        return this._spawnProcess(agentId, config.command, args || config.safeArgs, config.path, config.name);
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
            
            const process = this._spawnProcess(subId, parentConfig.command, ['--chrome'], worktreePath, taskName, parentId);
            this.subAgents[subId] = { parentId, worktreePath, taskName };
            
            return { success: true, subId, path: worktreePath };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    _spawnProcess(id, command, args, path, name, parentId = null) {
        // Feature 9 Restoration: Parse virtual env variables from args (e.g. MISSION_SCOPE=full)
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
            ...customEnv // Inject virtualized variables
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

            child.on('close', async (code) => {
                delete this.processes[id];
                this.broadcastStatus();
                
                if (this.subAgents[id]) {
                    const { worktreePath } = this.subAgents[id];
                    this.io.emit('log', { agentId: id, type: 'system', message: `🍂 Task complete. Cleaning up worktree...`, timestamp: new Date().toISOString() });
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
        this.io.emit('log', { agentId, type, message: data.toString(), timestamp: new Date().toISOString() });
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
        Object.keys(this.registry).forEach(id => { status[id] = this.processes[id] ? 'running' : 'stopped'; });
        Object.keys(this.subAgents).forEach(id => { status[id] = this.processes[id] ? 'running' : 'stopped'; });
        return status;
    }

    broadcastStatus() {
        this.io.emit('status', this.getStatus());
    }
}
