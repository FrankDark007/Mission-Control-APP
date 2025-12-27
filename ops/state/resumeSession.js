/**
 * Mission Control V8 Resume Session
 * 
 * PURPOSE: Handle crash recovery and session continuity.
 * Ensures missions continue from last state, never restart from scratch.
 * 
 * V8 CORE COMPONENT
 * 
 * @module state/resumeSession
 */

import { 
  MissionStatus, 
  TaskStatus, 
  AgentStatus 
} from './schema.js';

// =============================================================================
// RESUME STRATEGIES
// =============================================================================

/**
 * Resume policies for different scenarios
 */
export const ResumePolicy = Object.freeze({
  CONTINUE_FROM_LAST_TASK: 'continue_from_last_task',
  CONTINUE_FROM_LAST_AGENT: 'continue_from_last_agent',
  RETRY_FAILED_TASK: 'retry_failed_task',
  REQUIRE_HUMAN_DECISION: 'require_human_decision'
});

// =============================================================================
// SESSION RESUME MANAGER
// =============================================================================

/**
 * SessionResumeManager - V8 Crash Recovery
 * 
 * On reconnect:
 * 1. Reads StateStore
 * 2. Finds active missions
 * 3. Determines resume point
 * 4. Continues from where we left off
 */
export class SessionResumeManager {
  constructor(stateStore) {
    this.stateStore = stateStore;
    this.resumeLog = [];
  }

  /**
   * Main resume entry point
   * Called on Claude Desktop reconnect or server restart
   * 
   * @returns {Object} Resume summary
   */
  async resumeSession() {
    const summary = {
      timestamp: new Date().toISOString(),
      missionsResumed: 0,
      tasksResumed: 0,
      agentsRecovered: 0,
      actions: []
    };

    try {
      // 1. Get current state
      const state = await this.stateStore.getState();

      // 2. Find active missions
      const activeMissions = this.findActiveMissions(state.missions || []);
      
      if (activeMissions.length === 0) {
        summary.actions.push({
          type: 'info',
          message: 'No active missions to resume'
        });
        return summary;
      }

      // 3. Resume each mission
      for (const mission of activeMissions) {
        const missionResume = await this.resumeMission(mission, state);
        summary.missionsResumed++;
        summary.tasksResumed += missionResume.tasksResumed;
        summary.agentsRecovered += missionResume.agentsRecovered;
        summary.actions.push(...missionResume.actions);
      }

      // 4. Log resume event
      this.resumeLog.push(summary);

      return summary;

    } catch (error) {
      summary.error = error.message;
      summary.actions.push({
        type: 'error',
        message: `Resume failed: ${error.message}`
      });
      return summary;
    }
  }

  /**
   * Find missions that need to be resumed
   * 
   * @param {Array} missions - All missions
   * @returns {Array} Active missions
   */
  findActiveMissions(missions) {
    const activeStatuses = [
      MissionStatus.RUNNING,
      MissionStatus.BLOCKED,
      MissionStatus.NEEDS_REVIEW
    ];

    return missions.filter(m => activeStatuses.includes(m.status));
  }

  /**
   * Resume a single mission
   * 
   * @param {Object} mission - Mission to resume
   * @param {Object} state - Full state object
   * @returns {Object} Resume result
   */
  async resumeMission(mission, state) {
    const result = {
      missionId: mission.id,
      tasksResumed: 0,
      agentsRecovered: 0,
      actions: []
    };

    // Get mission's tasks
    const tasks = (state.tasks || []).filter(t => t.missionId === mission.id);
    
    // Get mission's agents
    const agents = (state.agents || []).filter(a => a.missionId === mission.id);

    // Determine resume strategy based on state
    const strategy = this.determineResumeStrategy(mission, tasks, agents);

    result.actions.push({
      type: 'info',
      message: `Resuming mission ${mission.id} with strategy: ${strategy}`
    });

    switch (strategy) {
      case ResumePolicy.CONTINUE_FROM_LAST_AGENT:
        result.agentsRecovered += await this.recoverAgents(mission, agents);
        break;

      case ResumePolicy.CONTINUE_FROM_LAST_TASK:
        result.tasksResumed += await this.resumeTasks(mission, tasks);
        break;

      case ResumePolicy.RETRY_FAILED_TASK:
        result.tasksResumed += await this.retryFailedTasks(mission, tasks);
        break;

      case ResumePolicy.REQUIRE_HUMAN_DECISION:
        await this.requestHumanDecision(mission);
        result.actions.push({
          type: 'blocked',
          message: `Mission ${mission.id} requires human decision`
        });
        break;
    }

    return result;
  }

  /**
   * Determine which resume strategy to use
   * 
   * @param {Object} mission - Mission
   * @param {Array} tasks - Mission's tasks
   * @param {Array} agents - Mission's agents
   * @returns {string} Resume policy
   */
  determineResumeStrategy(mission, tasks, agents) {
    // Check for running agents first
    const runningAgents = agents.filter(a => a.status === AgentStatus.RUNNING);
    if (runningAgents.length > 0) {
      return ResumePolicy.CONTINUE_FROM_LAST_AGENT;
    }

    // Check for stale agents that might need recovery
    const staleAgents = agents.filter(a => a.status === AgentStatus.STALE);
    if (staleAgents.length > 0) {
      return ResumePolicy.CONTINUE_FROM_LAST_AGENT;
    }

    // Check for failed tasks that might be retried
    const failedTasks = tasks.filter(t => t.status === TaskStatus.FAILED);
    if (failedTasks.length > 0 && mission.status !== MissionStatus.LOCKED) {
      return ResumePolicy.RETRY_FAILED_TASK;
    }

    // Check for ready tasks
    const readyTasks = tasks.filter(t => t.status === TaskStatus.READY);
    if (readyTasks.length > 0) {
      return ResumePolicy.CONTINUE_FROM_LAST_TASK;
    }

    // Check for running tasks
    const runningTasks = tasks.filter(t => t.status === TaskStatus.RUNNING);
    if (runningTasks.length > 0) {
      return ResumePolicy.CONTINUE_FROM_LAST_TASK;
    }

    // Default: need human decision
    return ResumePolicy.REQUIRE_HUMAN_DECISION;
  }

  /**
   * Recover agents that were running before disconnect
   * 
   * @param {Object} mission - Mission
   * @param {Array} agents - Agents to recover
   * @returns {number} Count of recovered agents
   */
  async recoverAgents(mission, agents) {
    let recovered = 0;

    for (const agent of agents) {
      if (agent.status === AgentStatus.RUNNING || agent.status === AgentStatus.STALE) {
        // Check if agent is still alive (via heartbeat)
        const isAlive = await this.checkAgentAlive(agent);

        if (isAlive) {
          // Agent is still running, just need to re-establish monitoring
          recovered++;
        } else {
          // Agent died, mark as dead and determine next action
          await this.stateStore.updateAgent(agent.id, {
            status: AgentStatus.DEAD,
            error: 'Lost connection during session disconnect'
          });

          // If task was assigned, reset it to ready
          if (agent.taskId) {
            await this.stateStore.updateTask(agent.taskId, {
              status: TaskStatus.READY,
              assignedAgent: null
            });
          }
        }
      }
    }

    return recovered;
  }

  /**
   * Check if an agent is still alive
   * 
   * @param {Object} agent - Agent to check
   * @returns {boolean}
   */
  async checkAgentAlive(agent) {
    if (!agent.lastHeartbeat) return false;

    const lastHeartbeat = new Date(agent.lastHeartbeat);
    const now = new Date();
    const deadThreshold = 150000; // 5x heartbeat interval (30s)

    return (now - lastHeartbeat) < deadThreshold;
  }

  /**
   * Resume tasks that were in progress
   * 
   * @param {Object} mission - Mission
   * @param {Array} tasks - Tasks to resume
   * @returns {number} Count of resumed tasks
   */
  async resumeTasks(mission, tasks) {
    let resumed = 0;

    // Find tasks that need attention
    const tasksToResume = tasks.filter(t => 
      t.status === TaskStatus.READY || 
      t.status === TaskStatus.RUNNING
    );

    for (const task of tasksToResume) {
      if (task.status === TaskStatus.RUNNING) {
        // Task was running, check if it has an agent
        if (!task.assignedAgent) {
          // No agent, reset to ready
          await this.stateStore.updateTask(task.id, {
            status: TaskStatus.READY
          });
        }
        resumed++;
      } else if (task.status === TaskStatus.READY) {
        // Task is ready, can be picked up
        resumed++;
      }
    }

    return resumed;
  }

  /**
   * Retry failed tasks if appropriate
   * 
   * @param {Object} mission - Mission
   * @param {Array} tasks - Tasks to check
   * @returns {number} Count of retried tasks
   */
  async retryFailedTasks(mission, tasks) {
    let retried = 0;

    const failedTasks = tasks.filter(t => t.status === TaskStatus.FAILED);

    for (const task of failedTasks) {
      // Check circuit breaker before retrying
      const circuitBreaker = await this.stateStore.getCircuitBreaker(mission.id);
      
      if (circuitBreaker?.tripped) {
        // Don't retry, circuit is open
        continue;
      }

      // Reset task to ready for retry
      await this.stateStore.updateTask(task.id, {
        status: TaskStatus.READY,
        assignedAgent: null,
        blockedReason: null
      });

      retried++;
    }

    return retried;
  }

  /**
   * Mark mission as needing human decision
   * 
   * @param {Object} mission - Mission
   */
  async requestHumanDecision(mission) {
    await this.stateStore.updateMission(mission.id, {
      status: MissionStatus.NEEDS_REVIEW,
      blockedReason: 'Session resumed but state unclear. Human review required.'
    });
  }

  /**
   * Get the last active task for a mission
   * 
   * @param {Object} mission - Mission
   * @returns {Object|null} Last active task
   */
  async getLastActiveTask(mission) {
    const state = await this.stateStore.getState();
    const tasks = (state.tasks || [])
      .filter(t => t.missionId === mission.id)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Find most recent non-complete task
    return tasks.find(t => 
      t.status !== TaskStatus.COMPLETE && 
      t.status !== TaskStatus.FAILED
    ) || null;
  }

  /**
   * Get the last active agent for a mission
   * 
   * @param {Object} mission - Mission
   * @returns {Object|null} Last active agent
   */
  async getLastActiveAgent(mission) {
    const state = await this.stateStore.getState();
    const agents = (state.agents || [])
      .filter(a => a.missionId === mission.id)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Find most recent running/stale agent
    return agents.find(a => 
      a.status === AgentStatus.RUNNING || 
      a.status === AgentStatus.STALE
    ) || null;
  }

  /**
   * Get resume log for debugging
   * @returns {Array}
   */
  getResumeLog() {
    return [...this.resumeLog];
  }

  /**
   * Clear resume log
   */
  clearResumeLog() {
    this.resumeLog = [];
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a resume session manager
 * 
 * @param {Object} stateStore - StateStore instance
 * @returns {SessionResumeManager}
 */
export function createSessionResumeManager(stateStore) {
  return new SessionResumeManager(stateStore);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  ResumePolicy,
  SessionResumeManager,
  createSessionResumeManager
};
