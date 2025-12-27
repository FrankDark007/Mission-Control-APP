/**
 * Mission Control V8 — Director Engine
 *
 * This service executes Director AI models and gives them the ability to:
 * - Analyze project instructions
 * - Create execution plans
 * - Spawn sub-agents (Perplexity, Refract, Ahrefs, etc.)
 * - Create tasks for Claude Code
 * - Monitor progress and adjust
 *
 * The Director is the "brain" that orchestrates work across multiple AI services.
 */

import { claudeCodeBridge } from './claudeCodeBridge.js';

// Director tool definitions - what the Director AI can do
const DIRECTOR_TOOLS = [
  {
    name: 'create_task_for_claude',
    description: 'Create a task for Claude Code to execute. Claude Code is the implementation agent that writes actual code.',
    parameters: {
      title: { type: 'string', description: 'Short task title' },
      instructions: { type: 'string', description: 'Detailed instructions for what Claude Code should build/implement' },
      priority: { type: 'string', enum: ['critical', 'high', 'normal', 'low'], description: 'Task priority' },
      context: { type: 'object', description: 'Additional context like file paths, dependencies, etc.' }
    }
  },
  {
    name: 'research_with_perplexity',
    description: 'Use Perplexity AI to research a topic, gather market data, or analyze competitors',
    parameters: {
      query: { type: 'string', description: 'Research query' },
      context: { type: 'string', description: 'Additional context for the research' }
    }
  },
  {
    name: 'generate_svg_with_refract',
    description: 'Use Refract to generate professional SVG graphics, icons, or illustrations',
    parameters: {
      prompt: { type: 'string', description: 'Description of the SVG to generate' },
      style: { type: 'string', description: 'Style guidance (e.g., "Google-style", "minimal", "illustrated")' },
      savePath: { type: 'string', description: 'Where to save the SVG file' }
    }
  },
  {
    name: 'generate_image_with_gemini',
    description: 'Use Gemini to generate images for the project',
    parameters: {
      prompt: { type: 'string', description: 'Image description' },
      aspectRatio: { type: 'string', description: 'Aspect ratio (16:9, 1:1, 4:3, etc.)' },
      savePath: { type: 'string', description: 'Where to save the image' }
    }
  },
  {
    name: 'get_keyword_data',
    description: 'Get keyword research data from Ahrefs or similar SEO tools',
    parameters: {
      keywords: { type: 'array', description: 'Keywords to research' },
      location: { type: 'string', description: 'Target location for local SEO' }
    }
  },
  {
    name: 'check_claude_progress',
    description: 'Check on the progress of tasks assigned to Claude Code',
    parameters: {
      projectId: { type: 'string', description: 'Project ID to check' }
    }
  },
  {
    name: 'register_artifact',
    description: 'Register a generated artifact (SVG, content, research) for Claude Code to use',
    parameters: {
      type: { type: 'string', enum: ['svg', 'image', 'content', 'research', 'data'], description: 'Artifact type' },
      name: { type: 'string', description: 'Artifact name' },
      filePath: { type: 'string', description: 'Path where artifact is saved' },
      instructions: { type: 'string', description: 'How Claude Code should use this artifact' }
    }
  },
  {
    name: 'update_execution_plan',
    description: 'Update the project execution plan based on progress or new information',
    parameters: {
      plan: { type: 'object', description: 'Updated execution plan' }
    }
  }
];

class DirectorEngine {
  constructor() {
    this.activeDirectors = new Map(); // projectId -> director state
    this.callAI = null;
    this.integrations = null;
    this.io = null;
  }

  /**
   * Initialize with dependencies
   */
  init({ callAI, integrations, io }) {
    this.callAI = callAI;
    this.integrations = integrations;
    this.io = io;
  }

  /**
   * Start a Director for a project
   * This actually calls the AI model and runs it
   */
  async startDirector(project) {
    const { id: projectId, name, instructions, directorModel } = project;

    console.log(`[DirectorEngine] Starting Director for project: ${name}`);
    console.log(`[DirectorEngine] Using model: ${directorModel}`);

    // Create director state
    const directorState = {
      projectId,
      projectName: name,
      model: directorModel,
      status: 'analyzing',
      startedAt: new Date().toISOString(),
      executionPlan: null,
      tasksCreated: [],
      artifactsGenerated: [],
      conversationHistory: []
    };

    this.activeDirectors.set(projectId, directorState);
    this._emit('director-started', { projectId, model: directorModel });

    // Build the Director's system prompt
    const systemPrompt = this._buildDirectorSystemPrompt(project);

    // Build the initial user prompt (the project instructions)
    const userPrompt = this._buildInitialPrompt(project);

    try {
      // Call the AI model
      const response = await this._callDirectorAI(directorModel, systemPrompt, userPrompt, projectId);

      // Parse and execute any tool calls from the response
      await this._processDirectorResponse(projectId, response);

      directorState.status = 'active';
      this._emit('director-ready', { projectId, plan: directorState.executionPlan });

      return {
        success: true,
        projectId,
        status: 'active',
        message: 'Director is now orchestrating the project'
      };

    } catch (error) {
      console.error(`[DirectorEngine] Error starting director:`, error);
      directorState.status = 'error';
      directorState.error = error.message;

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build the Director's system prompt
   */
  _buildDirectorSystemPrompt(project) {
    return `You are the DIRECTOR AI for the project "${project.name}".

## Your Role
You are the orchestrator. You analyze requirements, create plans, and delegate work to specialized agents:
- **Claude Code**: The implementation agent that writes actual code. Send it specific coding tasks.
- **Perplexity**: Research agent for market data, competitor analysis, content research.
- **Refract**: SVG and graphics generation agent.
- **Gemini Image**: Photo and illustration generation.
- **Ahrefs**: SEO and keyword research data.

## Your Workflow
1. ANALYZE the project requirements thoroughly
2. CREATE an execution plan with phases and tasks
3. DELEGATE research tasks first (gather data before implementation)
4. CREATE implementation tasks for Claude Code with specific, detailed instructions
5. MONITOR progress and adjust the plan as needed

## Available Tools
You have access to these tools:
${DIRECTOR_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')}

## Critical Rules
1. Break down work into small, specific tasks
2. Research BEFORE implementation - get data, then use it
3. Give Claude Code DETAILED instructions - files to create, exact requirements
4. Register artifacts so Claude Code knows what assets are available
5. Monitor progress and create follow-up tasks as needed

## Project Details
Name: ${project.name}
Description: ${project.description || 'No description provided'}

## Response Format
Respond with your analysis and then use tools to execute your plan. Format tool calls as:

TOOL_CALL: tool_name
PARAMETERS:
{
  "param1": "value1",
  "param2": "value2"
}
END_TOOL_CALL

You can make multiple tool calls in one response.`;
  }

  /**
   * Build the initial prompt with project instructions
   */
  _buildInitialPrompt(project) {
    return `## Project Instructions

${project.instructions}

---

Please analyze these requirements and:
1. Create an execution plan
2. Identify what research is needed
3. Start delegating tasks

Begin by analyzing the requirements and creating your first set of tasks.`;
  }

  /**
   * Call the Director AI model
   */
  async _callDirectorAI(model, systemPrompt, userPrompt, projectId) {
    if (!this.callAI) {
      throw new Error('AI caller not initialized');
    }

    // Add to conversation history
    const directorState = this.activeDirectors.get(projectId);
    directorState.conversationHistory.push({
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString()
    });

    // Call the AI
    const response = await this.callAI(model, userPrompt, systemPrompt);

    // Store response
    directorState.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });

    return response;
  }

  /**
   * Process the Director's response and execute tool calls
   */
  async _processDirectorResponse(projectId, response) {
    const directorState = this.activeDirectors.get(projectId);

    // Parse tool calls from response
    const toolCalls = this._parseToolCalls(response);

    console.log(`[DirectorEngine] Found ${toolCalls.length} tool calls in response`);

    for (const toolCall of toolCalls) {
      try {
        const result = await this._executeToolCall(projectId, toolCall);
        console.log(`[DirectorEngine] Tool ${toolCall.name} executed:`, result.success);
      } catch (error) {
        console.error(`[DirectorEngine] Tool ${toolCall.name} failed:`, error.message);
      }
    }

    // Extract execution plan if present
    const planMatch = response.match(/## Execution Plan([\s\S]*?)(?=##|TOOL_CALL|$)/i);
    if (planMatch) {
      directorState.executionPlan = planMatch[1].trim();
    }
  }

  /**
   * Parse tool calls from AI response
   */
  _parseToolCalls(response) {
    const toolCalls = [];
    const regex = /TOOL_CALL:\s*(\w+)\s*\nPARAMETERS:\s*(\{[\s\S]*?\})\s*END_TOOL_CALL/g;

    let match;
    while ((match = regex.exec(response)) !== null) {
      try {
        const name = match[1];
        const params = JSON.parse(match[2]);
        toolCalls.push({ name, params });
      } catch (e) {
        console.error('[DirectorEngine] Failed to parse tool call:', e.message);
      }
    }

    return toolCalls;
  }

  /**
   * Execute a tool call from the Director
   */
  async _executeToolCall(projectId, toolCall) {
    const { name, params } = toolCall;
    const directorState = this.activeDirectors.get(projectId);

    switch (name) {
      case 'create_task_for_claude':
        return await this._createClaudeTask(projectId, params, directorState);

      case 'research_with_perplexity':
        return await this._researchWithPerplexity(projectId, params, directorState);

      case 'generate_svg_with_refract':
        return await this._generateSVG(projectId, params, directorState);

      case 'generate_image_with_gemini':
        return await this._generateImage(projectId, params, directorState);

      case 'get_keyword_data':
        return await this._getKeywordData(projectId, params, directorState);

      case 'check_claude_progress':
        return await this._checkClaudeProgress(projectId, params);

      case 'register_artifact':
        return await this._registerArtifact(projectId, params, directorState);

      case 'update_execution_plan':
        directorState.executionPlan = params.plan;
        return { success: true };

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  }

  /**
   * Create a task for Claude Code
   */
  async _createClaudeTask(projectId, params, directorState) {
    const task = claudeCodeBridge.createTask({
      projectId,
      title: params.title,
      instructions: params.instructions,
      priority: params.priority || 'normal',
      createdBy: 'director',
      createdByModel: directorState.model,
      context: params.context || {}
    });

    directorState.tasksCreated.push(task.id);
    this._emit('task-created-for-claude', { projectId, task });

    return { success: true, taskId: task.id };
  }

  /**
   * Research with Perplexity
   */
  async _researchWithPerplexity(projectId, params, directorState) {
    if (!this.integrations?.perplexity) {
      return { success: false, error: 'Perplexity not configured' };
    }

    try {
      const result = await this.integrations.perplexity.search(params.query);

      // Register as artifact for Claude Code
      const artifact = claudeCodeBridge.registerArtifact({
        projectId,
        type: 'research',
        name: `Research: ${params.query.slice(0, 50)}`,
        description: params.context || 'Research from Perplexity',
        content: result,
        createdBy: 'perplexity',
        instructions: 'Use this research data when implementing related features'
      });

      directorState.artifactsGenerated.push(artifact.id);

      return { success: true, artifactId: artifact.id, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate SVG with Refract
   */
  async _generateSVG(projectId, params, directorState) {
    if (!this.integrations?.refract) {
      return { success: false, error: 'Refract not configured' };
    }

    try {
      const result = await this.integrations.refract.generateSVG(params.prompt, {
        style: params.style
      });

      // Save to file if path provided
      if (params.savePath) {
        const fs = await import('fs-extra');
        await fs.default.writeFile(params.savePath, result.svg);
      }

      // Register as artifact
      const artifact = claudeCodeBridge.registerArtifact({
        projectId,
        type: 'svg',
        name: `SVG: ${params.prompt.slice(0, 30)}`,
        description: params.prompt,
        filePath: params.savePath,
        content: result.svg,
        createdBy: 'refract',
        instructions: `Place this SVG at: ${params.savePath}`
      });

      directorState.artifactsGenerated.push(artifact.id);

      return { success: true, artifactId: artifact.id, path: params.savePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate image with Gemini
   */
  async _generateImage(projectId, params, directorState) {
    try {
      // Use the creative API endpoint
      const response = await fetch('http://localhost:3001/api/creative/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          aspectRatio: params.aspectRatio || '16:9'
        })
      });

      const result = await response.json();

      if (result.success && result.imageUrl) {
        // Register as artifact
        const artifact = claudeCodeBridge.registerArtifact({
          projectId,
          type: 'image',
          name: `Image: ${params.prompt.slice(0, 30)}`,
          description: params.prompt,
          filePath: params.savePath,
          content: result.imageUrl,
          metadata: { aspectRatio: params.aspectRatio },
          createdBy: 'gemini-image',
          instructions: `Use this image at: ${params.savePath}`
        });

        directorState.artifactsGenerated.push(artifact.id);

        return { success: true, artifactId: artifact.id, imageUrl: result.imageUrl };
      }

      return { success: false, error: result.error || 'Image generation failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get keyword data
   */
  async _getKeywordData(projectId, params, directorState) {
    // This would call Ahrefs or similar
    // For now, return placeholder
    const artifact = claudeCodeBridge.registerArtifact({
      projectId,
      type: 'data',
      name: `Keywords: ${params.keywords?.slice(0, 3).join(', ')}`,
      description: `Keyword research for: ${params.keywords?.join(', ')}`,
      content: { keywords: params.keywords, location: params.location, note: 'Keyword data placeholder' },
      createdBy: 'seo-research',
      instructions: 'Use these keywords in content and meta tags'
    });

    directorState.artifactsGenerated.push(artifact.id);

    return { success: true, artifactId: artifact.id };
  }

  /**
   * Check Claude Code progress
   */
  async _checkClaudeProgress(projectId, params) {
    const status = claudeCodeBridge.getProjectStatus(params.projectId || projectId);
    return { success: true, status };
  }

  /**
   * Register an artifact
   */
  async _registerArtifact(projectId, params, directorState) {
    const artifact = claudeCodeBridge.registerArtifact({
      projectId,
      type: params.type,
      name: params.name,
      filePath: params.filePath,
      instructions: params.instructions,
      createdBy: 'director'
    });

    directorState.artifactsGenerated.push(artifact.id);

    return { success: true, artifactId: artifact.id };
  }

  /**
   * Send a follow-up message to the Director
   */
  async sendMessage(projectId, message) {
    const directorState = this.activeDirectors.get(projectId);
    if (!directorState) {
      return { success: false, error: 'No active director for this project' };
    }

    const systemPrompt = this._buildDirectorSystemPrompt({
      id: projectId,
      name: directorState.projectName,
      description: '',
      instructions: ''
    });

    const response = await this._callDirectorAI(
      directorState.model,
      systemPrompt,
      message,
      projectId
    );

    await this._processDirectorResponse(projectId, response);

    return { success: true, response };
  }

  /**
   * Get Director status
   */
  getDirectorStatus(projectId) {
    const state = this.activeDirectors.get(projectId);
    if (!state) {
      return null;
    }

    return {
      projectId,
      projectName: state.projectName,
      model: state.model,
      status: state.status,
      startedAt: state.startedAt,
      executionPlan: state.executionPlan,
      tasksCreated: state.tasksCreated.length,
      artifactsGenerated: state.artifactsGenerated.length,
      conversationLength: state.conversationHistory.length
    };
  }

  /**
   * Get all active directors
   */
  getActiveDirectors() {
    const directors = [];
    for (const [projectId, state] of this.activeDirectors) {
      directors.push(this.getDirectorStatus(projectId));
    }
    return directors;
  }

  /**
   * Emit socket event
   */
  _emit(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
}

// Export singleton
export const directorEngine = new DirectorEngine();
export default directorEngine;
