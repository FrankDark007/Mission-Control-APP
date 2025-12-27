/**
 * Mission Control V8 Schema
 * 
 * V8 CHANGES:
 * - Added executionAuthority: 'CLAUDE_CODE' | 'DESKTOP'
 * - Added executionMode: 'RECIPE_ONLY' | 'IMMEDIATE_ONLY'
 * - Added bootstrapArtifactId for execution policy tracking
 * 
 * @module state/schema
 */

import { ArtifactTypes, ArtifactModes } from './ArtifactTypes.js';

// =============================================================================
// ENUMS
// =============================================================================

export const MissionClass = Object.freeze({
  EXPLORATION: 'exploration',
  IMPLEMENTATION: 'implementation',
  MAINTENANCE: 'maintenance',
  DESTRUCTIVE: 'destructive',
  CONTINUOUS: 'continuous'
});

export const MissionStatus = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  BLOCKED: 'blocked',
  NEEDS_REVIEW: 'needs_review',
  COMPLETE: 'complete',
  FAILED: 'failed',
  LOCKED: 'locked'
});

export const TaskStatus = Object.freeze({
  PENDING: 'pending',
  READY: 'ready',
  RUNNING: 'running',
  COMPLETE: 'complete',
  FAILED: 'failed',
  BLOCKED: 'blocked'
});

export const TaskType = Object.freeze({
  WORK: 'work',
  VERIFICATION: 'verification',
  FINALIZATION: 'finalization'
});

export const RiskLevel = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
});

export const TriggerSource = Object.freeze({
  MANUAL: 'manual',
  WATCHDOG: 'watchdog',
  SCHEDULED: 'scheduled'
});

export const ProducerType = Object.freeze({
  AGENT: 'agent',
  WATCHDOG: 'watchdog',
  SYSTEM: 'system',
  HUMAN: 'human'
});

export const AgentStatus = Object.freeze({
  SPAWNING: 'spawning',
  RUNNING: 'running',
  STALE: 'stale',
  DEAD: 'dead',
  COMPLETE: 'complete',
  FAILED: 'failed'
});

// =============================================================================
// V8: EXECUTION AUTHORITY ENUMS
// =============================================================================

/**
 * Execution Authority - WHO can execute
 * V8 Core Addition
 */
export const ExecutionAuthority = Object.freeze({
  CLAUDE_CODE: 'CLAUDE_CODE',   // Only Claude Code can execute
  DESKTOP: 'DESKTOP'            // Claude Desktop can execute (legacy, discouraged)
});

/**
 * Execution Mode - HOW execution happens
 * V8 Core Addition
 */
export const ExecutionMode = Object.freeze({
  RECIPE_ONLY: 'RECIPE_ONLY',       // spawn_agent returns recipe, human executes
  IMMEDIATE_ONLY: 'IMMEDIATE_ONLY'  // spawn_agent_immediate auto-executes
});

// =============================================================================
// TOOL PERMISSION MATRIX (Defaults by missionClass)
// =============================================================================

export const DefaultAllowedTools = Object.freeze({
  [MissionClass.EXPLORATION]: [
    '*.list', '*.get', 'ranking.*', 'gsc.inspect_url', 'provider.health'
  ],
  [MissionClass.IMPLEMENTATION]: [
    '*.list', '*.get', 'spawn_agent', 'task.*', 'mission.*', 'artifact.*',
    'ranking.*', 'provider.health'
  ],
  [MissionClass.MAINTENANCE]: [
    '*.list', '*.get', 'spawn_agent', 'task.*', 'mission.*', 'artifact.*',
    'approval.*', 'ranking.*', 'provider.health'
  ],
  [MissionClass.DESTRUCTIVE]: [
    '*'  // All tools, but never auto-approve
  ],
  [MissionClass.CONTINUOUS]: [
    'signal_report', 'append_log', 'ranking.*', 'provider.health',
    'watchdog.*', '*.list', '*.get'
  ]
});

// =============================================================================
// V8: DESKTOP ALLOWED TOOLS (Control Plane Only)
// =============================================================================

/**
 * Tools Claude Desktop is allowed to call
 * V8: Desktop is demoted to control plane only
 */
export const DesktopAllowedTools = Object.freeze([
  // Mission control plane
  'mission.create',
  'mission.get',
  'mission.list',
  'mission.update_status',
  
  // Approval workflow
  'approval.request',
  'approval.decide',
  'approval.list_pending',
  'approval.get',
  
  // State visibility (read-only)
  'state.get_snapshot',
  'state.get_mission_summary',
  'state.is_armed',
  'state.get_system_health',
  
  // Agent delegation only
  'agent.spawn_agent',
  'agent.spawn_agent_immediate',
  'agent.get',
  'agent.list',
  'agent.heartbeat',
  
  // Provider health checks
  'provider.health',
  'provider.get_rate_status'
]);

/**
 * Actions forbidden for Claude Desktop
 * V8: These trigger execution_violation artifacts
 */
export const DesktopForbiddenActions = Object.freeze([
  'INLINE_CODE_GENERATION',
  'DIRECT_FILE_WRITE',
  'COMMAND_EXECUTION',
  'ARTIFACT_CREATION_CODE_TYPE'
]);

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================

/**
 * Mission Schema
 * V8: Added executionAuthority, executionMode, bootstrapArtifactId
 */
export const MissionSchema = {
  id: { type: 'string', required: true, pattern: /^mission-\d+-[a-z0-9]+$/ },
  name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  description: { type: 'string', required: false, maxLength: 2000 },
  missionClass: { 
    type: 'string', 
    required: true, 
    enum: Object.values(MissionClass) 
  },
  status: { 
    type: 'string', 
    required: true, 
    enum: Object.values(MissionStatus),
    default: MissionStatus.QUEUED
  },
  blockedReason: { type: 'string', required: false },
  
  // Contract fields
  requiredArtifacts: { type: 'array', required: true, items: 'string' },
  verification: { 
    type: 'object', 
    required: true,
    properties: {
      checks: { type: 'array', items: 'string' }
    }
  },
  riskLevel: { 
    type: 'string', 
    required: true, 
    enum: Object.values(RiskLevel),
    default: RiskLevel.LOW
  },
  allowedTools: { type: 'array', required: false, items: 'string' },
  completionGate: { type: 'string', required: true, default: 'artifacts' },
  
  // Cost controls
  maxEstimatedCost: { type: 'number', required: false },
  maxCostPerHour: { type: 'number', required: false },
  
  // Trigger tracking
  triggerSource: { 
    type: 'string', 
    required: true, 
    enum: Object.values(TriggerSource),
    default: TriggerSource.MANUAL
  },
  
  // V8: EXECUTION AUTHORITY (MANDATORY)
  executionAuthority: {
    type: 'string',
    required: true,
    enum: Object.values(ExecutionAuthority),
    default: ExecutionAuthority.CLAUDE_CODE
  },
  
  // V8: EXECUTION MODE (MANDATORY)
  executionMode: {
    type: 'string',
    required: true,
    enum: Object.values(ExecutionMode),
    default: ExecutionMode.RECIPE_ONLY
  },
  
  // V8: Bootstrap artifact reference
  bootstrapArtifactId: { type: 'string', required: false },
  
  // Relationships
  tasks: { type: 'array', required: true, items: 'string', default: [] },
  artifacts: { type: 'array', required: true, items: 'string', default: [] },
  
  // State versioning
  _stateVersion: { type: 'number', required: true, default: 1 },
  _lastSnapshotAt: { type: 'string', required: false },
  
  // Timestamps
  createdAt: { type: 'string', required: true },
  updatedAt: { type: 'string', required: true },
  completedAt: { type: 'string', required: false }
};

/**
 * Task Schema
 */
export const TaskSchema = {
  id: { type: 'string', required: true, pattern: /^task-\d+-[a-z0-9]+$/ },
  missionId: { type: 'string', required: true },
  title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  description: { type: 'string', required: false, maxLength: 2000 },
  taskType: { 
    type: 'string', 
    required: true, 
    enum: Object.values(TaskType),
    default: TaskType.WORK
  },
  status: { 
    type: 'string', 
    required: true, 
    enum: Object.values(TaskStatus),
    default: TaskStatus.PENDING
  },
  blockedReason: { type: 'string', required: false },
  deps: { type: 'array', required: true, items: 'string', default: [] },
  requiredArtifacts: { type: 'array', required: true, items: 'string', default: [] },
  assignedAgent: { type: 'string', required: false },
  
  // State versioning
  _stateVersion: { type: 'number', required: true, default: 1 },
  
  // Timestamps
  createdAt: { type: 'string', required: true },
  updatedAt: { type: 'string', required: true }
};

/**
 * Artifact Schema
 */
export const ArtifactSchema = {
  id: { type: 'string', required: true, pattern: /^artifact-\d+-[a-z0-9]+$/ },
  missionId: { type: 'string', required: true },
  taskId: { type: 'string', required: false },
  type: { 
    type: 'string', 
    required: true,
    enum: Object.values(ArtifactTypes)
  },
  artifactMode: { 
    type: 'string', 
    required: true, 
    enum: Object.values(ArtifactModes),
    default: ArtifactModes.IMMUTABLE
  },
  label: { type: 'string', required: true, maxLength: 200 },
  payload: { type: 'object', required: false },
  files: { type: 'array', required: false, items: 'string', default: [] },
  provenance: {
    type: 'object',
    required: true,
    properties: {
      producer: { type: 'string', enum: Object.values(ProducerType) },
      agentId: { type: 'string' },
      worktree: { type: 'string' },
      commitHash: { type: 'string' }
    }
  },
  createdAt: { type: 'string', required: true }
};

/**
 * Agent Schema
 */
export const AgentSchema = {
  id: { type: 'string', required: true, pattern: /^agent-\d+-[a-z0-9]+$/ },
  missionId: { type: 'string', required: true },
  taskId: { type: 'string', required: false },
  status: { 
    type: 'string', 
    required: true, 
    enum: Object.values(AgentStatus),
    default: AgentStatus.SPAWNING
  },
  worktree: { type: 'string', required: false },
  pid: { type: 'number', required: false },
  lastHeartbeat: { type: 'string', required: false },
  exitCode: { type: 'number', required: false },
  error: { type: 'string', required: false },
  
  // State versioning
  _stateVersion: { type: 'number', required: true, default: 1 },
  
  // Timestamps
  createdAt: { type: 'string', required: true },
  updatedAt: { type: 'string', required: true }
};

/**
 * Circuit Breaker State Schema
 */
export const CircuitBreakerSchema = {
  missionId: { type: 'string', required: true },
  failureCount: { type: 'number', required: true, default: 0 },
  immediateExecCount: { type: 'number', required: true, default: 0 },
  tripped: { type: 'boolean', required: true, default: false },
  trippedAt: { type: 'string', required: false },
  trippedReason: { type: 'string', required: false },
  lockedUntil: { type: 'string', required: false }
};

// =============================================================================
// V8: EXECUTION VIOLATION TRACKING
// =============================================================================

/**
 * Execution Violation Record
 * V8: Tracks attempts to bypass delegation
 */
export const ExecutionViolationSchema = {
  id: { type: 'string', required: true },
  missionId: { type: 'string', required: true },
  taskId: { type: 'string', required: false },
  attemptedAction: { type: 'string', required: true },
  attemptedBy: { type: 'string', required: true },  // 'DESKTOP' or 'UNKNOWN'
  requiredAuthority: { type: 'string', required: true },
  timestamp: { type: 'string', required: true },
  blocked: { type: 'boolean', required: true, default: true },
  artifactId: { type: 'string', required: false }  // Reference to violation artifact
};

// =============================================================================
// CIRCUIT BREAKER LIMITS
// =============================================================================

export const CircuitBreakerLimits = Object.freeze({
  MAX_FAILURES_PER_MISSION: 3,
  MAX_IMMEDIATE_EXECS_PER_MISSION: 3,
  COOLDOWN_AFTER_FAILURE_MS: 60000,
  MAX_SPAWN_PER_HOUR: 10,
  MAX_ARTIFACTS_PER_HOUR: 100,
  MAX_STATE_MUTATIONS_PER_HOUR: 500
});

// =============================================================================
// APPROVAL STATUS (V7 Compatibility)
// =============================================================================

export const ApprovalStatus = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  AUTO_APPROVED: 'auto_approved'
});

// =============================================================================
// PROJECT SCHEMA (V8)
// =============================================================================

export const ProjectStatus = Object.freeze({
  INITIALIZED: 'initialized',
  PLANNING: 'planning',
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  NEEDS_APPROVAL: 'needs_approval',
  PAUSED: 'paused',
  COMPLETE: 'complete',
  FAILED: 'failed'
});

export const ProjectPhase = Object.freeze({
  BOOTSTRAP: 'bootstrap',
  RESEARCH: 'research',
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  DEPLOYMENT: 'deployment',
  MAINTENANCE: 'maintenance'
});

// =============================================================================
// INITIAL STATE
// =============================================================================

export const INITIAL_STATE = Object.freeze({
  missions: {},
  tasks: {},
  artifacts: {},
  agents: {},
  approvals: {},
  projects: {},
  circuitBreaker: {
    isOpen: false,
    failureCount: 0,
    lastFailure: null,
    cooldownUntil: null
  },
  armedMode: false,
  _version: 1,
  _lastUpdated: null
});

// =============================================================================
// HEARTBEAT THRESHOLDS
// =============================================================================

export const HeartbeatThresholds = Object.freeze({
  INTERVAL_MS: 30000,        // Heartbeat every 30 seconds
  STALE_THRESHOLD_MS: 60000, // 2x interval
  DEAD_THRESHOLD_MS: 150000  // 5x interval
});

// =============================================================================
// ID GENERATORS
// =============================================================================

export function generateMissionId() {
  return `mission-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateArtifactId() {
  return `artifact-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateAgentId() {
  return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Enums
  MissionClass,
  MissionStatus,
  TaskStatus,
  TaskType,
  RiskLevel,
  TriggerSource,
  ProducerType,
  AgentStatus,
  ExecutionAuthority,
  ExecutionMode,
  
  // Tool permissions
  DefaultAllowedTools,
  DesktopAllowedTools,
  DesktopForbiddenActions,
  
  // Schemas
  MissionSchema,
  TaskSchema,
  ArtifactSchema,
  AgentSchema,
  CircuitBreakerSchema,
  ExecutionViolationSchema,
  
  // Limits
  CircuitBreakerLimits,
  HeartbeatThresholds,
  
  // Generators
  generateMissionId,
  generateTaskId,
  generateArtifactId,
  generateAgentId
};
