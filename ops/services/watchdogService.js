/**
 * Mission Control V7 — Watchdog Service
 * Agent heartbeat monitoring, mission health checks, and anomaly detection
 *
 * Phase 7: Watchdog Implementation
 *
 * Responsibilities:
 * - Monitor agent heartbeats and detect stale/dead agents
 * - Track mission health and detect stuck missions
 * - Emit signals when issues are detected
 * - Create signal_report artifacts
 * - Trigger self-healing proposals when appropriate
 */

import { stateStore } from '../state/StateStore.js';
import { AgentStatus, MissionStatus, TaskStatus } from '../state/schema.js';
import { ArtifactTypes } from '../state/ArtifactTypes.js';
import { selfHealingService } from './selfHealingService.js';

// ============================================
// WATCHDOG CONFIGURATION
// ============================================

export const WatchdogConfig = {
  // Agent monitoring
  HEARTBEAT_INTERVAL_MS: 30000,         // Expected heartbeat interval
  STALE_THRESHOLD_MS: 90000,            // 3x heartbeat = stale
  DEAD_THRESHOLD_MS: 180000,            // 6x heartbeat = dead

  // Mission monitoring
  STUCK_MISSION_THRESHOLD_MS: 300000,   // 5 minutes with no progress
  MAX_MISSION_DURATION_MS: 3600000,     // 1 hour max

  // Task monitoring
  STUCK_TASK_THRESHOLD_MS: 180000,      // 3 minutes with no progress

  // Watchdog tick rate
  TICK_INTERVAL_MS: 15000,              // Check every 15 seconds

  // Auto-heal settings
  AUTO_HEAL_STALE_AGENTS: true,
  AUTO_HEAL_STUCK_TASKS: true,
  MAX_AUTO_HEAL_ATTEMPTS: 3
};

// ============================================
// SIGNAL TYPES
// ============================================

export const SignalType = {
  // Agent signals
  AGENT_STALE: 'agent_stale',
  AGENT_DEAD: 'agent_dead',
  AGENT_CRASHED: 'agent_crashed',
  AGENT_RECOVERED: 'agent_recovered',

  // Mission signals
  MISSION_STUCK: 'mission_stuck',
  MISSION_TIMEOUT: 'mission_timeout',
  MISSION_OVERRUN: 'mission_overrun',

  // Task signals
  TASK_STUCK: 'task_stuck',
  TASK_FAILED: 'task_failed',

  // System signals
  CIRCUIT_BREAKER_TRIP: 'circuit_breaker_trip',
  HIGH_FAILURE_RATE: 'high_failure_rate',
  RESOURCE_EXHAUSTION: 'resource_exhaustion'
};

// ============================================
// WATCHDOG SERVICE CLASS
// ============================================

class WatchdogService {
  constructor() {
    this.isRunning = false;
    this.tickInterval = null;
    this.signals = [];                   // Recent signals
    this.maxSignalHistory = 100;
    this.healAttempts = new Map();       // entityId -> attempt count
    this.subscribers = new Set();
    this.lastTickAt = null;
    this.stats = {
      ticks: 0,
      signalsEmitted: 0,
      healingTriggered: 0,
      agentsRecovered: 0
    };
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  start() {
    if (this.isRunning) {
      console.log('[Watchdog] Already running');
      return { success: false, reason: 'Already running' };
    }

    this.isRunning = true;
    this.tickInterval = setInterval(() => this._tick(), WatchdogConfig.TICK_INTERVAL_MS);
    console.log('[Watchdog] Started monitoring');

    return { success: true, tickInterval: WatchdogConfig.TICK_INTERVAL_MS };
  }

  stop() {
    if (!this.isRunning) {
      return { success: false, reason: 'Not running' };
    }

    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log('[Watchdog] Stopped');

    return { success: true };
  }

  // ============================================
  // MAIN TICK
  // ============================================

  async _tick() {
    this.lastTickAt = new Date().toISOString();
    this.stats.ticks++;

    try {
      // Run all checks in parallel
      await Promise.all([
        this._checkAgentHeartbeats(),
        this._checkMissionHealth(),
        this._checkTaskHealth(),
        this._checkCircuitBreaker()
      ]);
    } catch (error) {
      console.error('[Watchdog] Tick error:', error.message);
    }
  }

  // Force a manual tick (for testing or immediate check)
  async forceTick() {
    return this._tick();
  }

  // ============================================
  // AGENT HEARTBEAT MONITORING
  // ============================================

  async _checkAgentHeartbeats() {
    const agents = stateStore.listAgents({ status: AgentStatus.RUNNING });
    const now = Date.now();

    for (const agent of agents) {
      const lastHeartbeat = agent.lastHeartbeat
        ? new Date(agent.lastHeartbeat).getTime()
        : new Date(agent.createdAt).getTime();

      const timeSinceHeartbeat = now - lastHeartbeat;

      if (timeSinceHeartbeat >= WatchdogConfig.DEAD_THRESHOLD_MS) {
        await this._handleDeadAgent(agent, timeSinceHeartbeat);
      } else if (timeSinceHeartbeat >= WatchdogConfig.STALE_THRESHOLD_MS) {
        await this._handleStaleAgent(agent, timeSinceHeartbeat);
      }
    }
  }

  async _handleStaleAgent(agent, timeSinceHeartbeat) {
    const signal = await this._emitSignal({
      type: SignalType.AGENT_STALE,
      entityType: 'agent',
      entityId: agent.id,
      missionId: agent.missionId,
      details: {
        agentName: agent.name,
        timeSinceHeartbeat,
        threshold: WatchdogConfig.STALE_THRESHOLD_MS,
        lastHeartbeat: agent.lastHeartbeat
      },
      severity: 'warning'
    });

    // Update agent status
    await stateStore.updateAgent(agent.id, { status: AgentStatus.STALE });

    return signal;
  }

  async _handleDeadAgent(agent, timeSinceHeartbeat) {
    const signal = await this._emitSignal({
      type: SignalType.AGENT_DEAD,
      entityType: 'agent',
      entityId: agent.id,
      missionId: agent.missionId,
      details: {
        agentName: agent.name,
        timeSinceHeartbeat,
        threshold: WatchdogConfig.DEAD_THRESHOLD_MS,
        lastHeartbeat: agent.lastHeartbeat
      },
      severity: 'critical'
    });

    // Update agent status
    await stateStore.updateAgent(agent.id, { status: AgentStatus.DEAD });

    // Trigger self-healing if enabled
    if (WatchdogConfig.AUTO_HEAL_STALE_AGENTS) {
      await this._triggerAgentHealing(agent, signal);
    }

    return signal;
  }

  async _triggerAgentHealing(agent, signal) {
    const attemptKey = `agent-${agent.id}`;
    const attempts = this.healAttempts.get(attemptKey) || 0;

    if (attempts >= WatchdogConfig.MAX_AUTO_HEAL_ATTEMPTS) {
      console.log(`[Watchdog] Max heal attempts reached for agent ${agent.id}`);
      return null;
    }

    this.healAttempts.set(attemptKey, attempts + 1);
    this.stats.healingTriggered++;

    try {
      const proposal = await selfHealingService.generateProposal({
        missionId: agent.missionId,
        taskId: agent.taskId,
        failureSignature: `agent_dead_${agent.id}_${Date.now()}`,
        diagnosis: `Agent ${agent.name} (${agent.id}) stopped responding. Last heartbeat: ${agent.lastHeartbeat}`,
        proposedCommands: [
          `# Restart agent ${agent.id}`,
          `# Check worktree at ${agent.worktreePath}`,
          `# Review logs for crash cause`
        ],
        filesTouched: agent.worktreePath ? [agent.worktreePath] : [],
        riskRating: 'medium',
        rollbackPlan: `Stop and cleanup agent ${agent.id}, reset mission to blocked state`,
        context: { signal, agent }
      });

      return proposal;
    } catch (error) {
      console.error(`[Watchdog] Failed to create heal proposal for agent ${agent.id}:`, error.message);
      return null;
    }
  }

  // ============================================
  // MISSION HEALTH MONITORING
  // ============================================

  async _checkMissionHealth() {
    const runningMissions = stateStore.listMissions({ status: MissionStatus.RUNNING });
    const now = Date.now();

    for (const mission of runningMissions) {
      const startedAt = new Date(mission.updatedAt).getTime();
      const duration = now - startedAt;

      // Check for timeout
      if (duration >= WatchdogConfig.MAX_MISSION_DURATION_MS) {
        await this._handleMissionTimeout(mission, duration);
        continue;
      }

      // Check for stuck mission
      await this._checkMissionProgress(mission, duration);
    }
  }

  async _checkMissionProgress(mission, duration) {
    // Get tasks for this mission
    const tasks = stateStore.listTasks(mission.id);
    const runningTasks = tasks.filter(t => t.status === TaskStatus.RUNNING);

    if (runningTasks.length === 0 && duration >= WatchdogConfig.STUCK_MISSION_THRESHOLD_MS) {
      // No running tasks but mission is running - might be stuck
      const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETE);
      const pendingTasks = tasks.filter(t =>
        t.status === TaskStatus.PENDING || t.status === TaskStatus.READY
      );

      if (pendingTasks.length > 0 && completedTasks.length < tasks.length) {
        await this._emitSignal({
          type: SignalType.MISSION_STUCK,
          entityType: 'mission',
          entityId: mission.id,
          details: {
            missionTitle: mission.title,
            duration,
            totalTasks: tasks.length,
            completedTasks: completedTasks.length,
            pendingTasks: pendingTasks.length,
            runningTasks: 0
          },
          severity: 'warning'
        });
      }
    }
  }

  async _handleMissionTimeout(mission, duration) {
    const signal = await this._emitSignal({
      type: SignalType.MISSION_TIMEOUT,
      entityType: 'mission',
      entityId: mission.id,
      details: {
        missionTitle: mission.title,
        duration,
        maxDuration: WatchdogConfig.MAX_MISSION_DURATION_MS
      },
      severity: 'critical'
    });

    // Block the mission
    await stateStore.updateMission(mission.id, {
      status: MissionStatus.BLOCKED,
      blockedReason: `Watchdog timeout: exceeded ${WatchdogConfig.MAX_MISSION_DURATION_MS / 60000} minutes`
    });

    return signal;
  }

  // ============================================
  // TASK HEALTH MONITORING
  // ============================================

  async _checkTaskHealth() {
    const state = stateStore.getState();
    const now = Date.now();

    for (const task of Object.values(state.tasks)) {
      if (task.status !== TaskStatus.RUNNING) continue;

      const startedAt = task.startedAt
        ? new Date(task.startedAt).getTime()
        : new Date(task.updatedAt).getTime();

      const duration = now - startedAt;

      if (duration >= WatchdogConfig.STUCK_TASK_THRESHOLD_MS) {
        await this._handleStuckTask(task, duration);
      }
    }
  }

  async _handleStuckTask(task, duration) {
    const signal = await this._emitSignal({
      type: SignalType.TASK_STUCK,
      entityType: 'task',
      entityId: task.id,
      missionId: task.missionId,
      details: {
        taskTitle: task.title,
        taskType: task.taskType,
        duration,
        threshold: WatchdogConfig.STUCK_TASK_THRESHOLD_MS,
        agentId: task.agentId
      },
      severity: 'warning'
    });

    // Trigger self-healing if enabled
    if (WatchdogConfig.AUTO_HEAL_STUCK_TASKS) {
      await this._triggerTaskHealing(task, signal);
    }

    return signal;
  }

  async _triggerTaskHealing(task, signal) {
    const attemptKey = `task-${task.id}`;
    const attempts = this.healAttempts.get(attemptKey) || 0;

    if (attempts >= WatchdogConfig.MAX_AUTO_HEAL_ATTEMPTS) {
      console.log(`[Watchdog] Max heal attempts reached for task ${task.id}`);
      return null;
    }

    this.healAttempts.set(attemptKey, attempts + 1);
    this.stats.healingTriggered++;

    try {
      const proposal = await selfHealingService.generateProposal({
        missionId: task.missionId,
        taskId: task.id,
        failureSignature: `task_stuck_${task.id}_${Date.now()}`,
        diagnosis: `Task "${task.title}" appears stuck. Running for ${Math.round(signal.details.duration / 1000)}s without progress.`,
        proposedCommands: [
          `# Check agent ${task.agentId} status`,
          `# Review task dependencies`,
          `# Consider restarting task`
        ],
        filesTouched: [],
        riskRating: 'low',
        rollbackPlan: `Reset task ${task.id} to pending state`,
        context: { signal, task }
      });

      return proposal;
    } catch (error) {
      console.error(`[Watchdog] Failed to create heal proposal for task ${task.id}:`, error.message);
      return null;
    }
  }

  // ============================================
  // CIRCUIT BREAKER MONITORING
  // ============================================

  async _checkCircuitBreaker() {
    const state = stateStore.getState();

    if (state.circuitBreaker?.tripped && !this._hasRecentSignal(SignalType.CIRCUIT_BREAKER_TRIP)) {
      await this._emitSignal({
        type: SignalType.CIRCUIT_BREAKER_TRIP,
        entityType: 'system',
        entityId: 'circuit_breaker',
        details: {
          reason: state.circuitBreaker.reason,
          trippedAt: state.circuitBreaker.trippedAt
        },
        severity: 'critical'
      });
    }

    // Check failure rate
    await this._checkFailureRate();
  }

  async _checkFailureRate() {
    const missions = stateStore.listMissions({});
    const recentMissions = missions.filter(m => {
      const age = Date.now() - new Date(m.updatedAt).getTime();
      return age < 3600000; // Last hour
    });

    if (recentMissions.length < 3) return; // Not enough data

    const failed = recentMissions.filter(m => m.status === MissionStatus.FAILED).length;
    const failureRate = failed / recentMissions.length;

    if (failureRate > 0.5 && !this._hasRecentSignal(SignalType.HIGH_FAILURE_RATE)) {
      await this._emitSignal({
        type: SignalType.HIGH_FAILURE_RATE,
        entityType: 'system',
        entityId: 'failure_rate',
        details: {
          failureRate: Math.round(failureRate * 100),
          failed,
          total: recentMissions.length,
          timeWindow: '1 hour'
        },
        severity: 'critical'
      });
    }
  }

  // ============================================
  // SIGNAL EMISSION
  // ============================================

  async _emitSignal(signalData) {
    const signal = {
      id: `signal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...signalData,
      timestamp: new Date().toISOString()
    };

    // Store signal
    this.signals.push(signal);
    if (this.signals.length > this.maxSignalHistory) {
      this.signals = this.signals.slice(-this.maxSignalHistory);
    }

    this.stats.signalsEmitted++;

    // Create signal_report artifact if mission-linked
    if (signal.missionId) {
      try {
        await stateStore.addArtifact({
          id: `artifact-${Date.now()}-sig`,
          missionId: signal.missionId,
          taskId: signal.entityType === 'task' ? signal.entityId : null,
          type: ArtifactTypes.SIGNAL_REPORT,
          label: `Signal: ${signal.type}`,
          payload: signal,
          provenance: { producer: 'watchdog' }
        });
      } catch (error) {
        console.error('[Watchdog] Failed to create signal artifact:', error.message);
      }
    }

    // Notify subscribers
    this._notifySubscribers(signal);

    console.log(`[Watchdog] Signal: ${signal.type} (${signal.severity}) - ${signal.entityType}:${signal.entityId}`);

    return signal;
  }

  _hasRecentSignal(type, withinMs = 300000) {
    const cutoff = Date.now() - withinMs;
    return this.signals.some(s =>
      s.type === type && new Date(s.timestamp).getTime() > cutoff
    );
  }

  // ============================================
  // SUBSCRIPTION
  // ============================================

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _notifySubscribers(signal) {
    for (const callback of this.subscribers) {
      try {
        callback(signal);
      } catch (error) {
        console.error('[Watchdog] Subscriber error:', error.message);
      }
    }
  }

  // ============================================
  // MANUAL AGENT RECOVERY
  // ============================================

  async recoverAgent(agentId) {
    const agent = stateStore.getAgent(agentId);
    if (!agent) {
      return { success: false, error: `Agent ${agentId} not found` };
    }

    if (agent.status !== AgentStatus.STALE && agent.status !== AgentStatus.DEAD) {
      return { success: false, error: `Agent ${agentId} is not in stale/dead state` };
    }

    // Reset heartbeat and status
    await stateStore.updateAgent(agentId, {
      status: AgentStatus.RUNNING,
      lastHeartbeat: new Date().toISOString()
    });

    // Clear heal attempts
    this.healAttempts.delete(`agent-${agentId}`);
    this.stats.agentsRecovered++;

    // Emit recovery signal
    await this._emitSignal({
      type: SignalType.AGENT_RECOVERED,
      entityType: 'agent',
      entityId: agentId,
      missionId: agent.missionId,
      details: {
        agentName: agent.name,
        previousStatus: agent.status
      },
      severity: 'info'
    });

    return { success: true, agentId };
  }

  // ============================================
  // STATUS & QUERYING
  // ============================================

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastTickAt: this.lastTickAt,
      config: {
        tickInterval: WatchdogConfig.TICK_INTERVAL_MS,
        staleThreshold: WatchdogConfig.STALE_THRESHOLD_MS,
        deadThreshold: WatchdogConfig.DEAD_THRESHOLD_MS,
        stuckMissionThreshold: WatchdogConfig.STUCK_MISSION_THRESHOLD_MS
      },
      stats: this.stats,
      recentSignals: this.signals.slice(-10),
      healAttempts: Object.fromEntries(this.healAttempts)
    };
  }

  getSignals(filter = {}) {
    let signals = [...this.signals];

    if (filter.type) {
      signals = signals.filter(s => s.type === filter.type);
    }
    if (filter.severity) {
      signals = signals.filter(s => s.severity === filter.severity);
    }
    if (filter.entityType) {
      signals = signals.filter(s => s.entityType === filter.entityType);
    }
    if (filter.missionId) {
      signals = signals.filter(s => s.missionId === filter.missionId);
    }
    if (filter.since) {
      const sinceTime = new Date(filter.since).getTime();
      signals = signals.filter(s => new Date(s.timestamp).getTime() >= sinceTime);
    }

    return signals;
  }

  getActiveIssues() {
    const staleAgents = stateStore.listAgents({ status: AgentStatus.STALE });
    const deadAgents = stateStore.listAgents({ status: AgentStatus.DEAD });
    const blockedMissions = stateStore.listMissions({ status: MissionStatus.BLOCKED });
    const needsReviewMissions = stateStore.listMissions({ status: MissionStatus.NEEDS_REVIEW });

    return {
      staleAgents: staleAgents.map(a => ({ id: a.id, name: a.name, missionId: a.missionId })),
      deadAgents: deadAgents.map(a => ({ id: a.id, name: a.name, missionId: a.missionId })),
      blockedMissions: blockedMissions.map(m => ({ id: m.id, title: m.title, reason: m.blockedReason })),
      needsReviewMissions: needsReviewMissions.map(m => ({ id: m.id, title: m.title })),
      circuitBreakerTripped: stateStore.isCircuitBreakerTripped()
    };
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async healthCheck() {
    const status = this.getStatus();
    const issues = this.getActiveIssues();
    const criticalSignals = this.getSignals({ severity: 'critical' }).slice(-5);

    return {
      service: 'WatchdogService',
      status: this.isRunning ? 'ok' : 'stopped',
      isRunning: this.isRunning,
      lastTickAt: this.lastTickAt,
      stats: this.stats,
      activeIssues: {
        staleAgents: issues.staleAgents.length,
        deadAgents: issues.deadAgents.length,
        blockedMissions: issues.blockedMissions.length,
        circuitBreakerTripped: issues.circuitBreakerTripped
      },
      recentCriticalSignals: criticalSignals.length,
      checkedAt: new Date().toISOString()
    };
  }

  // ============================================
  // CLEANUP
  // ============================================

  clearHealAttempts(entityId = null) {
    if (entityId) {
      this.healAttempts.delete(entityId);
    } else {
      this.healAttempts.clear();
    }
    return { success: true };
  }

  clearSignals() {
    this.signals = [];
    return { success: true };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const watchdogService = new WatchdogService();
export { WatchdogService, WatchdogConfig, SignalType };
export default watchdogService;
