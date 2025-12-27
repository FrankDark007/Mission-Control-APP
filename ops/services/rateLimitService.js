/**
 * Mission Control V7 — Rate Limit Service
 * Per-provider rate limits, quotas, and backoff logic
 * 
 * Phase 3: Circuit Breaker Implementation
 */

import { stateStore } from '../state/StateStore.js';
import { ArtifactTypes } from '../state/ArtifactTypes.js';

// ============================================
// PROVIDER LIMITS (from Spec Section 16)
// ============================================

export const ProviderLimits = {
  serp: { qps: 1, dailyQuota: 1000, backoffMax: 60000 },
  gsc: { qps: 5, dailyQuota: 25000, backoffMax: 30000 },
  ga4: { qps: 10, dailyQuota: 50000, backoffMax: 30000 },
  ads: { qps: 1, dailyQuota: 15000, backoffMax: 60000 },
  ahrefs: { qps: 1, dailyQuota: null, backoffMax: 60000 },
  perplexity: { qps: 1, dailyQuota: null, backoffMax: 60000 },
  gemini: { qps: 5, dailyQuota: null, backoffMax: 30000 },
  refract: { qps: 2, dailyQuota: null, backoffMax: 30000 }
};

// ============================================
// RATE LIMIT SERVICE CLASS
// ============================================

class RateLimitService {
  constructor() {
    this.usage = {};        // { provider: { calls: [], daily: 0, resetAt: null } }
    this.backoff = {};      // { provider: { until: timestamp, attempt: number } }
    this.cooldowns = {};    // { provider: timestamp }
    this._initializeUsage();
  }

  _initializeUsage() {
    const midnight = this._getMidnightUTC();
    for (const provider of Object.keys(ProviderLimits)) {
      this.usage[provider] = {
        calls: [],
        daily: 0,
        resetAt: midnight
      };
      this.backoff[provider] = { until: 0, attempt: 0 };
    }
  }

  _getMidnightUTC() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    return tomorrow.getTime();
  }

  _resetDailyIfNeeded(provider) {
    const now = Date.now();
    if (this.usage[provider].resetAt <= now) {
      this.usage[provider].daily = 0;
      this.usage[provider].resetAt = this._getMidnightUTC();
    }
  }


  // ============================================
  // RATE CHECK (before API call)
  // ============================================

  async checkRateLimit(provider, missionId = null) {
    const limits = ProviderLimits[provider];
    if (!limits) {
      return { allowed: true, warning: `Unknown provider: ${provider}` };
    }

    this._resetDailyIfNeeded(provider);

    // Check backoff
    const now = Date.now();
    if (this.backoff[provider].until > now) {
      const waitMs = this.backoff[provider].until - now;
      return {
        allowed: false,
        reason: 'BACKOFF_ACTIVE',
        waitMs,
        message: `Provider ${provider} in backoff. Wait ${Math.ceil(waitMs / 1000)}s`
      };
    }

    // Check QPS (sliding window)
    const windowMs = 1000;
    const recentCalls = this.usage[provider].calls.filter(t => t > now - windowMs);
    if (recentCalls.length >= limits.qps) {
      return {
        allowed: false,
        reason: 'QPS_EXCEEDED',
        waitMs: windowMs - (now - recentCalls[0]),
        message: `QPS limit (${limits.qps}/s) exceeded for ${provider}`
      };
    }

    // Check daily quota
    if (limits.dailyQuota && this.usage[provider].daily >= limits.dailyQuota) {
      const resetIn = this.usage[provider].resetAt - now;
      await this._logRateLimitEvent(provider, 'QUOTA_EXCEEDED', missionId);
      return {
        allowed: false,
        reason: 'QUOTA_EXCEEDED',
        waitMs: resetIn,
        message: `Daily quota (${limits.dailyQuota}) exceeded for ${provider}`
      };
    }

    // Check 80% warning
    const warning = limits.dailyQuota && 
      this.usage[provider].daily >= limits.dailyQuota * 0.8
        ? `Warning: ${provider} at ${Math.round(this.usage[provider].daily / limits.dailyQuota * 100)}% quota`
        : null;

    return { allowed: true, warning };
  }

  // ============================================
  // RECORD USAGE (after API call)
  // ============================================

  recordCall(provider) {
    if (!this.usage[provider]) return;
    
    const now = Date.now();
    this.usage[provider].calls.push(now);
    this.usage[provider].daily++;

    // Prune old calls (keep last 10 seconds)
    this.usage[provider].calls = this.usage[provider].calls.filter(t => t > now - 10000);
  }

  // ============================================
  // BACKOFF HANDLING (on 429 response)
  // ============================================

  async recordThrottle(provider, missionId = null) {
    const limits = ProviderLimits[provider];
    if (!limits) return;

    const attempt = this.backoff[provider].attempt + 1;
    const delay = Math.min(
      Math.pow(2, attempt) * 1000,  // Exponential: 2s, 4s, 8s...
      limits.backoffMax
    );

    this.backoff[provider] = {
      until: Date.now() + delay,
      attempt
    };

    await this._logRateLimitEvent(provider, 'THROTTLED', missionId, { attempt, delay });
    console.log(`⏳ ${provider} throttled. Backoff ${delay}ms (attempt ${attempt})`);

    // Check max retries
    if (attempt >= 3) {
      this.cooldowns[provider] = Date.now() + limits.backoffMax;
      console.log(`🛑 ${provider} hit max retries. Cooling down.`);
    }
  }

  resetBackoff(provider) {
    if (this.backoff[provider]) {
      this.backoff[provider] = { until: 0, attempt: 0 };
    }
  }


  // ============================================
  // ARTIFACT LOGGING
  // ============================================

  async _logRateLimitEvent(provider, reason, missionId, details = {}) {
    if (!missionId) return;
    
    try {
      await stateStore.addArtifact({
        id: `artifact-${Date.now()}-rle`,
        missionId,
        type: ArtifactTypes.RATE_LIMIT_EVENT,
        label: `Rate limit: ${provider} - ${reason}`,
        payload: {
          provider,
          reason,
          daily: this.usage[provider]?.daily,
          quota: ProviderLimits[provider]?.dailyQuota,
          ...details,
          timestamp: new Date().toISOString()
        },
        provenance: { producer: 'system' }
      });
    } catch (e) {
      console.error('Failed to log rate limit event:', e.message);
    }
  }

  // ============================================
  // STATUS & REPORTING
  // ============================================

  getStatus(provider = null) {
    if (provider) {
      return this._getProviderStatus(provider);
    }

    const status = {};
    for (const p of Object.keys(ProviderLimits)) {
      status[p] = this._getProviderStatus(p);
    }
    return status;
  }

  _getProviderStatus(provider) {
    const limits = ProviderLimits[provider];
    const usage = this.usage[provider];
    const backoff = this.backoff[provider];

    if (!limits || !usage) {
      return { status: 'unknown', provider };
    }

    const now = Date.now();
    this._resetDailyIfNeeded(provider);

    let status = 'ok';
    if (backoff.until > now) {
      status = 'backoff';
    } else if (limits.dailyQuota && usage.daily >= limits.dailyQuota) {
      status = 'exceeded';
    } else if (limits.dailyQuota && usage.daily >= limits.dailyQuota * 0.8) {
      status = 'warning';
    }

    return {
      provider,
      status,
      daily: usage.daily,
      quota: limits.dailyQuota,
      quotaPercent: limits.dailyQuota ? Math.round(usage.daily / limits.dailyQuota * 100) : null,
      resetAt: new Date(usage.resetAt).toISOString(),
      qpsLimit: limits.qps,
      backoffUntil: backoff.until > now ? new Date(backoff.until).toISOString() : null,
      backoffAttempt: backoff.attempt
    };
  }

  getQuotaRemaining(provider) {
    const limits = ProviderLimits[provider];
    const usage = this.usage[provider];
    
    if (!limits?.dailyQuota || !usage) return null;
    
    this._resetDailyIfNeeded(provider);
    return Math.max(0, limits.dailyQuota - usage.daily);
  }

  // ============================================
  // WRAPPED API CALL HELPER
  // ============================================

  async withRateLimit(provider, apiCall, missionId = null) {
    // Check before call
    const check = await this.checkRateLimit(provider, missionId);
    if (!check.allowed) {
      const error = new Error(check.message);
      error.code = 'RATE_LIMITED';
      error.reason = check.reason;
      error.waitMs = check.waitMs;
      throw error;
    }

    try {
      const result = await apiCall();
      this.recordCall(provider);
      this.resetBackoff(provider);
      return result;
    } catch (error) {
      if (error.status === 429 || error.code === 'RATE_LIMITED') {
        await this.recordThrottle(provider, missionId);
      }
      throw error;
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const rateLimitService = new RateLimitService();
export { RateLimitService };
export default rateLimitService;
