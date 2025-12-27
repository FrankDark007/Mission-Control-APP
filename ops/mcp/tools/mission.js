/**
 * Mission Control V7 — MCP Mission Tools
 * Mission CRUD operations with contract enforcement
 */

import { stateStore } from '../../state/StateStore.js';
import { MissionStatus, MissionClass, RiskLevel } from '../../state/schema.js';
import { taskGraphService } from '../../services/taskGraphService.js';

export const missionTools = {
  // ============================================
  // MISSION CRUD
  // ============================================

  'mission.create': {
    schema: {
      description: 'Create a new mission with contract. Returns mission object.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique mission ID' },
          title: { type: 'string', description: 'Mission title' },
          description: { type: 'string', description: 'Mission description' },
          missionClass: {
            type: 'string',
            enum: Object.values(MissionClass),
            description: 'Mission class: exploration, implementation, maintenance, destructive, continuous'
          },
          requiredArtifacts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Artifact types required for completion'
          },
          riskLevel: {
            type: 'string',
            enum: Object.values(RiskLevel),
            description: 'Risk level: low, medium, high'
          },
          allowedTools: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tools allowed for this mission'
          },
          maxEstimatedCost: { type: 'number', description: 'Max budget in dollars' },
          rollbackStrategy: { type: 'string', description: 'Rollback plan if needed' }
        },
        required: ['id', 'title', 'missionClass', 'riskLevel']
      }
    },
    handler: async (params) => {
      const mission = await stateStore.createMission({
        id: params.id,
        title: params.title,
        description: params.description || '',
        missionClass: params.missionClass,
        contract: {
          requiredArtifacts: params.requiredArtifacts || [],
          riskLevel: params.riskLevel,
          allowedTools: params.allowedTools || [],
          maxEstimatedCost: params.maxEstimatedCost,
          rollbackStrategy: params.rollbackStrategy
        }
      });
      return { content: [{ type: 'text', text: JSON.stringify(mission, null, 2) }] };
    }
  },

  'mission.get': {
    schema: {
      description: 'Get mission by ID with full details.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params) => {
      const mission = stateStore.getMission(params.missionId);
      if (!mission) {
        return { content: [{ type: 'text', text: `Mission ${params.missionId} not found` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(mission, null, 2) }] };
    }
  },

  'mission.list': {
    schema: {
      description: 'List missions with optional status filter.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: Object.values(MissionStatus),
            description: 'Filter by status'
          },
          missionClass: {
            type: 'string',
            enum: Object.values(MissionClass),
            description: 'Filter by class'
          }
        }
      }
    },
    handler: async (params) => {
      const missions = stateStore.listMissions(params);
      return { content: [{ type: 'text', text: JSON.stringify(missions, null, 2) }] };
    }
  },

  'mission.update_status': {
    schema: {
      description: 'Update mission status. Enforces completion gates.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          status: {
            type: 'string',
            enum: Object.values(MissionStatus),
            description: 'New status'
          }
        },
        required: ['missionId', 'status']
      }
    },
    handler: async (params) => {
      try {
        const mission = await stateStore.updateMission(params.missionId, {
          status: params.status
        });
        return { content: [{ type: 'text', text: JSON.stringify(mission, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // MISSION PROGRESS
  // ============================================

  'mission.get_progress': {
    schema: {
      description: 'Get mission progress with task breakdown.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params) => {
      const progress = taskGraphService.getMissionProgress(params.missionId);
      const graphStatus = taskGraphService.getStatus(params.missionId);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ progress, graphStatus }, null, 2)
        }]
      };
    }
  },

  'mission.get_artifacts': {
    schema: {
      description: 'Get all artifacts for a mission.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params) => {
      const artifacts = stateStore.getMissionArtifacts(params.missionId);
      return { content: [{ type: 'text', text: JSON.stringify(artifacts, null, 2) }] };
    }
  },

  // ============================================
  // MISSION CONTROLS
  // ============================================

  'mission.unlock': {
    schema: {
      description: 'Unlock a locked mission (requires approval).',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          approvedBy: { type: 'string', description: 'Who approved the unlock' }
        },
        required: ['missionId', 'approvedBy']
      }
    },
    handler: async (params) => {
      try {
        const mission = await stateStore.unlockMission(params.missionId, params.approvedBy);
        return { content: [{ type: 'text', text: JSON.stringify(mission, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  }
};

export default missionTools;
