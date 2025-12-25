
import { spawn } from 'child_process';

export class AgentSpawner {
    constructor(io) {
        this.io = io;
        this.processes = {};
    }

    start(agentId, config, args = []) {
        if (this.processes[agentId]) {
            this.io.emit('log', { agentId, type: 'system', message: 'Agent already running.', timestamp: new Date().toISOString() });
            return;
        }

        const cmdArgs = args.length > 0 ? args : config.safeArgs;
        
        // Extract virtual env vars from args
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
        const child = spawn(config.command, finalArgs, { cwd: config.path, shell: true, env });
        
        this.processes[agentId] = child;
        this.broadcastStatus(agentId, 'running');

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
            this.broadcastStatus(agentId, 'stopped');
            this.io.emit('log', { 
                agentId, 
                type: 'system', 
                message: `Process exited with code ${code}`, 
                timestamp: new Date().toISOString() 
            });
        });

        return child;
    }

    stop(agentId) {
        if (this.processes[agentId]) {
            this.processes[agentId].kill();
            return true;
        }
        return false;
    }

    broadcastStatus(agentId, status) {
        this.io.emit('status-update', { agentId, status });
    }

    isAlive(agentId) {
        return !!this.processes[agentId];
    }
}
