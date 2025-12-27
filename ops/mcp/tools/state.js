/**
 * Mission Control V7 — MCP State Tools
 * State queries, snapshots, and safety controls
 */

import { stateStore } from '../../state/StateStore.js';

export const stateTools = {
  // ============================================
  // STATE QUERIES
  // ============================================

  'state.get': {
    schema: {
      description: 'Get full state snapshot.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const state = stateStore.getState();
      return { content: [{ type: 'text', text: JSON.stringify(state, null, 2) }] };
    }
  },

  'state.get_stats': {
    schema: {
      description: 'Get state statistics.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const stats = stateStore.getStats();
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
    }
  },

  // ============================================
  // SNAPSHOTS
  // ============================================

  'state.create_snapshot': {
    schema: {
      description: 'Create a state snapshot for recovery.',
      inputSchema: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Snapshot label (default: manual)' }
        }
      }
    },
    handler: async (params) => {
      const filename = await stateStore.createSnapshot(params.label || 'manual');
      return { content: [{ type: 'text', text: `Snapshot created: ${filename}` }] };
    }
  },

  'state.export_snapshot': {
    schema: {
      description: 'Export current state as JSON.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const state = stateStore.getState();
      const snapshot = {
        exportedAt: new Date().toISOString(),
        state
      };
      return { content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }] };
    }
  },

  // ============================================
  // ARMED MODE
  // ============================================

  'state.set_armed_mode': {
    schema: {
      description: 'Enable or disable armed mode for immediate executions.',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'Enable armed mode' },
          riskThreshold: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Max risk level for auto-approval (default: medium)'
          }
        },
        required: ['enabled']
      }
    },
    handler: async (params) => {
      stateStore.setArmedMode(params.enabled, params.riskThreshold || 'medium');
      return {
        content: [{
          type: 'text',
          text: `Armed mode: ${params.enabled ? 'ENABLED' : 'DISABLED'} (threshold: ${params.riskThreshold || 'medium'})`
        }]
      };
    }
  },

  'state.get_armed_mode': {
    schema: {
      description: 'Get current armed mode status.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const isArmed = stateStore.isArmedMode();
      const threshold = stateStore.riskThreshold;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ armedMode: isArmed, riskThreshold: threshold }, null, 2)
        }]
      };
    }
  },

  // ============================================
  // CIRCUIT BREAKER
  // ============================================

  'state.get_circuit_breaker': {
    schema: {
      description: 'Get circuit breaker status.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const state = stateStore.getState();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(state.circuitBreaker, null, 2)
        }]
      };
    }
  },

  'state.trip_circuit_breaker': {
    schema: {
      description: 'Manually trip the circuit breaker.',
      inputSchema: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Reason for tripping' }
        },
        required: ['reason']
      }
    },
    handler: async (params) => {
      await stateStore.tripCircuitBreaker(params.reason);
      return { content: [{ type: 'text', text: `Circuit breaker tripped: ${params.reason}` }] };
    }
  },

  'state.reset_circuit_breaker': {
    schema: {
      description: 'Reset the circuit breaker (requires approval).',
      inputSchema: {
        type: 'object',
        properties: {
          approvedBy: { type: 'string', description: 'Who approved the reset' }
        },
        required: ['approvedBy']
      }
    },
    handler: async (params) => {
      await stateStore.resetCircuitBreaker(params.approvedBy);
      return { content: [{ type: 'text', text: `Circuit breaker reset by ${params.approvedBy}` }] };
    }
  },

  // ============================================
  // TOOL PERMISSIONS
  // ============================================

  'state.check_tool_permission': {
    schema: {
      description: 'Check if a tool is allowed for a mission.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          toolName: { type: 'string', description: 'Tool name to check' }
        },
        required: ['missionId', 'toolName']
      }
    },
    handler: async (params) => {
      const result = await stateStore.checkToolPermission(params.missionId, params.toolName);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'state.check_immediate_exec': {
    schema: {
      description: 'Check all gates for immediate execution.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          toolName: { type: 'string', description: 'Tool name' },
          estimatedCost: { type: 'number', description: 'Estimated cost in dollars' }
        },
        required: ['missionId', 'toolName']
      }
    },
    handler: async (params) => {
      const result = await stateStore.checkImmediateExecGates(
        params.missionId,
        params.toolName,
        params.estimatedCost
      );
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  // ============================================
  // SUBSCRIPTION (for real-time updates)
  // ============================================

  'state.subscribe_info': {
    schema: {
      description: 'Get information about state subscription system.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            info: 'State subscriptions are available via WebSocket/SSE',
            subscriberCount: stateStore.subscribers?.size || 0,
            method: 'Use stateStore.subscribe(callback) in code'
          }, null, 2)
        }]
      };
    }
  }
};

export default stateTools;
