/**
 * Mission Control V7 — MCP Tools Index
 * Exports all V7 MCP tools for registration
 */

import { missionTools } from './mission.js';
import { taskTools } from './task.js';
import { artifactTools } from './artifact.js';
import { agentTools } from './agent.js';
import { approvalTools } from './approval.js';
import { stateTools } from './state.js';
import { rankingTools } from './ranking.js';
import { selfHealTools } from './selfHeal.js';
import { watchdogTools } from './watchdog.js';
import { providerTools } from './provider.js';
import { sessionManager } from './sessionManager.js';

// ============================================
// COMBINE ALL TOOLS
// ============================================

export const allTools = {
  ...missionTools,
  ...taskTools,
  ...artifactTools,
  ...agentTools,
  ...approvalTools,
  ...stateTools,
  ...rankingTools,
  ...selfHealTools,
  ...watchdogTools,
  ...providerTools
};

// ============================================
// TOOL REGISTRATION HELPER
// ============================================

export function registerV7Tools(mcpServer, dependencies = {}) {
  for (const [name, tool] of Object.entries(allTools)) {
    mcpServer.registerTool(name, tool.schema, async (params) => {
      // Track tool call in session manager
      sessionManager.recordToolCall(name, params);

      // Call handler with dependencies
      return tool.handler(params, dependencies);
    });
  }

  console.log(`Registered ${Object.keys(allTools).length} V7 MCP tools`);
  return Object.keys(allTools);
}

// ============================================
// TOOL CATEGORIES
// ============================================

export const toolCategories = {
  mission: Object.keys(missionTools),
  task: Object.keys(taskTools),
  artifact: Object.keys(artifactTools),
  agent: Object.keys(agentTools),
  approval: Object.keys(approvalTools),
  state: Object.keys(stateTools),
  ranking: Object.keys(rankingTools),
  selfHeal: Object.keys(selfHealTools),
  watchdog: Object.keys(watchdogTools),
  provider: Object.keys(providerTools)
};

// ============================================
// TOOL LIST FOR DISCOVERY
// ============================================

export function getToolList() {
  return Object.entries(allTools).map(([name, tool]) => ({
    name,
    description: tool.schema.description,
    inputSchema: tool.schema.inputSchema,
    category: name.split('.')[0]
  }));
}

// ============================================
// INDIVIDUAL EXPORTS
// ============================================

export {
  missionTools,
  taskTools,
  artifactTools,
  agentTools,
  approvalTools,
  stateTools,
  rankingTools,
  selfHealTools,
  watchdogTools,
  providerTools,
  sessionManager
};

export default allTools;
