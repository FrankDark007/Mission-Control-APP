/**
 * Mission Control V7 — Self-Healing Service
 * Generates and applies self-healing proposals with idempotency
 * 
 * Spec Reference: Section 6 (Self-Healing Proposals)
 * 
 * Stage 1: Generate Proposal
 *   - failure_report artifact
 *   - self_heal_proposal artifact with diagnosis, commands, files, risk, rollback
 * 
 * Stage 2: Apply or Block
 *   - If armedMode=true AND risk ≤ medium: auto-enqueue fix
 *   - Else: mission → needs_review
 * 
 * Idempotency:
 *   - selfHealKey = hash(failure_signature)
 *   - Duplicates blocked with "previously attempted fix" message
 */

import crypto from 'crypto';
import { stateStore } from '../state/StateStore.js';
import { ArtifactTypes } from '../state/ArtifactTypes.js';
import { MissionStatus, MissionClass, RiskLevel } from '../state/schema.js';

// ============================================
// SELF-HEAL RISK THRESHOLDS
// ============================================

const RiskThresholds = {
  [RiskLevel.LOW]: 1,
  [RiskLevel.MEDIUM]: 2,
  [RiskLevel.HIGH]: 3
};

function riskToNumber(risk) {
  return RiskThresholds[risk] || 0;
}

function canAutoApply(proposalRisk, thresholdRisk) {
  return riskToNumber(proposalRisk) <= riskToNumber(thresholdRisk);
}


// ============================================
// SELF-HEALING SERVICE CLASS
// ============================================

class SelfHealingService {
  constructor() {
    this.appliedKeys = new Map();  // selfHealKey → { proposalId, appliedAt, outcome }
    this.proposals = new Map();     // proposalId → proposal
    this.maxProposalsPerMission = 5;
  }

  // ============================================
  // IDEMPOTENCY KEY GENERATION (Spec 6.1)
  // ============================================

  generateSelfHealKey(failureSignature) {
    const normalized = typeof failureSignature === 'string' 
      ? failureSignature 
      : JSON.stringify(failureSignature);
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  isDuplicateProposal(selfHealKey) {
    const existing = this.appliedKeys.get(selfHealKey);
    if (!existing) return { duplicate: false };
    
    return {
      duplicate: true,
      previousProposal: existing.proposalId,
      previouslyAppliedAt: existing.appliedAt,
      previousOutcome: existing.outcome,
      message: 'Previously attempted fix detected'
    };
  }

  // ============================================
  // STAGE 1: GENERATE PROPOSAL (Spec 6)
  // ============================================

  async generateProposal(options) {
    const {
      missionId,
      taskId = null,
      failureSignature,
      diagnosis,
      proposedCommands = [],
      filesTouched = [],
      riskRating = RiskLevel.MEDIUM,
      rollbackPlan,
      estimatedCost = null,
      context = {}
    } = options;

    // Validate required fields
    if (!missionId) {
      throw new Error('missionId is required');
    }
    if (!failureSignature) {
      throw new Error('failureSignature is required');
    }
    if (!diagnosis) {
      throw new Error('diagnosis is required');
    }
    if (!rollbackPlan) {
      throw new Error('rollbackPlan is required');
    }

    // Check mission exists
    const mission = stateStore.getMission(missionId);
    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }

    // Generate idempotency key
    const selfHealKey = this.generateSelfHealKey(failureSignature);

    // Check for duplicate
    const duplicateCheck = this.isDuplicateProposal(selfHealKey);
    if (duplicateCheck.duplicate) {
      return {
        success: false,
        blocked: true,
        reason: duplicateCheck.message,
        previousProposal: duplicateCheck.previousProposal,
        selfHealKey
      };
    }

    // Check proposal limit per mission
    const existingProposals = Array.from(this.proposals.values())
      .filter(p => p.missionId === missionId && p.status === 'pending');
    
    if (existingProposals.length >= this.maxProposalsPerMission) {
      return {
        success: false,
        blocked: true,
        reason: `Maximum pending proposals (${this.maxProposalsPerMission}) reached for mission`,
        selfHealKey
      };
    }

    const now = new Date().toISOString();
    const proposalId = `proposal-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Create failure_report artifact
    const failureReport = await stateStore.addArtifact({
      id: `artifact-${Date.now()}-fr`,
      missionId,
      taskId,
      type: ArtifactTypes.FAILURE_REPORT,
      label: `Failure: ${diagnosis.substring(0, 50)}...`,
      payload: {
        failureSignature,
        diagnosis,
        context,
        detectedAt: now
      },
      provenance: { producer: 'system' }
    });

    // Create self_heal_proposal artifact
    const proposalArtifact = await stateStore.addArtifact({
      id: `artifact-${Date.now()}-shp`,
      missionId,
      taskId,
      type: ArtifactTypes.SELF_HEAL_PROPOSAL,
      label: `Self-heal: ${diagnosis.substring(0, 40)}...`,
      payload: {
        proposalId,
        selfHealKey,
        diagnosis,
        proposedCommands,
        filesTouched,
        riskRating,
        rollbackPlan,
        estimatedCost,
        failureReportId: failureReport.id,
        status: 'pending',
        createdAt: now
      },
      provenance: { producer: 'system' }
    });

    // Store proposal in memory
    const proposal = {
      id: proposalId,
      missionId,
      taskId,
      selfHealKey,
      diagnosis,
      proposedCommands,
      filesTouched,
      riskRating,
      rollbackPlan,
      estimatedCost,
      failureReportArtifactId: failureReport.id,
      proposalArtifactId: proposalArtifact.id,
      status: 'pending',
      createdAt: now
    };

    this.proposals.set(proposalId, proposal);

    return {
      success: true,
      proposalId,
      selfHealKey,
      failureReportId: failureReport.id,
      proposalArtifactId: proposalArtifact.id,
      riskRating,
      requiresReview: riskToNumber(riskRating) > riskToNumber(RiskLevel.MEDIUM)
    };
  }



  // ============================================
  // STAGE 2: APPLY OR BLOCK (Spec 6)
  // ============================================

  async evaluateProposal(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'pending') {
      return {
        success: false,
        reason: `Proposal already ${proposal.status}`,
        status: proposal.status
      };
    }

    const mission = stateStore.getMission(proposal.missionId);
    if (!mission) {
      throw new Error(`Mission ${proposal.missionId} not found`);
    }

    const isArmed = stateStore.isArmedMode();
    const riskThreshold = stateStore.riskThreshold || RiskLevel.MEDIUM;
    const canAuto = isArmed && canAutoApply(proposal.riskRating, riskThreshold);

    if (canAuto) {
      // Auto-enqueue fix
      return {
        action: 'auto_apply',
        reason: `Armed mode enabled, risk ${proposal.riskRating} within threshold ${riskThreshold}`,
        proposalId,
        canProceed: true
      };
    } else {
      // Block and send to review
      return {
        action: 'needs_review',
        reason: isArmed 
          ? `Risk ${proposal.riskRating} exceeds threshold ${riskThreshold}`
          : 'Armed mode not enabled',
        proposalId,
        canProceed: false
      };
    }
  }

  async applyProposal(proposalId, options = {}) {
    const { approvedBy = null, skipApprovalCheck = false } = options;

    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'pending') {
      return {
        success: false,
        reason: `Proposal already ${proposal.status}`,
        status: proposal.status
      };
    }

    // Evaluate if auto-apply is allowed
    if (!skipApprovalCheck) {
      const evaluation = await this.evaluateProposal(proposalId);
      
      if (evaluation.action === 'needs_review' && !approvedBy) {
        // Transition mission to needs_review
        await stateStore.updateMission(proposal.missionId, {
          status: MissionStatus.NEEDS_REVIEW,
          blockedReason: evaluation.reason
        });

        // Create approval request
        const approvalId = `approval-${Date.now()}-sh`;
        await stateStore.createApproval({
          id: approvalId,
          missionId: proposal.missionId,
          taskId: proposal.taskId,
          action: 'self_heal_apply',
          params: {
            proposalId,
            diagnosis: proposal.diagnosis,
            riskRating: proposal.riskRating,
            filesTouched: proposal.filesTouched
          },
          estimatedCost: proposal.estimatedCost,
          riskLevel: proposal.riskRating
        });

        proposal.status = 'awaiting_approval';
        proposal.approvalId = approvalId;
        this.proposals.set(proposalId, proposal);

        return {
          success: false,
          status: 'awaiting_approval',
          approvalId,
          reason: evaluation.reason
        };
      }
    }

    // Snapshot before applying
    await stateStore.createSnapshot(`self_heal_${proposalId}`);

    // Mark proposal as applied
    proposal.status = 'applied';
    proposal.appliedAt = new Date().toISOString();
    proposal.appliedBy = approvedBy || 'auto';
    this.proposals.set(proposalId, proposal);

    // Record in idempotency map
    this.appliedKeys.set(proposal.selfHealKey, {
      proposalId,
      appliedAt: proposal.appliedAt,
      outcome: 'applied'
    });

    // Create approval_record artifact
    await stateStore.addArtifact({
      id: `artifact-${Date.now()}-apr`,
      missionId: proposal.missionId,
      taskId: proposal.taskId,
      type: ArtifactTypes.APPROVAL_RECORD,
      label: `Self-heal applied: ${proposal.diagnosis.substring(0, 30)}...`,
      payload: {
        targetType: 'self_heal',
        targetId: proposal.proposalArtifactId,
        decision: 'approve',
        approvedBy: proposal.appliedBy,
        reason: 'Self-healing fix applied',
        timestamp: proposal.appliedAt
      },
      provenance: { producer: 'system' }
    });

    return {
      success: true,
      proposalId,
      status: 'applied',
      appliedAt: proposal.appliedAt,
      appliedBy: proposal.appliedBy,
      commands: proposal.proposedCommands,
      rollbackPlan: proposal.rollbackPlan
    };
  }

  async rejectProposal(proposalId, reason, rejectedBy = 'human') {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    proposal.status = 'rejected';
    proposal.rejectedAt = new Date().toISOString();
    proposal.rejectedBy = rejectedBy;
    proposal.rejectionReason = reason;
    this.proposals.set(proposalId, proposal);

    // Record in idempotency map to prevent re-proposal
    this.appliedKeys.set(proposal.selfHealKey, {
      proposalId,
      appliedAt: proposal.rejectedAt,
      outcome: 'rejected'
    });

    return {
      success: true,
      proposalId,
      status: 'rejected',
      reason
    };
  }



  // ============================================
  // ROLLBACK SUPPORT
  // ============================================

  async markRollbackNeeded(proposalId, reason) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'applied') {
      return {
        success: false,
        reason: `Proposal not in applied state (current: ${proposal.status})`
      };
    }

    proposal.status = 'needs_rollback';
    proposal.rollbackReason = reason;
    proposal.rollbackNeededAt = new Date().toISOString();
    this.proposals.set(proposalId, proposal);

    // Update idempotency record
    this.appliedKeys.set(proposal.selfHealKey, {
      proposalId,
      appliedAt: proposal.appliedAt,
      outcome: 'needs_rollback'
    });

    // Create failure_report for the failed fix
    await stateStore.addArtifact({
      id: `artifact-${Date.now()}-fr`,
      missionId: proposal.missionId,
      taskId: proposal.taskId,
      type: ArtifactTypes.FAILURE_REPORT,
      label: `Self-heal failed: ${reason.substring(0, 40)}...`,
      payload: {
        failureSignature: `rollback_${proposal.selfHealKey}`,
        diagnosis: `Self-heal proposal ${proposalId} failed and needs rollback`,
        context: {
          originalDiagnosis: proposal.diagnosis,
          rollbackReason: reason,
          rollbackPlan: proposal.rollbackPlan
        },
        detectedAt: proposal.rollbackNeededAt
      },
      provenance: { producer: 'system' }
    });

    return {
      success: true,
      proposalId,
      status: 'needs_rollback',
      rollbackPlan: proposal.rollbackPlan,
      reason
    };
  }

  async completeRollback(proposalId, executedBy = 'human') {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'needs_rollback') {
      return {
        success: false,
        reason: `Proposal not in needs_rollback state (current: ${proposal.status})`
      };
    }

    proposal.status = 'rolled_back';
    proposal.rolledBackAt = new Date().toISOString();
    proposal.rolledBackBy = executedBy;
    this.proposals.set(proposalId, proposal);

    // Update idempotency record
    this.appliedKeys.set(proposal.selfHealKey, {
      proposalId,
      appliedAt: proposal.appliedAt,
      outcome: 'rolled_back'
    });

    return {
      success: true,
      proposalId,
      status: 'rolled_back',
      rolledBackAt: proposal.rolledBackAt
    };
  }

  // ============================================
  // STATUS & QUERYING
  // ============================================

  getProposal(proposalId) {
    return this.proposals.get(proposalId) || null;
  }

  getProposalByKey(selfHealKey) {
    for (const proposal of this.proposals.values()) {
      if (proposal.selfHealKey === selfHealKey) {
        return proposal;
      }
    }
    return null;
  }

  listProposals(filter = {}) {
    let proposals = Array.from(this.proposals.values());

    if (filter.missionId) {
      proposals = proposals.filter(p => p.missionId === filter.missionId);
    }
    if (filter.status) {
      proposals = proposals.filter(p => p.status === filter.status);
    }
    if (filter.riskRating) {
      proposals = proposals.filter(p => p.riskRating === filter.riskRating);
    }

    return proposals;
  }

  getPendingProposals(missionId = null) {
    return this.listProposals({ 
      status: 'pending',
      ...(missionId && { missionId })
    });
  }

  getAwaitingApproval(missionId = null) {
    return this.listProposals({
      status: 'awaiting_approval',
      ...(missionId && { missionId })
    });
  }

  getStatus() {
    const proposals = Array.from(this.proposals.values());
    const byStatus = {};
    
    for (const p of proposals) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    }

    return {
      totalProposals: proposals.length,
      byStatus,
      appliedKeys: this.appliedKeys.size,
      maxProposalsPerMission: this.maxProposalsPerMission
    };
  }

  // ============================================
  // CLEANUP
  // ============================================

  clearOldProposals(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleared = 0;

    for (const [id, proposal] of this.proposals.entries()) {
      const age = now - new Date(proposal.createdAt).getTime();
      if (age > maxAgeMs && ['rejected', 'rolled_back'].includes(proposal.status)) {
        this.proposals.delete(id);
        cleared++;
      }
    }

    return { cleared };
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async healthCheck() {
    const status = this.getStatus();
    const pending = this.getPendingProposals();
    const awaitingApproval = this.getAwaitingApproval();

    return {
      service: 'SelfHealingService',
      status: 'ok',
      proposals: {
        total: status.totalProposals,
        pending: pending.length,
        awaitingApproval: awaitingApproval.length,
        byStatus: status.byStatus
      },
      idempotencyKeys: status.appliedKeys,
      checkedAt: new Date().toISOString()
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const selfHealingService = new SelfHealingService();
export { SelfHealingService, RiskLevel, canAutoApply };
export default selfHealingService;
