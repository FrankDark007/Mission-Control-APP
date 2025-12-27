
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Advanced Mission Orchestrator.
 * Manages task dependencies and triggers real-world agent actions.
 */
export class MissionQueue {
    constructor(io, agentManager, autopilot) {
        this.io = io;
        this.agentManager = agentManager;
        this.autopilot = autopilot;
        this.activeTasks = [];
        this.queue = [];
        this.history = [];
        this.maxConcurrency = 4;
        this.dbPath = join(process.cwd(), 'ops/missions.json');
        this.loadHistory();
    }

    async loadHistory() {
        try {
            if (existsSync(this.dbPath)) {
                const data = await readFile(this.dbPath, 'utf8');
                this.history = JSON.parse(data);
                this.broadcast();
            }
        } catch (e) {
            console.warn('[Queue] Failed to load history:', e.message);
        }
    }

    async persistHistory() {
        try {
            await writeFile(this.dbPath, JSON.stringify(this.history, null, 2));
        } catch (e) {
            console.error('[Queue] Persistence failure:', e.message);
        }
    }

    addTask(task) {
        const newTask = {
            id: task.id || Date.now() + Math.floor(Math.random() * 1000),
            status: 'pending',
            created: new Date().toISOString(),
            dependencies: task.dependencies || [],
            agentId: task.agentId || null,
            instruction: task.instruction || null,
            command: task.command || null,
            ...task
        };
        this.queue.push(newTask);
        this.broadcast();
        this.process();
        return newTask;
    }

    async process() {
        if (this.activeTasks.length >= this.maxConcurrency) return;

        const completedIds = new Set(this.history.filter(t => t.status === 'completed').map(t => t.id));
        const readyToStart = [];
        const remainingQueue = [];

        // Simple priority sort
        const sortedQueue = [...this.queue].sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0));

        for (const task of sortedQueue) {
            const dependenciesMet = task.dependencies.every(depId => completedIds.has(depId));
            if (dependenciesMet && (this.activeTasks.length + readyToStart.length < this.maxConcurrency)) {
                readyToStart.push(task);
            } else {
                remainingQueue.push(task);
            }
        }

        if (readyToStart.length > 0) {
            this.queue = remainingQueue;
            readyToStart.forEach(task => this.runTask(task));
        }
    }

    async runTask(task) {
        task.status = 'processing';
        task.startTime = new Date().toISOString();
        this.activeTasks.push(task);
        this.broadcast();

        try {
            if (task.agentId && this.agentManager) {
                if (task.instruction) {
                    this.io.emit('log', { agentId: task.agentId, type: 'system', message: `Instructing: ${task.instruction}`, timestamp: new Date().toISOString() });
                } else if (task.command) {
                    await this.agentManager.executeCommand(task.agentId, task.command);
                }
            }

            // Simulate baseline execution time for UI visibility
            await new Promise(resolve => setTimeout(resolve, 3000));
            task.status = 'completed';
        } catch (error) {
            task.status = 'failed';
            task.error = error.message;

            // Trigger Autonomic Intervention if active
            if (this.autopilot) {
                this.autopilot.handleMissionFailure(task, this);
            }
        }

        task.endTime = new Date().toISOString();
        this.activeTasks = this.activeTasks.filter(t => t.id !== task.id);
        this.history.push(task);
        await this.persistHistory();
        this.broadcast();
        this.process();
    }

    getStatus() {
        return {
            processing: this.activeTasks.length > 0,
            activeTasks: this.activeTasks,
            queue: this.queue,
            history: this.history.slice(-50)
        };
    }

    broadcast() {
        if (this.io) {
            this.io.emit('queue-status', this.getStatus());
        }
    }
}
