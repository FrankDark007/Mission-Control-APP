/**
 * Mission Control V8 StateStore Additions
 * 
 * PURPOSE: Methods to add to existing StateStore.js for V8 functionality.
 * This file contains ADDITIONS ONLY - merge these into your existing StateStore.js
 * 
 * V8 ADDITIONS:
 * - createMissionBootstrap() - Creates bootstrap artifact on mission creation
 * - recordExecutionViolation() - Persists violation artifacts
 * - resumeSession() - Handles crash recovery
 * - getMissionWithAuthority() - Gets mission with execution context
 * 
 * @module state/StateStore (V8 Additions)
 */

import { SessionResumeManager } from './resumeSession.js';
import { 
  ArtifactTypes, 
  createBootstrapPayload, 
  createViolationPayload 
} from './ArtifactTypes.js';
import { 
  ExecutionAuthority, 
  ExecutionMode,
  generateArtifactId 
} from './schema.js';

// =============================================================================
// V8 METHODS TO ADD TO StateStore CLASS
// =============================================================================

/**
 * ADD THESE METHODS TO YOUR EXISTING StateStore CLASS
 */

const V8StateStoreMethods = {
  
  /**
   * Initialize V8 components
   * Call this in constructor after existing initialization
   */
  initV8() {
    this.resumeManager = new SessionResumeManager(this);
    this.executionViolations = [];
  },

  /**
   * V8: Create mission with bootstrap artifact
   * REPLACES or WRAPS existing createMission
   * 
   * @param {Object} data - Mission data
   * @returns {Object} Created mission with bootstrap
   */
  async createMissionWithBootstrap(data) {
    // Set V8 defaults
    const missionData = {
      ...data,
      executionAuthority: data.executionAuthority || ExecutionAuthority.CLAUDE_CODE,
      executionMode: data.executionMode || ExecutionMode.RECIPE_ONLY
    };

    // Create mission using existing method
    const mission = await this.createMission(missionData);

    // Create bootstrap artifact
    const bootstrapPayload = createBootstrapPayload(mission);
    const bootstrapArtifact = await this.createArtifact({
      missionId: mission.id,
      type: ArtifactTypes.MISSION_BOOTSTRAP,
      label: `Bootstrap: ${mission.name}`,
      payload: bootstrapPayload,
      provenance: {
        producer: 'system',
        agentId: null,
        worktree: null,
        commitHash: null
      }
    });

    // Update mission with bootstrap reference
    await this.updateMission(mission.id, {
      bootstrapArtifactId: bootstrapArtifact.id
    });

    return {
      ...mission,
      bootstrapArtifactId: bootstrapArtifact.id
    };
  },

  /**
   * V8: Record an execution violation
   * Creates immutable artifact and optionally blocks task
   * 
   * @param {Object} violation - Violation details
   * @returns {Object} Created artifact
   */
  async recordExecutionViolation(violation) {
    const payload = createViolationPayload(violation);

    const artifact = await this.createArtifact({
      missionId: violation.missionId,
      taskId: violation.taskId || null,
      type: ArtifactTypes.EXECUTION_VIOLATION,
      label: `Violation: ${violation.attemptedAction}`,
      payload,
      provenance: {
        producer: 'system',
        agentId: null,
        worktree: null,
        commitHash: null
      }
    });

    // Track violation
    this.executionViolations.push({
      id: artifact.id,
      missionId: violation.missionId,
      timestamp: new Date().toISOString()
    });

    // Block task if specified
    if (violation.taskId && violation.blockTask !== false) {
      await this.updateTask(violation.taskId, {
        status: 'blocked',
        blockedReason: `EXECUTION_VIOLATION: ${violation.attemptedAction}`
      });
    }

    return artifact;
  },

  /**
   * V8: Resume session after disconnect/crash
   * 
   * @returns {Object} Resume summary
   */
  async resumeSession() {
    return this.resumeManager.resumeSession();
  },

  /**
   * V8: Get mission with execution authority context
   * 
   * @param {string} missionId - Mission ID
   * @returns {Object} Mission with authority info
   */
  async getMissionWithAuthority(missionId) {
    const mission = await this.getMission(missionId);
    if (!mission) return null;

    const bootstrap = mission.bootstrapArtifactId
      ? await this.getArtifact(mission.bootstrapArtifactId)
      : null;

    return {
      ...mission,
      authorityContext: {
        executionAuthority: mission.executionAuthority || ExecutionAuthority.CLAUDE_CODE,
        executionMode: mission.executionMode || ExecutionMode.RECIPE_ONLY,
        delegationRequired: mission.executionAuthority === ExecutionAuthority.CLAUDE_CODE,
        bootstrap: bootstrap?.payload || null
      }
    };
  },

  /**
   * V8: Check if caller can execute for mission
   * 
   * @param {string} missionId - Mission ID
   * @param {string} caller - 'DESKTOP' or 'CLAUDE_CODE'
   * @returns {Object} { allowed: boolean, reason?: string }
   */
  async checkExecutionPermission(missionId, caller) {
    const mission = await this.getMission(missionId);
    if (!mission) {
      return { allowed: false, reason: 'Mission not found' };
    }

    const authority = mission.executionAuthority || ExecutionAuthority.CLAUDE_CODE;

    if (authority === ExecutionAuthority.CLAUDE_CODE && caller === 'DESKTOP') {
      return {
        allowed: false,
        reason: 'Mission requires CLAUDE_CODE execution authority'
      };
    }

    return { allowed: true };
  },

  /**
   * V8: Get all execution violations for a mission
   * 
   * @param {string} missionId - Mission ID
   * @returns {Array} Violation artifacts
   */
  async getExecutionViolations(missionId) {
    const artifacts = await this.listArtifacts({ missionId });
    return artifacts.filter(a => a.type === ArtifactTypes.EXECUTION_VIOLATION);
  },

  /**
   * V8: Get last active task for resume
   * 
   * @param {string} missionId - Mission ID
   * @returns {Object|null} Last active task
   */
  async getLastActiveTask(missionId) {
    const mission = await this.getMission(missionId);
    if (!mission) return null;
    return this.resumeManager.getLastActiveTask(mission);
  },

  /**
   * V8: Get last active agent for resume
   * 
   * @param {string} missionId - Mission ID
   * @returns {Object|null} Last active agent
   */
  async getLastActiveAgent(missionId) {
    const mission = await this.getMission(missionId);
    if (!mission) return null;
    return this.resumeManager.getLastActiveAgent(mission);
  },

  /**
   * V8: Get violation count
   * @returns {number}
   */
  getViolationCount() {
    return this.executionViolations.length;
  }
};

// =============================================================================
// INTEGRATION INSTRUCTIONS
// =============================================================================

/**
 * HOW TO INTEGRATE INTO EXISTING StateStore.js:
 * 
 * 1. Add imports at top:
 *    import { SessionResumeManager } from './resumeSession.js';
 *    import { createBootstrapPayload, createViolationPayload } from './ArtifactTypes.js';
 *    import { ExecutionAuthority, ExecutionMode } from './schema.js';
 * 
 * 2. In constructor, add:
 *    this.initV8();
 * 
 * 3. Add all methods from V8StateStoreMethods to your StateStore class
 * 
 * 4. Update createMission to call createMissionWithBootstrap instead,
 *    or add a flag: createMission(data, { withBootstrap: true })
 * 
 * 5. In updateMission, add validation check:
 *    if (patch.status === 'complete') {
 *      const permission = await this.checkExecutionPermission(missionId, context.caller);
 *      if (!permission.allowed) throw new ExecutionAuthorityError(...);
 *    }
 */

// =============================================================================
// EXPORTS
// =============================================================================

export { V8StateStoreMethods };

export default V8StateStoreMethods;
