/**
 * Mission Control V7 — Task Graph Service
 * Dependency resolution, task types (work, verification, finalization), and task gates
 *
 * Phase 5: Task Graph Implementation
 */

import { stateStore } from '../state/StateStore.js';
import { TaskStatus, TaskType } from '../state/schema.js';
import { ArtifactTypes } from '../state/ArtifactTypes.js';

// ============================================
// ERROR CODES
// ============================================

export const TaskGraphErrorCode = {
  CYCLE_DETECTED: 'CYCLE_DETECTED',
  DEPENDENCY_NOT_FOUND: 'DEPENDENCY_NOT_FOUND',
  INVALID_TASK_TYPE: 'INVALID_TASK_TYPE',
  GATE_NOT_PASSED: 'GATE_NOT_PASSED',
  TASK_NOT_READY: 'TASK_NOT_READY',
  FINALIZATION_BLOCKED: 'FINALIZATION_BLOCKED',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED'
};

// ============================================
// TASK TYPE ORDERING
// ============================================

const TASK_TYPE_ORDER = {
  [TaskType.WORK]: 1,
  [TaskType.VERIFICATION]: 2,
  [TaskType.FINALIZATION]: 3
};

// ============================================
// TASK GATES
// ============================================

export const TaskGates = {
  // Work tasks can start when deps are complete
  WORK_GATE: 'work_gate',
  // Verification tasks require all work tasks complete + their deps
  VERIFICATION_GATE: 'verification_gate',
  // Finalization requires verification passed + all tasks complete
  FINALIZATION_GATE: 'finalization_gate',
  // Artifact gate - task cannot complete without required artifacts
  ARTIFACT_GATE: 'artifact_gate'
};


// ============================================
// TASK GRAPH SERVICE CLASS
// ============================================

class TaskGraphService {
  constructor() {
    this.graphCache = new Map();  // missionId -> computed graph
    this.executionOrder = new Map();  // missionId -> ordered task list
  }

  // ============================================
  // GRAPH CONSTRUCTION
  // ============================================

  buildGraph(missionId) {
    const tasks = stateStore.listTasks(missionId);
    const graph = {
      nodes: new Map(),
      edges: new Map(),      // taskId -> [dependsOn]
      reverseEdges: new Map(), // taskId -> [dependedOnBy]
      byType: {
        [TaskType.WORK]: [],
        [TaskType.VERIFICATION]: [],
        [TaskType.FINALIZATION]: []
      }
    };

    // Build nodes and categorize by type
    for (const task of tasks) {
      graph.nodes.set(task.id, task);
      graph.edges.set(task.id, task.deps || []);
      graph.reverseEdges.set(task.id, []);

      const taskType = task.taskType || TaskType.WORK;
      if (graph.byType[taskType]) {
        graph.byType[taskType].push(task.id);
      }
    }

    // Build reverse edges (who depends on me)
    for (const [taskId, deps] of graph.edges) {
      for (const depId of deps) {
        if (graph.reverseEdges.has(depId)) {
          graph.reverseEdges.get(depId).push(taskId);
        }
      }
    }

    this.graphCache.set(missionId, graph);
    return graph;
  }

  getGraph(missionId) {
    if (!this.graphCache.has(missionId)) {
      return this.buildGraph(missionId);
    }
    return this.graphCache.get(missionId);
  }

  invalidateCache(missionId) {
    this.graphCache.delete(missionId);
    this.executionOrder.delete(missionId);
  }


  // ============================================
  // DEPENDENCY RESOLUTION
  // ============================================

  resolveDependencies(missionId, taskId) {
    const graph = this.getGraph(missionId);
    const task = graph.nodes.get(taskId);

    if (!task) {
      return {
        success: false,
        error: `Task ${taskId} not found`,
        code: TaskGraphErrorCode.DEPENDENCY_NOT_FOUND
      };
    }

    const deps = graph.edges.get(taskId) || [];
    const resolved = [];
    const unresolved = [];

    for (const depId of deps) {
      const depTask = graph.nodes.get(depId);
      if (!depTask) {
        return {
          success: false,
          error: `Dependency ${depId} not found for task ${taskId}`,
          code: TaskGraphErrorCode.DEPENDENCY_NOT_FOUND
        };
      }

      if (depTask.status === TaskStatus.COMPLETE) {
        resolved.push(depId);
      } else {
        unresolved.push({
          id: depId,
          status: depTask.status,
          title: depTask.title
        });
      }
    }

    return {
      success: true,
      taskId,
      resolved,
      unresolved,
      allMet: unresolved.length === 0
    };
  }

  getAllDependencies(missionId, taskId, visited = new Set()) {
    const graph = this.getGraph(missionId);
    const deps = graph.edges.get(taskId) || [];
    const allDeps = new Set();

    for (const depId of deps) {
      if (visited.has(depId)) continue;
      visited.add(depId);
      allDeps.add(depId);

      // Recursively get transitive deps
      const transitive = this.getAllDependencies(missionId, depId, visited);
      for (const td of transitive) {
        allDeps.add(td);
      }
    }

    return Array.from(allDeps);
  }


  // ============================================
  // CYCLE DETECTION
  // ============================================

  detectCycle(missionId) {
    const graph = this.getGraph(missionId);
    const visited = new Set();
    const recStack = new Set();
    const cyclePath = [];

    const dfs = (taskId, path) => {
      visited.add(taskId);
      recStack.add(taskId);
      path.push(taskId);

      const deps = graph.edges.get(taskId) || [];
      for (const depId of deps) {
        if (!visited.has(depId)) {
          const cycle = dfs(depId, [...path]);
          if (cycle) return cycle;
        } else if (recStack.has(depId)) {
          // Found cycle
          const cycleStart = path.indexOf(depId);
          return path.slice(cycleStart).concat(depId);
        }
      }

      recStack.delete(taskId);
      return null;
    };

    for (const taskId of graph.nodes.keys()) {
      if (!visited.has(taskId)) {
        const cycle = dfs(taskId, []);
        if (cycle) {
          return {
            hasCycle: true,
            cycle,
            message: `Cycle detected: ${cycle.join(' -> ')}`
          };
        }
      }
    }

    return { hasCycle: false };
  }


  // ============================================
  // TOPOLOGICAL SORT (Execution Order)
  // ============================================

  computeExecutionOrder(missionId) {
    const graph = this.getGraph(missionId);

    // First check for cycles
    const cycleCheck = this.detectCycle(missionId);
    if (cycleCheck.hasCycle) {
      return {
        success: false,
        error: cycleCheck.message,
        code: TaskGraphErrorCode.CYCLE_DETECTED
      };
    }

    // Kahn's algorithm for topological sort
    const inDegree = new Map();
    const queue = [];
    const order = [];

    // Initialize in-degrees
    for (const taskId of graph.nodes.keys()) {
      const deps = graph.edges.get(taskId) || [];
      inDegree.set(taskId, deps.length);
      if (deps.length === 0) {
        queue.push(taskId);
      }
    }

    // Process queue
    while (queue.length > 0) {
      // Sort queue by task type priority (work < verification < finalization)
      queue.sort((a, b) => {
        const taskA = graph.nodes.get(a);
        const taskB = graph.nodes.get(b);
        const orderA = TASK_TYPE_ORDER[taskA?.taskType || TaskType.WORK];
        const orderB = TASK_TYPE_ORDER[taskB?.taskType || TaskType.WORK];
        return orderA - orderB;
      });

      const taskId = queue.shift();
      order.push(taskId);

      // Reduce in-degree of dependents
      const dependents = graph.reverseEdges.get(taskId) || [];
      for (const depId of dependents) {
        inDegree.set(depId, inDegree.get(depId) - 1);
        if (inDegree.get(depId) === 0) {
          queue.push(depId);
        }
      }
    }

    // Check if all tasks are included
    if (order.length !== graph.nodes.size) {
      return {
        success: false,
        error: 'Could not order all tasks (possible missing dependency)',
        code: TaskGraphErrorCode.CYCLE_DETECTED
      };
    }

    this.executionOrder.set(missionId, order);
    return {
      success: true,
      order,
      orderWithDetails: order.map(id => {
        const task = graph.nodes.get(id);
        return {
          id,
          title: task?.title,
          taskType: task?.taskType || TaskType.WORK,
          status: task?.status
        };
      })
    };
  }


  // ============================================
  // TASK GATES
  // ============================================

  checkTaskGate(missionId, taskId) {
    const graph = this.getGraph(missionId);
    const task = graph.nodes.get(taskId);

    if (!task) {
      return {
        passed: false,
        gate: null,
        error: `Task ${taskId} not found`,
        code: TaskGraphErrorCode.DEPENDENCY_NOT_FOUND
      };
    }

    const taskType = task.taskType || TaskType.WORK;

    switch (taskType) {
      case TaskType.WORK:
        return this._checkWorkGate(missionId, taskId, graph);
      case TaskType.VERIFICATION:
        return this._checkVerificationGate(missionId, taskId, graph);
      case TaskType.FINALIZATION:
        return this._checkFinalizationGate(missionId, taskId, graph);
      default:
        return {
          passed: false,
          gate: null,
          error: `Unknown task type: ${taskType}`,
          code: TaskGraphErrorCode.INVALID_TASK_TYPE
        };
    }
  }

  _checkWorkGate(missionId, taskId, graph) {
    // Work gate: all direct dependencies must be complete
    const depCheck = this.resolveDependencies(missionId, taskId);

    if (!depCheck.success) {
      return {
        passed: false,
        gate: TaskGates.WORK_GATE,
        error: depCheck.error,
        code: depCheck.code
      };
    }

    if (!depCheck.allMet) {
      return {
        passed: false,
        gate: TaskGates.WORK_GATE,
        error: `Waiting on dependencies: ${depCheck.unresolved.map(d => d.title || d.id).join(', ')}`,
        code: TaskGraphErrorCode.TASK_NOT_READY,
        blocking: depCheck.unresolved
      };
    }

    return {
      passed: true,
      gate: TaskGates.WORK_GATE
    };
  }

  _checkVerificationGate(missionId, taskId, graph) {
    // Verification gate: all work tasks this depends on must be complete
    const depCheck = this.resolveDependencies(missionId, taskId);

    if (!depCheck.success) {
      return {
        passed: false,
        gate: TaskGates.VERIFICATION_GATE,
        error: depCheck.error,
        code: depCheck.code
      };
    }

    // Also check that all referenced work tasks are complete
    const allDeps = this.getAllDependencies(missionId, taskId);
    const workTasks = allDeps.filter(depId => {
      const dep = graph.nodes.get(depId);
      return dep && (dep.taskType === TaskType.WORK || !dep.taskType);
    });

    const incompleteWork = workTasks.filter(wId => {
      const work = graph.nodes.get(wId);
      return work && work.status !== TaskStatus.COMPLETE;
    });

    if (incompleteWork.length > 0) {
      return {
        passed: false,
        gate: TaskGates.VERIFICATION_GATE,
        error: `Verification blocked: ${incompleteWork.length} work task(s) incomplete`,
        code: TaskGraphErrorCode.VERIFICATION_REQUIRED,
        blocking: incompleteWork.map(id => ({
          id,
          title: graph.nodes.get(id)?.title
        }))
      };
    }

    if (!depCheck.allMet) {
      return {
        passed: false,
        gate: TaskGates.VERIFICATION_GATE,
        error: `Waiting on dependencies: ${depCheck.unresolved.map(d => d.title || d.id).join(', ')}`,
        code: TaskGraphErrorCode.TASK_NOT_READY,
        blocking: depCheck.unresolved
      };
    }

    return {
      passed: true,
      gate: TaskGates.VERIFICATION_GATE
    };
  }

  _checkFinalizationGate(missionId, taskId, graph) {
    // Finalization gate: all verification tasks must be complete
    const verificationTasks = graph.byType[TaskType.VERIFICATION];
    const incompleteVerification = verificationTasks.filter(vId => {
      const v = graph.nodes.get(vId);
      return v && v.status !== TaskStatus.COMPLETE;
    });

    if (incompleteVerification.length > 0) {
      return {
        passed: false,
        gate: TaskGates.FINALIZATION_GATE,
        error: `Finalization blocked: ${incompleteVerification.length} verification task(s) incomplete`,
        code: TaskGraphErrorCode.FINALIZATION_BLOCKED,
        blocking: incompleteVerification.map(id => ({
          id,
          title: graph.nodes.get(id)?.title,
          status: graph.nodes.get(id)?.status
        }))
      };
    }

    // Also check all work tasks are complete
    const workTasks = graph.byType[TaskType.WORK];
    const incompleteWork = workTasks.filter(wId => {
      const w = graph.nodes.get(wId);
      return w && w.status !== TaskStatus.COMPLETE;
    });

    if (incompleteWork.length > 0) {
      return {
        passed: false,
        gate: TaskGates.FINALIZATION_GATE,
        error: `Finalization blocked: ${incompleteWork.length} work task(s) incomplete`,
        code: TaskGraphErrorCode.FINALIZATION_BLOCKED,
        blocking: incompleteWork.map(id => ({
          id,
          title: graph.nodes.get(id)?.title
        }))
      };
    }

    // Check direct dependencies
    const depCheck = this.resolveDependencies(missionId, taskId);
    if (!depCheck.allMet) {
      return {
        passed: false,
        gate: TaskGates.FINALIZATION_GATE,
        error: `Waiting on dependencies: ${depCheck.unresolved.map(d => d.title || d.id).join(', ')}`,
        code: TaskGraphErrorCode.TASK_NOT_READY,
        blocking: depCheck.unresolved
      };
    }

    return {
      passed: true,
      gate: TaskGates.FINALIZATION_GATE
    };
  }


  // ============================================
  // ARTIFACT GATE
  // ============================================

  checkArtifactGate(missionId, taskId) {
    const task = stateStore.getTask(taskId);
    if (!task) {
      return {
        passed: false,
        gate: TaskGates.ARTIFACT_GATE,
        error: `Task ${taskId} not found`,
        code: TaskGraphErrorCode.DEPENDENCY_NOT_FOUND
      };
    }

    const requiredArtifacts = task.requiredArtifacts || [];
    if (requiredArtifacts.length === 0) {
      return { passed: true, gate: TaskGates.ARTIFACT_GATE };
    }

    // Get artifacts for this task
    const artifacts = Object.values(stateStore.getState().artifacts || {})
      .filter(a => a.taskId === taskId);
    const artifactTypes = artifacts.map(a => a.type);

    const missing = requiredArtifacts.filter(r => !artifactTypes.includes(r));

    if (missing.length > 0) {
      return {
        passed: false,
        gate: TaskGates.ARTIFACT_GATE,
        error: `Missing required artifacts: ${missing.join(', ')}`,
        code: TaskGraphErrorCode.GATE_NOT_PASSED,
        missing,
        present: artifactTypes
      };
    }

    return {
      passed: true,
      gate: TaskGates.ARTIFACT_GATE,
      artifacts: artifactTypes
    };
  }


  // ============================================
  // READY TASKS (for scheduling)
  // ============================================

  getReadyTasks(missionId) {
    const graph = this.getGraph(missionId);
    const ready = [];

    for (const [taskId, task] of graph.nodes) {
      // Skip already completed or running tasks
      if (task.status === TaskStatus.COMPLETE ||
          task.status === TaskStatus.RUNNING) {
        continue;
      }

      // Skip failed or blocked
      if (task.status === TaskStatus.FAILED ||
          task.status === TaskStatus.BLOCKED) {
        continue;
      }

      // Check task gate
      const gateCheck = this.checkTaskGate(missionId, taskId);
      if (gateCheck.passed) {
        ready.push({
          id: taskId,
          title: task.title,
          taskType: task.taskType || TaskType.WORK,
          status: task.status,
          gate: gateCheck.gate
        });
      }
    }

    // Sort by task type order (work first, then verification, then finalization)
    ready.sort((a, b) => {
      const orderA = TASK_TYPE_ORDER[a.taskType] || 1;
      const orderB = TASK_TYPE_ORDER[b.taskType] || 1;
      return orderA - orderB;
    });

    return ready;
  }

  getNextTask(missionId) {
    const ready = this.getReadyTasks(missionId);
    return ready.length > 0 ? ready[0] : null;
  }


  // ============================================
  // MISSION PROGRESS
  // ============================================

  getMissionProgress(missionId) {
    const graph = this.getGraph(missionId);
    const total = graph.nodes.size;

    if (total === 0) {
      return {
        missionId,
        total: 0,
        completed: 0,
        running: 0,
        pending: 0,
        failed: 0,
        blocked: 0,
        percentComplete: 0,
        byType: {}
      };
    }

    const counts = {
      [TaskStatus.COMPLETE]: 0,
      [TaskStatus.RUNNING]: 0,
      [TaskStatus.PENDING]: 0,
      [TaskStatus.READY]: 0,
      [TaskStatus.FAILED]: 0,
      [TaskStatus.BLOCKED]: 0
    };

    const byType = {
      [TaskType.WORK]: { total: 0, complete: 0 },
      [TaskType.VERIFICATION]: { total: 0, complete: 0 },
      [TaskType.FINALIZATION]: { total: 0, complete: 0 }
    };

    for (const task of graph.nodes.values()) {
      const status = task.status || TaskStatus.PENDING;
      const taskType = task.taskType || TaskType.WORK;

      if (counts[status] !== undefined) {
        counts[status]++;
      }

      if (byType[taskType]) {
        byType[taskType].total++;
        if (status === TaskStatus.COMPLETE) {
          byType[taskType].complete++;
        }
      }
    }

    const completed = counts[TaskStatus.COMPLETE];
    const ready = this.getReadyTasks(missionId).length;

    return {
      missionId,
      total,
      completed,
      running: counts[TaskStatus.RUNNING],
      pending: counts[TaskStatus.PENDING] + counts[TaskStatus.READY],
      ready,
      failed: counts[TaskStatus.FAILED],
      blocked: counts[TaskStatus.BLOCKED],
      percentComplete: Math.round((completed / total) * 100),
      byType
    };
  }


  // ============================================
  // TASK TRANSITION VALIDATION
  // ============================================

  async validateTransition(missionId, taskId, newStatus) {
    const task = stateStore.getTask(taskId);
    if (!task) {
      return {
        valid: false,
        error: `Task ${taskId} not found`,
        code: TaskGraphErrorCode.DEPENDENCY_NOT_FOUND
      };
    }

    const currentStatus = task.status;

    // Validate status transitions
    const validTransitions = {
      [TaskStatus.PENDING]: [TaskStatus.READY, TaskStatus.BLOCKED],
      [TaskStatus.READY]: [TaskStatus.RUNNING, TaskStatus.BLOCKED],
      [TaskStatus.RUNNING]: [TaskStatus.COMPLETE, TaskStatus.FAILED, TaskStatus.BLOCKED],
      [TaskStatus.BLOCKED]: [TaskStatus.PENDING, TaskStatus.READY],
      [TaskStatus.FAILED]: [TaskStatus.PENDING]  // Allow retry
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return {
        valid: false,
        error: `Invalid transition: ${currentStatus} -> ${newStatus}`,
        allowedTransitions: allowed
      };
    }

    // For transition to RUNNING, check gate
    if (newStatus === TaskStatus.RUNNING) {
      const gateCheck = this.checkTaskGate(missionId, taskId);
      if (!gateCheck.passed) {
        return {
          valid: false,
          error: gateCheck.error,
          code: gateCheck.code,
          gate: gateCheck.gate,
          blocking: gateCheck.blocking
        };
      }
    }

    // For transition to COMPLETE, check artifact gate
    if (newStatus === TaskStatus.COMPLETE) {
      const artifactCheck = this.checkArtifactGate(missionId, taskId);
      if (!artifactCheck.passed) {
        return {
          valid: false,
          error: artifactCheck.error,
          code: artifactCheck.code,
          gate: artifactCheck.gate,
          missing: artifactCheck.missing
        };
      }
    }

    return { valid: true };
  }


  // ============================================
  // GRAPH VISUALIZATION (for debugging)
  // ============================================

  visualize(missionId) {
    const graph = this.getGraph(missionId);
    const lines = ['Task Graph Visualization:', ''];

    const statusIcons = {
      [TaskStatus.COMPLETE]: '[x]',
      [TaskStatus.RUNNING]: '[>]',
      [TaskStatus.PENDING]: '[ ]',
      [TaskStatus.READY]: '[o]',
      [TaskStatus.FAILED]: '[!]',
      [TaskStatus.BLOCKED]: '[-]'
    };

    const typeLabels = {
      [TaskType.WORK]: 'WORK',
      [TaskType.VERIFICATION]: 'VERIFY',
      [TaskType.FINALIZATION]: 'FINAL'
    };

    // Group by type
    for (const [type, taskIds] of Object.entries(graph.byType)) {
      if (taskIds.length === 0) continue;

      lines.push(`${typeLabels[type] || type}:`);

      for (const taskId of taskIds) {
        const task = graph.nodes.get(taskId);
        const deps = graph.edges.get(taskId) || [];
        const icon = statusIcons[task?.status] || '[ ]';

        let line = `  ${icon} ${task?.title || taskId}`;
        if (deps.length > 0) {
          line += ` (deps: ${deps.length})`;
        }
        lines.push(line);
      }
      lines.push('');
    }

    return lines.join('\n');
  }


  // ============================================
  // STATUS & REPORTING
  // ============================================

  getStatus(missionId) {
    const graph = this.getGraph(missionId);
    const progress = this.getMissionProgress(missionId);
    const ready = this.getReadyTasks(missionId);
    const cycleCheck = this.detectCycle(missionId);

    return {
      missionId,
      nodeCount: graph.nodes.size,
      edgeCount: Array.from(graph.edges.values()).reduce((sum, deps) => sum + deps.length, 0),
      progress,
      readyTasks: ready.length,
      nextTask: ready[0] || null,
      hasCycle: cycleCheck.hasCycle,
      cycleDetails: cycleCheck.hasCycle ? cycleCheck.message : null
    };
  }
}


// ============================================
// SINGLETON EXPORT
// ============================================

export const taskGraphService = new TaskGraphService();
export { TaskGraphService };
export default taskGraphService;
