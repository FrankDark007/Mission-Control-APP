/**
 * Mission Control V7 — Ranking Watchdog Service
 * Monitors ranking data freshness, anomaly detection, and visibility changes
 *
 * Phase 7: Ranking-Specific Watchdog
 *
 * Responsibilities:
 * - Monitor ranking data freshness
 * - Detect ranking anomalies (sudden drops, volatility)
 * - Track visibility map changes
 * - Monitor local pack position changes
 * - Create rank_delta_report artifacts
 * - Trigger alerts on significant changes
 */

import { stateStore } from '../state/StateStore.js';
import { ArtifactTypes } from '../state/ArtifactTypes.js';
import { watchdogService, SignalType } from './watchdogService.js';

// ============================================
// RANKING WATCHDOG CONFIGURATION
// ============================================

export const RankingWatchdogConfig = {
  // Data freshness thresholds
  VISIBILITY_STALE_THRESHOLD_MS: 86400000,    // 24 hours
  LOCAL_PACK_STALE_THRESHOLD_MS: 43200000,    // 12 hours
  SERP_STALE_THRESHOLD_MS: 21600000,          // 6 hours

  // Anomaly detection thresholds
  RANK_DROP_ALERT_THRESHOLD: 10,              // Alert if rank drops by 10+ positions
  RANK_DROP_CRITICAL_THRESHOLD: 20,           // Critical if rank drops by 20+ positions
  VISIBILITY_DROP_PERCENT_THRESHOLD: 15,      // Alert if visibility drops 15%+
  LOCAL_PACK_EXIT_ALERT: true,                // Alert if exits local pack

  // Volatility detection
  VOLATILITY_WINDOW_DAYS: 7,
  HIGH_VOLATILITY_THRESHOLD: 5,               // Std dev of rank changes

  // Tick rate
  TICK_INTERVAL_MS: 60000,                    // Check every minute

  // Alert cooldown (prevent spam)
  ALERT_COOLDOWN_MS: 3600000                  // 1 hour between same alerts
};

// ============================================
// RANKING SIGNAL TYPES
// ============================================

export const RankingSignalType = {
  // Data freshness signals
  VISIBILITY_DATA_STALE: 'visibility_data_stale',
  LOCAL_PACK_DATA_STALE: 'local_pack_data_stale',
  SERP_DATA_STALE: 'serp_data_stale',

  // Ranking change signals
  RANK_DROP_DETECTED: 'rank_drop_detected',
  RANK_DROP_CRITICAL: 'rank_drop_critical',
  RANK_IMPROVEMENT: 'rank_improvement',
  LOCAL_PACK_EXIT: 'local_pack_exit',
  LOCAL_PACK_ENTRY: 'local_pack_entry',
  LOCAL_PACK_POSITION_CHANGE: 'local_pack_position_change',

  // Visibility signals
  VISIBILITY_DROP: 'visibility_drop',
  VISIBILITY_IMPROVEMENT: 'visibility_improvement',

  // Volatility signals
  HIGH_RANK_VOLATILITY: 'high_rank_volatility',

  // Competitor signals
  COMPETITOR_OVERTAKE: 'competitor_overtake',
  NEW_COMPETITOR_DETECTED: 'new_competitor_detected'
};

// ============================================
// RANKING WATCHDOG SERVICE CLASS
// ============================================

class RankingWatchdogService {
  constructor() {
    this.isRunning = false;
    this.tickInterval = null;
    this.lastTickAt = null;

    // Tracking data
    this.rankHistory = new Map();           // keyword -> [{ rank, timestamp }]
    this.visibilityHistory = [];            // [{ score, timestamp }]
    this.localPackHistory = new Map();      // keyword -> [{ position, inPack, timestamp }]
    this.lastAlerts = new Map();            // signalType -> timestamp (for cooldown)

    // Stats
    this.stats = {
      ticks: 0,
      signalsEmitted: 0,
      rankDropsDetected: 0,
      localPackExits: 0,
      visibilityDrops: 0
    };

    // Configuration for tracked keywords/locations
    this.trackedKeywords = new Set();
    this.trackedLocations = new Set();
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  start() {
    if (this.isRunning) {
      return { success: false, reason: 'Already running' };
    }

    this.isRunning = true;
    this.tickInterval = setInterval(() => this._tick(), RankingWatchdogConfig.TICK_INTERVAL_MS);
    console.log('[RankingWatchdog] Started monitoring');

    return { success: true, tickInterval: RankingWatchdogConfig.TICK_INTERVAL_MS };
  }

  stop() {
    if (!this.isRunning) {
      return { success: false, reason: 'Not running' };
    }

    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log('[RankingWatchdog] Stopped');

    return { success: true };
  }

  // ============================================
  // MAIN TICK
  // ============================================

  async _tick() {
    this.lastTickAt = new Date().toISOString();
    this.stats.ticks++;

    try {
      await Promise.all([
        this._checkDataFreshness(),
        this._analyzeRankingArtifacts()
      ]);
    } catch (error) {
      console.error('[RankingWatchdog] Tick error:', error.message);
    }
  }

  async forceTick() {
    return this._tick();
  }

  // ============================================
  // DATA FRESHNESS CHECKS
  // ============================================

  async _checkDataFreshness() {
    const state = stateStore.getState();
    const now = Date.now();

    // Find latest artifacts by type
    const artifacts = Object.values(state.artifacts || {});

    const latestVisibility = this._findLatestArtifact(artifacts, ArtifactTypes.VISIBILITY_MAP);
    const latestLocalPack = this._findLatestArtifact(artifacts, ArtifactTypes.LOCAL_PACK_SNAPSHOT);
    const latestSerp = this._findLatestArtifact(artifacts, ArtifactTypes.ORGANIC_SERP_SNAPSHOT);

    // Check visibility freshness
    if (latestVisibility) {
      const age = now - new Date(latestVisibility.createdAt).getTime();
      if (age > RankingWatchdogConfig.VISIBILITY_STALE_THRESHOLD_MS) {
        await this._emitRankingSignal({
          type: RankingSignalType.VISIBILITY_DATA_STALE,
          details: {
            lastUpdate: latestVisibility.createdAt,
            ageMs: age,
            threshold: RankingWatchdogConfig.VISIBILITY_STALE_THRESHOLD_MS
          },
          severity: 'warning'
        });
      }
    }

    // Check local pack freshness
    if (latestLocalPack) {
      const age = now - new Date(latestLocalPack.createdAt).getTime();
      if (age > RankingWatchdogConfig.LOCAL_PACK_STALE_THRESHOLD_MS) {
        await this._emitRankingSignal({
          type: RankingSignalType.LOCAL_PACK_DATA_STALE,
          details: {
            lastUpdate: latestLocalPack.createdAt,
            ageMs: age,
            threshold: RankingWatchdogConfig.LOCAL_PACK_STALE_THRESHOLD_MS
          },
          severity: 'warning'
        });
      }
    }

    // Check SERP freshness
    if (latestSerp) {
      const age = now - new Date(latestSerp.createdAt).getTime();
      if (age > RankingWatchdogConfig.SERP_STALE_THRESHOLD_MS) {
        await this._emitRankingSignal({
          type: RankingSignalType.SERP_DATA_STALE,
          details: {
            lastUpdate: latestSerp.createdAt,
            ageMs: age,
            threshold: RankingWatchdogConfig.SERP_STALE_THRESHOLD_MS
          },
          severity: 'warning'
        });
      }
    }
  }

  _findLatestArtifact(artifacts, type) {
    return artifacts
      .filter(a => a.type === type)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  }

  // ============================================
  // RANKING ARTIFACT ANALYSIS
  // ============================================

  async _analyzeRankingArtifacts() {
    const state = stateStore.getState();
    const artifacts = Object.values(state.artifacts || {});

    // Get rank delta reports
    const deltaReports = artifacts
      .filter(a => a.type === ArtifactTypes.RANK_DELTA_REPORT)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (deltaReports.length === 0) return;

    const latestDelta = deltaReports[0];
    await this._processRankDelta(latestDelta);

    // Analyze visibility maps
    const visibilityMaps = artifacts
      .filter(a => a.type === ArtifactTypes.VISIBILITY_MAP)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (visibilityMaps.length >= 2) {
      await this._compareVisibility(visibilityMaps[0], visibilityMaps[1]);
    }

    // Analyze local pack snapshots
    const localPackSnapshots = artifacts
      .filter(a => a.type === ArtifactTypes.LOCAL_PACK_SNAPSHOT)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (localPackSnapshots.length >= 2) {
      await this._compareLocalPack(localPackSnapshots[0], localPackSnapshots[1]);
    }
  }

  async _processRankDelta(deltaArtifact) {
    const payload = deltaArtifact.payload;
    if (!payload) return;

    const { keyword, previousRank, currentRank, delta } = payload;

    // Record in history
    this._recordRankHistory(keyword, currentRank);

    // Check for significant drops
    if (delta && delta < -RankingWatchdogConfig.RANK_DROP_CRITICAL_THRESHOLD) {
      this.stats.rankDropsDetected++;
      await this._emitRankingSignal({
        type: RankingSignalType.RANK_DROP_CRITICAL,
        details: {
          keyword,
          previousRank,
          currentRank,
          delta,
          artifactId: deltaArtifact.id
        },
        severity: 'critical',
        missionId: deltaArtifact.missionId
      });
    } else if (delta && delta < -RankingWatchdogConfig.RANK_DROP_ALERT_THRESHOLD) {
      this.stats.rankDropsDetected++;
      await this._emitRankingSignal({
        type: RankingSignalType.RANK_DROP_DETECTED,
        details: {
          keyword,
          previousRank,
          currentRank,
          delta,
          artifactId: deltaArtifact.id
        },
        severity: 'warning',
        missionId: deltaArtifact.missionId
      });
    } else if (delta && delta > RankingWatchdogConfig.RANK_DROP_ALERT_THRESHOLD) {
      await this._emitRankingSignal({
        type: RankingSignalType.RANK_IMPROVEMENT,
        details: {
          keyword,
          previousRank,
          currentRank,
          delta,
          artifactId: deltaArtifact.id
        },
        severity: 'info',
        missionId: deltaArtifact.missionId
      });
    }

    // Check volatility
    await this._checkVolatility(keyword);
  }

  _recordRankHistory(keyword, rank) {
    if (!this.rankHistory.has(keyword)) {
      this.rankHistory.set(keyword, []);
    }

    const history = this.rankHistory.get(keyword);
    history.push({
      rank,
      timestamp: new Date().toISOString()
    });

    // Keep last 30 days of data
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.rankHistory.set(keyword, history.filter(h =>
      new Date(h.timestamp).getTime() > cutoff
    ));
  }

  async _checkVolatility(keyword) {
    const history = this.rankHistory.get(keyword);
    if (!history || history.length < 7) return;

    // Get last N days of data
    const cutoff = Date.now() - (RankingWatchdogConfig.VOLATILITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentHistory = history.filter(h =>
      new Date(h.timestamp).getTime() > cutoff
    );

    if (recentHistory.length < 3) return;

    // Calculate rank changes
    const changes = [];
    for (let i = 1; i < recentHistory.length; i++) {
      changes.push(Math.abs(recentHistory[i].rank - recentHistory[i - 1].rank));
    }

    // Calculate standard deviation
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const squaredDiffs = changes.map(c => Math.pow(c - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    if (stdDev > RankingWatchdogConfig.HIGH_VOLATILITY_THRESHOLD) {
      await this._emitRankingSignal({
        type: RankingSignalType.HIGH_RANK_VOLATILITY,
        details: {
          keyword,
          volatility: stdDev.toFixed(2),
          threshold: RankingWatchdogConfig.HIGH_VOLATILITY_THRESHOLD,
          dataPoints: recentHistory.length,
          windowDays: RankingWatchdogConfig.VOLATILITY_WINDOW_DAYS
        },
        severity: 'warning'
      });
    }
  }

  async _compareVisibility(current, previous) {
    const currentScore = current.payload?.overallScore || current.payload?.score;
    const previousScore = previous.payload?.overallScore || previous.payload?.score;

    if (currentScore === undefined || previousScore === undefined) return;

    const percentChange = ((currentScore - previousScore) / previousScore) * 100;

    if (percentChange < -RankingWatchdogConfig.VISIBILITY_DROP_PERCENT_THRESHOLD) {
      this.stats.visibilityDrops++;
      await this._emitRankingSignal({
        type: RankingSignalType.VISIBILITY_DROP,
        details: {
          currentScore,
          previousScore,
          percentChange: percentChange.toFixed(2),
          threshold: RankingWatchdogConfig.VISIBILITY_DROP_PERCENT_THRESHOLD,
          currentArtifactId: current.id,
          previousArtifactId: previous.id
        },
        severity: 'warning',
        missionId: current.missionId
      });
    } else if (percentChange > RankingWatchdogConfig.VISIBILITY_DROP_PERCENT_THRESHOLD) {
      await this._emitRankingSignal({
        type: RankingSignalType.VISIBILITY_IMPROVEMENT,
        details: {
          currentScore,
          previousScore,
          percentChange: percentChange.toFixed(2),
          currentArtifactId: current.id
        },
        severity: 'info',
        missionId: current.missionId
      });
    }
  }

  async _compareLocalPack(current, previous) {
    const currentInPack = current.payload?.inLocalPack ?? current.payload?.position !== null;
    const previousInPack = previous.payload?.inLocalPack ?? previous.payload?.position !== null;
    const currentPosition = current.payload?.position;
    const previousPosition = previous.payload?.position;

    // Check for local pack exit
    if (previousInPack && !currentInPack) {
      this.stats.localPackExits++;
      await this._emitRankingSignal({
        type: RankingSignalType.LOCAL_PACK_EXIT,
        details: {
          previousPosition,
          keyword: current.payload?.keyword,
          location: current.payload?.location,
          artifactId: current.id
        },
        severity: 'critical',
        missionId: current.missionId
      });
    }
    // Check for local pack entry
    else if (!previousInPack && currentInPack) {
      await this._emitRankingSignal({
        type: RankingSignalType.LOCAL_PACK_ENTRY,
        details: {
          currentPosition,
          keyword: current.payload?.keyword,
          location: current.payload?.location,
          artifactId: current.id
        },
        severity: 'info',
        missionId: current.missionId
      });
    }
    // Check for position change within pack
    else if (currentInPack && previousInPack && currentPosition !== previousPosition) {
      const improved = currentPosition < previousPosition;
      await this._emitRankingSignal({
        type: RankingSignalType.LOCAL_PACK_POSITION_CHANGE,
        details: {
          previousPosition,
          currentPosition,
          improved,
          keyword: current.payload?.keyword,
          location: current.payload?.location,
          artifactId: current.id
        },
        severity: improved ? 'info' : 'warning',
        missionId: current.missionId
      });
    }
  }

  // ============================================
  // SIGNAL EMISSION
  // ============================================

  async _emitRankingSignal(signalData) {
    // Check cooldown
    const cooldownKey = `${signalData.type}:${signalData.details?.keyword || 'global'}`;
    const lastAlert = this.lastAlerts.get(cooldownKey);
    const now = Date.now();

    if (lastAlert && (now - lastAlert) < RankingWatchdogConfig.ALERT_COOLDOWN_MS) {
      return null; // Skip due to cooldown
    }

    this.lastAlerts.set(cooldownKey, now);
    this.stats.signalsEmitted++;

    // Create signal through main watchdog
    const signal = {
      id: `ranking-signal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: 'ranking',
      ...signalData,
      timestamp: new Date().toISOString()
    };

    // Create signal artifact if mission-linked
    if (signal.missionId) {
      try {
        await stateStore.addArtifact({
          id: `artifact-${Date.now()}-rsig`,
          missionId: signal.missionId,
          type: ArtifactTypes.SIGNAL_REPORT,
          label: `Ranking Signal: ${signal.type}`,
          payload: signal,
          provenance: { producer: 'ranking_watchdog' }
        });
      } catch (error) {
        console.error('[RankingWatchdog] Failed to create signal artifact:', error.message);
      }
    }

    console.log(`[RankingWatchdog] Signal: ${signal.type} (${signal.severity})`);

    return signal;
  }

  // ============================================
  // TRACKING MANAGEMENT
  // ============================================

  addTrackedKeyword(keyword) {
    this.trackedKeywords.add(keyword.toLowerCase());
    return { success: true, keyword };
  }

  removeTrackedKeyword(keyword) {
    this.trackedKeywords.delete(keyword.toLowerCase());
    return { success: true, keyword };
  }

  addTrackedLocation(location) {
    this.trackedLocations.add(location);
    return { success: true, location };
  }

  removeTrackedLocation(location) {
    this.trackedLocations.delete(location);
    return { success: true, location };
  }

  getTracked() {
    return {
      keywords: Array.from(this.trackedKeywords),
      locations: Array.from(this.trackedLocations)
    };
  }

  // ============================================
  // MANUAL DATA INGESTION
  // ============================================

  async ingestRankData(data) {
    const { keyword, rank, location, source = 'manual' } = data;

    if (!keyword || rank === undefined) {
      return { success: false, error: 'keyword and rank are required' };
    }

    this._recordRankHistory(keyword, rank);

    // Check against previous
    const history = this.rankHistory.get(keyword);
    if (history && history.length >= 2) {
      const previous = history[history.length - 2];
      const delta = previous.rank - rank; // Positive = improvement

      if (Math.abs(delta) >= RankingWatchdogConfig.RANK_DROP_ALERT_THRESHOLD) {
        await this._processRankDelta({
          payload: {
            keyword,
            previousRank: previous.rank,
            currentRank: rank,
            delta,
            location,
            source
          },
          createdAt: new Date().toISOString()
        });
      }
    }

    return {
      success: true,
      keyword,
      rank,
      historyLength: this.rankHistory.get(keyword)?.length || 0
    };
  }

  async ingestLocalPackData(data) {
    const { keyword, position, inPack, location, competitors = [] } = data;

    if (!keyword) {
      return { success: false, error: 'keyword is required' };
    }

    const key = `${keyword}:${location || 'default'}`;

    if (!this.localPackHistory.has(key)) {
      this.localPackHistory.set(key, []);
    }

    const history = this.localPackHistory.get(key);
    const entry = {
      position,
      inPack: inPack ?? position !== null,
      competitors,
      timestamp: new Date().toISOString()
    };

    history.push(entry);

    // Keep last 30 entries
    if (history.length > 30) {
      this.localPackHistory.set(key, history.slice(-30));
    }

    // Compare with previous
    if (history.length >= 2) {
      const previous = history[history.length - 2];
      const current = entry;

      if (previous.inPack && !current.inPack) {
        this.stats.localPackExits++;
        await this._emitRankingSignal({
          type: RankingSignalType.LOCAL_PACK_EXIT,
          details: { keyword, location, previousPosition: previous.position },
          severity: 'critical'
        });
      } else if (!previous.inPack && current.inPack) {
        await this._emitRankingSignal({
          type: RankingSignalType.LOCAL_PACK_ENTRY,
          details: { keyword, location, position: current.position },
          severity: 'info'
        });
      }
    }

    return { success: true, keyword, position, inPack: entry.inPack };
  }

  // ============================================
  // STATUS & QUERYING
  // ============================================

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastTickAt: this.lastTickAt,
      config: {
        tickInterval: RankingWatchdogConfig.TICK_INTERVAL_MS,
        rankDropAlertThreshold: RankingWatchdogConfig.RANK_DROP_ALERT_THRESHOLD,
        visibilityDropThreshold: RankingWatchdogConfig.VISIBILITY_DROP_PERCENT_THRESHOLD
      },
      stats: this.stats,
      tracked: {
        keywords: this.trackedKeywords.size,
        locations: this.trackedLocations.size
      },
      historySize: {
        ranks: this.rankHistory.size,
        visibility: this.visibilityHistory.length,
        localPack: this.localPackHistory.size
      }
    };
  }

  getRankHistory(keyword) {
    return this.rankHistory.get(keyword) || [];
  }

  getLocalPackHistory(keyword, location = 'default') {
    const key = `${keyword}:${location}`;
    return this.localPackHistory.get(key) || [];
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async healthCheck() {
    const status = this.getStatus();

    return {
      service: 'RankingWatchdogService',
      status: this.isRunning ? 'ok' : 'stopped',
      isRunning: this.isRunning,
      lastTickAt: this.lastTickAt,
      stats: this.stats,
      trackedKeywords: this.trackedKeywords.size,
      trackedLocations: this.trackedLocations.size,
      checkedAt: new Date().toISOString()
    };
  }

  // ============================================
  // CLEANUP
  // ============================================

  clearHistory() {
    this.rankHistory.clear();
    this.visibilityHistory = [];
    this.localPackHistory.clear();
    this.lastAlerts.clear();
    return { success: true };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const rankingWatchdogService = new RankingWatchdogService();
export { RankingWatchdogService, RankingWatchdogConfig, RankingSignalType };
export default rankingWatchdogService;
