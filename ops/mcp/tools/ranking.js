/**
 * Mission Control V7 — MCP Ranking Tools
 * Ranking data management and watchdog integration
 */

import { stateStore } from '../../state/StateStore.js';
import { ArtifactTypes } from '../../state/ArtifactTypes.js';
import { rankingWatchdogService } from '../../services/rankingWatchdogService.js';

export const rankingTools = {
  // ============================================
  // RANKING DATA INGESTION
  // ============================================

  'ranking.ingest_rank': {
    schema: {
      description: 'Ingest rank data for tracking and anomaly detection.',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Target keyword' },
          rank: { type: 'number', description: 'Current rank position' },
          location: { type: 'string', description: 'Geographic location' },
          source: { type: 'string', description: 'Data source (serp, gsc, manual)' }
        },
        required: ['keyword', 'rank']
      }
    },
    handler: async (params) => {
      const result = await rankingWatchdogService.ingestRankData(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'ranking.ingest_local_pack': {
    schema: {
      description: 'Ingest local pack data for tracking.',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Target keyword' },
          position: { type: 'number', description: 'Position in local pack (null if not in pack)' },
          inPack: { type: 'boolean', description: 'Whether in local pack' },
          location: { type: 'string', description: 'Geographic location' },
          competitors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Competitors in the local pack'
          }
        },
        required: ['keyword']
      }
    },
    handler: async (params) => {
      const result = await rankingWatchdogService.ingestLocalPackData(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  // ============================================
  // RANKING ARTIFACTS
  // ============================================

  'ranking.create_visibility_map': {
    schema: {
      description: 'Create a visibility map artifact.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          overallScore: { type: 'number', description: 'Overall visibility score (0-100)' },
          keywords: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                keyword: { type: 'string' },
                rank: { type: 'number' },
                searchVolume: { type: 'number' },
                difficulty: { type: 'number' }
              }
            },
            description: 'Keyword rankings'
          },
          locations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Locations covered'
          }
        },
        required: ['missionId', 'overallScore', 'keywords']
      }
    },
    handler: async (params) => {
      try {
        const artifact = await stateStore.addArtifact({
          id: `artifact-${Date.now()}-vm`,
          missionId: params.missionId,
          type: ArtifactTypes.VISIBILITY_MAP,
          label: `Visibility Map: ${params.overallScore}%`,
          payload: {
            overallScore: params.overallScore,
            keywords: params.keywords,
            locations: params.locations || [],
            generatedAt: new Date().toISOString()
          },
          provenance: { producer: 'system' }
        });
        return { content: [{ type: 'text', text: JSON.stringify(artifact, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'ranking.create_local_pack_snapshot': {
    schema: {
      description: 'Create a local pack snapshot artifact.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          keyword: { type: 'string', description: 'Target keyword' },
          location: { type: 'string', description: 'Location' },
          position: { type: 'number', description: 'Position in pack (null if not present)' },
          inLocalPack: { type: 'boolean', description: 'Whether in local pack' },
          competitors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                position: { type: 'number' },
                rating: { type: 'number' },
                reviews: { type: 'number' }
              }
            },
            description: 'Competitors in the pack'
          }
        },
        required: ['missionId', 'keyword', 'location']
      }
    },
    handler: async (params) => {
      try {
        const artifact = await stateStore.addArtifact({
          id: `artifact-${Date.now()}-lp`,
          missionId: params.missionId,
          type: ArtifactTypes.LOCAL_PACK_SNAPSHOT,
          label: `Local Pack: ${params.keyword} (${params.location})`,
          payload: {
            keyword: params.keyword,
            location: params.location,
            position: params.position,
            inLocalPack: params.inLocalPack ?? params.position !== null,
            competitors: params.competitors || [],
            snapshotAt: new Date().toISOString()
          },
          provenance: { producer: 'system' }
        });
        return { content: [{ type: 'text', text: JSON.stringify(artifact, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  'ranking.create_rank_delta': {
    schema: {
      description: 'Create a rank delta report artifact.',
      inputSchema: {
        type: 'object',
        properties: {
          missionId: { type: 'string', description: 'Mission ID' },
          keyword: { type: 'string', description: 'Target keyword' },
          previousRank: { type: 'number', description: 'Previous rank' },
          currentRank: { type: 'number', description: 'Current rank' },
          location: { type: 'string', description: 'Location' }
        },
        required: ['missionId', 'keyword', 'previousRank', 'currentRank']
      }
    },
    handler: async (params) => {
      const delta = params.previousRank - params.currentRank; // Positive = improvement

      try {
        const artifact = await stateStore.addArtifact({
          id: `artifact-${Date.now()}-rd`,
          missionId: params.missionId,
          type: ArtifactTypes.RANK_DELTA_REPORT,
          label: `Rank Delta: ${params.keyword} (${delta >= 0 ? '+' : ''}${delta})`,
          payload: {
            keyword: params.keyword,
            previousRank: params.previousRank,
            currentRank: params.currentRank,
            delta,
            location: params.location,
            improved: delta > 0,
            reportedAt: new Date().toISOString()
          },
          provenance: { producer: 'system' }
        });
        return { content: [{ type: 'text', text: JSON.stringify(artifact, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  },

  // ============================================
  // TRACKING MANAGEMENT
  // ============================================

  'ranking.add_tracked_keyword': {
    schema: {
      description: 'Add a keyword to track for anomalies.',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Keyword to track' }
        },
        required: ['keyword']
      }
    },
    handler: async (params) => {
      const result = rankingWatchdogService.addTrackedKeyword(params.keyword);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'ranking.add_tracked_location': {
    schema: {
      description: 'Add a location to track.',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Location to track' }
        },
        required: ['location']
      }
    },
    handler: async (params) => {
      const result = rankingWatchdogService.addTrackedLocation(params.location);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'ranking.get_tracked': {
    schema: {
      description: 'Get list of tracked keywords and locations.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const tracked = rankingWatchdogService.getTracked();
      return { content: [{ type: 'text', text: JSON.stringify(tracked, null, 2) }] };
    }
  },

  // ============================================
  // HISTORY QUERIES
  // ============================================

  'ranking.get_rank_history': {
    schema: {
      description: 'Get rank history for a keyword.',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Keyword' }
        },
        required: ['keyword']
      }
    },
    handler: async (params) => {
      const history = rankingWatchdogService.getRankHistory(params.keyword);
      return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
    }
  },

  'ranking.get_local_pack_history': {
    schema: {
      description: 'Get local pack history for a keyword.',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Keyword' },
          location: { type: 'string', description: 'Location (default: default)' }
        },
        required: ['keyword']
      }
    },
    handler: async (params) => {
      const history = rankingWatchdogService.getLocalPackHistory(
        params.keyword,
        params.location || 'default'
      );
      return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
    }
  },

  // ============================================
  // WATCHDOG STATUS
  // ============================================

  'ranking.get_watchdog_status': {
    schema: {
      description: 'Get ranking watchdog status.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const status = rankingWatchdogService.getStatus();
      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
    }
  },

  'ranking.start_watchdog': {
    schema: {
      description: 'Start the ranking watchdog.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const result = rankingWatchdogService.start();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  },

  'ranking.stop_watchdog': {
    schema: {
      description: 'Stop the ranking watchdog.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    handler: async () => {
      const result = rankingWatchdogService.stop();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  }
};

export default rankingTools;
