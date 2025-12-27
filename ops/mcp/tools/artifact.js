/**
 * Mission Control V7 — MCP Artifact Tools
 * Artifact creation and queries with validation
 */

import { stateStore } from '../../state/StateStore.js';
import { ArtifactTypes, ArtifactMode, isValidArtifactType } from '../../state/ArtifactTypes.js';

export const artifactTools = {
  // ============================================
  // ARTIFACT CREATION
  // ============================================

  'artifact.create': {
    schema: {
      description: 'Create a new artifact with provenance tracking.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Parent mission ID' },
          taskId: { type: 'string', description: 'Parent task ID (optional)' },
          type: {
            type: 'string',
            description: 'Artifact type (git_diff, build_log, verification_report, etc.)'
          },
          label: { type: 'string', description: 'Human-readable label' },
          payload: { type: 'object', description: 'Artifact payload data' },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Associated file paths'
          },
          producer: {
            type: 'string',
            enum: ['agent', 'watchdog', 'system', 'human'],
            description: 'Who created this artifact'
          },
          agentId: { type: 'string', description: 'Agent ID if produced by agent' },
          commitHash: { type: 'string', description: 'Git commit hash if applicable' }
        },
        required: ['missionId', 'type', 'label', 'producer']
      }
    },
    handler: async (params) => {
      if (!isValidArtifactType(params.type)) {
        return {
          content: [{
            type: 'text',
            text: `Invalid artifact type: ${params.type}. Valid types: ${Object.values(ArtifactTypes).join(', ')}`
          }]
        };
      }

      try {
        const artifact = await stateStore.addArtifact({
          id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          missionId: params.missionId,
          taskId: params.taskId || null,
          type: params.type,
          label: params.label,
          payload: params.payload || null,
          files: params.files || [],
          provenance: {
            producer: params.producer,
            agentId: params.agentId || null,
            commitHash: params.commitHash || null
          }
        });
        return { content: [{ type: 'text', text: JSON.stringify(artifact, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'artifact.get': {
    schema: {
      description: 'Get artifact by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          artifactId: { type: 'string', description: 'Artifact ID' }
        },
        required: ['artifactId']
      }
    },
    handler: async (params) => {
      const artifact = stateStore.getArtifact(params.artifactId);
      if (!artifact) {
        return { content: [{ type: 'text', text: `Artifact ${params.artifactId} not found` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(artifact, null, 2) }] };
    }
  },

  'artifact.list': {
    schema: {
      description: 'List artifacts for a mission, optionally filtered by type.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          type: { type: 'string', description: 'Filter by artifact type' },
          taskId: { type: 'string', description: 'Filter by task ID' }
        },
        required: ['missionId']
      }
    },
    handler: async (params) => {
      let artifacts = stateStore.getMissionArtifacts(params.missionId);

      if (params.type) {
        artifacts = artifacts.filter(a => a.type === params.type);
      }
      if (params.taskId) {
        artifacts = artifacts.filter(a => a.taskId === params.taskId);
      }

      return { content: [{ type: 'text', text: JSON.stringify(artifacts, null, 2) }] };
    }
  },

  // ============================================
  // ARTIFACT UPDATE (append-only types only)
  // ============================================

  'artifact.append': {
    schema: {
      description: 'Append to an append-only artifact (build_log, runtime_log, console_errors).',
      inputSchema: {
        type: 'object',
        properties: {
          artifactId: { type: 'string', description: 'Artifact ID' },
          payload: { type: 'object', description: 'Data to append to payload' },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files to append'
          }
        },
        required: ['artifactId']
      }
    },
    handler: async (params) => {
      try {
        const updated = await stateStore.updateArtifact(params.artifactId, {
          payload: params.payload,
          files: params.files
        });
        return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // ARTIFACT TYPES
  // ============================================

  'artifact.list_types': {
    schema: {
      description: 'List all valid artifact types and their mutability modes.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const types = Object.entries(ArtifactTypes).map(([key, value]) => ({
        key,
        type: value
      }));
      return { content: [{ type: 'text', text: JSON.stringify(types, null, 2) }] };
    }
  },

  // ============================================
  // CONVENIENCE CREATORS
  // ============================================

  'artifact.create_git_diff': {
    schema: {
      description: 'Create a git_diff artifact from diff output.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          taskId: { type: 'string', description: 'Task ID' },
          diff: { type: 'string', description: 'Git diff content' },
          files: { type: 'array', items: { type: 'string' }, description: 'Changed files' },
          commitHash: { type: 'string', description: 'Commit hash' },
          agentId: { type: 'string', description: 'Agent ID' }
        },
        required: ['missionId', 'diff']
      }
    },
    handler: async (params) => {
      try {
        const artifact = await stateStore.addArtifact({
          id: `artifact-${Date.now()}-diff`,
          missionId: params.missionId,
          taskId: params.taskId || null,
          type: ArtifactTypes.GIT_DIFF,
          label: `Git diff: ${params.files?.length || 0} files`,
          payload: { diff: params.diff },
          files: params.files || [],
          provenance: {
            producer: 'agent',
            agentId: params.agentId || null,
            commitHash: params.commitHash || null
          }
        });
        return { content: [{ type: 'text', text: JSON.stringify(artifact, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'artifact.create_verification_report': {
    schema: {
      description: 'Create a verification_report artifact.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          taskId: { type: 'string', description: 'Task ID' },
          passed: { type: 'boolean', description: 'Whether verification passed' },
          checks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                passed: { type: 'boolean' },
                message: { type: 'string' }
              }
            },
            description: 'Individual check results'
          },
          summary: { type: 'string', description: 'Summary message' },
          agentId: { type: 'string', description: 'Agent ID' }
        },
        required: ['missionId', 'passed', 'checks']
      }
    },
    handler: async (params) => {
      try {
        const artifact = await stateStore.addArtifact({
          id: `artifact-${Date.now()}-vr`,
          missionId: params.missionId,
          taskId: params.taskId || null,
          type: ArtifactTypes.VERIFICATION_REPORT,
          label: `Verification: ${params.passed ? 'PASSED' : 'FAILED'}`,
          payload: {
            passed: params.passed,
            checks: params.checks,
            summary: params.summary,
            timestamp: new Date().toISOString()
          },
          provenance: {
            producer: 'agent',
            agentId: params.agentId || null
          }
        });
        return { content: [{ type: 'text', text: JSON.stringify(artifact, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'artifact.create_plan': {
    schema: {
      description: 'Create a plan artifact.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          title: { type: 'string', description: 'Plan title' },
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Plan steps'
          },
          risks: {
            type: 'array',
            items: { type: 'string' },
            description: 'Identified risks'
          },
          dependencies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Dependencies'
          },
          agentId: { type: 'string', description: 'Agent ID' }
        },
        required: ['missionId', 'title', 'steps']
      }
    },
    handler: async (params) => {
      try {
        const artifact = await stateStore.addArtifact({
          id: `artifact-${Date.now()}-plan`,
          missionId: params.missionId,
          type: ArtifactTypes.PLAN,
          label: `Plan: ${params.title}`,
          payload: {
            title: params.title,
            steps: params.steps,
            risks: params.risks || [],
            dependencies: params.dependencies || [],
            createdAt: new Date().toISOString()
          },
          provenance: {
            producer: 'agent',
            agentId: params.agentId || null
          }
        });
        return { content: [{ type: 'text', text: JSON.stringify(artifact, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  }
};

export default artifactTools;
