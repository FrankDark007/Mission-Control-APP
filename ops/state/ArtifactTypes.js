/**
 * Mission Control V8 Artifact Types
 * 
 * V8 CHANGES:
 * - Added MISSION_BOOTSTRAP: Immutable record of execution policy
 * - Added EXECUTION_VIOLATION: Records attempts to bypass delegation
 * 
 * @module state/ArtifactTypes
 */

// =============================================================================
// ARTIFACT MODES
// =============================================================================

/**
 * Artifact mutability modes
 */
export const ArtifactModes = Object.freeze({
  IMMUTABLE: 'immutable',      // Cannot modify after creation
  APPEND_ONLY: 'append-only'   // Can add content, never overwrite
});

// =============================================================================
// CORE ARTIFACT TYPES (V7)
// =============================================================================

/**
 * Core verification and build artifacts
 */
export const CoreArtifactTypes = Object.freeze({
  GIT_DIFF: 'git_diff',
  GIT_COMMIT: 'git_commit',
  BUILD_LOG: 'build_log',
  RUNTIME_LOG: 'runtime_log',
  LIGHTHOUSE_REPORT: 'lighthouse_report',
  CONSOLE_ERRORS: 'console_errors',
  SCREENSHOT_DESKTOP: 'screenshot_desktop',
  SCREENSHOT_MOBILE: 'screenshot_mobile'
});

// =============================================================================
// AUTONOMY/SAFETY ARTIFACT TYPES (V7)
// =============================================================================

/**
 * Safety, approval, and autonomy control artifacts
 */
export const SafetyArtifactTypes = Object.freeze({
  PLAN: 'plan',
  VERIFICATION_REPORT: 'verification_report',
  FAILURE_REPORT: 'failure_report',
  SELF_HEAL_PROPOSAL: 'self_heal_proposal',
  APPROVAL_RECORD: 'approval_record',
  AGENT_RECIPE: 'agent_recipe',
  EXIT_STATUS: 'exit_status',
  SIGNAL_REPORT: 'signal_report',
  CIRCUIT_BREAKER_TRIP: 'circuit_breaker_trip',
  POLICY_MATCH_REPORT: 'policy_match_report',
  PRE_FLIGHT_SNAPSHOT: 'pre_flight_snapshot',
  CHANGE_PLAN: 'change_plan',
  COST_ESTIMATE: 'cost_estimate',
  RATE_LIMIT_EVENT: 'rate_limit_event'
});

// =============================================================================
// RANKINGS ARTIFACT TYPES (V7)
// =============================================================================

/**
 * SEO and rankings tracking artifacts
 */
export const RankingsArtifactTypes = Object.freeze({
  VISIBILITY_MAP: 'visibility_map',
  LOCAL_PACK_SNAPSHOT: 'local_pack_snapshot',
  ORGANIC_SERP_SNAPSHOT: 'organic_serp_snapshot',
  RANK_DELTA_REPORT: 'rank_delta_report',
  SCAN_METADATA: 'scan_metadata',
  COMPETITOR_ANALYSIS: 'competitor_analysis'
});

// =============================================================================
// V8: EXECUTION AUTHORITY ARTIFACT TYPES
// =============================================================================

/**
 * V8 Execution Authority artifacts
 * These control and track delegation enforcement
 */
export const ExecutionArtifactTypes = Object.freeze({
  /**
   * MISSION_BOOTSTRAP
   * 
   * Created once per mission at startup.
   * Immutable record of execution policy.
   * 
   * Payload structure:
   * {
   *   executionAuthority: 'CLAUDE_CODE' | 'DESKTOP',
   *   executionMode: 'RECIPE_ONLY' | 'IMMEDIATE_ONLY',
   *   resumePolicy: 'continue_from_last_task' | 'restart',
   *   delegationRequired: boolean,
   *   createdAt: ISOString,
   *   createdBy: 'system'
   * }
   */
  MISSION_BOOTSTRAP: 'mission_bootstrap',
  
  /**
   * EXECUTION_VIOLATION
   * 
   * Created when Claude Desktop attempts inline execution.
   * Immutable evidence of policy violation.
   * 
   * Payload structure:
   * {
   *   attemptedAction: string,
   *   attemptedBy: 'DESKTOP',
   *   requiredAuthority: 'CLAUDE_CODE',
   *   timestamp: ISOString,
   *   blocked: true,
   *   taskId: string | null,
   *   toolAttempted: string | null,
   *   errorCode: 'EXECUTION_VIOLATION'
   * }
   */
  EXECUTION_VIOLATION: 'execution_violation'
});

// =============================================================================
// COMBINED ARTIFACT TYPES
// =============================================================================

/**
 * All artifact types combined
 */
export const ArtifactTypes = Object.freeze({
  ...CoreArtifactTypes,
  ...SafetyArtifactTypes,
  ...RankingsArtifactTypes,
  ...ExecutionArtifactTypes
});

// =============================================================================
// ARTIFACT MODE MAPPING
// =============================================================================

/**
 * Maps artifact types to their default mutability mode
 */
export const ArtifactModeDefaults = Object.freeze({
  // Core - mostly immutable
  [ArtifactTypes.GIT_DIFF]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.GIT_COMMIT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.BUILD_LOG]: ArtifactModes.APPEND_ONLY,
  [ArtifactTypes.RUNTIME_LOG]: ArtifactModes.APPEND_ONLY,
  [ArtifactTypes.LIGHTHOUSE_REPORT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.CONSOLE_ERRORS]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.SCREENSHOT_DESKTOP]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.SCREENSHOT_MOBILE]: ArtifactModes.IMMUTABLE,
  
  // Safety - all immutable
  [ArtifactTypes.PLAN]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.VERIFICATION_REPORT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.FAILURE_REPORT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.SELF_HEAL_PROPOSAL]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.APPROVAL_RECORD]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.AGENT_RECIPE]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.EXIT_STATUS]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.SIGNAL_REPORT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.CIRCUIT_BREAKER_TRIP]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.POLICY_MATCH_REPORT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.PRE_FLIGHT_SNAPSHOT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.CHANGE_PLAN]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.COST_ESTIMATE]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.RATE_LIMIT_EVENT]: ArtifactModes.IMMUTABLE,
  
  // Rankings - all immutable
  [ArtifactTypes.VISIBILITY_MAP]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.LOCAL_PACK_SNAPSHOT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.ORGANIC_SERP_SNAPSHOT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.RANK_DELTA_REPORT]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.SCAN_METADATA]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.COMPETITOR_ANALYSIS]: ArtifactModes.IMMUTABLE,
  
  // V8 Execution - all immutable (critical for audit trail)
  [ArtifactTypes.MISSION_BOOTSTRAP]: ArtifactModes.IMMUTABLE,
  [ArtifactTypes.EXECUTION_VIOLATION]: ArtifactModes.IMMUTABLE
});

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Check if a string is a valid artifact type
 * @param {string} type - Type to validate
 * @returns {boolean}
 */
export function isValidArtifactType(type) {
  return Object.values(ArtifactTypes).includes(type);
}

/**
 * Get the default mode for an artifact type
 * @param {string} type - Artifact type
 * @returns {string} Mode (immutable or append-only)
 */
export function getDefaultArtifactMode(type) {
  return ArtifactModeDefaults[type] || ArtifactModes.IMMUTABLE;
}

/**
 * Check if an artifact type is V8 execution-related
 * @param {string} type - Artifact type
 * @returns {boolean}
 */
export function isExecutionArtifact(type) {
  return Object.values(ExecutionArtifactTypes).includes(type);
}

/**
 * Check if an artifact type is safety-related
 * @param {string} type - Artifact type
 * @returns {boolean}
 */
export function isSafetyArtifact(type) {
  return Object.values(SafetyArtifactTypes).includes(type);
}

// =============================================================================
// V8: BOOTSTRAP ARTIFACT FACTORY
// =============================================================================

/**
 * Create a mission bootstrap artifact payload
 * V8: Called once per mission at creation
 * 
 * @param {Object} mission - Mission object
 * @returns {Object} Bootstrap payload
 */
export function createBootstrapPayload(mission) {
  return {
    executionAuthority: mission.executionAuthority || 'CLAUDE_CODE',
    executionMode: mission.executionMode || 'RECIPE_ONLY',
    resumePolicy: 'continue_from_last_task',
    delegationRequired: mission.executionAuthority === 'CLAUDE_CODE',
    missionId: mission.id,
    missionClass: mission.missionClass,
    createdAt: new Date().toISOString(),
    createdBy: 'system'
  };
}

/**
 * Create an execution violation artifact payload
 * V8: Called when delegation is bypassed
 * 
 * @param {Object} violation - Violation details
 * @returns {Object} Violation payload
 */
export function createViolationPayload(violation) {
  return {
    attemptedAction: violation.attemptedAction,
    attemptedBy: violation.attemptedBy || 'DESKTOP',
    requiredAuthority: violation.requiredAuthority || 'CLAUDE_CODE',
    timestamp: new Date().toISOString(),
    blocked: true,
    taskId: violation.taskId || null,
    toolAttempted: violation.toolAttempted || null,
    errorCode: 'EXECUTION_VIOLATION',
    missionId: violation.missionId
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  ArtifactModes,
  ArtifactTypes,
  CoreArtifactTypes,
  SafetyArtifactTypes,
  RankingsArtifactTypes,
  ExecutionArtifactTypes,
  ArtifactModeDefaults,
  isValidArtifactType,
  getDefaultArtifactMode,
  isExecutionArtifact,
  isSafetyArtifact,
  createBootstrapPayload,
  createViolationPayload
};
