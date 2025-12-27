/**
 * Mission Control V8 Mission Validator
 * 
 * PURPOSE: Enforce mission contracts and V8 execution authority.
 * 
 * V8 ADDITIONS:
 * - Validates executionAuthority field
 * - Validates executionMode field
 * - Ensures bootstrap artifact exists before execution
 * - Enforces delegation requirements
 * 
 * @module state/validators/missionValidator
 */

import { 
  MissionSchema,
  MissionClass,
  MissionStatus,
  RiskLevel,
  ExecutionAuthority,
  ExecutionMode,
  CircuitBreakerLimits
} from '../schema.js';
import { ArtifactTypes } from '../ArtifactTypes.js';

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class ValidationError extends Error {
  constructor(field, message, value) {
    super(`Validation failed for '${field}': ${message}`);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.field = field;
    this.invalidValue = value;
  }
}

export class MissingArtifactError extends Error {
  constructor(missionId, missingArtifacts) {
    super(`Mission ${missionId} cannot complete: missing artifacts [${missingArtifacts.join(', ')}]`);
    this.name = 'MissingArtifactError';
    this.code = 'COMPLETION_BLOCKED';
    this.missionId = missionId;
    this.missingArtifacts = missingArtifacts;
  }
}

export class CircuitBreakerError extends Error {
  constructor(missionId, reason) {
    super(`Mission ${missionId} is locked: ${reason}`);
    this.name = 'CircuitBreakerError';
    this.code = 'CIRCUIT_BREAKER_TRIPPED';
    this.missionId = missionId;
    this.reason = reason;
  }
}

export class ExecutionAuthorityError extends Error {
  constructor(missionId, message) {
    super(`Execution authority violation for mission ${missionId}: ${message}`);
    this.name = 'ExecutionAuthorityError';
    this.code = 'EXECUTION_AUTHORITY_VIOLATION';
    this.missionId = missionId;
  }
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate a mission object
 * 
 * @param {Object} mission - Mission to validate
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateMission(mission, options = {}) {
  const errors = [];
  const isCreate = options.isCreate !== false;

  // Required fields
  if (isCreate) {
    if (!mission.name || typeof mission.name !== 'string') {
      errors.push('name is required and must be a string');
    }
    if (!mission.missionClass || !Object.values(MissionClass).includes(mission.missionClass)) {
      errors.push(`missionClass must be one of: ${Object.values(MissionClass).join(', ')}`);
    }
    if (!Array.isArray(mission.requiredArtifacts)) {
      errors.push('requiredArtifacts must be an array');
    }
    if (!mission.verification || !Array.isArray(mission.verification.checks)) {
      errors.push('verification.checks must be an array');
    }
  }

  // Status validation
  if (mission.status && !Object.values(MissionStatus).includes(mission.status)) {
    errors.push(`status must be one of: ${Object.values(MissionStatus).join(', ')}`);
  }

  // Risk level validation
  if (mission.riskLevel && !Object.values(RiskLevel).includes(mission.riskLevel)) {
    errors.push(`riskLevel must be one of: ${Object.values(RiskLevel).join(', ')}`);
  }

  // V8: Execution authority validation
  if (mission.executionAuthority !== undefined) {
    if (!Object.values(ExecutionAuthority).includes(mission.executionAuthority)) {
      errors.push(`executionAuthority must be one of: ${Object.values(ExecutionAuthority).join(', ')}`);
    }
  }

  // V8: Execution mode validation
  if (mission.executionMode !== undefined) {
    if (!Object.values(ExecutionMode).includes(mission.executionMode)) {
      errors.push(`executionMode must be one of: ${Object.values(ExecutionMode).join(', ')}`);
    }
  }

  // V8: Default execution authority for new missions
  if (isCreate && !mission.executionAuthority) {
    mission.executionAuthority = ExecutionAuthority.CLAUDE_CODE;
  }

  // V8: Default execution mode for new missions
  if (isCreate && !mission.executionMode) {
    mission.executionMode = ExecutionMode.RECIPE_ONLY;
  }

  // Cost limits validation
  if (mission.maxEstimatedCost !== undefined && mission.maxEstimatedCost !== null) {
    if (typeof mission.maxEstimatedCost !== 'number' || mission.maxEstimatedCost < 0) {
      errors.push('maxEstimatedCost must be a non-negative number');
    }
  }

  if (mission.maxCostPerHour !== undefined && mission.maxCostPerHour !== null) {
    if (typeof mission.maxCostPerHour !== 'number' || mission.maxCostPerHour < 0) {
      errors.push('maxCostPerHour must be a non-negative number');
    }
  }

  // Allowed tools validation
  if (mission.allowedTools !== undefined && mission.allowedTools !== null) {
    if (!Array.isArray(mission.allowedTools)) {
      errors.push('allowedTools must be an array');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate mission status transition
 * 
 * @param {string} from - Current status
 * @param {string} to - Target status
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function validateStatusTransition(from, to) {
  const validTransitions = {
    [MissionStatus.QUEUED]: [MissionStatus.RUNNING, MissionStatus.BLOCKED, MissionStatus.FAILED],
    [MissionStatus.RUNNING]: [MissionStatus.BLOCKED, MissionStatus.NEEDS_REVIEW, MissionStatus.COMPLETE, MissionStatus.FAILED, MissionStatus.LOCKED],
    [MissionStatus.BLOCKED]: [MissionStatus.RUNNING, MissionStatus.NEEDS_REVIEW, MissionStatus.FAILED, MissionStatus.LOCKED],
    [MissionStatus.NEEDS_REVIEW]: [MissionStatus.RUNNING, MissionStatus.COMPLETE, MissionStatus.FAILED, MissionStatus.LOCKED],
    [MissionStatus.COMPLETE]: [], // Terminal state
    [MissionStatus.FAILED]: [MissionStatus.QUEUED], // Can retry
    [MissionStatus.LOCKED]: [MissionStatus.BLOCKED, MissionStatus.QUEUED] // Requires unlock
  };

  const allowed = validTransitions[from] || [];

  if (!allowed.includes(to)) {
    return {
      valid: false,
      reason: `Cannot transition from '${from}' to '${to}'. Allowed: [${allowed.join(', ')}]`
    };
  }

  return { valid: true };
}

/**
 * Validate artifact gate for mission completion
 * 
 * @param {Object} mission - Mission
 * @param {Array} artifacts - Mission's artifacts
 * @returns {Object} { valid: boolean, missingArtifacts: string[] }
 */
export function validateArtifactGate(mission, artifacts) {
  // Exploration class tolerates missing artifacts
  if (mission.missionClass === MissionClass.EXPLORATION) {
    return { valid: true, missingArtifacts: [] };
  }

  const requiredTypes = mission.requiredArtifacts || [];
  const presentTypes = new Set(artifacts.map(a => a.type));
  
  const missing = requiredTypes.filter(type => !presentTypes.has(type));

  return {
    valid: missing.length === 0,
    missingArtifacts: missing
  };
}

/**
 * Validate completion attempt
 * Enforces all gates
 * 
 * @param {Object} mission - Mission attempting completion
 * @param {Array} artifacts - Mission's artifacts
 * @param {Object} circuitBreaker - Circuit breaker state
 * @returns {Object} { allowed: boolean, reason?: string, error?: Error }
 */
export function validateCompletion(mission, artifacts, circuitBreaker) {
  // 1. Check circuit breaker
  if (circuitBreaker?.tripped) {
    return {
      allowed: false,
      reason: `Circuit breaker tripped: ${circuitBreaker.trippedReason}`,
      error: new CircuitBreakerError(mission.id, circuitBreaker.trippedReason)
    };
  }

  // 2. Check artifact gate
  const artifactCheck = validateArtifactGate(mission, artifacts);
  if (!artifactCheck.valid) {
    return {
      allowed: false,
      reason: `Missing required artifacts: ${artifactCheck.missingArtifacts.join(', ')}`,
      error: new MissingArtifactError(mission.id, artifactCheck.missingArtifacts)
    };
  }

  // 3. Destructive missions never auto-complete
  if (mission.missionClass === MissionClass.DESTRUCTIVE) {
    const hasApproval = artifacts.some(a => a.type === ArtifactTypes.APPROVAL_RECORD);
    if (!hasApproval) {
      return {
        allowed: false,
        reason: 'Destructive missions require approval_record artifact',
        error: new MissingArtifactError(mission.id, ['approval_record'])
      };
    }
  }

  // 4. V8: Check bootstrap artifact exists
  if (mission.executionAuthority === ExecutionAuthority.CLAUDE_CODE) {
    const hasBootstrap = artifacts.some(a => a.type === ArtifactTypes.MISSION_BOOTSTRAP);
    if (!hasBootstrap) {
      return {
        allowed: false,
        reason: 'Mission with CLAUDE_CODE authority requires mission_bootstrap artifact',
        error: new ExecutionAuthorityError(mission.id, 'Missing bootstrap artifact')
      };
    }
  }

  return { allowed: true };
}

/**
 * V8: Validate execution authority for a tool call
 * 
 * @param {Object} mission - Mission context
 * @param {string} tool - Tool being called
 * @param {string} caller - Who is calling ('DESKTOP' or 'CLAUDE_CODE')
 * @returns {Object} { allowed: boolean, reason?: string }
 */
export function validateExecutionAuthority(mission, tool, caller) {
  if (!mission) {
    return { allowed: true }; // No mission context, allow
  }

  const authority = mission.executionAuthority || ExecutionAuthority.CLAUDE_CODE;

  // If mission requires CLAUDE_CODE and caller is DESKTOP
  if (authority === ExecutionAuthority.CLAUDE_CODE && caller === 'DESKTOP') {
    // Check if tool is execution-related
    const executionTools = [
      'artifact.create',
      'task.update_status',
      'selfHeal.apply'
    ];

    if (executionTools.includes(tool)) {
      return {
        allowed: false,
        reason: `Mission requires CLAUDE_CODE authority. Tool '${tool}' must be called via spawn_agent.`
      };
    }
  }

  return { allowed: true };
}

/**
 * V8: Validate execution mode for spawn tools
 * 
 * @param {Object} mission - Mission context
 * @param {string} tool - Spawn tool being called
 * @returns {Object} { allowed: boolean, reason?: string }
 */
export function validateExecutionMode(mission, tool) {
  if (!mission) {
    return { allowed: true };
  }

  const mode = mission.executionMode || ExecutionMode.RECIPE_ONLY;

  if (mode === ExecutionMode.RECIPE_ONLY && tool === 'agent.spawn_agent_immediate') {
    return {
      allowed: false,
      reason: 'Mission is in RECIPE_ONLY mode. Use spawn_agent instead of spawn_agent_immediate.'
    };
  }

  if (mode === ExecutionMode.IMMEDIATE_ONLY && tool === 'agent.spawn_agent') {
    return {
      allowed: false,
      reason: 'Mission is in IMMEDIATE_ONLY mode. Use spawn_agent_immediate instead of spawn_agent.'
    };
  }

  return { allowed: true };
}

/**
 * Check circuit breaker limits
 * 
 * @param {Object} circuitBreaker - Current circuit breaker state
 * @param {string} action - Action being attempted
 * @returns {Object} { allowed: boolean, reason?: string, shouldTrip: boolean }
 */
export function checkCircuitBreaker(circuitBreaker, action) {
  if (!circuitBreaker) {
    return { allowed: true, shouldTrip: false };
  }

  // Already tripped
  if (circuitBreaker.tripped) {
    return {
      allowed: false,
      reason: circuitBreaker.trippedReason,
      shouldTrip: false
    };
  }

  // Check failure count
  if (circuitBreaker.failureCount >= CircuitBreakerLimits.MAX_FAILURES_PER_MISSION) {
    return {
      allowed: false,
      reason: 'MAX_FAILURES_EXCEEDED',
      shouldTrip: true
    };
  }

  // Check immediate exec count for spawn_agent_immediate
  if (action === 'spawn_agent_immediate') {
    if (circuitBreaker.immediateExecCount >= CircuitBreakerLimits.MAX_IMMEDIATE_EXECS_PER_MISSION) {
      return {
        allowed: false,
        reason: 'MAX_IMMEDIATE_EXECS_EXCEEDED',
        shouldTrip: true
      };
    }
  }

  return { allowed: true, shouldTrip: false };
}

/**
 * Validate mission contract on creation
 * Ensures all required contract fields are present
 * 
 * @param {Object} mission - Mission being created
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateMissionContract(mission) {
  const errors = [];

  // Required contract fields
  if (!Array.isArray(mission.requiredArtifacts)) {
    errors.push('requiredArtifacts is required');
  }

  if (!mission.verification || !Array.isArray(mission.verification.checks)) {
    errors.push('verification.checks is required');
  }

  if (!mission.riskLevel) {
    errors.push('riskLevel is required');
  }

  if (!mission.completionGate) {
    errors.push('completionGate is required (should be "artifacts")');
  }

  // V8: Execution authority contract
  if (!mission.executionAuthority) {
    errors.push('executionAuthority is required (CLAUDE_CODE or DESKTOP)');
  }

  if (!mission.executionMode) {
    errors.push('executionMode is required (RECIPE_ONLY or IMMEDIATE_ONLY)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Error classes
  ValidationError,
  MissingArtifactError,
  CircuitBreakerError,
  ExecutionAuthorityError,
  
  // Validation functions
  validateMission,
  validateStatusTransition,
  validateArtifactGate,
  validateCompletion,
  validateExecutionAuthority,
  validateExecutionMode,
  checkCircuitBreaker,
  validateMissionContract
};
