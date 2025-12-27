/**
 * Mission Control V7 — MCP Agent Tools
 * Agent spawning with V7 hybrid execution model:
 * - spawn_agent: Recipe mode (returns recipe, no execution)
 * - spawn_agent_immediate: Armed mode (actual execution with gates)
 */

import { stateStore } from '../../state/StateStore.js';
import { AgentStatus, MissionStatus, RiskLevel } from '../../state/schema.js';
import { ArtifactTypes } from '../../state/ArtifactTypes.js';
import { costEstimatorService } from '../../services/costEstimatorService.js';

export const agentTools = {
  // ============================================
  // SPAWN AGENT (RECIPE MODE - DEFAULT)
  // Returns recipe object for manual execution by Claude Desktop/operator
  // ============================================

  'agent.spawn': {
    schema: {
      description: 'Generate a spawn recipe for an agent. Returns recipe object - does NOT execute. Operator reviews and executes manually or uses spawn_immediate with armed mode.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID to associate agent with' },
          taskId: { type: 'string', description: 'Task ID agent will work on' },
          name: { type: 'string', description: 'Agent name/description' },
          branchName: { type: 'string', description: 'Git branch for worktree' },
          prompt: { type: 'string', description: 'Initial prompt for the agent' },
          model: { type: 'string', description: 'Model to use (claude-sonnet-4, claude-opus-4)' },
          autoPilot: { type: 'boolean', description: 'Enable auto-pilot for permissions' },
          riskLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Risk level for this agent task'
          },
          allowedTools: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of allowed tools for this agent'
          },
          requiredArtifacts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Artifact types required before execution'
          }
        },
        required: ['missionId', 'name', 'prompt']
      }
    },
    handler: async (params, deps) => {
      const { agentManager } = deps;

      // Check mission exists and is not locked
      const mission = stateStore.getMission(params.missionId);
      if (!mission) {
        return { content: [{ type: 'text', text: `Mission ${params.missionId} not found` }] };
      }

      if (mission.status === MissionStatus.LOCKED) {
        return { content: [{ type: 'text', text: `Mission is locked: ${mission.lockedReason}` }] };
      }

      // Estimate cost for recipe
      const costEstimate = costEstimatorService.estimateAgentSpawnCost({
        model: params.model || 'claude-sonnet-4',
        taskComplexity: 'medium'
      });

      // Generate recipe via agentManager (NO EXECUTION)
      try {
        const result = await agentManager.spawnAgent({
          missionId: params.missionId,
          taskId: params.taskId,
          taskName: params.name,
          branchName: params.branchName || null,
          prompt: params.prompt,
          model: params.model || 'claude-sonnet-4',
          autoPilot: params.autoPilot ?? true,
          estimatedCost: costEstimate,
          riskLevel: params.riskLevel || 'medium',
          allowedTools: params.allowedTools || [],
          requiredArtifacts: params.requiredArtifacts || []
        });

        if (result.success) {
          // Create recipe artifact for tracking
          await stateStore.addArtifact({
            id: `artifact-${Date.now()}-recipe`,
            missionId: params.missionId,
            taskId: params.taskId || null,
            type: ArtifactTypes.AGENT_RECIPE,
            label: `Recipe: ${params.name}`,
            payload: result.recipe,
            provenance: { producer: 'agent.spawn' }
          });
        }

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Recipe generation failed: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // SPAWN AGENT IMMEDIATE (ARMED MODE ONLY)
  // Actually spawns and executes Claude Code with gate enforcement
  // ============================================

  'agent.spawn_immediate': {
    schema: {
      description: 'Spawn and execute agent IMMEDIATELY. Requires armed mode. Enforces gates: risk level, allowed tools, required artifacts, cost budget, cooldowns (60s between, max 3/hr per mission).',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          taskId: { type: 'string', description: 'Task ID' },
          name: { type: 'string', description: 'Agent name' },
          branchName: { type: 'string', description: 'Git branch for worktree' },
          prompt: { type: 'string', description: 'Initial prompt' },
          model: { type: 'string', description: 'Model to use' },
          autoPilot: { type: 'boolean', description: 'Enable auto-pilot' },
          riskLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Risk level for this agent task'
          },
          allowedTools: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tools this agent will use'
          },
          requiredArtifacts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Artifact types this agent requires'
          }
        },
        required: ['missionId', 'name', 'prompt']
      }
    },
    handler: async (params, deps) => {
      const { agentManager } = deps;

      // Gate 1: Check armed mode (both stateStore and agentManager)
      const stateArmed = stateStore.isArmedMode ? stateStore.isArmedMode() : false;
      const agentArmed = agentManager.isArmedMode();

      if (!stateArmed && !agentArmed) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Armed mode required for spawn_immediate',
              hint: 'Use agent.spawn for recipe mode, or enable armed mode via state.arm tool',
              mode: 'recipe_fallback_available'
            }, null, 2)
          }]
        };
      }

      // Get mission for gate validation
      const mission = stateStore.getMission(params.missionId);
      if (!mission) {
        return { content: [{ type: 'text', text: `Mission ${params.missionId} not found` }] };
      }

      if (mission.status === MissionStatus.LOCKED) {
        return { content: [{ type: 'text', text: `Mission is locked: ${mission.lockedReason}` }] };
      }

      // Build gates object from mission contract
      const contract = mission.contract || {};
      const gates = {
        riskThreshold: contract.riskThreshold || 'high',
        allowedTools: contract.allowedTools || null, // null = all allowed
        requiredArtifacts: contract.requiredArtifacts || null,
        budgetLimit: contract.maxEstimatedCost || null
      };

      // Estimate cost for gate check
      const costEstimate = costEstimatorService.estimateAgentSpawnCost({
        model: params.model || 'claude-sonnet-4',
        taskComplexity: 'medium'
      });

      // Sync armed mode to agentManager
      agentManager.setArmedMode(true);

      // Execute via agentManager with gates
      try {
        const result = await agentManager.spawnAgentImmediate({
          missionId: params.missionId,
          taskId: params.taskId,
          taskName: params.name,
          branchName: params.branchName || null,
          prompt: params.prompt,
          model: params.model || 'claude-sonnet-4',
          autoPilot: params.autoPilot ?? true,
          riskLevel: params.riskLevel || 'medium',
          allowedTools: params.allowedTools || [],
          requiredArtifacts: params.requiredArtifacts || [],
          estimatedCost: costEstimate
        }, gates);

        if (result.success) {
          // Register agent in state store
          await stateStore.registerAgent({
            id: result.agentId,
            missionId: params.missionId,
            taskId: params.taskId || null,
            name: params.name,
            worktreePath: result.worktreePath,
            branchName: result.branchName,
            model: params.model,
            autoPilot: result.autoPilot,
            pid: result.pid,
            mode: 'immediate'
          });

          // Create execution artifact
          await stateStore.addArtifact({
            id: `artifact-${Date.now()}-exec`,
            missionId: params.missionId,
            taskId: params.taskId || null,
            type: ArtifactTypes.PRE_FLIGHT_SNAPSHOT,
            label: `Immediate exec: ${params.name}`,
            payload: {
              agentId: result.agentId,
              pid: result.pid,
              mode: 'immediate',
              gatesChecked: Object.keys(gates),
              timestamp: new Date().toISOString()
            },
            provenance: { producer: 'agent.spawn_immediate' }
          });
        }

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Spawn failed: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // EXECUTE RECIPE (convert recipe to immediate execution)
  // ============================================

  'agent.execute_recipe': {
    schema: {
      description: 'Execute a previously generated recipe. Requires armed mode.',
      inputSchema: {
        type: 'object',
        properties: {
          recipeId: { type: 'string', description: 'Recipe ID to execute' }
        },
        required: ['recipeId']
      }
    },
    handler: async (params, deps) => {
      const { agentManager } = deps;

      // Check armed mode
      if (!agentManager.isArmedMode() && !(stateStore.isArmedMode && stateStore.isArmedMode())) {
        return {
          content: [{
            type: 'text',
            text: 'Armed mode required to execute recipes. Enable via state.arm tool.'
          }]
        };
      }

      // Get recipe from agentManager
      const recipeEntry = agentManager.subAgents[params.recipeId];
      if (!recipeEntry || recipeEntry.type !== 'recipe') {
        return { content: [{ type: 'text', text: `Recipe ${params.recipeId} not found` }] };
      }

      const recipe = recipeEntry.recipe;

      // Check if expired
      if (new Date(recipe.expiresAt) < new Date()) {
        return {
          content: [{
            type: 'text',
            text: `Recipe expired at ${recipe.expiresAt}. Generate a new one with agent.spawn.`
          }]
        };
      }

      // Execute via spawn_immediate
      agentManager.setArmedMode(true);

      try {
        const result = await agentManager.spawnAgentImmediate({
          missionId: recipe.missionId,
          taskId: recipe.taskId,
          taskName: recipe.task,
          branchName: recipe.branchName,
          prompt: recipe.prompt,
          model: recipe.model,
          autoPilot: recipe.autoPilot,
          riskLevel: recipe.riskLevel,
          allowedTools: recipe.allowedTools,
          requiredArtifacts: recipe.requiredArtifacts,
          estimatedCost: recipe.estimatedCost
        }, {});

        // Mark recipe as executed
        recipeEntry.status = result.success ? 'executed' : 'execution_failed';
        recipeEntry.executedAt = new Date().toISOString();
        recipeEntry.executionResult = result;

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Recipe execution failed: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // GET IMMEDIATE EXEC STATS
  // ============================================

  'agent.get_exec_stats': {
    schema: {
      description: 'Get immediate execution stats for a mission (cooldowns, limits).',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params, deps) => {
      const { agentManager } = deps;
      const stats = agentManager.getImmediateExecStats(params.missionId);
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
    }
  },

  // ============================================
  // AGENT STATUS & CONTROL
  // ============================================

  'agent.get_status': {
    schema: {
      description: 'Get status of an agent or all agents.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID (optional, omit for all)' }
        }
      }
    },
    handler: async (params, deps) => {
      const { agentManager } = deps;

      if (params.agentId) {
        const stateAgent = stateStore.getAgent(params.agentId);
        const managerStatus = agentManager.getStatus(params.agentId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ stateStore: stateAgent, manager: managerStatus }, null, 2)
          }]
        };
      }

      const agents = stateStore.listAgents({});
      const managerStatus = agentManager.getStatus();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ stateStore: agents, manager: managerStatus }, null, 2)
        }]
      };
    }
  },

  'agent.stop': {
    schema: {
      description: 'Stop an agent and optionally cleanup worktree.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID' },
          cleanup: { type: 'boolean', description: 'Remove worktree' }
        },
        required: ['agentId']
      }
    },
    handler: async (params, deps) => {
      const { agentManager } = deps;

      try {
        const result = await agentManager.stopAgent(params.agentId, params.cleanup);

        // Update state store
        await stateStore.updateAgent(params.agentId, {
          status: AgentStatus.STOPPED,
          endedAt: new Date().toISOString()
        });

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'agent.send_input': {
    schema: {
      description: 'Send input to an agent stdin.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID' },
          input: { type: 'string', description: 'Text to send' }
        },
        required: ['agentId', 'input']
      }
    },
    handler: async (params, deps) => {
      const { agentManager } = deps;
      const result = agentManager.sendInput(params.agentId, params.input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'agent.get_logs': {
    schema: {
      description: 'Get recent logs from an agent.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID' },
          lines: { type: 'number', description: 'Number of lines (default 100)' }
        },
        required: ['agentId']
      }
    },
    handler: async (params, deps) => {
      const { agentManager } = deps;
      const logs = agentManager.getLogs(params.agentId, params.lines || 100);
      return { content: [{ type: 'text', text: logs.join('\n') }] };
    }
  },

  // ============================================
  // HEARTBEAT
  // ============================================

  'agent.heartbeat': {
    schema: {
      description: 'Record a heartbeat for an agent.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID' }
        },
        required: ['agentId']
      }
    },
    handler: async (params) => {
      try {
        const agent = await stateStore.recordHeartbeat(params.agentId);
        return { content: [{ type: 'text', text: `Heartbeat recorded: ${agent.lastHeartbeat}` }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'agent.report_status': {
    schema: {
      description: 'Report agent status update.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID' },
          status: {
            type: 'string',
            enum: Object.values(AgentStatus),
            description: 'New status'
          },
          exitCode: { type: 'number', description: 'Exit code if completed/failed' }
        },
        required: ['agentId', 'status']
      }
    },
    handler: async (params) => {
      try {
        const updates = {
          status: params.status
        };

        if (params.status === AgentStatus.COMPLETED || params.status === AgentStatus.FAILED) {
          updates.endedAt = new Date().toISOString();
          updates.exitCode = params.exitCode;
        }

        const agent = await stateStore.updateAgent(params.agentId, updates);
        return { content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  }
};

export default agentTools;
