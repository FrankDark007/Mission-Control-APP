/**
 * Mission Control V8 — Project Service
 * Manages project lifecycle, bootstrap, and director agent spawning
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { claudeCodeBridge } from './claudeCodeBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECTS_FILE = path.join(__dirname, '../state/projects.json');

// Project Status enum
const ProjectStatus = {
  INITIALIZED: 'initialized',
  PLANNING: 'planning',
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  NEEDS_APPROVAL: 'needs_approval',
  PAUSED: 'paused',
  COMPLETE: 'complete',
  FAILED: 'failed'
};

// Project Phase enum
const ProjectPhase = {
  BOOTSTRAP: 'bootstrap',
  RESEARCH: 'research',
  PLANNING: 'planning',
  EXECUTION: 'execution',
  REVIEW: 'review',
  DEPLOYMENT: 'deployment',
  MAINTENANCE: 'maintenance'
};

class ProjectService {
  constructor() {
    this.projects = {};
    this.stateStore = null;
    this.agentManager = null;
    this.directorEngine = null;
    this.io = null;
    this._loadProjects();
  }

  /**
   * Initialize with dependencies
   */
  init({ stateStore, agentManager, io, directorEngine }) {
    this.stateStore = stateStore;
    this.agentManager = agentManager;
    this.directorEngine = directorEngine;
    this.io = io;
  }

  /**
   * Load projects from persistent storage
   */
  _loadProjects() {
    try {
      if (fs.existsSync(PROJECTS_FILE)) {
        this.projects = fs.readJsonSync(PROJECTS_FILE);
      } else {
        this.projects = {};
        this._saveProjects();
      }
    } catch (e) {
      console.error('[ProjectService] Failed to load projects:', e.message);
      this.projects = {};
    }
  }

  /**
   * Save projects to persistent storage
   */
  _saveProjects() {
    try {
      fs.writeJsonSync(PROJECTS_FILE, this.projects, { spaces: 2 });
    } catch (e) {
      console.error('[ProjectService] Failed to save projects:', e.message);
    }
  }

  /**
   * Emit project updates via socket
   */
  _emitUpdate() {
    if (this.io) {
      this.io.emit('projects-update', this.getAllProjects());
    }
  }

  /**
   * Get all projects as array
   */
  getAllProjects() {
    return Object.values(this.projects).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Get project by ID
   */
  getProject(projectId) {
    return this.projects[projectId] || null;
  }

  /**
   * Create a new project
   */
  async createProject({ name, description, instructions, directorModel }) {
    const projectId = `proj_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const project = {
      id: projectId,
      name: name.trim(),
      description: description?.trim() || '',
      instructions: instructions.trim(),
      status: ProjectStatus.INITIALIZED,
      phase: ProjectPhase.BOOTSTRAP,
      directorModel,
      directorAgentId: null,
      missionIds: [],
      bootstrapArtifactId: null,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      completedAt: null,
      _stateVersion: 1
    };

    // Save project
    this.projects[projectId] = project;
    this._saveProjects();

    // Create bootstrap mission if stateStore is available
    if (this.stateStore) {
      const missionId = await this._createBootstrapMission(project);
      project.missionIds.push(missionId);

      // Create bootstrap artifact
      const artifactId = await this._createBootstrapArtifact(project, missionId);
      project.bootstrapArtifactId = artifactId;

      this._saveProjects();
    }

    this._emitUpdate();

    return { success: true, project };
  }

  /**
   * Create the initial bootstrap mission for a project
   */
  async _createBootstrapMission(project) {
    const missionId = `mission_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const mission = {
      id: missionId,
      title: `[${project.name}] Project Bootstrap`,
      description: `Initialize project "${project.name}" with director agent and execution plan`,
      status: 'queued',
      missionClass: 'exploration',
      projectId: project.id,
      contract: {
        requiredArtifacts: ['BOOTSTRAP_ARTIFACT', 'EXECUTION_PLAN'],
        verification: { checks: ['director_spawned', 'plan_created'] },
        riskLevel: 'low',
        allowedTools: ['read', 'write', 'glob', 'grep', 'bash'],
        completionGate: 'artifacts',
        executionAuthority: 'MISSION_CONTROL',
        executionMode: 'AGENT_DRIVEN'
      },
      taskIds: [],
      artifactIds: [],
      agentIds: [],
      createdAt: now,
      updatedAt: now,
      createdBy: 'project_service',
      triggerSource: 'manual',
      _stateVersion: 1,
      failureCount: 0,
      immediateExecCount: 0
    };

    // Add to state store if available
    if (this.stateStore && typeof this.stateStore.createMission === 'function') {
      await this.stateStore.createMission(mission);
    }

    return missionId;
  }

  /**
   * Create the bootstrap artifact containing project context
   */
  async _createBootstrapArtifact(project, missionId) {
    const artifactId = `artifact_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const artifact = {
      id: artifactId,
      type: 'BOOTSTRAP_ARTIFACT',
      missionId,
      projectId: project.id,
      name: `Bootstrap Context: ${project.name}`,
      content: {
        projectId: project.id,
        projectName: project.name,
        projectDescription: project.description,
        instructions: project.instructions,
        directorModel: project.directorModel,
        availableTools: this._getAvailableMCPTools(),
        availableIntegrations: this._getAvailableIntegrations(),
        executionConstraints: {
          requireApprovalFor: ['destructive', 'high_risk', 'external_api'],
          maxConcurrentAgents: 5,
          budgetLimit: null,
          timeoutMinutes: 60
        }
      },
      createdAt: now,
      updatedAt: now,
      immutable: true,
      _stateVersion: 1
    };

    // Add to state store if available
    if (this.stateStore && typeof this.stateStore.createArtifact === 'function') {
      await this.stateStore.createArtifact(artifact);
    }

    return artifactId;
  }

  /**
   * Get available MCP tools
   */
  _getAvailableMCPTools() {
    return [
      { name: 'mission.create', description: 'Create a new mission' },
      { name: 'mission.update', description: 'Update mission status' },
      { name: 'task.create', description: 'Create a task within a mission' },
      { name: 'task.complete', description: 'Mark task as complete' },
      { name: 'artifact.create', description: 'Create an artifact' },
      { name: 'agent.spawn', description: 'Spawn a sub-agent (recipe mode)' },
      { name: 'agent.spawn_immediate', description: 'Spawn and execute agent immediately' },
      { name: 'approval.request', description: 'Request approval for an action' },
      { name: 'project.update_phase', description: 'Update project phase' },
      { name: 'project.update_status', description: 'Update project status' }
    ];
  }

  /**
   * Get available integrations
   */
  _getAvailableIntegrations() {
    return [
      { name: 'Google Search Console', available: true },
      { name: 'Google Analytics 4', available: true },
      { name: 'Ahrefs', available: false },
      { name: 'Perplexity', available: true },
      { name: 'Lighthouse', available: true },
      { name: 'Git', available: true }
    ];
  }

  /**
   * Update project status
   */
  async updateProjectStatus(projectId, status) {
    const project = this.projects[projectId];
    if (!project) return { success: false, error: 'Project not found' };

    project.status = status;
    project.updatedAt = new Date().toISOString();
    project.lastActivityAt = new Date().toISOString();

    this._saveProjects();
    this._emitUpdate();

    return { success: true, project };
  }

  /**
   * Update project phase
   */
  async updateProjectPhase(projectId, phase) {
    const project = this.projects[projectId];
    if (!project) return { success: false, error: 'Project not found' };

    project.phase = phase;
    project.updatedAt = new Date().toISOString();
    project.lastActivityAt = new Date().toISOString();

    this._saveProjects();
    this._emitUpdate();

    return { success: true, project };
  }

  /**
   * Spawn the Director agent for a project
   * This actually invokes the Director AI model and starts orchestration
   */
  async spawnDirectorAgent(projectId) {
    const project = this.projects[projectId];
    if (!project) return { success: false, error: 'Project not found' };

    // Check if Director Engine is available
    if (!this.directorEngine) {
      console.warn('[ProjectService] Director engine not available, falling back to recipe mode');
      return this._spawnDirectorRecipe(projectId, project);
    }

    console.log(`[ProjectService] Starting Director for project: ${project.name}`);

    // Update project status
    project.status = ProjectStatus.ACTIVE;
    project.phase = ProjectPhase.PLANNING;
    project.directorStartedAt = new Date().toISOString();
    project.updatedAt = new Date().toISOString();
    this._saveProjects();
    this._emitUpdate();

    // Actually start the Director AI - this calls the AI model
    try {
      const result = await this.directorEngine.startDirector(project);

      if (result.success) {
        project.directorActive = true;
        project.status = ProjectStatus.ACTIVE;
        this._saveProjects();
        this._emitUpdate();

        // Notify Claude Code that the Director is active
        claudeCodeBridge.createTask({
          projectId: project.id,
          title: `[Director Active] ${project.name} - Director is orchestrating`,
          instructions: `The Director AI (${project.directorModel}) for "${project.name}" is now actively orchestrating this project.

## What's Happening
The Director is:
1. Analyzing the project requirements
2. Creating an execution plan
3. Delegating research tasks to specialized agents
4. Creating specific implementation tasks for you

## Your Role
Watch your inbox for tasks from the Director. Each task will have specific instructions.

## Project Instructions (for context)
${project.instructions}

The Director will break this down into manageable tasks for you.`,
          priority: 'normal',
          createdBy: 'director',
          createdByModel: project.directorModel,
          context: {
            projectId: project.id,
            projectName: project.name,
            directorModel: project.directorModel,
            directorActive: true
          }
        });
      }

      return result;

    } catch (error) {
      console.error('[ProjectService] Failed to start Director:', error);
      project.status = ProjectStatus.BLOCKED;
      project.blockedReason = `Director failed to start: ${error.message}`;
      this._saveProjects();
      this._emitUpdate();

      return { success: false, error: error.message };
    }
  }

  /**
   * Fallback: Create Director recipe without executing (old behavior)
   */
  async _spawnDirectorRecipe(projectId, project) {
    if (!this.agentManager) {
      return { success: false, error: 'Agent manager not initialized' };
    }

    const directorPrompt = this._buildDirectorPrompt(project);

    const result = await this.agentManager.spawnAgent({
      missionId: project.missionIds[0],
      taskId: null,
      task: `Director Agent for project: ${project.name}`,
      model: project.directorModel,
      prompt: directorPrompt,
      agentRole: 'director'
    });

    if (result.success && result.recipe) {
      project.directorRecipeId = result.recipe.recipeId;
      project.status = ProjectStatus.PLANNING;
      project.updatedAt = new Date().toISOString();
      this._saveProjects();
      this._emitUpdate();
    }

    return result;
  }

  /**
   * Create a task for Claude Code from Director/Agent
   */
  async createClaudeTask(projectId, { title, instructions, priority, createdBy, createdByModel, context, artifacts }) {
    const project = this.projects[projectId];
    if (!project) return { success: false, error: 'Project not found' };

    const task = claudeCodeBridge.createTask({
      projectId,
      title,
      instructions,
      priority: priority || 'normal',
      createdBy: createdBy || 'director',
      createdByModel: createdByModel || project.directorModel,
      context,
      artifacts
    });

    return { success: true, task };
  }

  /**
   * Register an artifact from sub-agent for Claude Code
   */
  async registerArtifactForClaude(projectId, { type, name, description, filePath, content, metadata, createdBy, instructions }) {
    const project = this.projects[projectId];
    if (!project) return { success: false, error: 'Project not found' };

    const artifact = claudeCodeBridge.registerArtifact({
      projectId,
      type,
      name,
      description,
      filePath,
      content,
      metadata,
      createdBy,
      instructions
    });

    return { success: true, artifact };
  }

  /**
   * Build the director agent prompt
   */
  _buildDirectorPrompt(project) {
    return `You are the DIRECTOR AGENT for the project: "${project.name}"

## Your Role
You are responsible for planning and orchestrating the execution of this project. You DO NOT execute tasks directly - you delegate to sub-agents and use Mission Control tools.

## Project Context
${project.description ? `Description: ${project.description}` : ''}

## Project Instructions
${project.instructions}

## Your Responsibilities
1. Analyze the project requirements
2. Break down the project into phases and tasks
3. Identify what research/data is needed
4. Spawn sub-agents for specific work:
   - Research agents for information gathering
   - Implementation agents for code changes
   - Review agents for quality checks
5. Monitor progress and adjust plans
6. Report status updates to Mission Control

## Available Mission Control Tools
- mission.create - Create new missions for major work streams
- task.create - Create tasks within missions
- agent.spawn - Spawn sub-agents for specific tasks
- artifact.create - Store outputs and deliverables
- approval.request - Request human approval when needed
- project.update_phase - Move project to next phase

## Constraints
- You MUST NOT edit files directly
- You MUST NOT execute shell commands directly
- You MUST delegate all implementation work to sub-agents
- You MUST request approval for high-risk operations
- You MUST keep Mission Control updated on progress

## First Steps
1. Analyze the project instructions carefully
2. Create an execution plan artifact
3. Identify the first phase of work
4. Spawn appropriate sub-agents to begin

Begin by outputting your analysis and initial execution plan.`;
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId) {
    if (!this.projects[projectId]) {
      return { success: false, error: 'Project not found' };
    }

    delete this.projects[projectId];
    this._saveProjects();
    this._emitUpdate();

    return { success: true };
  }

  /**
   * Get project statistics
   */
  getStats() {
    const all = this.getAllProjects();
    return {
      total: all.length,
      active: all.filter(p => p.status === ProjectStatus.ACTIVE).length,
      planning: all.filter(p => p.status === ProjectStatus.PLANNING).length,
      blocked: all.filter(p => p.status === ProjectStatus.BLOCKED).length,
      complete: all.filter(p => p.status === ProjectStatus.COMPLETE).length
    };
  }
}

// Export singleton instance
const projectService = new ProjectService();
export default projectService;
export { ProjectStatus, ProjectPhase };
