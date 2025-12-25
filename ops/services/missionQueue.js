
/**
 * Tracks the status of asynchronous tasks and missions with dependency support.
 */
export class MissionQueue {
    constructor(io) {
        this.io = io;
        this.activeTasks = [];
        this.queue = [];
        this.history = [];
        this.maxConcurrency = 4;
    }

    /**
     * Adds a new task to the queue.
     * @param {Object} task - Task details including optional 'dependencies' array of IDs and 'parentId'.
     */
    addTask(task) {
        const newTask = {
            id: task.id || Date.now() + Math.floor(Math.random() * 1000),
            status: 'pending',
            created: new Date().toISOString(),
            dependencies: task.dependencies || [],
            parentId: task.parentId || null, // Hierarchy support
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

        for (const task of this.queue) {
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

        const duration = 3000 + Math.random() * 5000;
        
        try {
            await new Promise(resolve => setTimeout(resolve, duration));
            if (Math.random() < 0.05) throw new Error("Mission deviation detected.");
            task.status = 'completed';
        } catch (error) {
            task.status = 'failed';
            task.error = error.message;
        }

        task.endTime = new Date().toISOString();
        this.activeTasks = this.activeTasks.filter(t => t.id !== task.id);
        this.history.push(task);
        this.broadcast();
        this.process();
    }

    getStatus() {
        return {
            processing: this.activeTasks.length > 0,
            activeTasks: this.activeTasks,
            queue: this.queue,
            history: this.history.slice(-30)
        };
    }

    broadcast() {
        if (this.io) {
            this.io.emit('queue-status', this.getStatus());
        }
    }
}
