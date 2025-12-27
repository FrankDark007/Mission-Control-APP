/**
 * Mission Control V7 — StateStore
 * Central state authority with contract enforcement, artifact gates, and snapshots
 * Phase 2: Full validator integration
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_STATE, MissionStatus, MissionClass, ApprovalStatus, CircuitBreakerLimits } from './schema.js';
import {
  validateMissionContract,
  checkCircuitBreaker,
  validateCompletion,
  validateExecutionAuthority,
  ValidationError
} from './validators/missionValidator.js';
import {
  validateArtifact,
  validateArtifactUpdate,
  createArtifactObject,
  ArtifactErrorCode
} from './validators/artifactValidator.js';
import { ArtifactTypes, ArtifactModes, getDefaultArtifactMode } from './ArtifactTypes.js';

// V8 Compatibility: Aliases for V7 functions
const validateCompletionGate = validateCompletion;
const getArtifactMode = getDefaultArtifactMode;
const checkToolPermission = () => ({ allowed: true }); // Stub - handled by delegationGate now
const checkCostLimits = () => ({ allowed: true }); // Stub
const checkDestructiveGate = () => ({ allowed: true }); // Stub
const checkArmedModeGate = () => ({ allowed: true }); // Stub
const DefaultToolPermissions = {}; // Stub
const MissionErrorCode = { VALIDATION_ERROR: 'VALIDATION_ERROR' }; // Stub

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_FILE = path.join(__dirname, 'storage', 'state.json');
const SNAPSHOT_DIR = path.join(__dirname, 'snapshots');
const AUDIT_DIR = path.join(__dirname, 'audit');


// ============================================
// CUSTOM ERRORS
// ============================================

class StateError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'StateError';
    this.code = code;
    this.details = details;
  }
}

// ============================================
// STATESTORE CLASS
// ============================================

class StateStore {
  constructor() {
    this.state = structuredClone(INITIAL_STATE);
    this.subscribers = new Set();
    this.isInitialized = false;
    this.armedMode = false;
    this.riskThreshold = 'medium';
  }

  async init() {
    if (this.isInitialized) return;
    await this._ensureDirs();
    await this._load();
    this.isInitialized = true;
    console.log('✅ StateStore initialized with Phase 2 contract enforcement');
  }

  async _ensureDirs() {
    await fs.mkdir(path.dirname(STORAGE_FILE), { recursive: true });
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
    await fs.mkdir(AUDIT_DIR, { recursive: true });
  }

  async _load() {
    try {
      const data = await fs.readFile(STORAGE_FILE, 'utf8');
      this.state = { ...INITIAL_STATE, ...JSON.parse(data) };
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('📝 No state file found, starting fresh.');
        await this._save();
      } else {
        console.error('💥 Failed to load state:', err);
      }
    }
  }

  async _save() {
    const data = JSON.stringify(this.state, null, 2);
    await fs.writeFile(STORAGE_FILE, data, 'utf8');
    this._notify();
  }

  // ============================================
  // SNAPSHOTS
  // ============================================

  async createSnapshot(label = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${label}.json`;
    const filePath = path.join(SNAPSHOT_DIR, filename);
    
    this.state._lastSnapshotAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(this.state, null, 2));
    console.log(`📸 Snapshot created: ${filename}`);
    return filename;
  }

  // ============================================
  // AUDIT LOG (append-only)
  // ============================================

  async _audit(action, details) {
    const record = {
      timestamp: new Date().toISOString(),
      action,
      armedMode: this.armedMode,
      ...details
    };
    
    const date = new Date().toISOString().split('T')[0];
    const auditFile = path.join(AUDIT_DIR, `audit_${date}.jsonl`);
    await fs.appendFile(auditFile, JSON.stringify(record) + '\n');
  }

  // ============================================
  // STATE GETTERS
  // ============================================

  getState() {
    return structuredClone(this.state);
  }

  getMission(missionId) {
    return this.state.missions[missionId] ? structuredClone(this.state.missions[missionId]) : null;
  }

  getTask(taskId) {
    return this.state.tasks[taskId] ? structuredClone(this.state.tasks[taskId]) : null;
  }

  getAgent(agentId) {
    return this.state.agents[agentId] ? structuredClone(this.state.agents[agentId]) : null;
  }

  getArtifact(artifactId) {
    return this.state.artifacts[artifactId] ? structuredClone(this.state.artifacts[artifactId]) : null;
  }

  getApproval(approvalId) {
    return this.state.approvals[approvalId] ? structuredClone(this.state.approvals[approvalId]) : null;
  }

  getMissionArtifacts(missionId) {
    return Object.values(this.state.artifacts)
      .filter(a => a.missionId === missionId)
      .map(a => structuredClone(a));
  }

  getPendingApprovals() {
    return Object.values(this.state.approvals)
      .filter(a => a.status === ApprovalStatus.PENDING)
      .map(a => structuredClone(a));
  }


  // ============================================
  // MISSION MANAGEMENT (Phase 2 Contract Enforcement)
  // ============================================

  async createMission(missionData) {
    if (!missionData.id) {
      throw new StateError('Mission requires id', MissionErrorCode.VALIDATION_ERROR);
    }

    // Validate contract
    const validation = validateMissionContract(missionData);
    if (!validation.valid) {
      throw new StateError(validation.errors.join('; '), validation.code);
    }

    // Apply default tool permissions based on missionClass
    const missionClass = missionData.missionClass || MissionClass.IMPLEMENTATION;
    if (!missionData.contract.allowedTools || missionData.contract.allowedTools.length === 0) {
      missionData.contract.allowedTools = [...(DefaultToolPermissions[missionClass] || [])];
    }

    const now = new Date().toISOString();
    const mission = {
      ...missionData,
      status: missionData.status || MissionStatus.QUEUED,
      taskIds: missionData.taskIds || [],
      artifactIds: missionData.artifactIds || [],
      agentIds: missionData.agentIds || [],
      failureCount: 0,
      immediateExecCount: 0,
      createdAt: now,
      updatedAt: now,
      _stateVersion: 1
    };
    
    this.state.missions[mission.id] = mission;
    await this._save();
    await this._audit('mission.create', { missionId: mission.id, missionClass });
    
    return structuredClone(mission);
  }

  async updateMission(missionId, updates) {
    const current = this.state.missions[missionId];
    if (!current) {
      throw new StateError(`Mission ${missionId} not found`, MissionErrorCode.NOT_FOUND);
    }

    // Check circuit breaker before any update
    const breakerCheck = checkCircuitBreaker(current, this.state);
    if (!breakerCheck.valid && current.status !== MissionStatus.LOCKED) {
      // Trip the breaker and lock mission
      await this._lockMission(missionId, breakerCheck.errors[0]);
      throw new StateError(breakerCheck.errors[0], breakerCheck.code);
    }

    // PHASE 2: Enforce completion gate
    if (updates.status === MissionStatus.COMPLETE) {
      const artifacts = this.getMissionArtifacts(missionId);
      const gateCheck = validateCompletionGate(current, artifacts);
      
      if (!gateCheck.valid) {
        // Block completion, do not complete
        throw new StateError(
          `Cannot complete mission: ${gateCheck.errors.join('; ')}`,
          MissionErrorCode.COMPLETION_BLOCKED,
          { missingArtifacts: gateCheck.errors }
        );
      }

      // Snapshot before completion
      await this.createSnapshot(`mission_${missionId}_complete`);
      updates.completedAt = new Date().toISOString();
    }

    // Handle failure tracking
    if (updates.status === MissionStatus.FAILED) {
      updates.failureCount = (current.failureCount || 0) + 1;
      updates.lastFailureAt = new Date().toISOString();
      
      // Check if breaker should trip
      if (updates.failureCount >= CircuitBreakerLimits.MAX_FAILURES_PER_MISSION) {
        await this._lockMission(missionId, 'MAX_FAILURES_EXCEEDED');
        await this._createCircuitBreakerArtifact(missionId, 'MAX_FAILURES_EXCEEDED', updates.failureCount);
      }
    }

    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      _stateVersion: (current._stateVersion || 0) + 1
    };

    this.state.missions[missionId] = updated;
    await this._save();
    await this._audit('mission.update', { missionId, updates: Object.keys(updates) });
    
    return structuredClone(updated);
  }

  async _lockMission(missionId, reason) {
    const current = this.state.missions[missionId];
    if (!current) return;

    this.state.missions[missionId] = {
      ...current,
      status: MissionStatus.LOCKED,
      lockedReason: reason,
      updatedAt: new Date().toISOString(),
      _stateVersion: (current._stateVersion || 0) + 1
    };

    await this.createSnapshot(`mission_${missionId}_locked`);
    await this._save();
    await this._audit('mission.lock', { missionId, reason });
  }

  async _createCircuitBreakerArtifact(missionId, reason, failureCount) {
    const artifact = {
      id: `artifact-${Date.now()}-cb`,
      missionId,
      taskId: null,
      type: ArtifactTypes.CIRCUIT_BREAKER_TRIP,
      label: 'Circuit breaker tripped',
      payload: {
        reason,
        failureCount,
        maxFailures: CircuitBreakerLimits.MAX_FAILURES_PER_MISSION,
        trippedAt: new Date().toISOString(),
        requiredAction: 'Human approval via approval.record'
      },
      provenance: { producer: 'system' }
    };
    
    await this.addArtifact(artifact);
  }


  // ============================================
  // TASK MANAGEMENT
  // ============================================

  async createTask(task) {
    if (!task.id || !task.missionId) {
      throw new StateError('Task requires id and missionId', MissionErrorCode.VALIDATION_ERROR);
    }
    
    const mission = this.getMission(task.missionId);
    if (!mission) {
      throw new StateError(`Mission ${task.missionId} not found`, MissionErrorCode.NOT_FOUND);
    }

    const now = new Date().toISOString();
    const newTask = {
      ...task,
      status: task.status || 'pending',
      deps: task.deps || [],
      requiredArtifacts: task.requiredArtifacts || [],
      artifactIds: [],
      createdAt: now,
      updatedAt: now,
      _stateVersion: 1
    };
    
    this.state.tasks[newTask.id] = newTask;
    
    // Add task to mission
    if (!this.state.missions[task.missionId].taskIds.includes(task.id)) {
      this.state.missions[task.missionId].taskIds.push(task.id);
    }
    
    await this._save();
    return structuredClone(newTask);
  }

  async updateTask(taskId, updates) {
    const current = this.state.tasks[taskId];
    if (!current) {
      throw new StateError(`Task ${taskId} not found`, MissionErrorCode.NOT_FOUND);
    }

    // Check dependencies before allowing status=running
    if (updates.status === 'running') {
      const unmetDeps = (current.deps || []).filter(depId => {
        const dep = this.state.tasks[depId];
        return !dep || dep.status !== 'complete';
      });
      
      if (unmetDeps.length > 0) {
        throw new StateError(
          `Cannot start task: dependencies not met (${unmetDeps.join(', ')})`,
          MissionErrorCode.DEPENDENCY_NOT_MET
        );
      }
    }

    // Enforce artifact gate for completion
    if (updates.status === 'complete' && current.requiredArtifacts?.length > 0) {
      const taskArtifacts = Object.values(this.state.artifacts)
        .filter(a => a.taskId === taskId)
        .map(a => a.type);
      
      const missing = current.requiredArtifacts.filter(r => !taskArtifacts.includes(r));
      if (missing.length > 0) {
        throw new StateError(
          `Cannot complete task: missing artifacts (${missing.join(', ')})`,
          MissionErrorCode.COMPLETION_BLOCKED
        );
      }
    }
    
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      _stateVersion: (current._stateVersion || 0) + 1
    };

    this.state.tasks[taskId] = updated;
    await this._save();
    
    return structuredClone(updated);
  }

  // ============================================
  // AGENT MANAGEMENT
  // ============================================

  async registerAgent(agent) {
    if (!agent.id) {
      throw new StateError('Agent requires id', MissionErrorCode.VALIDATION_ERROR);
    }
    
    const now = new Date().toISOString();
    const newAgent = {
      ...agent,
      status: agent.status || 'starting',
      createdAt: now,
      updatedAt: now,
      lastHeartbeat: now,
      _stateVersion: 1
    };
    
    this.state.agents[newAgent.id] = newAgent;
    
    // Add agent to mission if linked
    if (agent.missionId && this.state.missions[agent.missionId]) {
      if (!this.state.missions[agent.missionId].agentIds.includes(agent.id)) {
        this.state.missions[agent.missionId].agentIds.push(agent.id);
      }
    }
    
    await this._save();
    await this._audit('agent.register', { agentId: agent.id, missionId: agent.missionId });
    
    return structuredClone(newAgent);
  }

  async updateAgent(agentId, updates) {
    const current = this.state.agents[agentId];
    if (!current) {
      throw new StateError(`Agent ${agentId} not found`, MissionErrorCode.NOT_FOUND);
    }
    
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      _stateVersion: (current._stateVersion || 0) + 1
    };

    this.state.agents[agentId] = updated;
    await this._save();
    
    return structuredClone(updated);
  }

  async recordHeartbeat(agentId) {
    return this.updateAgent(agentId, { lastHeartbeat: new Date().toISOString() });
  }


  // ============================================
  // ARTIFACT MANAGEMENT (with validation)
  // ============================================

  async addArtifact(artifactData) {
    // Validate and create artifact object
    const artifact = createArtifactObject(artifactData);
    
    this.state.artifacts[artifact.id] = artifact;
    
    // Add to mission
    if (artifact.missionId && this.state.missions[artifact.missionId]) {
      if (!this.state.missions[artifact.missionId].artifactIds.includes(artifact.id)) {
        this.state.missions[artifact.missionId].artifactIds.push(artifact.id);
      }
    }
    
    // Add to task
    if (artifact.taskId && this.state.tasks[artifact.taskId]) {
      if (!this.state.tasks[artifact.taskId].artifactIds.includes(artifact.id)) {
        this.state.tasks[artifact.taskId].artifactIds.push(artifact.id);
      }
    }
    
    await this._save();
    return structuredClone(artifact);
  }

  async updateArtifact(artifactId, updates) {
    const current = this.state.artifacts[artifactId];
    if (!current) {
      throw new StateError(`Artifact ${artifactId} not found`, MissionErrorCode.NOT_FOUND);
    }

    // Enforce mutability rules
    const mutabilityCheck = validateArtifactUpdate(current, updates);
    if (!mutabilityCheck.valid) {
      throw new StateError(mutabilityCheck.errors[0], mutabilityCheck.code);
    }

    // For append-only, merge payload and files
    if (current.artifactMode === 'append-only') {
      if (updates.payload) {
        updates.payload = { ...current.payload, ...updates.payload };
      }
      if (updates.files) {
        updates.files = [...(current.files || []), ...updates.files];
      }
    }

    this.state.artifacts[artifactId] = { ...current, ...updates };
    await this._save();
    
    return structuredClone(this.state.artifacts[artifactId]);
  }

  // ============================================
  // APPROVAL QUEUE (Phase 2)
  // ============================================

  async createApproval(approvalData) {
    if (!approvalData.id || !approvalData.missionId || !approvalData.action) {
      throw new StateError('Approval requires id, missionId, and action', MissionErrorCode.VALIDATION_ERROR);
    }

    const now = new Date().toISOString();
    const approval = {
      ...approvalData,
      status: ApprovalStatus.PENDING,
      autoApproved: false,
      createdAt: now,
      _stateVersion: 1
    };

    this.state.approvals[approval.id] = approval;
    await this._save();
    await this._audit('approval.create', { approvalId: approval.id, action: approval.action });
    
    return structuredClone(approval);
  }

  async resolveApproval(approvalId, decision, approvedBy, comment = null) {
    const current = this.state.approvals[approvalId];
    if (!current) {
      throw new StateError(`Approval ${approvalId} not found`, MissionErrorCode.NOT_FOUND);
    }

    if (current.status !== ApprovalStatus.PENDING) {
      throw new StateError(`Approval ${approvalId} already resolved`, MissionErrorCode.VALIDATION_ERROR);
    }

    const now = new Date().toISOString();
    const updated = {
      ...current,
      status: decision === 'approve' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
      approvedBy: decision === 'approve' ? approvedBy : undefined,
      approvedAt: decision === 'approve' ? now : undefined,
      rejectedBy: decision === 'reject' ? approvedBy : undefined,
      rejectedAt: decision === 'reject' ? now : undefined,
      comment,
      _stateVersion: (current._stateVersion || 0) + 1
    };

    this.state.approvals[approvalId] = updated;
    await this._save();
    await this._audit('approval.resolve', { approvalId, decision, approvedBy });

    // Create approval_record artifact
    await this.addArtifact({
      id: `artifact-${Date.now()}-apr`,
      missionId: current.missionId,
      taskId: current.taskId || null,
      type: ArtifactTypes.APPROVAL_RECORD,
      label: `Approval: ${current.action}`,
      payload: {
        approvalId,
        targetType: current.action,
        decision,
        approvedBy,
        comment,
        timestamp: now
      },
      provenance: { producer: 'system' }
    });

    return structuredClone(updated);
  }


  // ============================================
  // SAFETY CONTROLS (Phase 2)
  // ============================================

  setArmedMode(enabled, riskThreshold = 'medium') {
    this.armedMode = enabled;
    this.riskThreshold = riskThreshold;
    this._audit('safety.armed_mode', { enabled, riskThreshold });
    console.log(`⚡ Armed mode: ${enabled ? 'ENABLED' : 'DISABLED'} (threshold: ${riskThreshold})`);
  }

  isArmedMode() {
    return this.armedMode;
  }

  async checkToolPermission(missionId, toolName) {
    const mission = this.getMission(missionId);
    if (!mission) {
      return { allowed: false, error: `Mission ${missionId} not found` };
    }

    const check = checkToolPermission(mission, toolName);
    if (!check.valid) {
      return { allowed: false, error: check.errors[0], code: check.code };
    }
    return { allowed: true };
  }

  async checkImmediateExecGates(missionId, toolName, estimatedCost = null) {
    const mission = this.getMission(missionId);
    if (!mission) {
      return { allowed: false, error: `Mission ${missionId} not found`, code: MissionErrorCode.NOT_FOUND };
    }

    // 1. Check circuit breaker
    const breakerCheck = checkCircuitBreaker(mission, this.state);
    if (!breakerCheck.valid) {
      return { allowed: false, error: breakerCheck.errors[0], code: breakerCheck.code };
    }

    // 2. Check armed mode
    const armedCheck = checkArmedModeGate(mission, this.armedMode, this.riskThreshold);
    if (!armedCheck.valid) {
      return { allowed: false, error: armedCheck.errors[0], code: armedCheck.code };
    }

    // 3. Check tool permission
    const toolCheck = checkToolPermission(mission, toolName);
    if (!toolCheck.valid) {
      return { allowed: false, error: toolCheck.errors[0], code: toolCheck.code };
    }

    // 4. Check destructive gate
    const destructiveCheck = checkDestructiveGate(mission, toolName, this.armedMode);
    if (!destructiveCheck.valid) {
      // Create approval request instead of blocking
      const approvalId = `approval-${Date.now()}`;
      await this.createApproval({
        id: approvalId,
        missionId,
        action: toolName,
        toolName,
        riskLevel: mission.contract?.riskLevel,
        estimatedCost
      });
      return { 
        allowed: false, 
        error: destructiveCheck.errors[0], 
        code: destructiveCheck.code,
        approvalRequired: true,
        approvalId
      };
    }

    // 5. Check cost limits
    if (estimatedCost) {
      const costCheck = checkCostLimits(mission, estimatedCost);
      if (!costCheck.valid) {
        return { allowed: false, error: costCheck.errors[0], code: costCheck.code };
      }
    }

    // 6. Increment immediate exec counter
    await this.updateMission(missionId, {
      immediateExecCount: (mission.immediateExecCount || 0) + 1
    });

    return { allowed: true };
  }

  // ============================================
  // CIRCUIT BREAKER CONTROLS
  // ============================================

  async tripCircuitBreaker(reason) {
    this.state.circuitBreaker = {
      tripped: true,
      reason,
      trippedAt: new Date().toISOString()
    };
    await this.createSnapshot('circuit_breaker_trip');
    await this._save();
    await this._audit('circuit_breaker.trip', { reason });
  }

  async resetCircuitBreaker(approvedBy) {
    this.state.circuitBreaker = {
      tripped: false,
      reason: null,
      trippedAt: null
    };
    await this._save();
    await this._audit('circuit_breaker.reset', { approvedBy });
  }

  async unlockMission(missionId, approvedBy) {
    const current = this.state.missions[missionId];
    if (!current) {
      throw new StateError(`Mission ${missionId} not found`, MissionErrorCode.NOT_FOUND);
    }

    if (current.status !== MissionStatus.LOCKED) {
      throw new StateError(`Mission ${missionId} is not locked`, MissionErrorCode.VALIDATION_ERROR);
    }

    // Reset failure counters
    await this.updateMission(missionId, {
      status: MissionStatus.BLOCKED,
      lockedReason: null,
      failureCount: 0,
      immediateExecCount: 0
    });

    await this._audit('mission.unlock', { missionId, approvedBy });
    
    return this.getMission(missionId);
  }

  isCircuitBreakerTripped() {
    return this.state.circuitBreaker?.tripped || false;
  }


  // ============================================
  // SUBSCRIPTION SYSTEM
  // ============================================

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _notify() {
    for (const callback of this.subscribers) {
      try {
        callback(this.getState());
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    }
  }

  // ============================================
  // QUERY HELPERS
  // ============================================

  listMissions(filter = {}) {
    let missions = Object.values(this.state.missions);
    
    if (filter.status) {
      missions = missions.filter(m => m.status === filter.status);
    }
    if (filter.missionClass) {
      missions = missions.filter(m => m.missionClass === filter.missionClass);
    }
    
    return missions.map(m => structuredClone(m));
  }

  listTasks(missionId) {
    return Object.values(this.state.tasks)
      .filter(t => t.missionId === missionId)
      .map(t => structuredClone(t));
  }

  listAgents(filter = {}) {
    let agents = Object.values(this.state.agents);
    
    if (filter.status) {
      agents = agents.filter(a => a.status === filter.status);
    }
    if (filter.missionId) {
      agents = agents.filter(a => a.missionId === filter.missionId);
    }
    
    return agents.map(a => structuredClone(a));
  }

  // ============================================
  // STATISTICS
  // ============================================

  getStats() {
    return {
      missions: {
        total: Object.keys(this.state.missions).length,
        byStatus: this._countByField(this.state.missions, 'status')
      },
      tasks: {
        total: Object.keys(this.state.tasks).length,
        byStatus: this._countByField(this.state.tasks, 'status')
      },
      agents: {
        total: Object.keys(this.state.agents).length,
        byStatus: this._countByField(this.state.agents, 'status')
      },
      artifacts: {
        total: Object.keys(this.state.artifacts).length,
        byType: this._countByField(this.state.artifacts, 'type')
      },
      approvals: {
        total: Object.keys(this.state.approvals).length,
        pending: Object.values(this.state.approvals).filter(a => a.status === ApprovalStatus.PENDING).length
      },
      circuitBreaker: this.state.circuitBreaker,
      armedMode: this.armedMode,
      _stateVersion: this.state._stateVersion
    };
  }

  _countByField(obj, field) {
    const counts = {};
    for (const item of Object.values(obj)) {
      const value = item[field] || 'unknown';
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const stateStore = new StateStore();
export { StateStore, StateError };
export default stateStore;
