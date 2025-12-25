import { spawn } from 'child_process';

/**
 * Manages the lifecycle of multiple background AI agents.
 */
export class AgentManager {
    constructor(io, registry) {
        this.io = io;
        this.registry = registry;
        this.processes = {};
    }

    /**
     * Starts an agent process by ID.
     */
    start(agentId, args = null) {
        const config = this.registry[agentId];
        if (!config) throw new Error(`Agent ${agentId} not found in registry.`);
        if (this.processes[agentId]) return { success: false, message: 'Agent is already running.' };

        const cmdArgs = args || config.safeArgs;
        
        // Extract environment variables if passed in format KEY=VALUE
        const finalArgs = [];
        const customEnv = {};
        cmdArgs.forEach(arg => {
            if (typeof arg === 'string' && arg.includes('=') && !arg.startsWith('-')) {
                const [k, v] = arg.split('=');
                customEnv[k] = v;
            } else {
                finalArgs.push(arg);
            }
        });

        const env = { ...process.env, FORCE_COLOR: '1', ...customEnv };
        
        try {
            const child = spawn(config.command, finalArgs, { 
                cwd: config.path, 
                shell: true, 
                env: env 
            });
            
            this.processes[agentId] = child;
            this.broadcastStatus();

            this.io.emit('log', { 
                agentId, 
                type: 'system', 
                message: `🚀 Spawned ${config.name} (PID: ${child.pid})`, 
                timestamp: new Date().toISOString() 
            });

            const streamLog = (data, type) => {
                this.io.emit('log', { 
                    agentId, 
                    type, 
                    message: data.toString(), 
                    timestamp: new Date().toISOString() 
                });
            };

            child.stdout.on('data', (d) => streamLog(d, 'stdout'));
            child.stderr.on('data', (d) => streamLog(d, 'stderr'));

            child.on('close', (code) => {
                delete this.processes[agentId];
                this.broadcastStatus();
                this.io.emit('log', { 
                    agentId, 
                    type: 'system', 
                    message: `⏹️ Process exited with code ${code}`, 
                    timestamp: new Date().toISOString() 
                });
            });

            return { success: true, pid: child.pid };
        } catch (e) {
            console.error(`Spawn Error for ${agentId}:`, e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Stops an agent process.
     */
    stop(agentId) {
        if (this.processes[agentId]) {
            this.processes[agentId].kill();
            return true;
        }
        return false;
    }

    /**
     * Returns the current running status of all agents.
     */
    getStatus() {
        const status = {};
        Object.keys(this.registry).forEach(id => {
            status[id] = this.processes[id] ? 'running' : 'stopped';
        });
        return status;
    }

    /**
     * Broadcasts status updates via Socket.IO.
     */
    broadcastStatus() {
        this.io.emit('status', this.getStatus());
    }
}