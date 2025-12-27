/**
 * Mission Control V7 — MCP Watchdog Tools
 * Watchdog controls and signal queries
 */

import { watchdogService, SignalType, WatchdogConfig } from '../../services/watchdogService.js';
import { rankingWatchdogService } from '../../services/rankingWatchdogService.js';

export const watchdogTools = {
  // ============================================
  // WATCHDOG LIFECYCLE
  // ============================================

  'watchdog.start': {
    schema: {
      description: 'Start the watchdog service.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const result = watchdogService.start();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'watchdog.stop': {
    schema: {
      description: 'Stop the watchdog service.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const result = watchdogService.stop();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'watchdog.force_tick': {
    schema: {
      description: 'Force an immediate watchdog check cycle.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      await watchdogService.forceTick();
      return { content: [{ type: 'text', text: 'Watchdog tick completed' }] };
    }
  },

  // ============================================
  // STATUS & SIGNALS
  // ============================================

  'watchdog.get_status': {
    schema: {
      description: 'Get watchdog service status.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const status = watchdogService.getStatus();
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }
  },

  'watchdog.get_signals': {
    schema: {
      description: 'Get recent signals with optional filters.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Filter by signal type'
          },
          severity: {
            type: 'string',
            enum: ['info', 'warning', 'critical'],
            description: 'Filter by severity'
          },
          entityType: {
            type: 'string',
            enum: ['agent', 'mission', 'task', 'system'],
            description: 'Filter by entity type'
          },
          missionId: { type: 'string', description: 'Filter by mission ID' },
          since: { type: 'string', description: 'ISO timestamp to filter from' }
        }
      }
    },
    handler: async (params) => {
      const signals = watchdogService.getSignals(params);
      return { content: [{ type: 'text', text: JSON.stringify(signals, null, 2) }] };
    }
  },

  'watchdog.get_active_issues': {
    schema: {
      description: 'Get currently active issues requiring attention.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const issues = watchdogService.getActiveIssues();
      return { content: [{ type: 'text', text: JSON.stringify(issues, null, 2) }] };
    }
  },

  'watchdog.list_signal_types': {
    schema: {
      description: 'List all signal types.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      return { content: [{ type: 'text', text: JSON.stringify(SignalType, null, 2) }] };
    }
  },

  // ============================================
  // AGENT RECOVERY
  // ============================================

  'watchdog.recover_agent': {
    schema: {
      description: 'Manually recover a stale/dead agent.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID to recover' }
        },
        required: ['agentId']
      }
    },
    handler: async (params) => {
      const result = await watchdogService.recoverAgent(params.agentId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  // ============================================
  // CONFIGURATION
  // ============================================

  'watchdog.get_config': {
    schema: {
      description: 'Get watchdog configuration.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      return { content: [{ type: 'text', text: JSON.stringify(WatchdogConfig, null, 2) }] };
    }
  },

  // ============================================
  // CLEANUP
  // ============================================

  'watchdog.clear_heal_attempts': {
    schema: {
      description: 'Clear heal attempt counter for an entity.',
      inputSchema: {
        type: 'object',
        properties: {
          entityId: { type: 'string', description: 'Entity ID (e.g., agent-xxx or task-xxx)' }
        }
      }
    },
    handler: async (params) => {
      const result = watchdogService.clearHealAttempts(params.entityId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'watchdog.clear_signals': {
    schema: {
      description: 'Clear signal history.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const result = watchdogService.clearSignals();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  // ============================================
  // HEALTH CHECK
  // ============================================

  'watchdog.health_check': {
    schema: {
      description: 'Run health check on watchdog service.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const health = await watchdogService.healthCheck();
      return { content: [{ type: 'text', text: JSON.stringify(health, null, 2) }] };
    }
  },

  // ============================================
  // COMBINED STATUS (both watchdogs)
  // ============================================

  'watchdog.get_all_status': {
    schema: {
      description: 'Get status of all watchdog services.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const coreStatus = watchdogService.getStatus();
      const rankingStatus = rankingWatchdogService.getStatus();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            core: coreStatus,
            ranking: rankingStatus
          }, null, 2)
        }]
      };
    }
  },

  'watchdog.start_all': {
    schema: {
      description: 'Start all watchdog services.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const coreResult = watchdogService.start();
      const rankingResult = rankingWatchdogService.start();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            core: coreResult,
            ranking: rankingResult
          }, null, 2)
        }]
      };
    }
  },

  'watchdog.stop_all': {
    schema: {
      description: 'Stop all watchdog services.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const coreResult = watchdogService.stop();
      const rankingResult = rankingWatchdogService.stop();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            core: coreResult,
            ranking: rankingResult
          }, null, 2)
        }]
      };
    }
  }
};

export default watchdogTools;
