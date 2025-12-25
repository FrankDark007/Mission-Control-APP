
export type AgentStatus = 'running' | 'stopped' | 'error' | 'waiting_approval';

export type SwarmStatus = Record<string, AgentStatus>;

export interface AgentConfig {
    name: string;
    role?: string;
    path: string;
    command: string;
    safeArgs: string[];
    yoloArgs: string[];
    restartPolicy: string;
}

export interface LogMessage {
  agentId: string;
  type: 'stdout' | 'stderr' | 'system' | 'ai-proxy';
  message: string;
  timestamp: string;
}

export type AiModelId = 
  | 'gemini-3-pro' 
  | 'deep-reasoning'
  | 'builder-mode'
  | 'search-grounding'
  | 'maps-grounding'
  | 'swarm-consensus' 
  | 'qa-critic'
  | 'claude-sim' 
  | 'perplexity-sim' 
  | 'chatgpt-sim' 
  | 'recraft-sim';

export interface AutoPilotConfig {
  enabled: boolean;
  standardsMode: boolean;
  model: AiModelId;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  modelUsed?: AiModelId;
  timestamp: number;
  image?: string; // Base64 string for image display
}

export interface HealingProposal {
  agentId: string;
  diagnosis: string;
  fixCommand: string;
  explanation: string;
  timestamp: number;
}

// --- Task Queue & Visualizer ---

export interface TaskDefinition {
  id: number;
  type: string; 
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  dependencies?: number[];
  lastLog?: string;
  startTime?: string;
  created?: string;
  result?: any;
}

export interface QueueResponse {
  processing: boolean;
  activeTasks: TaskDefinition[];
  queue: TaskDefinition[];
}

// --- Management & SEO Data ---

export interface AuditScore {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  date: string;
}

export interface FactDatabase {
  project_name: string;
  tech_stack: string[];
  rules: string[];
}

export interface SeoPageMetric {
  url: string;
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
  lastUpdated: string;
}

export interface KeywordRank {
  keyword: string;
  position: number;
  delta: number;
  url: string;
}

export interface VisualAuditResult {
    desktop: string;
    mobile: string;
    diff: number;
}
