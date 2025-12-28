/**
 * Mission Control — Artifact Service
 * Manages artifacts with preview generation, storage, and project/task linking
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACTS_FILE = path.join(__dirname, '../state/artifacts.json');
const ARTIFACTS_DIR = path.join(__dirname, '../artifacts');

// Common artifact types
const ArtifactType = {
  RESEARCH_DATA: 'research_data',
  KEYWORD_ANALYSIS: 'keyword_analysis',
  COMPETITOR_ANALYSIS: 'competitor_analysis',
  CONTENT_DRAFT: 'content_draft',
  HTML_PAGE: 'html_page',
  SVG_GRAPHIC: 'svg_graphic',
  SCREENSHOT: 'screenshot',
  CODE_FILE: 'code_file',
  CONFIG: 'config',
  PROJECT_PLAN: 'project_plan',
  EXECUTION_LOG: 'execution_log',
  ERROR_REPORT: 'error_report'
};

// Content types for storage and preview
const ContentType = {
  JSON: 'json',
  MARKDOWN: 'markdown',
  HTML: 'html',
  SVG: 'svg',
  IMAGE: 'image',
  CODE: 'code',
  TEXT: 'text'
};

class ArtifactService extends EventEmitter {
  constructor() {
    super();
    this.artifacts = {};
    this.projectService = null;
    this.taskService = null;
    this.io = null;
    this._loadArtifacts();
  }

  /**
   * Initialize with dependencies
   */
  init({ projectService, taskService, io }) {
    this.projectService = projectService;
    this.taskService = taskService;
    this.io = io;
    this._ensureArtifactsDir();
  }

  /**
   * Ensure artifacts directory exists
   */
  async _ensureArtifactsDir() {
    await fs.ensureDir(ARTIFACTS_DIR);
  }

  /**
   * Load artifacts from persistent storage
   */
  _loadArtifacts() {
    try {
      if (fs.existsSync(ARTIFACTS_FILE)) {
        this.artifacts = fs.readJsonSync(ARTIFACTS_FILE);
      } else {
        this.artifacts = {};
        this._saveArtifacts();
      }
    } catch (e) {
      console.error('[ArtifactService] Failed to load artifacts:', e.message);
      this.artifacts = {};
    }
  }

  /**
   * Save artifacts to persistent storage
   */
  _saveArtifacts() {
    try {
      fs.ensureDirSync(path.dirname(ARTIFACTS_FILE));
      fs.writeJsonSync(ARTIFACTS_FILE, this.artifacts, { spaces: 2 });
    } catch (e) {
      console.error('[ArtifactService] Failed to save artifacts:', e.message);
    }
  }

  /**
   * Emit artifact updates via socket
   */
  _emitUpdate(eventName, artifact) {
    if (this.io) {
      this.io.emit('artifact-update', { event: eventName, artifact });
    }
    this.emit(eventName, artifact);
  }

  /**
   * Create a new artifact
   */
  async createArtifact(data) {
    const artifactId = `artifact_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const contentType = data.contentType || this.inferContentType(data.type);

    const artifact = {
      id: artifactId,
      projectId: data.projectId,
      taskId: data.taskId || null,
      phaseIndex: data.phaseIndex || 0,
      type: data.type,
      label: data.label,
      contentType,
      payload: null,
      filePath: null,
      fileSize: null,
      previewable: this.isPreviewable(contentType),
      previewHtml: null,
      thumbnailPath: null,
      provenance: data.provenance || {
        producer: 'unknown',
        agentId: null,
        model: null,
        promptTokens: null,
        completionTokens: null,
        cost: null
      },
      createdAt: now,
      _stateVersion: 1
    };

    // Handle content storage
    if (data.content) {
      const contentSize = typeof data.content === 'string'
        ? data.content.length
        : JSON.stringify(data.content).length;

      // Store large content (>10KB) to file
      if (contentSize > 10000) {
        const ext = this.getExtension(contentType);
        const filename = `${artifactId}.${ext}`;
        artifact.filePath = path.join(ARTIFACTS_DIR, filename);

        const contentToWrite = typeof data.content === 'string'
          ? data.content
          : JSON.stringify(data.content, null, 2);

        await fs.writeFile(artifact.filePath, contentToWrite);
        artifact.fileSize = contentSize;
      } else {
        // Store small content inline
        artifact.payload = typeof data.content === 'string'
          ? { content: data.content }
          : data.content;
      }
    } else if (data.payload) {
      artifact.payload = data.payload;
    }

    // Generate preview if possible
    if (artifact.previewable) {
      artifact.previewHtml = await this.generatePreview(artifact, data.content);
    }

    this.artifacts[artifactId] = artifact;
    this._saveArtifacts();

    // Link to project and task
    if (this.projectService && artifact.projectId) {
      await this.projectService.linkArtifact(artifact.projectId, artifactId);
    }
    if (this.taskService && artifact.taskId) {
      await this.taskService.linkArtifact(artifact.taskId, artifactId);
    }

    this._emitUpdate('artifact:created', artifact);
    return artifact;
  }

  /**
   * Get artifact by ID
   */
  getArtifact(artifactId) {
    return this.artifacts[artifactId] || null;
  }

  /**
   * Get artifact content
   */
  async getArtifactContent(artifactId) {
    const artifact = this.artifacts[artifactId];
    if (!artifact) return null;

    if (artifact.filePath) {
      try {
        return await fs.readFile(artifact.filePath, 'utf-8');
      } catch (e) {
        console.error(`[ArtifactService] Failed to read file: ${artifact.filePath}`, e.message);
        return null;
      }
    } else if (artifact.payload?.content) {
      return artifact.payload.content;
    } else if (artifact.payload) {
      return JSON.stringify(artifact.payload, null, 2);
    }
    return null;
  }

  /**
   * Get all artifacts for a project
   */
  getArtifactsByProject(projectId) {
    return Object.values(this.artifacts)
      .filter(a => a.projectId === projectId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Get all artifacts for a task
   */
  getArtifactsByTask(taskId) {
    return Object.values(this.artifacts)
      .filter(a => a.taskId === taskId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Get all artifacts with optional filters
   */
  getAllArtifacts(filters = {}) {
    let artifacts = Object.values(this.artifacts);

    if (filters.projectId) {
      artifacts = artifacts.filter(a => a.projectId === filters.projectId);
    }
    if (filters.taskId) {
      artifacts = artifacts.filter(a => a.taskId === filters.taskId);
    }
    if (filters.type) {
      artifacts = artifacts.filter(a => a.type === filters.type);
    }
    if (filters.contentType) {
      artifacts = artifacts.filter(a => a.contentType === filters.contentType);
    }

    artifacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters.limit) {
      artifacts = artifacts.slice(0, filters.limit);
    }

    return artifacts;
  }

  /**
   * Update an artifact
   */
  async updateArtifact(artifactId, updates) {
    const artifact = this.artifacts[artifactId];
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    Object.assign(artifact, updates, {
      _stateVersion: artifact._stateVersion + 1
    });

    this.artifacts[artifactId] = artifact;
    this._saveArtifacts();

    this._emitUpdate('artifact:updated', artifact);
    return artifact;
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(artifactId) {
    const artifact = this.artifacts[artifactId];
    if (!artifact) {
      return { success: false, error: 'Artifact not found' };
    }

    // Delete file if exists
    if (artifact.filePath) {
      try {
        await fs.remove(artifact.filePath);
      } catch (e) {
        console.error(`[ArtifactService] Failed to delete file: ${artifact.filePath}`, e.message);
      }
    }

    delete this.artifacts[artifactId];
    this._saveArtifacts();
    this._emitUpdate('artifact:deleted', { id: artifactId });

    return { success: true };
  }

  /**
   * Infer content type from artifact type
   */
  inferContentType(type) {
    const typeMap = {
      [ArtifactType.RESEARCH_DATA]: ContentType.JSON,
      [ArtifactType.KEYWORD_ANALYSIS]: ContentType.JSON,
      [ArtifactType.COMPETITOR_ANALYSIS]: ContentType.MARKDOWN,
      [ArtifactType.CONTENT_DRAFT]: ContentType.MARKDOWN,
      [ArtifactType.HTML_PAGE]: ContentType.HTML,
      [ArtifactType.SVG_GRAPHIC]: ContentType.SVG,
      [ArtifactType.SCREENSHOT]: ContentType.IMAGE,
      [ArtifactType.CODE_FILE]: ContentType.CODE,
      [ArtifactType.CONFIG]: ContentType.JSON,
      [ArtifactType.PROJECT_PLAN]: ContentType.JSON,
      [ArtifactType.EXECUTION_LOG]: ContentType.TEXT,
      [ArtifactType.ERROR_REPORT]: ContentType.JSON
    };
    return typeMap[type] || ContentType.TEXT;
  }

  /**
   * Check if content type is previewable
   */
  isPreviewable(contentType) {
    return [
      ContentType.JSON,
      ContentType.MARKDOWN,
      ContentType.HTML,
      ContentType.SVG,
      ContentType.TEXT,
      ContentType.CODE
    ].includes(contentType);
  }

  /**
   * Get file extension for content type
   */
  getExtension(contentType) {
    const extMap = {
      [ContentType.JSON]: 'json',
      [ContentType.MARKDOWN]: 'md',
      [ContentType.HTML]: 'html',
      [ContentType.SVG]: 'svg',
      [ContentType.CODE]: 'txt',
      [ContentType.TEXT]: 'txt',
      [ContentType.IMAGE]: 'png'
    };
    return extMap[contentType] || 'txt';
  }

  /**
   * Generate preview HTML for an artifact
   */
  async generatePreview(artifact, content = null) {
    const actualContent = content || await this.getArtifactContent(artifact.id);
    if (!actualContent) return null;

    const maxPreviewLength = 500;
    const truncated = actualContent.length > maxPreviewLength;
    const previewContent = actualContent.slice(0, maxPreviewLength);

    try {
      switch (artifact.contentType) {
        case ContentType.JSON:
          const parsed = JSON.parse(actualContent);
          const formatted = JSON.stringify(parsed, null, 2).slice(0, maxPreviewLength);
          return `<pre class="artifact-preview json">${this.escapeHtml(formatted)}${truncated ? '...' : ''}</pre>`;

        case ContentType.MARKDOWN:
          return `<pre class="artifact-preview markdown">${this.escapeHtml(previewContent)}${truncated ? '...' : ''}</pre>`;

        case ContentType.SVG:
          // SVG is directly renderable (but sanitize it)
          if (actualContent.includes('<script')) {
            return `<pre class="artifact-preview svg-code">${this.escapeHtml(previewContent)}</pre>`;
          }
          return `<div class="artifact-preview svg">${actualContent}</div>`;

        case ContentType.HTML:
          return `<pre class="artifact-preview html">${this.escapeHtml(previewContent)}${truncated ? '...' : ''}</pre>`;

        case ContentType.CODE:
          return `<pre class="artifact-preview code">${this.escapeHtml(previewContent)}${truncated ? '...' : ''}</pre>`;

        default:
          return `<pre class="artifact-preview text">${this.escapeHtml(previewContent)}${truncated ? '...' : ''}</pre>`;
      }
    } catch (e) {
      return `<pre class="artifact-preview error">Preview error: ${this.escapeHtml(e.message)}</pre>`;
    }
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Get artifact statistics for a project
   */
  getProjectArtifactStats(projectId) {
    const artifacts = this.getArtifactsByProject(projectId);
    const byType = {};

    for (const artifact of artifacts) {
      byType[artifact.type] = (byType[artifact.type] || 0) + 1;
    }

    return {
      total: artifacts.length,
      byType
    };
  }
}

// Export singleton instance
const artifactService = new ArtifactService();
export default artifactService;
export { ArtifactService, ArtifactType, ContentType };
