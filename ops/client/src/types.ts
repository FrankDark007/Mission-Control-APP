
export type AgentStatus = 'running' | 'stopped' | 'error' | 'waiting_approval';

export type SwarmStatus = Record<string, AgentStatus>;

export interface AgentConfig {
    id: string;
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
  level?: 'INFO' | 'WARN' | 'ERROR';
  count?: number;
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

export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { uri: string; title: string };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  modelUsed?: string;
  timestamp: number;
  image?: string; 
  groundingChunks?: GroundingChunk[];
}

export interface ProjectFact {
  id: number;
  title: string;
  content: string;
  category: 'rule' | 'knowledge' | 'tech';
  timestamp: string;
  // Added agentAffinities to support tactical grounding data filtering
  agentAffinities?: string[];
}

export interface HealingProposal {
  agentId: string;
  diagnosis: string;
  fixCommand: string;
  explanation: string;
  timestamp: number;
  failure?: boolean;
}

export interface TaskDefinition {
  id: number;
  type: string; 
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  dependencies?: number[];
  parentId?: number | string | null;
  lastLog?: string;
  startTime?: string;
  endTime?: string;
  error?: string;
  created?: string;
  result?: any;
  // agentId is used in MissionTimeline to identify the agent assigned to the task
  agentId?: string | null;
  // instruction stores the prompt or instruction provided to the agent
  instruction?: string | null;
}

export interface QueueResponse {
  processing: boolean;
  activeTasks: TaskDefinition[];
  queue: TaskDefinition[];
  history: TaskDefinition[];
}

export interface KeywordRank {
  keyword: string;
  position: number;
  delta: number;
  url: string;
}

export interface SeoPageMetric {
  url: string;
  clicks: number;
  impressions: number;
  position: number;
  ctr: number;
  lastUpdated: string;
}

export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  author_email: string;
}

export interface ProtocolStep {
    agentId: string;
    taskName: string;
    instruction: string;
}

export interface Protocol {
    id: string;
    name: string;
    steps: ProtocolStep[];
    timestamp: number;
}

// ============================================
// PROJECT TYPES (V8)
// ============================================

export type ProjectStatus =
  | 'initialized'
  | 'planning'
  | 'active'
  | 'blocked'
  | 'needs_approval'
  | 'paused'
  | 'complete'
  | 'failed';

export type ProjectPhase =
  | 'bootstrap'
  | 'research'
  | 'planning'
  | 'execution'
  | 'review'
  | 'deployment'
  | 'maintenance';

export interface Project {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  status: ProjectStatus;
  phase: ProjectPhase;
  directorModel: string;
  directorAgentId?: string;
  missionIds: string[];
  bootstrapArtifactId?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  completedAt?: string;
}

export interface DirectorModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  capabilities?: string[];
  available: boolean;
}

export interface NewProjectData {
  name: string;
  description?: string;
  instructions: string;
  directorModel: string;
}
