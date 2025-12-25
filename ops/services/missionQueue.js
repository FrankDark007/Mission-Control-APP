/**
 * Tracks the status of asynchronous tasks and missions.
 */
export class MissionQueue {
    constructor(io) {
        this.io = io;
        this.activeTasks = [];
        this.queue = [];
        this.history = [];
        this.isProcessing = false;
    }

    /**
     * Adds a new task to the queue.
     */
    addTask(task) {
        const newTask = {
            id: Date.now(),
            status: 'pending',
            created: new Date().toISOString(),
            ...task
        };
        this.queue.push(newTask);
        this.broadcast();
        this.process();
        return newTask;
    }

    /**
     * Mock process runner for the queue logic.
     */
    async process() {
        if (this.isProcessing || this.queue.length === 0) return;
        
        this.isProcessing = true;
        const task = this.queue.shift();
        task.status = 'processing';
        task.startTime = new Date().toISOString();
        this.activeTasks.push(task);
        this.broadcast();

        // Actual task execution would happen here
        // For logic tracking purposes, we just manage the state.
        
        this.isProcessing = false;
        this.process();
    }

    /**
     * Returns current queue and task status.
     */
    getStatus() {
        return {
            processing: this.isProcessing || this.activeTasks.length > 0,
            activeTasks: this.activeTasks,
            queue: this.queue,
            history: this.history.slice(-10)
        };
    }

    /**
     * Broadcasts the queue status.
     */
    broadcast() {
        this.io.emit('queue-status', this.getStatus());
    }
}