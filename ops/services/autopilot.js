/**
 * State controller for Autopilot functionality.
 */
export class AutopilotService {
    constructor(io) {
        this.io = io;
        this.state = {
            enabled: false,
            standardsMode: true,
            model: 'gemini-3-flash-preview',
            lastHeal: null,
            systemInstruction: 'You are an autonomous recovery agent for a multi-agent swarm.'
        };
    }

    /**
     * Returns the current autopilot state.
     */
    getState() {
        return this.state;
    }

    /**
     * Updates the autopilot configuration and broadcasts changes.
     */
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
     * Broadcasts the state to all connected clients.
     */
    broadcast() {
        if (this.io) {
            this.io.emit('autopilot-state', this.state);
        }
    }
}