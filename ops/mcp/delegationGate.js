/**
 * Mission Control V8 Delegation Gate
 * 
 * PURPOSE: Enforce execution authority at the MCP router level.
 * This module blocks inline execution and requires delegation to Claude Code.
 * 
 * V8 CORE COMPONENT
 * 
 * @module mcp/delegationGate
 */

import { 
  ExecutionAuthority, 
  ExecutionMode,
  DesktopAllowedTools,
  DesktopForbiddenActions 
} from '../state/schema.js';
import { 
  ArtifactTypes, 
  createViolationPayload 
} from '../state/ArtifactTypes.js';

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Thrown when execution authority is violated
 */
export class ExecutionViolationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ExecutionViolationError';
    this.code = 'EXECUTION_VIOLATION';
    this.details = details;
    this.blocked = true;
  }
}

/**
 * Thrown when tool access is denied
 */
export class ToolAccessDeniedError extends Error {
  constructor(tool, reason) {
    super(`Tool access denied: ${tool} - ${reason}`);
    this.name = 'ToolAccessDeniedError';
    this.code = 'TOOL_ACCESS_DENIED';
    this.tool = tool;
    this.reason = reason;
  }
}

// =============================================================================
// DELEGATION GATE
// =============================================================================

/**
 * DelegationGate - V8 Execution Authority Enforcement
 * 
 * Sits at the MCP router level and enforces:
 * 1. Desktop can only call allowed tools
 * 2. Inline execution attempts are blocked
 * 3. Violations are persisted as artifacts
 */
export class DelegationGate {
  constructor(stateStore) {
    this.stateStore = stateStore;
    this.violationCount = 0;
  }

  /**
   * Check if a tool call is allowed for the given caller
   * 
   * @param {string} tool - Tool name being called
   * @param {string} caller - 'DESKTOP' or 'CLAUDE_CODE'
   * @param {Object} mission - Current mission context
   * @returns {Object} { allowed: boolean, reason?: string }
   */
  checkToolAccess(tool, caller, mission) {
    // Claude Code has no restrictions
    if (caller === 'CLAUDE_CODE') {
      return { allowed: true };
    }

    // Desktop is restricted
    if (caller === 'DESKTOP') {
      // Check against allowed tools list
      const isAllowed = this.isToolAllowedForDesktop(tool);
      
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Tool '${tool}' is not in DesktopAllowedTools. Use spawn_agent to delegate.`
        };
      }

      // Check if mission requires CLAUDE_CODE authority
      if (mission?.executionAuthority === ExecutionAuthority.CLAUDE_CODE) {
        // Even for allowed tools, check if this is an execution attempt
        if (this.isExecutionTool(tool)) {
          return {
            allowed: false,
            reason: `Mission requires CLAUDE_CODE execution authority. Delegation required.`
          };
        }
      }

      return { allowed: true };
    }

    // Unknown caller
    return {
      allowed: false,
      reason: `Unknown caller: ${caller}`
    };
  }

  /**
   * Check if a tool is in the Desktop allowed list
   * Supports wildcards (e.g., 'mission.*')
   * 
   * @param {string} tool - Tool name
   * @returns {boolean}
   */
  isToolAllowedForDesktop(tool) {
    for (const allowed of DesktopAllowedTools) {
      // Exact match
      if (allowed === tool) return true;
      
      // Wildcard match (e.g., 'mission.*' matches 'mission.create')
      if (allowed.endsWith('.*')) {
        const prefix = allowed.slice(0, -2);
        if (tool.startsWith(prefix + '.')) return true;
      }
    }
    return false;
  }

  /**
   * Check if a tool is considered an execution tool
   * Execution tools perform work rather than control/visibility
   * 
   * @param {string} tool - Tool name
   * @returns {boolean}
   */
  isExecutionTool(tool) {
    const executionTools = [
      'artifact.create',
      'task.update_status',
      'selfHeal.apply',
      'selfHeal.diagnose'
    ];
    
    // spawn_agent tools are delegation, not execution
    if (tool.startsWith('agent.spawn')) return false;
    
    return executionTools.includes(tool);
  }

  /**
   * Validate and gate a tool call
   * Main entry point for the MCP router
   * 
   * @param {string} tool - Tool being called
   * @param {Object} args - Tool arguments
   * @param {Object} context - Call context
   * @returns {Object} { proceed: boolean, error?: Error }
   */
  async validateToolCall(tool, args, context) {
    const caller = context.caller || 'DESKTOP';
    const mission = context.mission;

    // Check tool access
    const accessResult = this.checkToolAccess(tool, caller, mission);

    if (!accessResult.allowed) {
      // Create violation artifact
      const violation = await this.recordViolation({
        missionId: mission?.id,
        taskId: context.taskId,
        attemptedAction: `TOOL_CALL: ${tool}`,
        attemptedBy: caller,
        requiredAuthority: ExecutionAuthority.CLAUDE_CODE,
        toolAttempted: tool
      });

      return {
        proceed: false,
        error: new ExecutionViolationError(accessResult.reason, {
          tool,
          caller,
          violationId: violation?.id
        })
      };
    }

    return { proceed: true };
  }

  /**
   * Check if an inline execution attempt is occurring
   * Called for suspicious patterns
   * 
   * @param {Object} context - Execution context
   * @returns {boolean}
   */
  detectInlineExecution(context) {
    const suspiciousPatterns = [
      // Direct file operations
      context.action === 'file_write',
      context.action === 'file_create',
      context.action === 'file_delete',
      
      // Command execution
      context.action === 'command_exec',
      context.action === 'shell_command',
      
      // Code generation without delegation
      context.action === 'code_generate' && !context.delegated,
      
      // Artifact creation of code type from Desktop
      context.action === 'artifact_create' && 
        context.artifactType === 'code' && 
        context.caller === 'DESKTOP'
    ];

    return suspiciousPatterns.some(p => p === true);
  }

  /**
   * Record an execution violation
   * Creates an immutable artifact
   * 
   * @param {Object} violation - Violation details
   * @returns {Object} Created artifact
   */
  async recordViolation(violation) {
    this.violationCount++;

    const payload = createViolationPayload(violation);

    try {
      const artifact = await this.stateStore.createArtifact({
        missionId: violation.missionId,
        taskId: violation.taskId,
        type: ArtifactTypes.EXECUTION_VIOLATION,
        label: `Execution violation: ${violation.attemptedAction}`,
        payload,
        provenance: {
          producer: 'system',
          agentId: null,
          worktree: null,
          commitHash: null
        }
      });

      // If task exists, block it
      if (violation.taskId) {
        await this.stateStore.updateTask(violation.taskId, {
          status: 'blocked',
          blockedReason: `EXECUTION_VIOLATION: ${violation.attemptedAction}. Delegation required.`
        });
      }

      return artifact;
    } catch (error) {
      console.error('[DelegationGate] Failed to record violation:', error);
      // Still throw the violation error even if recording fails
      return null;
    }
  }

  /**
   * Get violation count for monitoring
   * @returns {number}
   */
  getViolationCount() {
    return this.violationCount;
  }

  /**
   * Enforce execution mode
   * Ensures spawn_agent vs spawn_agent_immediate is respected
   * 
   * @param {string} tool - Tool being called
   * @param {Object} mission - Mission context
   * @returns {Object} { allowed: boolean, reason?: string }
   */
  enforceExecutionMode(tool, mission) {
    if (!mission) return { allowed: true };

    const mode = mission.executionMode;

    if (mode === ExecutionMode.RECIPE_ONLY) {
      if (tool === 'agent.spawn_agent_immediate') {
        return {
          allowed: false,
          reason: 'Mission is in RECIPE_ONLY mode. Use spawn_agent instead.'
        };
      }
    }

    if (mode === ExecutionMode.IMMEDIATE_ONLY) {
      if (tool === 'agent.spawn_agent') {
        return {
          allowed: false,
          reason: 'Mission is in IMMEDIATE_ONLY mode. Use spawn_agent_immediate instead.'
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Full validation pipeline
   * Combines all checks
   * 
   * @param {string} tool - Tool name
   * @param {Object} args - Tool arguments
   * @param {Object} context - Call context
   * @returns {Object} Validation result
   */
  async validate(tool, args, context) {
    const mission = context.mission;

    // 1. Check tool access
    const accessCheck = await this.validateToolCall(tool, args, context);
    if (!accessCheck.proceed) {
      return accessCheck;
    }

    // 2. Check execution mode
    const modeCheck = this.enforceExecutionMode(tool, mission);
    if (!modeCheck.allowed) {
      return {
        proceed: false,
        error: new ToolAccessDeniedError(tool, modeCheck.reason)
      };
    }

    // 3. Check for inline execution patterns
    if (this.detectInlineExecution(context)) {
      const violation = await this.recordViolation({
        missionId: mission?.id,
        taskId: context.taskId,
        attemptedAction: context.action || 'INLINE_EXECUTION',
        attemptedBy: context.caller || 'DESKTOP',
        requiredAuthority: ExecutionAuthority.CLAUDE_CODE
      });

      return {
        proceed: false,
        error: new ExecutionViolationError(
          'Inline execution detected. Use spawn_agent to delegate.',
          { violationId: violation?.id }
        )
      };
    }

    return { proceed: true };
  }
}

// =============================================================================
// MIDDLEWARE FACTORY
// =============================================================================

/**
 * Create delegation gate middleware for MCP router
 * 
 * @param {Object} stateStore - StateStore instance
 * @returns {Function} Middleware function
 */
export function createDelegationMiddleware(stateStore) {
  const gate = new DelegationGate(stateStore);

  return async function delegationMiddleware(tool, args, context, next) {
    const result = await gate.validate(tool, args, context);

    if (!result.proceed) {
      return {
        success: false,
        error: result.error.code,
        message: result.error.message,
        blocked: true,
        details: result.error.details
      };
    }

    // Proceed to tool handler
    return next(tool, args, context);
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  DelegationGate,
  ExecutionViolationError,
  ToolAccessDeniedError,
  createDelegationMiddleware
};
