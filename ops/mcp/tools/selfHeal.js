/**
 * Mission Control V7 — MCP Self-Healing Tools
 * Self-healing proposal management
 */

import { selfHealingService } from '../../services/selfHealingService.js';
import { RiskLevel } from '../../state/schema.js';

export const selfHealTools = {
  // ============================================
  // PROPOSAL GENERATION
  // ============================================

  'selfheal.generate_proposal': {
    schema: {
      description: 'Generate a self-healing proposal for a failure.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          taskId: { type: 'string', description: 'Task ID (optional)' },
          failureSignature: { type: 'string', description: 'Unique failure identifier' },
          diagnosis: { type: 'string', description: 'What went wrong' },
          proposedCommands: {
            type: 'array',
            items: { type: 'string' },
            description: 'Commands to fix the issue'
          },
          filesTouched: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files that will be modified'
          },
          riskRating: {
            type: 'string',
            enum: Object.values(RiskLevel),
            description: 'Risk level of the fix'
          },
          rollbackPlan: { type: 'string', description: 'How to undo if fix fails' },
          estimatedCost: { type: 'number', description: 'Estimated cost in dollars' }
        },
        required: ['missionId', 'failureSignature', 'diagnosis', 'rollbackPlan']
      }
    },
    handler: async (params) => {
      try {
        const result = await selfHealingService.generateProposal({
          missionId: params.missionId,
          taskId: params.taskId,
          failureSignature: params.failureSignature,
          diagnosis: params.diagnosis,
          proposedCommands: params.proposedCommands || [],
          filesTouched: params.filesTouched || [],
          riskRating: params.riskRating || RiskLevel.MEDIUM,
          rollbackPlan: params.rollbackPlan,
          estimatedCost: params.estimatedCost
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // PROPOSAL EVALUATION & APPLICATION
  // ============================================

  'selfheal.evaluate_proposal': {
    schema: {
      description: 'Evaluate if a proposal can be auto-applied.',
      inputSchema: {
        type: 'object',
        properties: {
          proposalId: { type: 'string', description: 'Proposal ID' }
        },
        required: ['proposalId']
      }
    },
    handler: async (params) => {
      try {
        const result = await selfHealingService.evaluateProposal(params.proposalId);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'selfheal.apply_proposal': {
    schema: {
      description: 'Apply a self-healing proposal.',
      inputSchema: {
        type: 'object',
        properties: {
          proposalId: { type: 'string', description: 'Proposal ID' },
          approvedBy: { type: 'string', description: 'Who approved (for manual approvals)' },
          skipApprovalCheck: { type: 'boolean', description: 'Skip approval check (dangerous)' }
        },
        required: ['proposalId']
      }
    },
    handler: async (params) => {
      try {
        const result = await selfHealingService.applyProposal(params.proposalId, {
          approvedBy: params.approvedBy,
          skipApprovalCheck: params.skipApprovalCheck
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'selfheal.reject_proposal': {
    schema: {
      description: 'Reject a self-healing proposal.',
      inputSchema: {
        type: 'object',
        properties: {
          proposalId: { type: 'string', description: 'Proposal ID' },
          reason: { type: 'string', description: 'Reason for rejection' },
          rejectedBy: { type: 'string', description: 'Who rejected' }
        },
        required: ['proposalId', 'reason']
      }
    },
    handler: async (params) => {
      try {
        const result = await selfHealingService.rejectProposal(
          params.proposalId,
          params.reason,
          params.rejectedBy || 'human'
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // ROLLBACK
  // ============================================

  'selfheal.mark_rollback_needed': {
    schema: {
      description: 'Mark that an applied proposal needs rollback.',
      inputSchema: {
        type: 'object',
        properties: {
          proposalId: { type: 'string', description: 'Proposal ID' },
          reason: { type: 'string', description: 'Why rollback is needed' }
        },
        required: ['proposalId', 'reason']
      }
    },
    handler: async (params) => {
      try {
        const result = await selfHealingService.markRollbackNeeded(
          params.proposalId,
          params.reason
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'selfheal.complete_rollback': {
    schema: {
      description: 'Mark rollback as completed.',
      inputSchema: {
        type: 'object',
        properties: {
          proposalId: { type: 'string', description: 'Proposal ID' },
          executedBy: { type: 'string', description: 'Who executed the rollback' }
        },
        required: ['proposalId']
      }
    },
    handler: async (params) => {
      try {
        const result = await selfHealingService.completeRollback(
          params.proposalId,
          params.executedBy || 'human'
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // QUERIES
  // ============================================

  'selfheal.get_proposal': {
    schema: {
      description: 'Get a proposal by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          proposalId: { type: 'string', description: 'Proposal ID' }
        },
        required: ['proposalId']
      }
    },
    handler: async (params) => {
      const proposal = selfHealingService.getProposal(params.proposalId);
      if (!proposal) {
        return { content: [{ type: 'text', text: `Proposal ${params.proposalId} not found` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(proposal, null, 2) }] };
    }
  },

  'selfheal.list_pending': {
    schema: {
      description: 'List pending self-healing proposals.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Filter by mission ID' }
        }
      }
    },
    handler: async (params) => {
      const proposals = selfHealingService.getPendingProposals(params.missionId);
      return { content: [{ type: 'text', text: JSON.stringify(proposals, null, 2) }] };
    }
  },

  'selfheal.list_awaiting_approval': {
    schema: {
      description: 'List proposals awaiting human approval.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Filter by mission ID' }
        }
      }
    },
    handler: async (params) => {
      const proposals = selfHealingService.getAwaitingApproval(params.missionId);
      return { content: [{ type: 'text', text: JSON.stringify(proposals, null, 2) }] };
    }
  },

  'selfheal.list_all': {
    schema: {
      description: 'List all proposals with optional filters.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Filter by mission ID' },
          status: { type: 'string', description: 'Filter by status' },
          riskRating: { type: 'string', description: 'Filter by risk rating' }
        }
      }
    },
    handler: async (params) => {
      const proposals = selfHealingService.listProposals(params);
      return { content: [{ type: 'text', text: JSON.stringify(proposals, null, 2) }] };
    }
  },

  // ============================================
  // IDEMPOTENCY
  // ============================================

  'selfheal.check_duplicate': {
    schema: {
      description: 'Check if a failure signature has already been handled.',
      inputSchema: {
        type: 'object',
        properties: {
          failureSignature: { type: 'string', description: 'Failure signature to check' }
        },
        required: ['failureSignature']
      }
    },
    handler: async (params) => {
      const key = selfHealingService.generateSelfHealKey(params.failureSignature);
      const check = selfHealingService.isDuplicateProposal(key);
      return { content: [{ type: 'text', text: JSON.stringify({ key, ...check }, null, 2) }] };
    }
  },

  // ============================================
  // STATUS
  // ============================================

  'selfheal.get_status': {
    schema: {
      description: 'Get self-healing service status.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const status = selfHealingService.getStatus();
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }
  },

  'selfheal.health_check': {
    schema: {
      description: 'Run health check on self-healing service.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const health = await selfHealingService.healthCheck();
      return { content: [{ type: 'text', text: JSON.stringify(health, null, 2) }] };
    }
  }
};

export default selfHealTools;
