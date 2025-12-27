/**
 * Mission Control V7 — Cost Estimator Service
 * Pre-flight cost estimation for API calls and agent spawns
 * 
 * Phase 3: Circuit Breaker Implementation
 */

import { stateStore } from '../state/StateStore.js';
import { ArtifactTypes } from '../state/ArtifactTypes.js';

// ============================================
// COST MODEL REGISTRY (per 1K tokens)
// ============================================

export const CostModels = {
  // Claude models
  'claude-opus-4': {
    inputPer1K: 0.015,
    outputPer1K: 0.075,
    minBilling: 0.001
  },
  'claude-sonnet-4': {
    inputPer1K: 0.003,
    outputPer1K: 0.015,
    minBilling: 0.0001
  },
  'claude-haiku': {
    inputPer1K: 0.00025,
    outputPer1K: 0.00125,
    minBilling: 0.00001
  },
  
  // Google models
  'gemini-2.0-flash': {
    inputPer1K: 0.000075,
    outputPer1K: 0.0003,
    minBilling: 0.00001
  },
  'gemini-1.5-pro': {
    inputPer1K: 0.00125,
    outputPer1K: 0.005,
    minBilling: 0.0001
  },
  
  // OpenAI models
  'gpt-4o': {
    inputPer1K: 0.0025,
    outputPer1K: 0.01,
    minBilling: 0.0001
  },
  'gpt-4o-mini': {
    inputPer1K: 0.00015,
    outputPer1K: 0.0006,
    minBilling: 0.00001
  },
  
  // API services (per call)
  'serp-api': { perCall: 0.005 },
  'ahrefs-api': { perCall: 0.01 },
  'perplexity-api': { perCall: 0.005 }
};

// Default model for estimation
const DEFAULT_MODEL = 'claude-sonnet-4';


// ============================================
// COST ESTIMATOR CLASS
// ============================================

class CostEstimatorService {
  constructor() {
    this.costHistory = [];  // Track actual costs for accuracy
  }

  // ============================================
  // PRE-FLIGHT ESTIMATION
  // ============================================

  estimateTaskCost(params) {
    const {
      model = DEFAULT_MODEL,
      inputTokens = 0,
      outputTokens = 0,
      retryCount = 1,
      apiCalls = {}  // { provider: count }
    } = params;

    const modelCost = CostModels[model];
    if (!modelCost) {
      return {
        success: false,
        error: `Unknown model: ${model}`,
        confidence: 0
      };
    }

    let minCost = 0;
    let maxCost = 0;

    // LLM token costs
    if (modelCost.inputPer1K) {
      const inputCost = (inputTokens / 1000) * modelCost.inputPer1K;
      const outputCost = (outputTokens / 1000) * modelCost.outputPer1K;
      
      minCost += inputCost + outputCost;
      maxCost += (inputCost + outputCost) * retryCount * 1.2;  // 20% buffer
    }

    // API call costs
    for (const [provider, count] of Object.entries(apiCalls)) {
      const apiCost = CostModels[`${provider}-api`];
      if (apiCost?.perCall) {
        minCost += apiCost.perCall * count;
        maxCost += apiCost.perCall * count * retryCount;
      }
    }

    // Apply minimum billing
    minCost = Math.max(minCost, modelCost.minBilling || 0);

    return {
      success: true,
      model,
      minCost: this._round(minCost),
      maxCost: this._round(maxCost),
      confidence: this._calculateConfidence(params),
      breakdown: {
        inputTokens,
        outputTokens,
        retryCount,
        apiCalls
      }
    };
  }

  // ============================================
  // MISSION-LEVEL ESTIMATION
  // ============================================

  estimateMissionCost(mission, tasks = []) {
    let totalMin = 0;
    let totalMax = 0;
    const taskEstimates = [];

    for (const task of tasks) {
      const estimate = this.estimateTaskCost({
        model: task.model || DEFAULT_MODEL,
        inputTokens: task.estimatedInputTokens || 2000,
        outputTokens: task.estimatedOutputTokens || 1000,
        retryCount: 2,
        apiCalls: task.apiCalls || {}
      });

      if (estimate.success) {
        totalMin += estimate.minCost;
        totalMax += estimate.maxCost;
        taskEstimates.push({
          taskId: task.id,
          ...estimate
        });
      }
    }

    return {
      missionId: mission.id,
      minCost: this._round(totalMin),
      maxCost: this._round(totalMax),
      confidence: taskEstimates.length > 0 ? 0.7 : 0.3,
      taskCount: tasks.length,
      taskEstimates
    };
  }


  // ============================================
  // SPAWN AGENT COST ESTIMATION
  // ============================================

  estimateAgentSpawnCost(params) {
    const {
      model = DEFAULT_MODEL,
      taskComplexity = 'medium',  // low, medium, high
      estimatedTurns = 5
    } = params;

    const complexityMultiplier = {
      low: { input: 1000, output: 500 },
      medium: { input: 3000, output: 1500 },
      high: { input: 8000, output: 4000 }
    };

    const tokens = complexityMultiplier[taskComplexity] || complexityMultiplier.medium;

    return this.estimateTaskCost({
      model,
      inputTokens: tokens.input * estimatedTurns,
      outputTokens: tokens.output * estimatedTurns,
      retryCount: 2
    });
  }

  // ============================================
  // ACTUAL COST RECORDING
  // ============================================

  recordActualCost(missionId, cost, details = {}) {
    this.costHistory.push({
      missionId,
      cost,
      details,
      timestamp: new Date().toISOString()
    });

    // Keep last 1000 records
    if (this.costHistory.length > 1000) {
      this.costHistory = this.costHistory.slice(-1000);
    }
  }

  // ============================================
  // COST ARTIFACT GENERATION
  // ============================================

  async createCostEstimateArtifact(missionId, estimate) {
    try {
      return await stateStore.addArtifact({
        id: `artifact-${Date.now()}-cost`,
        missionId,
        type: ArtifactTypes.COST_ESTIMATE,
        label: `Cost estimate: $${estimate.minCost.toFixed(4)} - $${estimate.maxCost.toFixed(4)}`,
        payload: estimate,
        provenance: { producer: 'system' }
      });
    } catch (e) {
      console.error('Failed to create cost estimate artifact:', e.message);
      return null;
    }
  }

  // ============================================
  // BUDGET CHECK
  // ============================================

  checkBudget(mission, estimate) {
    const maxCost = mission.contract?.maxEstimatedCost;
    
    if (!maxCost) {
      return { withinBudget: true, warning: 'No budget limit set' };
    }

    if (estimate.maxCost > maxCost) {
      return {
        withinBudget: false,
        reason: 'BUDGET_EXCEEDED',
        estimated: estimate.maxCost,
        limit: maxCost,
        overage: this._round(estimate.maxCost - maxCost)
      };
    }

    if (estimate.maxCost > maxCost * 0.8) {
      return {
        withinBudget: true,
        warning: `Approaching budget limit (${Math.round(estimate.maxCost / maxCost * 100)}%)`
      };
    }

    return { withinBudget: true };
  }

  // ============================================
  // HELPERS
  // ============================================

  _round(value) {
    return Math.round(value * 10000) / 10000;  // 4 decimal places
  }

  _calculateConfidence(params) {
    let confidence = 0.5;
    
    if (params.inputTokens > 0) confidence += 0.2;
    if (params.outputTokens > 0) confidence += 0.2;
    if (Object.keys(params.apiCalls || {}).length > 0) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  getModelRegistry() {
    return { ...CostModels };
  }

  getCostHistory(missionId = null) {
    if (missionId) {
      return this.costHistory.filter(c => c.missionId === missionId);
    }
    return [...this.costHistory];
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const costEstimatorService = new CostEstimatorService();
export { CostEstimatorService };
export default costEstimatorService;
