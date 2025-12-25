
import { spawn } from 'child_process';

export class AgentController {
    constructor(io, agentRegistry) {
        this.io = io;
        this.registry = agentRegistry;
        this.processes = {};
    }

    start(agentId, args = null) {
        const config = this.registry[agentId];
        if (!config) throw new Error(`Agent ${agentId} not found in registry.`);
        if (this.processes[agentId]) return { success: false, message: 'Already running' };

        const cmdArgs = args || config.safeArgs;
        
        // Extract virtual environment variables
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
                message: `🚀 Agent started with PID: ${child.pid}`, 
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
            return { success: false, error: e.message };
        }
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
        Object.keys(this.registry).forEach(id => {
            status[id] = this.processes[id] ? 'running' : 'stopped';
        });
        return status;
    }

    broadcastStatus() {
        this.io.emit('status', this.getStatus());
    }

    updateRegistry(newRegistry) {
        this.registry = newRegistry;
        this.io.emit('agent-registry', this.registry);
    }
}
