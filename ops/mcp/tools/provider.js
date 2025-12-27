/**
 * Mission Control V7 — MCP Provider Tools
 * Provider health checks, rate limits, and cost tracking
 */

import { rateLimitService, ProviderLimits } from '../../services/rateLimitService.js';
import { costEstimatorService, CostModels } from '../../services/costEstimatorService.js';

export const providerTools = {
  // ============================================
  // RATE LIMITS
  // ============================================

  'provider.check_rate_limit': {
    schema: {
      description: 'Check if a provider call is allowed (rate limit check).',
      inputSchema: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: Object.keys(ProviderLimits),
            description: 'Provider name'
          },
          missionId: { type: 'string', description: 'Mission ID for logging' }
        },
        required: ['provider']
      }
    },
    handler: async (params) => {
      const result = await rateLimitService.checkRateLimit(params.provider, params.missionId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'provider.record_call': {
    schema: {
      description: 'Record a successful API call for rate tracking.',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider name' }
        },
        required: ['provider']
      }
    },
    handler: async (params) => {
      rateLimitService.recordCall(params.provider);
      return { content: [{ type: 'text', text: `Call recorded for ${params.provider}` }] };
    }
  },

  'provider.record_throttle': {
    schema: {
      description: 'Record a 429 throttle response to trigger backoff.',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider name' },
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['provider']
      }
    },
    handler: async (params) => {
      await rateLimitService.recordThrottle(params.provider, params.missionId);
      const status = rateLimitService.getStatus(params.provider);
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }
  },

  'provider.get_rate_status': {
    schema: {
      description: 'Get rate limit status for a provider or all providers.',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider name (optional)' }
        }
      }
    },
    handler: async (params) => {
      const status = rateLimitService.getStatus(params.provider);
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }
  },

  'provider.get_quota_remaining': {
    schema: {
      description: 'Get remaining daily quota for a provider.',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider name' }
        },
        required: ['provider']
      }
    },
    handler: async (params) => {
      const remaining = rateLimitService.getQuotaRemaining(params.provider);
      const limits = ProviderLimits[params.provider];
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            provider: params.provider,
            remaining,
            dailyQuota: limits?.dailyQuota,
            hasQuota: limits?.dailyQuota !== null
          }, null, 2)
        }]
      };
    }
  },

  'provider.reset_backoff': {
    schema: {
      description: 'Reset backoff for a provider.',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider name' }
        },
        required: ['provider']
      }
    },
    handler: async (params) => {
      rateLimitService.resetBackoff(params.provider);
      return { content: [{ type: 'text', text: `Backoff reset for ${params.provider}` }] };
    }
  },

  // ============================================
  // COST ESTIMATION
  // ============================================

  'provider.estimate_task_cost': {
    schema: {
      description: 'Estimate cost for a task.',
      inputSchema: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model name' },
          inputTokens: { type: 'number', description: 'Estimated input tokens' },
          outputTokens: { type: 'number', description: 'Estimated output tokens' },
          retryCount: { type: 'number', description: 'Expected retry count' },
          apiCalls: {
            type: 'object',
            description: 'API calls by provider (e.g., { serp: 5, gsc: 10 })'
          }
        },
        required: ['model']
      }
    },
    handler: async (params) => {
      const estimate = costEstimatorService.estimateTaskCost(params);
      return { content: [{ type: 'text', text: JSON.stringify(estimate, null, 2) }] };
    }
  },

  'provider.estimate_agent_cost': {
    schema: {
      description: 'Estimate cost for spawning an agent.',
      inputSchema: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model name' },
          taskComplexity: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Task complexity'
          },
          estimatedTurns: { type: 'number', description: 'Estimated conversation turns' }
        }
      }
    },
    handler: async (params) => {
      const estimate = costEstimatorService.estimateAgentSpawnCost(params);
      return { content: [{ type: 'text', text: JSON.stringify(estimate, null, 2) }] };
    }
  },

  'provider.record_actual_cost': {
    schema: {
      description: 'Record actual cost after task completion.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          cost: { type: 'number', description: 'Actual cost in dollars' },
          details: { type: 'object', description: 'Cost breakdown details' }
        },
        required: ['missionId', 'cost']
      }
    },
    handler: async (params) => {
      costEstimatorService.recordActualCost(params.missionId, params.cost, params.details);
      return { content: [{ type: 'text', text: `Cost recorded: $${params.cost}` }] };
    }
  },

  'provider.get_cost_history': {
    schema: {
      description: 'Get cost history.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Filter by mission ID' }
        }
      }
    },
    handler: async (params) => {
      const history = costEstimatorService.getCostHistory(params.missionId);
      return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
    }
  },

  // ============================================
  // MODEL REGISTRY
  // ============================================

  'provider.list_models': {
    schema: {
      description: 'List available models and their costs.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const models = costEstimatorService.getModelRegistry();
      return { content: [{ type: 'text', text: JSON.stringify(models, null, 2) }] };
    }
  },

  'provider.list_providers': {
    schema: {
      description: 'List all providers and their rate limits.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      return { content: [{ type: 'text', text: JSON.stringify(ProviderLimits, null, 2) }] };
    }
  },

  // ============================================
  // HEALTH CHECK
  // ============================================

  'provider.health': {
    schema: {
      description: 'Get health status of all providers.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const allStatus = rateLimitService.getStatus();
      const providers = {};

      for (const [name, status] of Object.entries(allStatus)) {
        providers[name] = {
          status: status.status,
          quotaPercent: status.quotaPercent,
          inBackoff: status.backoffUntil !== null
        };
      }

      const healthy = Object.values(providers).filter(p => p.status === 'ok').length;
      const total = Object.keys(providers).length;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            overall: healthy === total ? 'healthy' : 'degraded',
            healthy,
            total,
            providers
          }, null, 2)
        }]
      };
    }
  }
};

export default providerTools;
