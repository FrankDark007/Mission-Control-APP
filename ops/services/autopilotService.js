
/**
 * Consolidated Autopilot state and intervention service.
 */
export class AutopilotService {
    constructor(io) {
        this.io = io;
        this.state = {
            enabled: false,
            standardsMode: true,
            model: 'gemini-3-pro-preview',
            lastHeal: null,
            systemInstruction: 'You are an autonomous recovery agent for a multi-agent swarm.'
        };
    }

    getState() {
        return this.state;
    }

    updateState(updates) {
        this.state = { ...this.state, ...updates };
        this.broadcast();
        
        if (updates.enabled !== undefined) {
            this.io.emit('log', {
                agentId: 'system',
                type: 'system',
                message: `🤖 Autopilot mode is now ${this.state.enabled ? 'ACTIVE' : 'INACTIVE'}`,
                timestamp: new Date().toISOString()
            });
        }
        
        return this.state;
    }

    /**
     * Autonomous Failure Intervention.
     * Triggered when the mission queue reports a failure.
     */
    async handleMissionFailure(task, queue) {
        if (!this.state.enabled) return;

        this.io.emit('log', {
            agentId: 'autopilot',
            type: 'system',
            message: `🚨 Autonomic Intervention: Analyzing failure in task #${task.id}...`,
            timestamp: new Date().toISOString()
        });

        // Queue a priority diagnosis task
        queue.addTask({
            name: `Diagnosis: ${task.name}`,
            type: 'deep-diagnosis',
            agentId: 'autopilot',
            priority: 'high',
            metadata: { 
                originalTaskId: task.id, 
                failureLog: task.error || 'Unknown runtime error' 
            }
        });
    }

    broadcast() {
        if (this.io) {
            this.io.emit('autopilot-state', this.state);
        }
    }
}
