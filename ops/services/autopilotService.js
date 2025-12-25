
export class AutopilotService {
    constructor(io) {
        this.io = io;
        this.state = {
            enabled: false,
            standardsMode: true,
            model: 'gemini-3-flash-preview'
        };
    }

    updateConfig(config) {
        this.state = { ...this.state, ...config };
        this.broadcast();
        return this.state;
    }

    toggle(enabled) {
        this.state.enabled = enabled;
        this.broadcast();
        this.io.emit('log', { 
            agentId: 'system', 
            type: 'system', 
            message: `🤖 Autopilot is now ${enabled ? 'ENABLED' : 'DISABLED'}.`, 
            timestamp: new Date().toISOString() 
        });
        return this.state;
    }

    getState() {
        return this.state;
    }

    broadcast() {
        this.io.emit('autopilot-state', this.state);
    }
}
