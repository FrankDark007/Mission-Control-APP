/**
 * Session Manager - Tracks conversation state and generates handoff packets
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HANDOFF_DIR = join(__dirname, '../../handoffs');

class SessionManager {
  constructor() {
    this.toolCallCount = 0;
    this.filesRead = [];
    this.filesWritten = [];
    this.activeTask = null;
    this.checkpoints = [];
    this.startTime = Date.now();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    if (!existsSync(HANDOFF_DIR)) {
      await mkdir(HANDOFF_DIR, { recursive: true });
    }
    this.initialized = true;
  }

  recordToolCall(toolName, params) {
    this.toolCallCount++;
    
    if (toolName === 'read_file' && params?.path) {
      this.filesRead.push(params.path);
    }
    if ((toolName === 'write_file' || toolName === 'create_file') && params?.path) {
      this.filesWritten.push(params.path);
    }
  }

  setActiveTask(task) {
    this.activeTask = task;
    this.checkpoints.push({
      time: new Date().toISOString(),
      task,
      toolCalls: this.toolCallCount
    });
  }

  getHealthStatus() {
    const sessionMinutes = (Date.now() - this.startTime) / 60000;
    
    return {
      toolCallCount: this.toolCallCount,
      sessionMinutes: Math.round(sessionMinutes),
      filesRead: this.filesRead.length,
      filesWritten: this.filesWritten.length,
      warningLevel: this._calculateWarningLevel(),
      activeTask: this.activeTask
    };
  }

  _calculateWarningLevel() {
    if (this.toolCallCount > 300) return 'CRITICAL';
    if (this.toolCallCount > 200) return 'HIGH';
    if (this.toolCallCount > 100) return 'MEDIUM';
    return 'LOW';
  }

  async generateHandoff(reason = 'manual', nextSteps = '') {
    await this.init();
    
    const handoff = {
      id: `handoff-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      reason,
      nextSteps,
      activeTask: this.activeTask,
      checkpoints: this.checkpoints.slice(-10),
      stats: this.getHealthStatus(),
      filesRead: [...new Set(this.filesRead)].slice(-20),
      filesWritten: [...new Set(this.filesWritten)],
      resumePrompt: this._buildResumePrompt(nextSteps)
    };

    const filename = `handoff-${Date.now()}.json`;
    const filepath = join(HANDOFF_DIR, filename);
    await writeFile(filepath, JSON.stringify(handoff, null, 2));
    await writeFile(join(HANDOFF_DIR, 'latest.json'), JSON.stringify(handoff, null, 2));

    return { filepath, handoff };
  }

  _buildResumePrompt(nextSteps) {
    let prompt = `## Session Resume\n\n`;
    prompt += `**Last Active Task:** ${this.activeTask || 'None specified'}\n\n`;
    
    if (this.filesWritten.length > 0) {
      prompt += `**Files Modified:**\n`;
      prompt += this.filesWritten.slice(-10).map(f => `- ${f}`).join('\n');
      prompt += '\n\n';
    }
    
    if (this.checkpoints.length > 0) {
      prompt += `**Recent Checkpoints:**\n`;
      prompt += this.checkpoints.slice(-5).map(c => `- ${c.task}`).join('\n');
      prompt += '\n\n';
    }
    
    if (nextSteps) {
      prompt += `**Next Steps:** ${nextSteps}\n`;
    }
    
    return prompt;
  }

  async loadLatestHandoff() {
    try {
      const data = await readFile(join(HANDOFF_DIR, 'latest.json'), 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  reset() {
    this.toolCallCount = 0;
    this.filesRead = [];
    this.filesWritten = [];
    this.activeTask = null;
    this.checkpoints = [];
    this.startTime = Date.now();
  }
}

export const sessionManager = new SessionManager();
