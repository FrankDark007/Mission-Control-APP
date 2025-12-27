/**
 * Mission Control V7 — Approval Policy Service
 * Policy-based auto-approval for safe fixes
 * 
 * Phase 3: Circuit Breaker Implementation
 */

import { stateStore } from '../state/StateStore.js';
import { ArtifactTypes } from '../state/ArtifactTypes.js';

// ============================================
// AUTO-APPROVE POLICIES (Spec Section 9)
// ============================================

export const ApprovalPolicies = {
  // Path-based policies
  PATH_LOGS_ONLY: {
    id: 'PATH_LOGS_ONLY',
    description: 'Files only in /logs/ directory',
    pattern: /^(\/logs\/|logs\/)/,
    autoApprove: true,
    riskLevel: 'low'
  },
  PATH_TEMP_ONLY: {
    id: 'PATH_TEMP_ONLY',
    description: 'Files only in /temp/ directory',
    pattern: /^(\/temp\/|temp\/)/,
    autoApprove: true,
    riskLevel: 'low'
  },
  PATH_CACHE_ONLY: {
    id: 'PATH_CACHE_ONLY',
    description: 'Files only in /cache/ directory',
    pattern: /^(\/cache\/|cache\/)/,
    autoApprove: true,
    riskLevel: 'low'
  },
  PATH_NODE_MODULES: {
    id: 'PATH_NODE_MODULES',
    description: 'Files in node_modules (package installs)',
    pattern: /node_modules\//,
    autoApprove: true,
    riskLevel: 'low'
  },
  
  // Action-based policies
  ACTION_READ_ONLY: {
    id: 'ACTION_READ_ONLY',
    description: 'Read-only operations',
    actions: ['list', 'get', 'inspect', 'status', 'health'],
    autoApprove: true,
    riskLevel: 'low'
  }
};

// Revocable policy tracking
const revokedPolicies = new Set();


// ============================================
// APPROVAL POLICY SERVICE CLASS
// ============================================

class ApprovalPolicyService {
  constructor() {
    this.policies = { ...ApprovalPolicies };
    this.revoked = new Set();
    this.matchHistory = [];  // Track policy matches for audit
  }

  // ============================================
  // POLICY EVALUATION
  // ============================================

  evaluateApproval(request) {
    const {
      action,
      toolName,
      filePaths = [],
      missionId,
      riskLevel = 'low'
    } = request;

    // Never auto-approve high risk
    if (riskLevel === 'high') {
      return {
        autoApprove: false,
        reason: 'High risk actions require human approval',
        matchedPolicy: null
      };
    }

    // Check action-based policies
    const actionPolicy = this._checkActionPolicy(action, toolName);
    if (actionPolicy && !this.revoked.has(actionPolicy.id)) {
      return this._createMatch(actionPolicy, request);
    }

    // Check path-based policies (all files must match)
    if (filePaths.length > 0) {
      const pathPolicy = this._checkPathPolicies(filePaths);
      if (pathPolicy && !this.revoked.has(pathPolicy.id)) {
        return this._createMatch(pathPolicy, request);
      }
    }

    // No policy matched
    return {
      autoApprove: false,
      reason: 'No matching auto-approval policy',
      matchedPolicy: null
    };
  }

  _checkActionPolicy(action, toolName) {
    const policy = this.policies.ACTION_READ_ONLY;
    if (!policy) return null;

    const normalizedAction = (action || toolName || '').toLowerCase();
    const isReadOnly = policy.actions.some(a => normalizedAction.includes(a));
    
    return isReadOnly ? policy : null;
  }

  _checkPathPolicies(filePaths) {
    // All files must match the same policy
    for (const policy of Object.values(this.policies)) {
      if (!policy.pattern) continue;
      
      const allMatch = filePaths.every(p => policy.pattern.test(p));
      if (allMatch) return policy;
    }
    return null;
  }

  _createMatch(policy, request) {
    const match = {
      autoApprove: policy.autoApprove,
      matchedPolicy: policy.id,
      policyDescription: policy.description,
      riskLevel: policy.riskLevel,
      timestamp: new Date().toISOString()
    };

    this.matchHistory.push({
      ...match,
      missionId: request.missionId,
      action: request.action
    });

    return match;
  }


  // ============================================
  // POLICY MANAGEMENT
  // ============================================

  revokePolicy(policyId, reason) {
    if (!this.policies[policyId]) {
      return { success: false, error: `Policy ${policyId} not found` };
    }
    
    this.revoked.add(policyId);
    console.log(`⚠️ Policy ${policyId} revoked: ${reason}`);
    
    return { success: true, policyId, reason };
  }

  reinstatePolicy(policyId) {
    if (!this.revoked.has(policyId)) {
      return { success: false, error: `Policy ${policyId} not revoked` };
    }
    
    this.revoked.delete(policyId);
    console.log(`✅ Policy ${policyId} reinstated`);
    
    return { success: true, policyId };
  }

  isRevoked(policyId) {
    return this.revoked.has(policyId);
  }

  // ============================================
  // ARTIFACT GENERATION
  // ============================================

  async createPolicyMatchArtifact(missionId, match) {
    if (!match.autoApprove) return null;

    try {
      return await stateStore.addArtifact({
        id: `artifact-${Date.now()}-pmr`,
        missionId,
        type: ArtifactTypes.POLICY_MATCH_REPORT,
        label: `Auto-approved: ${match.matchedPolicy}`,
        payload: match,
        provenance: { producer: 'system' }
      });
    } catch (e) {
      console.error('Failed to create policy match artifact:', e.message);
      return null;
    }
  }

  // ============================================
  // APPLY AUTO-APPROVAL
  // ============================================

  async tryAutoApprove(approvalId, request) {
    const evaluation = this.evaluateApproval(request);

    if (!evaluation.autoApprove) {
      return { approved: false, reason: evaluation.reason };
    }

    try {
      // Create policy match artifact
      await this.createPolicyMatchArtifact(request.missionId, evaluation);

      // Resolve the approval
      await stateStore.resolveApproval(
        approvalId,
        'approve',
        `policy:${evaluation.matchedPolicy}`,
        `Auto-approved by policy: ${evaluation.policyDescription}`
      );

      return {
        approved: true,
        policy: evaluation.matchedPolicy,
        description: evaluation.policyDescription
      };
    } catch (e) {
      return { approved: false, reason: e.message };
    }
  }

  // ============================================
  // STATUS & REPORTING
  // ============================================

  getStatus() {
    return {
      activePolicies: Object.keys(this.policies).filter(p => !this.revoked.has(p)),
      revokedPolicies: Array.from(this.revoked),
      recentMatches: this.matchHistory.slice(-20),
      totalMatches: this.matchHistory.length
    };
  }

  getPolicies() {
    return Object.entries(this.policies).map(([id, policy]) => ({
      ...policy,
      revoked: this.revoked.has(id)
    }));
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const approvalPolicyService = new ApprovalPolicyService();
export { ApprovalPolicyService };
export default approvalPolicyService;
