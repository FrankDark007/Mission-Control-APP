
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
     * @param {Object} task - Task details including optional 'dependencies' array of IDs.
     */
    addTask(task) {
        const newTask = {
            id: task.id || Date.now() + Math.floor(Math.random() * 1000),
            status: 'pending',
            created: new Date().toISOString(),
            dependencies: task.dependencies || [],
            ...task
        };
        this.queue.push(newTask);
        this.broadcast();
        this.process();
        return newTask;
    }

    /**
     * Orchestrates task execution based on concurrency limits and dependencies.
     */
    async process() {
        if (this.activeTasks.length >= this.maxConcurrency) return;

        // Get IDs of all successfully completed tasks
        const completedIds = new Set(this.history.filter(t => t.status === 'completed').map(t => t.id));
        
        // Identify tasks in queue that are ready (all dependencies satisfied)
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

        // Update queue to exclude tasks we are starting
        if (readyToStart.length > 0) {
            this.queue = remainingQueue;
            readyToStart.forEach(task => this.runTask(task));
        }
    }

    /**
     * Simulates the execution of a single task.
     */
    async runTask(task) {
        task.status = 'processing';
        task.startTime = new Date().toISOString();
        this.activeTasks.push(task);
        this.broadcast();

        // Simulate varying workloads (3 to 8 seconds)
        const duration = 3000 + Math.random() * 5000;
        
        try {
            // Mock execution delay
            await new Promise(resolve => setTimeout(resolve, duration));
            
            // Random chance of failure for realistic simulation
            if (Math.random() < 0.1) {
                throw new Error("Task execution failed unexpectedly.");
            }

            task.status = 'completed';
        } catch (error) {
            task.status = 'failed';
            task.error = error.message;
        }

        task.endTime = new Date().toISOString();
        
        // Move from active pool to history log
        this.activeTasks = this.activeTasks.filter(t => t.id !== task.id);
        this.history.push(task);
        
        this.broadcast();
        
        // Re-run process to pick up newly unlocked tasks
        this.process();
    }

    /**
     * Returns current queue and task status.
     */
    getStatus() {
        return {
            processing: this.activeTasks.length > 0,
            activeTasks: this.activeTasks,
            queue: this.queue,
            history: this.history.slice(-20)
        };
    }

    /**
     * Broadcasts the queue status to all connected clients via Socket.IO.
     */
    broadcast() {
        if (this.io) {
            this.io.emit('queue-status', this.getStatus());
        }
    }
}
