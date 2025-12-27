/**
 * Mission Control V7 — MCP Task Tools
 * Task management with dependency resolution and gates
 */

import { stateStore } from '../../state/StateStore.js';
import { TaskStatus, TaskType } from '../../state/schema.js';
import { taskGraphService } from '../../services/taskGraphService.js';

export const taskTools = {
  // ============================================
  // TASK CRUD
  // ============================================

  'task.create': {
    schema: {
      description: 'Create a new task for a mission.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique task ID' },
          missionId: { type: 'string', description: 'Parent mission ID' },
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task description' },
          taskType: {
            type: 'string',
            enum: Object.values(TaskType),
            description: 'Task type: work, verification, finalization'
          },
          deps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Task IDs this task depends on'
          },
          requiredArtifacts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Artifact types required to complete this task'
          },
          model: { type: 'string', description: 'Preferred model for this task' }
        },
        required: ['id', 'missionId', 'title']
      }
    },
    handler: async (params) => {
      const task = await stateStore.createTask({
        id: params.id,
        missionId: params.missionId,
        title: params.title,
        description: params.description || '',
        taskType: params.taskType || TaskType.WORK,
        deps: params.deps || [],
        requiredArtifacts: params.requiredArtifacts || [],
        model: params.model
      });

      // Invalidate graph cache
      taskGraphService.invalidateCache(params.missionId);

      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    }
  },

  'task.get': {
    schema: {
      description: 'Get task by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' }
        },
        required: ['taskId']
      }
    },
    handler: async (params) => {
      const task = stateStore.getTask(params.taskId);
      if (!task) {
        return { content: [{ type: 'text', text: `Task ${params.taskId} not found` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    }
  },

  'task.list': {
    schema: {
      description: 'List tasks for a mission.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params) => {
      const tasks = stateStore.listTasks(params.missionId);
      return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    }
  },

  'task.update_status': {
    schema: {
      description: 'Update task status. Validates dependencies and gates.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' },
          status: {
            type: 'string',
            enum: Object.values(TaskStatus),
            description: 'New status'
          }
        },
        required: ['taskId', 'status']
      }
    },
    handler: async (params) => {
      const task = stateStore.getTask(params.taskId);
      if (!task) {
        return { content: [{ type: 'text', text: `Task ${params.taskId} not found` }] };
      }

      // Validate transition
      const validation = await taskGraphService.validateTransition(
        task.missionId,
        params.taskId,
        params.status
      );

      if (!validation.valid) {
        return { content: [{ type: 'text', text: `Cannot update: ${validation.error}` }] };
      }

      try {
        const updated = await stateStore.updateTask(params.taskId, {
          status: params.status,
          ...(params.status === TaskStatus.RUNNING && { startedAt: new Date().toISOString() }),
          ...(params.status === TaskStatus.COMPLETE && { completedAt: new Date().toISOString() })
        });
        return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // DEPENDENCY RESOLUTION
  // ============================================

  'task.check_dependencies': {
    schema: {
      description: 'Check if task dependencies are met.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' }
        },
        required: ['taskId']
      }
    },
    handler: async (params) => {
      const task = stateStore.getTask(params.taskId);
      if (!task) {
        return { content: [{ type: 'text', text: `Task ${params.taskId} not found` }] };
      }

      const deps = taskGraphService.resolveDependencies(task.missionId, params.taskId);
      return { content: [{ type: 'text', text: JSON.stringify(deps, null, 2) }] };
    }
  },

  'task.check_gate': {
    schema: {
      description: 'Check if task gate is passed (work/verification/finalization).',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' }
        },
        required: ['taskId']
      }
    },
    handler: async (params) => {
      const task = stateStore.getTask(params.taskId);
      if (!task) {
        return { content: [{ type: 'text', text: `Task ${params.taskId} not found` }] };
      }

      const gateCheck = taskGraphService.checkTaskGate(task.missionId, params.taskId);
      const artifactCheck = taskGraphService.checkArtifactGate(task.missionId, params.taskId);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ taskGate: gateCheck, artifactGate: artifactCheck }, null, 2)
        }]
      };
    }
  },

  // ============================================
  // SCHEDULING
  // ============================================

  'task.get_ready': {
    schema: {
      description: 'Get tasks ready to execute (dependencies met, gates passed).',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params) => {
      const ready = taskGraphService.getReadyTasks(params.missionId);
      return { content: [{ type: 'text', text: JSON.stringify(ready, null, 2) }] };
    }
  },

  'task.get_next': {
    schema: {
      description: 'Get next task to execute based on priority and type.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params) => {
      const next = taskGraphService.getNextTask(params.missionId);
      if (!next) {
        return { content: [{ type: 'text', text: 'No tasks ready to execute' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(next, null, 2) }] };
    }
  },

  'task.get_execution_order': {
    schema: {
      description: 'Get topologically sorted execution order for all tasks.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params) => {
      const order = taskGraphService.computeExecutionOrder(params.missionId);
      return { content: [{ type: 'text', text: JSON.stringify(order, null, 2) }] };
    }
  },

  // ============================================
  // VISUALIZATION
  // ============================================

  'task.visualize_graph': {
    schema: {
      description: 'Get ASCII visualization of task dependency graph.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params) => {
      const viz = taskGraphService.visualize(params.missionId);
      return { content: [{ type: 'text', text: viz }] };
    }
  }
};

export default taskTools;
