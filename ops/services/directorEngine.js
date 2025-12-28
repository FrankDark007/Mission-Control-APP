/**
 * Mission Control V8 — Autonomous Director Engine
 *
 * This is the BRAIN of Mission Control. Directors are AUTONOMOUS agents that:
 * - Analyze project requirements and create execution plans
 * - Delegate research to specialized agents (Perplexity, Ahrefs, SERP)
 * - Generate assets via Refract/Gemini
 * - Create SPECIFIC, DETAILED tasks for Claude Code
 * - MONITOR task progress in a continuous loop
 * - Create FOLLOW-UP tasks when work completes
 * - Adapt the plan based on results
 *
 * Directors run in a LOOP until the project is complete.
 */

import { claudeCodeBridge } from './claudeCodeBridge.js';
import { skillsLoader } from './skillsLoader.js';
import taskService from './taskService.js';
import artifactService from './artifactService.js';
import projectService from './projectService.js';

// Director tool definitions
const DIRECTOR_TOOLS = [
  {
    name: 'create_task_for_claude',
    description: 'Create a SPECIFIC implementation task for Claude Code. Include exact file paths, code requirements, and acceptance criteria.',
    parameters: {
      title: { type: 'string', description: 'Clear, action-oriented task title' },
      instructions: { type: 'string', description: 'DETAILED step-by-step instructions with file paths, code snippets, and exact requirements' },
      priority: { type: 'string', enum: ['critical', 'high', 'normal', 'low'] },
      artifactIds: { type: 'array', description: 'Artifact IDs to include with this task' },
      acceptanceCriteria: { type: 'array', description: 'List of criteria that must be met for task completion' }
    }
  },
  {
    name: 'research_with_perplexity',
    description: 'Research a topic using Perplexity AI. Returns real-time web data with citations.',
    parameters: {
      query: { type: 'string', description: 'Specific research question' },
      purpose: { type: 'string', description: 'How this research will be used' }
    }
  },
  {
    name: 'generate_svg_with_refract',
    description: 'Generate professional SVG graphics',
    parameters: {
      prompt: { type: 'string', description: 'Detailed description of the SVG' },
      style: { type: 'string', description: 'Style (icon, illustration, infographic)' },
      filename: { type: 'string', description: 'Filename to save as' }
    }
  },
  {
    name: 'get_keyword_data',
    description: 'Get SEO keyword research data',
    parameters: {
      keywords: { type: 'array', description: 'Keywords to research' },
      location: { type: 'string', description: 'Target location' }
    }
  },
  {
    name: 'mark_phase_complete',
    description: 'Mark a phase of the project as complete and move to the next phase',
    parameters: {
      phase: { type: 'string', description: 'Phase that was completed' },
      summary: { type: 'string', description: 'Summary of what was accomplished' }
    }
  },
  {
    name: 'request_human_review',
    description: 'Request human review before proceeding',
    parameters: {
      reason: { type: 'string', description: 'Why review is needed' },
      options: { type: 'array', description: 'Possible actions to take' }
    }
  },
  {
    name: 'complete_project',
    description: 'Mark the entire project as complete',
    parameters: {
      summary: { type: 'string', description: 'Final project summary' },
      deliverables: { type: 'array', description: 'List of deliverables created' }
    }
  },
  {
    name: 'get_skill_instructions',
    description: 'Fetch master skill instructions for a specific type of work (SEO, content, design, development, etc.)',
    parameters: {
      skillType: { type: 'string', description: 'Type of skill needed (e.g., seo-content, web-design, copywriting)' },
      taskContext: { type: 'string', description: 'Description of what you need the skill for' }
    }
  },
  {
    name: 'update_execution_plan',
    description: 'Update the project execution plan based on new information',
    parameters: {
      plan: { type: 'string', description: 'The updated execution plan' },
      reasoning: { type: 'string', description: 'Why the plan was updated' }
    }
  }
];

// Director phases
const DirectorPhase = {
  ANALYZING: 'analyzing',
  RESEARCHING: 'researching',
  PLANNING: 'planning',
  DELEGATING: 'delegating',
  MONITORING: 'monitoring',
  REVIEWING: 'reviewing',
  COMPLETE: 'complete',
  PAUSED: 'paused',
  ERROR: 'error'
};

// Monitoring intervals
const MONITOR_INTERVAL = 15000;  // Check every 15 seconds
const MAX_IDLE_TIME = 300000;    // 5 minutes max idle before escalation

class DirectorEngine {
  constructor() {
    this.activeDirectors = new Map();
    this.monitoringLoops = new Map();
    this.callAI = null;
    this.integrations = null;
    this.io = null;
  }

  init({ callAI, integrations, io }) {
    this.callAI = callAI;
    this.integrations = integrations;
    this.io = io;
  }

  /**
   * Create a task plan from project instructions using AI
   * This creates tasks via taskService for proper linking
   */
  async createTaskPlan(projectId) {
    const project = projectService.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    console.log(`[DirectorEngine] 📋 Creating task plan for: ${project.name}`);

    const prompt = `You are a project planning AI. Analyze the following project and create a detailed task breakdown.

PROJECT: ${project.name}

DESCRIPTION:
${project.description || 'No description provided'}

INSTRUCTIONS:
${project.instructions}

Create a JSON response with this EXACT structure (no markdown, just JSON):
{
  "phases": [
    {
      "name": "Phase Name",
      "index": 0,
      "tasks": [
        {
          "title": "Specific task title",
          "description": "Detailed description of what needs to be done",
          "taskType": "research|generation|build|qa|deployment",
          "estimatedMinutes": 30,
          "deps": [],
          "prompt": "Specific prompt/instructions for Claude Code to execute this task"
        }
      ]
    }
  ],
  "summary": "Brief summary of the plan"
}

RULES:
1. Be SPECIFIC and ACTIONABLE - each task should be completable by an AI coding assistant
2. taskType must be one of: research, generation, build, qa, deployment
3. deps array contains indices of tasks this depends on (e.g., [0, 1] means depends on tasks at index 0 and 1)
4. Include at least 3-6 phases covering the full project lifecycle
5. Each phase should have 2-5 concrete tasks
6. The prompt field should contain detailed instructions for execution

RESPOND WITH ONLY THE JSON, NO OTHER TEXT.`;

    const systemPrompt = `You are a project planning expert. Respond ONLY with valid JSON, no markdown code blocks, no explanation.`;

    try {
      const response = await this.callAI(project.directorModel || 'gemini-2.0-flash', prompt, systemPrompt);
      const responseText = typeof response === 'string' ? response : (response?.text || '');

      // Extract JSON from response (handle potential markdown wrapping)
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }

      const plan = JSON.parse(jsonText);

      if (!plan.phases || !Array.isArray(plan.phases)) {
        throw new Error('Invalid plan structure: missing phases array');
      }

      console.log(`[DirectorEngine] 📊 Plan created: ${plan.phases.length} phases`);

      // Create tasks from plan using taskService
      const taskIdMap = {};
      let globalIndex = 0;
      const createdPhases = [];

      for (const phase of plan.phases) {
        const phaseTaskIds = [];

        for (const taskData of phase.tasks) {
          // Map deps from local indices to actual task IDs
          const deps = (taskData.deps || [])
            .map(depIndex => taskIdMap[depIndex])
            .filter(Boolean);

          const task = await taskService.createTask({
            projectId,
            phaseIndex: phase.index,
            phaseName: phase.name,
            title: taskData.title,
            description: taskData.description,
            taskType: taskData.taskType || 'build',
            estimatedMinutes: taskData.estimatedMinutes,
            prompt: taskData.prompt || taskData.description,
            deps
          });

          taskIdMap[globalIndex] = task.id;
          phaseTaskIds.push(task.id);
          globalIndex++;

          console.log(`[DirectorEngine] ✅ Created task: ${task.title} (${task.id})`);
        }

        createdPhases.push({
          name: phase.name,
          index: phase.index,
          status: phase.index === 0 ? 'active' : 'pending',
          taskIds: phaseTaskIds,
          startedAt: phase.index === 0 ? new Date().toISOString() : null,
          completedAt: null
        });
      }

      // Update project with phases
      await projectService.updateProject(projectId, {
        phases: createdPhases,
        status: 'active',
        phase: plan.phases[0]?.name || 'Execution'
      });

      // Create plan artifact
      const planArtifact = await artifactService.createArtifact({
        projectId,
        taskId: null,
        type: 'project_plan',
        label: `Execution Plan: ${project.name}`,
        content: JSON.stringify(plan, null, 2),
        contentType: 'json',
        provenance: {
          producer: 'director',
          model: project.directorModel || 'gemini-2.0-flash'
        }
      });

      console.log(`[DirectorEngine] 📝 Plan artifact created: ${planArtifact.id}`);

      const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);

      return {
        success: true,
        phases: plan.phases.length,
        tasks: totalTasks,
        planArtifactId: planArtifact.id,
        summary: plan.summary || `Created ${totalTasks} tasks across ${plan.phases.length} phases`
      };

    } catch (error) {
      console.error(`[DirectorEngine] ❌ Failed to create task plan:`, error);
      throw error;
    }
  }

  /**
   * Start a Director for a project - begins the autonomous loop
   */
  async startDirector(project) {
    const { id: projectId, name, instructions, directorModel } = project;

    console.log(`[DirectorEngine] 🚀 Starting AUTONOMOUS Director for: ${name}`);
    console.log(`[DirectorEngine] Model: ${directorModel}`);

    // Create director state
    const directorState = {
      projectId,
      projectName: name,
      projectInstructions: instructions,
      model: directorModel,
      phase: DirectorPhase.ANALYZING,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      executionPlan: null,
      currentPhaseIndex: 0,
      phases: [],
      tasksCreated: [],
      tasksCompleted: [],
      artifactsGenerated: [],
      conversationHistory: [],
      decisions: [],
      blockers: [],
      loopCount: 0
    };

    this.activeDirectors.set(projectId, directorState);
    this._emit('director-started', { projectId, model: directorModel, phase: DirectorPhase.ANALYZING });

    try {
      // Initial analysis and planning
      await this._runDirectorCycle(projectId, 'initial');

      // Start the monitoring loop
      this._startMonitoringLoop(projectId);

      return {
        success: true,
        projectId,
        status: 'active',
        message: 'Director is now AUTONOMOUSLY orchestrating the project'
      };

    } catch (error) {
      console.error(`[DirectorEngine] ❌ Error starting director:`, error);
      directorState.phase = DirectorPhase.ERROR;
      directorState.error = error.message;
      return { success: false, error: error.message };
    }
  }

  /**
   * The main Director cycle - runs periodically
   */
  async _runDirectorCycle(projectId, trigger = 'monitor') {
    const state = this.activeDirectors.get(projectId);
    if (!state || state.phase === DirectorPhase.COMPLETE || state.phase === DirectorPhase.PAUSED) {
      return;
    }

    state.loopCount++;
    state.lastActivityAt = new Date().toISOString();

    console.log(`[DirectorEngine] 🔄 Cycle #${state.loopCount} for ${state.projectName} (trigger: ${trigger})`);

    // Get current project status
    const projectStatus = claudeCodeBridge.getProjectStatus(projectId);
    const artifacts = claudeCodeBridge.getArtifacts(projectId);

    // Build context for the Director
    const context = this._buildDirectorContext(state, projectStatus, artifacts, trigger);

    // Call the Director AI
    const systemPrompt = this._buildAutonomousSystemPrompt(state);
    const response = await this._callDirectorAI(state.model, systemPrompt, context, projectId);

    // Process the response
    await this._processDirectorResponse(projectId, response);

    // Emit status update
    this._emit('director-cycle-complete', {
      projectId,
      phase: state.phase,
      loopCount: state.loopCount,
      tasksCreated: state.tasksCreated.length,
      tasksCompleted: state.tasksCompleted.length,
      artifactsGenerated: state.artifactsGenerated.length
    });
  }

  /**
   * Build context for the Director's decision-making
   */
  _buildDirectorContext(state, projectStatus, artifacts, trigger) {
    // Find pending, in-progress, and completed tasks
    const pendingTasks = projectStatus.pendingTasks || [];
    const activeTasks = projectStatus.activeTasks || [];
    const completedCount = projectStatus.stats?.completed || 0;
    const blockedTasks = projectStatus.blockedTasks || [];

    // Format artifacts for the Director
    const artifactSummary = artifacts.map(a => ({
      id: a.id,
      type: a.type,
      name: a.name,
      createdBy: a.createdBy,
      used: !!a.usedAt
    }));

    return `## Director Status Update

**Trigger:** ${trigger}
**Current Phase:** ${state.phase}
**Loop Count:** ${state.loopCount}
**Time Since Start:** ${this._getTimeSince(state.startedAt)}

## Project: ${state.projectName}

### Original Instructions
${state.projectInstructions}

### Execution Plan
${state.executionPlan || 'Not yet created'}

### Current Task Status
- **Pending Tasks:** ${pendingTasks.length}
- **In Progress:** ${activeTasks.length}
- **Completed:** ${completedCount}
- **Blocked:** ${blockedTasks.length}

### Pending Tasks Details
${pendingTasks.length > 0 ? pendingTasks.map(t => `- [${t.id}] ${t.title} (${t.priority})`).join('\n') : 'No pending tasks'}

### Active Tasks (In Progress)
${activeTasks.length > 0 ? activeTasks.map(t => `- [${t.id}] ${t.title} - Progress: ${t.progress || 0}%`).join('\n') : 'No active tasks'}

### Blocked Tasks
${blockedTasks.length > 0 ? blockedTasks.map(t => `- [${t.id}] ${t.title} - Blocker: ${t.blocker || 'Unknown'}`).join('\n') : 'No blocked tasks'}

### Available Artifacts
${artifactSummary.length > 0 ? artifactSummary.map(a => `- [${a.id}] ${a.type}: ${a.name} (by ${a.createdBy})${a.used ? ' ✓ Used' : ''}`).join('\n') : 'No artifacts yet'}

### Recent Decisions
${state.decisions.slice(-5).map(d => `- ${d.timestamp}: ${d.decision}`).join('\n') || 'No decisions yet'}

### Available Master Skills
${this._getAvailableSkillsSummary(state)}

---

## Your Task

Based on the current status, decide what to do next:

1. **If no tasks exist:** Create the first batch of research/implementation tasks
2. **If tasks are pending but not started:** Check if Claude Code needs prompting
3. **If tasks are in progress:** Monitor and wait (unless stuck)
4. **If tasks are completed:** Review results and create follow-up tasks
5. **If blocked:** Analyze blockers and create unblocking tasks
6. **If all work is done:** Mark phase/project complete

Make tool calls to execute your decisions. Be SPECIFIC with task instructions.`;
  }

  /**
   * Build the autonomous system prompt
   */
  _buildAutonomousSystemPrompt(state) {
    return `You are an AUTONOMOUS AI Director managing the project "${state.projectName}".

## Your Role
You are the orchestrator running in a CONTINUOUS LOOP. You:
1. ANALYZE project requirements and current status
2. CREATE specific, actionable tasks for Claude Code
3. MONITOR task progress and completion
4. CREATE follow-up tasks when work completes
5. ADAPT the plan based on results
6. COMPLETE the project when all work is done

## Available Tools
${DIRECTOR_TOOLS.map(t => `### ${t.name}
${t.description}
Parameters: ${JSON.stringify(t.parameters, null, 2)}`).join('\n\n')}

## CRITICAL Rules

### IMPORTANT: You Do NOT Execute Code
You are a DIRECTOR, not an executor. You CREATE TASKS but do NOT implement them.
- When you call create_task_for_claude, you are ONLY creating a task in the queue
- The task will NOT be executed until Claude Code picks it up
- NEVER say "I have implemented" or "changes made" - say "I have created a task for Claude Code"
- After creating tasks, report: "Created X task(s) for Claude Code. Tasks are PENDING execution."

### Task Creation Rules
When creating tasks for Claude Code, you MUST:
1. Use SPECIFIC file paths (e.g., "/ops/client/src/components/Hero.tsx")
2. Include EXACT code requirements (not vague descriptions)
3. Reference artifact IDs that Claude Code should use
4. Define clear acceptance criteria
5. Set appropriate priority

### Example of a GOOD task:
\`\`\`
TOOL_CALL: create_task_for_claude
PARAMETERS:
{
  "title": "Create Hero Component with Research Data",
  "instructions": "Create /ops/client/src/components/Hero.tsx\\n\\n## Requirements\\n1. Use the brand colors: #1E3A8A (primary), #3B82F6 (secondary)\\n2. Include H1: 'Water Damage Restoration Experts'\\n3. Subheadline: '24/7 Emergency Service in Northern Virginia'\\n4. CTA Button: 'Call Now' linking to tel:+1-800-555-0123\\n5. Use the research from artifact_ec7998a3 for competitor positioning\\n\\n## Technical Requirements\\n- TypeScript with proper types\\n- Tailwind CSS for styling\\n- Mobile-responsive design\\n- Export as default",
  "priority": "high",
  "artifactIds": ["artifact_ec7998a3"],
  "acceptanceCriteria": [
    "Component renders without errors",
    "H1 contains target keyword",
    "CTA button is visible and functional",
    "Responsive on mobile"
  ]
}
END_TOOL_CALL
\`\`\`

### Example of a BAD task (DO NOT DO THIS):
\`\`\`
{
  "title": "[Director Active] - Director is orchestrating",
  "instructions": "Watch your inbox for tasks from the Director."
}
\`\`\`

## Response Format
Respond with:
1. Brief analysis of current status
2. Decision on what to do next
3. Tool calls to execute that decision

TOOL_CALL: tool_name
PARAMETERS:
{
  "param": "value"
}
END_TOOL_CALL`;
  }

  /**
   * Start the monitoring loop for a Director
   */
  _startMonitoringLoop(projectId) {
    // Clear any existing loop
    if (this.monitoringLoops.has(projectId)) {
      clearInterval(this.monitoringLoops.get(projectId));
    }

    console.log(`[DirectorEngine] 👁️ Starting monitoring loop for ${projectId}`);

    const loop = setInterval(async () => {
      const state = this.activeDirectors.get(projectId);
      if (!state) {
        clearInterval(loop);
        this.monitoringLoops.delete(projectId);
        return;
      }

      // Skip if complete or paused
      if (state.phase === DirectorPhase.COMPLETE || state.phase === DirectorPhase.PAUSED) {
        return;
      }

      try {
        // Check for task completion events
        const hasChanges = await this._checkForChanges(projectId);

        if (hasChanges) {
          console.log(`[DirectorEngine] 📢 Changes detected for ${state.projectName}`);
          await this._runDirectorCycle(projectId, 'task_change');
        } else {
          // Check for idle timeout
          const idleTime = Date.now() - new Date(state.lastActivityAt).getTime();
          if (idleTime > MAX_IDLE_TIME) {
            console.log(`[DirectorEngine] ⏰ Idle timeout for ${state.projectName}`);
            await this._runDirectorCycle(projectId, 'idle_timeout');
          }
        }
      } catch (error) {
        console.error(`[DirectorEngine] ❌ Monitoring error:`, error.message);
      }
    }, MONITOR_INTERVAL);

    this.monitoringLoops.set(projectId, loop);
  }

  /**
   * Check if there are any changes worth responding to
   */
  async _checkForChanges(projectId) {
    const state = this.activeDirectors.get(projectId);
    const status = claudeCodeBridge.getProjectStatus(projectId);

    // Check for newly completed tasks
    const currentCompleted = status.stats?.completed || 0;
    const previousCompleted = state.tasksCompleted.length;

    if (currentCompleted > previousCompleted) {
      // Update completed tasks list
      const allTasks = claudeCodeBridge.getAllTasks({ projectId });
      state.tasksCompleted = allTasks.filter(t => t.status === 'completed').map(t => t.id);
      return true;
    }

    // Check for blocked tasks
    if (status.blockedTasks?.length > 0 && state.blockers.length === 0) {
      state.blockers = status.blockedTasks.map(t => t.id);
      return true;
    }

    // Check for help requests
    const helpRequests = claudeCodeBridge.getPendingHelpRequests(projectId);
    if (helpRequests.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Stop monitoring a Director
   */
  stopDirector(projectId) {
    const state = this.activeDirectors.get(projectId);
    if (state) {
      state.phase = DirectorPhase.PAUSED;
    }

    if (this.monitoringLoops.has(projectId)) {
      clearInterval(this.monitoringLoops.get(projectId));
      this.monitoringLoops.delete(projectId);
    }

    console.log(`[DirectorEngine] ⏹️ Stopped Director for ${projectId}`);
    this._emit('director-stopped', { projectId });

    return { success: true };
  }

  /**
   * Resume a paused Director
   */
  async resumeDirector(projectId) {
    const state = this.activeDirectors.get(projectId);
    if (!state) {
      return { success: false, error: 'Director not found' };
    }

    state.phase = DirectorPhase.MONITORING;
    this._startMonitoringLoop(projectId);
    await this._runDirectorCycle(projectId, 'resume');

    return { success: true };
  }

  /**
   * Call the Director AI
   */
  async _callDirectorAI(model, systemPrompt, userPrompt, projectId) {
    if (!this.callAI) {
      throw new Error('AI caller not initialized');
    }

    const state = this.activeDirectors.get(projectId);
    state.conversationHistory.push({
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString()
    });

    const aiResponse = await this.callAI(model, userPrompt, systemPrompt);
    const response = typeof aiResponse === 'string' ? aiResponse : (aiResponse?.text || '');

    state.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });

    return response;
  }

  /**
   * Process the Director's response
   */
  async _processDirectorResponse(projectId, response) {
    const state = this.activeDirectors.get(projectId);
    const toolCalls = this._parseToolCalls(response);

    console.log(`[DirectorEngine] 🔧 Found ${toolCalls.length} tool calls`);

    const results = [];
    for (const toolCall of toolCalls) {
      try {
        const result = await this._executeToolCall(projectId, toolCall);
        results.push({ tool: toolCall.name, success: result.success, result });
        console.log(`[DirectorEngine] ✅ ${toolCall.name}: ${result.success ? 'success' : 'failed'}`);

        // Record decision
        state.decisions.push({
          timestamp: new Date().toISOString(),
          tool: toolCall.name,
          decision: `Executed ${toolCall.name} with ${JSON.stringify(toolCall.params).slice(0, 100)}...`,
          success: result.success
        });
      } catch (error) {
        console.error(`[DirectorEngine] ❌ ${toolCall.name} failed:`, error.message);
        results.push({ tool: toolCall.name, success: false, error: error.message });
      }
    }

    // Extract execution plan
    const planMatch = response.match(/## Execution Plan([\s\S]*?)(?=##|TOOL_CALL|$)/i);
    if (planMatch) {
      state.executionPlan = planMatch[1].trim();
    }

    return results;
  }

  /**
   * Parse tool calls from response
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
   * Execute a tool call
   */
  async _executeToolCall(projectId, toolCall) {
    const { name, params } = toolCall;
    const state = this.activeDirectors.get(projectId);

    switch (name) {
      case 'create_task_for_claude':
        return await this._createClaudeTask(projectId, params, state);

      case 'research_with_perplexity':
        return await this._researchWithPerplexity(projectId, params, state);

      case 'generate_svg_with_refract':
        return await this._generateSVG(projectId, params, state);

      case 'get_keyword_data':
        return await this._getKeywordData(projectId, params, state);

      case 'mark_phase_complete':
        return this._markPhaseComplete(projectId, params, state);

      case 'request_human_review':
        return this._requestHumanReview(projectId, params, state);

      case 'complete_project':
        return this._completeProject(projectId, params, state);

      case 'get_skill_instructions':
        return this._getSkillInstructions(projectId, params, state);

      case 'update_execution_plan':
        return this._updateExecutionPlan(projectId, params, state);

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  }

  /**
   * Get skill instructions for the Director
   */
  _getSkillInstructions(projectId, params, state) {
    const { skillType, taskContext } = params;

    const skillData = skillsLoader.getSkillsForDirector({
      taskType: skillType,
      taskDescription: taskContext,
      projectName: state.projectName,
      keywords: (taskContext || '').split(' ').filter(w => w.length > 3)
    });

    if (!skillData) {
      console.log(`[DirectorEngine] No skills found for: ${skillType}`);
      return {
        success: false,
        message: `No skills found matching "${skillType}". Available skills: ${skillsLoader.getIndex().map(s => s.id).join(', ')}`
      };
    }

    console.log(`[DirectorEngine] 📚 Loaded ${skillData.skills.length} skills for: ${skillType}`);

    // Add to state for reference
    state.loadedSkills = state.loadedSkills || [];
    state.loadedSkills.push(...skillData.skills);

    return {
      success: true,
      message: `Loaded ${skillData.skills.length} skill(s): ${skillData.skills.map(s => s.name).join(', ')}`,
      instructions: skillData.prompt
    };
  }

  /**
   * Update the execution plan
   */
  _updateExecutionPlan(projectId, params, state) {
    const { plan, reasoning } = params;

    state.executionPlan = plan;
    state.decisions.push({
      timestamp: new Date().toISOString(),
      decision: `Updated execution plan: ${reasoning}`
    });

    console.log(`[DirectorEngine] 📋 Updated execution plan for ${state.projectName}`);

    return { success: true, message: 'Execution plan updated' };
  }

  /**
   * Create a task for Claude Code with SPECIFIC instructions
   */
  async _createClaudeTask(projectId, params, state) {
    // Build comprehensive instructions
    let instructions = params.instructions || '';

    // Add artifact references if provided
    if (params.artifactIds?.length > 0) {
      const artifacts = params.artifactIds.map(id => claudeCodeBridge.getArtifact(id)).filter(Boolean);
      if (artifacts.length > 0) {
        instructions += '\n\n## Referenced Artifacts\n';
        artifacts.forEach(a => {
          instructions += `\n### ${a.name} (${a.id})\nType: ${a.type}\n`;
          if (a.type === 'research' && a.content?.answer) {
            instructions += `Content:\n${a.content.answer.slice(0, 500)}...\n`;
          } else if (a.type === 'svg') {
            instructions += `SVG available at: ${a.filePath || 'inline'}\n`;
          }
        });
      }
    }

    // Add acceptance criteria
    if (params.acceptanceCriteria?.length > 0) {
      instructions += '\n\n## Acceptance Criteria\n';
      params.acceptanceCriteria.forEach((c, i) => {
        instructions += `${i + 1}. ${c}\n`;
      });
    }

    const task = claudeCodeBridge.createTask({
      projectId,
      title: params.title,
      instructions,
      priority: params.priority || 'normal',
      createdBy: 'director',
      createdByModel: state.model,
      context: {
        artifactIds: params.artifactIds || [],
        acceptanceCriteria: params.acceptanceCriteria || [],
        phase: state.phase,
        loopCount: state.loopCount
      },
      artifacts: params.artifactIds || []
    });

    state.tasksCreated.push(task.id);
    state.phase = DirectorPhase.DELEGATING;

    this._emit('director-task-created', {
      projectId,
      taskId: task.id,
      title: params.title,
      priority: params.priority,
      status: 'pending',
      createdByModel: state.model,
      createdAt: new Date().toISOString()
    });

    console.log(`[DirectorEngine] 📋 Task CREATED (not executed): ${params.title}`);
    console.log(`[DirectorEngine] ⏳ Task ${task.id} awaiting Claude Code execution`);

    // Return explicit status showing task was CREATED but NOT EXECUTED
    return {
      success: true,
      taskId: task.id,
      status: 'pending',
      executed: false,
      awaitingExecution: 'CLAUDE_CODE',
      message: `Task "${params.title}" created and queued for Claude Code. Task has NOT been executed yet - it is awaiting Claude Code to pick it up.`
    };
  }

  /**
   * Research with Perplexity
   */
  async _researchWithPerplexity(projectId, params, state) {
    if (!this.integrations?.perplexity) {
      return { success: false, error: 'Perplexity not configured' };
    }

    state.phase = DirectorPhase.RESEARCHING;

    try {
      console.log(`[DirectorEngine] 🔍 Researching: ${params.query}`);
      const result = await this.integrations.perplexity.search(params.query);

      const artifact = claudeCodeBridge.registerArtifact({
        projectId,
        type: 'research',
        name: `Research: ${params.query.slice(0, 50)}`,
        description: params.purpose || 'Research from Perplexity',
        content: result,
        createdBy: 'perplexity',
        instructions: params.purpose || 'Use this research data in implementation'
      });

      state.artifactsGenerated.push(artifact.id);

      this._emit('director-research-complete', {
        projectId,
        artifactId: artifact.id,
        query: params.query
      });

      return { success: true, artifactId: artifact.id, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate SVG with Refract
   */
  async _generateSVG(projectId, params, state) {
    if (!this.integrations?.refract) {
      return { success: false, error: 'Refract not available' };
    }

    try {
      console.log(`[DirectorEngine] 🎨 Generating SVG: ${params.prompt}`);
      const result = await this.integrations.refract.generate({
        description: params.prompt,
        style: params.style || 'icon'
      });

      const artifact = claudeCodeBridge.registerArtifact({
        projectId,
        type: 'svg',
        name: `SVG: ${params.prompt.slice(0, 30)}`,
        description: params.prompt,
        content: result.svg,
        createdBy: 'refract',
        instructions: `Use this SVG as ${params.filename || 'graphic asset'}`
      });

      state.artifactsGenerated.push(artifact.id);

      return { success: true, artifactId: artifact.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get keyword data
   */
  async _getKeywordData(projectId, params, state) {
    // TODO: Integrate with real Ahrefs API
    const artifact = claudeCodeBridge.registerArtifact({
      projectId,
      type: 'data',
      name: `Keywords: ${params.keywords?.slice(0, 3).join(', ')}`,
      description: `Keyword research for: ${params.keywords?.join(', ')}`,
      content: {
        keywords: params.keywords,
        location: params.location,
        metrics: params.keywords?.map(k => ({
          keyword: k,
          volume: Math.floor(Math.random() * 10000),
          difficulty: Math.floor(Math.random() * 100),
          cpc: (Math.random() * 10).toFixed(2)
        }))
      },
      createdBy: 'seo-research',
      instructions: 'Use these keywords in meta tags, headings, and content'
    });

    state.artifactsGenerated.push(artifact.id);
    return { success: true, artifactId: artifact.id };
  }

  /**
   * Mark a phase as complete
   */
  _markPhaseComplete(projectId, params, state) {
    console.log(`[DirectorEngine] ✅ Phase complete: ${params.phase}`);

    state.phases.push({
      name: params.phase,
      completedAt: new Date().toISOString(),
      summary: params.summary
    });

    state.currentPhaseIndex++;
    state.phase = DirectorPhase.PLANNING;

    this._emit('director-phase-complete', {
      projectId,
      phase: params.phase,
      summary: params.summary
    });

    return { success: true };
  }

  /**
   * Request human review
   */
  _requestHumanReview(projectId, params, state) {
    console.log(`[DirectorEngine] 🙋 Requesting human review: ${params.reason}`);

    state.phase = DirectorPhase.PAUSED;

    this._emit('director-needs-review', {
      projectId,
      reason: params.reason,
      options: params.options
    });

    // Stop the monitoring loop until resumed
    this.stopDirector(projectId);

    return { success: true, message: 'Awaiting human review' };
  }

  /**
   * Complete the project
   */
  _completeProject(projectId, params, state) {
    console.log(`[DirectorEngine] 🎉 Project complete: ${state.projectName}`);

    state.phase = DirectorPhase.COMPLETE;
    state.completedAt = new Date().toISOString();
    state.completionSummary = params.summary;
    state.deliverables = params.deliverables;

    // Stop monitoring
    if (this.monitoringLoops.has(projectId)) {
      clearInterval(this.monitoringLoops.get(projectId));
      this.monitoringLoops.delete(projectId);
    }

    this._emit('director-complete', {
      projectId,
      summary: params.summary,
      deliverables: params.deliverables,
      stats: {
        duration: this._getTimeSince(state.startedAt),
        loopCount: state.loopCount,
        tasksCreated: state.tasksCreated.length,
        artifactsGenerated: state.artifactsGenerated.length
      }
    });

    return { success: true };
  }

  /**
   * Get Director status
   */
  getDirectorStatus(projectId) {
    const state = this.activeDirectors.get(projectId);
    if (!state) return null;

    return {
      projectId,
      projectName: state.projectName,
      model: state.model,
      phase: state.phase,
      startedAt: state.startedAt,
      lastActivityAt: state.lastActivityAt,
      loopCount: state.loopCount,
      executionPlan: state.executionPlan,
      currentPhaseIndex: state.currentPhaseIndex,
      phasesCompleted: state.phases.length,
      tasksCreated: state.tasksCreated.length,
      tasksCompleted: state.tasksCompleted.length,
      artifactsGenerated: state.artifactsGenerated.length,
      recentDecisions: state.decisions.slice(-5),
      conversationLength: state.conversationHistory.length,
      isMonitoring: this.monitoringLoops.has(projectId)
    };
  }

  /**
   * Get all active directors
   */
  getActiveDirectors() {
    return Array.from(this.activeDirectors.keys()).map(id => this.getDirectorStatus(id));
  }

  /**
   * Send a message to a Director
   */
  async sendMessage(projectId, message) {
    const state = this.activeDirectors.get(projectId);
    if (!state) {
      return { success: false, error: 'No active director' };
    }

    const systemPrompt = this._buildAutonomousSystemPrompt(state);
    const context = `## Human Message\n\n${message}\n\n---\n\nRespond to this message and take any necessary actions.`;

    const response = await this._callDirectorAI(state.model, systemPrompt, context, projectId);
    await this._processDirectorResponse(projectId, response);

    return { success: true, response };
  }

  /**
   * Helper: Get time since a timestamp
   */
  _getTimeSince(timestamp) {
    const ms = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);

    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  }

  /**
   * Get available skills summary for Director context
   */
  _getAvailableSkillsSummary(state) {
    const allSkills = skillsLoader.getIndex();

    if (allSkills.length === 0) {
      return 'No master skills configured. Create skills in /ops/skills/ folder.';
    }

    // Show loaded skills first
    const loadedSkills = state.loadedSkills || [];
    let summary = '';

    if (loadedSkills.length > 0) {
      summary += '**Loaded Skills (active):**\n';
      summary += loadedSkills.map(s => `- ✅ ${s.name} (${s.category})`).join('\n');
      summary += '\n\n';
    }

    summary += '**Available Skills (use get_skill_instructions to load):**\n';
    summary += allSkills
      .filter(s => !loadedSkills.find(ls => ls.id === s.id))
      .map(s => `- ${s.id}: ${s.triggers.slice(0, 3).join(', ')}`)
      .join('\n');

    if (allSkills.length > 0) {
      summary += '\n\n*Call get_skill_instructions with the skill type to load master instructions.*';
    }

    return summary;
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

export const directorEngine = new DirectorEngine();
export default directorEngine;
