/**
 * Mission Control V7 — MCP Approval Tools
 * Approval queue management
 */

import { stateStore } from '../../state/StateStore.js';
import { ApprovalStatus } from '../../state/schema.js';
import { approvalPolicyService } from '../../services/approvalPolicyService.js';

export const approvalTools = {
  // ============================================
  // APPROVAL QUEUE
  // ============================================

  'approval.list_pending': {
    schema: {
      description: 'List all pending approvals.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Filter by mission ID' }
        }
      }
    },
    handler: async (params) => {
      let approvals = stateStore.getPendingApprovals();

      if (params.missionId) {
        approvals = approvals.filter(a => a.missionId === params.missionId);
      }

      return { content: [{ type: 'text', text: JSON.stringify(approvals, null, 2) }] };
    }
  },

  'approval.get': {
    schema: {
      description: 'Get approval by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          approvalId: { type: 'string', description: 'Approval ID' }
        },
        required: ['approvalId']
      }
    },
    handler: async (params) => {
      const approval = stateStore.getApproval(params.approvalId);
      if (!approval) {
        return { content: [{ type: 'text', text: `Approval ${params.approvalId} not found` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(approval, null, 2) }] };
    }
  },

  // ============================================
  // APPROVAL ACTIONS
  // ============================================

  'approval.approve': {
    schema: {
      description: 'Approve a pending approval request.',
      inputSchema: {
        type: 'object',
        properties: {
          approvalId: { type: 'string', description: 'Approval ID' },
          approvedBy: { type: 'string', description: 'Who is approving' },
          comment: { type: 'string', description: 'Optional comment' }
        },
        required: ['approvalId', 'approvedBy']
      }
    },
    handler: async (params) => {
      try {
        const approval = await stateStore.resolveApproval(
          params.approvalId,
          'approve',
          params.approvedBy,
          params.comment
        );
        return { content: [{ type: 'text', text: JSON.stringify(approval, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'approval.reject': {
    schema: {
      description: 'Reject a pending approval request.',
      inputSchema: {
        type: 'object',
        properties: {
          approvalId: { type: 'string', description: 'Approval ID' },
          rejectedBy: { type: 'string', description: 'Who is rejecting' },
          comment: { type: 'string', description: 'Reason for rejection' }
        },
        required: ['approvalId', 'rejectedBy']
      }
    },
    handler: async (params) => {
      try {
        const approval = await stateStore.resolveApproval(
          params.approvalId,
          'reject',
          params.rejectedBy,
          params.comment
        );
        return { content: [{ type: 'text', text: JSON.stringify(approval, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // AUTO-APPROVAL POLICIES
  // ============================================

  'approval.evaluate_policy': {
    schema: {
      description: 'Evaluate if an action qualifies for auto-approval.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action being performed' },
          toolName: { type: 'string', description: 'Tool being used' },
          filePaths: {
            type: 'array',
            items: { type: 'string' },
            description: 'File paths being touched'
          },
          missionId: { type: 'string', description: 'Mission ID' },
          riskLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Risk level of action'
          }
        },
        required: ['action']
      }
    },
    handler: async (params) => {
      const evaluation = approvalPolicyService.evaluateApproval(params);
      return { content: [{ type: 'text', text: JSON.stringify(evaluation, null, 2) }] };
    }
  },

  'approval.try_auto_approve': {
    schema: {
      description: 'Attempt to auto-approve a pending approval based on policies.',
      inputSchema: {
        type: 'object',
        properties: {
          approvalId: { type: 'string', description: 'Approval ID' }
        },
        required: ['approvalId']
      }
    },
    handler: async (params) => {
      const approval = stateStore.getApproval(params.approvalId);
      if (!approval) {
        return { content: [{ type: 'text', text: `Approval ${params.approvalId} not found` }] };
      }

      const result = await approvalPolicyService.tryAutoApprove(params.approvalId, {
        action: approval.action,
        toolName: approval.toolName,
        missionId: approval.missionId,
        riskLevel: approval.riskLevel
      });

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  // ============================================
  // POLICY MANAGEMENT
  // ============================================

  'approval.list_policies': {
    schema: {
      description: 'List all auto-approval policies and their status.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const policies = approvalPolicyService.getPolicies();
      return { content: [{ type: 'text', text: JSON.stringify(policies, null, 2) }] };
    }
  },

  'approval.revoke_policy': {
    schema: {
      description: 'Revoke an auto-approval policy.',
      inputSchema: {
        type: 'object',
        properties: {
          policyId: { type: 'string', description: 'Policy ID' },
          reason: { type: 'string', description: 'Reason for revocation' }
        },
        required: ['policyId', 'reason']
      }
    },
    handler: async (params) => {
      const result = approvalPolicyService.revokePolicy(params.policyId, params.reason);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'approval.reinstate_policy': {
    schema: {
      description: 'Reinstate a revoked auto-approval policy.',
      inputSchema: {
        type: 'object',
        properties: {
          policyId: { type: 'string', description: 'Policy ID' }
        },
        required: ['policyId']
      }
    },
    handler: async (params) => {
      const result = approvalPolicyService.reinstatePolicy(params.policyId);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  // ============================================
  // STATUS
  // ============================================

  'approval.get_status': {
    schema: {
      description: 'Get approval policy service status.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const status = approvalPolicyService.getStatus();
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }
  }
};

export default approvalTools;
