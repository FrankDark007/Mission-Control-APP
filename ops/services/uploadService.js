/**
 * Upload Service
 * Handles file uploads, zip extraction, and file management
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import unzipper from 'unzipper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload directories
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const PROJECTS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'projects');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PROJECTS_UPLOADS_DIR)) {
  fs.mkdirSync(PROJECTS_UPLOADS_DIR, { recursive: true });
}

class UploadService {
  constructor() {
    this.uploads = new Map(); // uploadId -> metadata
    this._loadState();
  }

  _loadState() {
    const statePath = path.join(UPLOADS_DIR, 'uploads.json');
    if (fs.existsSync(statePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        data.forEach(u => this.uploads.set(u.id, u));
      } catch (e) {
        console.error('[UploadService] Failed to load state:', e.message);
      }
    }
  }

  _saveState() {
    const statePath = path.join(UPLOADS_DIR, 'uploads.json');
    const data = Array.from(this.uploads.values());
    fs.writeFileSync(statePath, JSON.stringify(data, null, 2));
  }

  /**
   * Get project upload directory
   */
  getProjectDir(projectId) {
    const dir = path.join(PROJECTS_UPLOADS_DIR, projectId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Process an uploaded file
   */
  async processUpload(file, projectId = null) {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const destDir = projectId ? this.getProjectDir(projectId) : UPLOADS_DIR;

    const metadata = {
      id: uploadId,
      projectId,
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedAt: new Date().toISOString(),
      processed: false,
      extractedFiles: [],
      analysis: null
    };

    // Handle zip files
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      const extractDir = path.join(destDir, `extracted_${uploadId}`);
      fs.mkdirSync(extractDir, { recursive: true });

      try {
        const extractedFiles = await this._extractZip(file.path, extractDir);
        metadata.extractedFiles = extractedFiles;
        metadata.extractedDir = extractDir;
        metadata.processed = true;
        console.log(`[UploadService] Extracted ${extractedFiles.length} files from zip`);
      } catch (error) {
        console.error('[UploadService] Zip extraction failed:', error.message);
        metadata.error = error.message;
      }
    } else {
      metadata.processed = true;
    }

    this.uploads.set(uploadId, metadata);
    this._saveState();

    return metadata;
  }

  /**
   * Extract a zip file
   */
  async _extractZip(zipPath, destDir) {
    const extractedFiles = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Parse())
        .on('entry', async (entry) => {
          const filePath = entry.path;
          const type = entry.type;
          const fullPath = path.join(destDir, filePath);

          // Skip __MACOSX and hidden files
          if (filePath.includes('__MACOSX') || filePath.startsWith('.')) {
            entry.autodrain();
            return;
          }

          if (type === 'Directory') {
            fs.mkdirSync(fullPath, { recursive: true });
            entry.autodrain();
          } else {
            // Ensure parent directory exists
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });

            entry.pipe(fs.createWriteStream(fullPath));

            extractedFiles.push({
              path: filePath,
              fullPath,
              size: entry.vars.uncompressedSize || 0,
              type: this._getFileType(filePath)
            });
          }
        })
        .on('close', () => resolve(extractedFiles))
        .on('error', reject);
    });
  }

  /**
   * Get file type from extension
   */
  _getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.json': 'json',
      '.md': 'markdown',
      '.txt': 'text',
      '.svg': 'svg',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.webp': 'image',
      '.pdf': 'pdf'
    };
    return typeMap[ext] || 'other';
  }

  /**
   * Get upload by ID
   */
  getUpload(uploadId) {
    return this.uploads.get(uploadId);
  }

  /**
   * Get all uploads for a project
   */
  getProjectUploads(projectId) {
    return Array.from(this.uploads.values())
      .filter(u => u.projectId === projectId)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  /**
   * Get all global uploads (no project)
   */
  getGlobalUploads() {
    return Array.from(this.uploads.values())
      .filter(u => !u.projectId)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  /**
   * Get file content for analysis
   */
  getFileContent(uploadId, filePath = null) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return null;

    if (filePath && upload.extractedDir) {
      const fullPath = path.join(upload.extractedDir, filePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
    } else if (upload.path && fs.existsSync(upload.path)) {
      return fs.readFileSync(upload.path, 'utf-8');
    }
    return null;
  }

  /**
   * Get all text content from extracted files for AI analysis
   */
  getExtractedContent(uploadId) {
    const upload = this.uploads.get(uploadId);
    if (!upload || !upload.extractedFiles) return null;

    const content = [];
    const textTypes = ['html', 'css', 'javascript', 'typescript', 'json', 'markdown', 'text'];

    for (const file of upload.extractedFiles) {
      if (textTypes.includes(file.type) && fs.existsSync(file.fullPath)) {
        try {
          const text = fs.readFileSync(file.fullPath, 'utf-8');
          content.push({
            path: file.path,
            type: file.type,
            content: text.slice(0, 50000) // Limit per file
          });
        } catch (e) {
          // Skip unreadable files
        }
      }
    }

    return content;
  }

  /**
   * Delete an upload
   */
  deleteUpload(uploadId) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return false;

    // Delete files
    if (upload.path && fs.existsSync(upload.path)) {
      fs.unlinkSync(upload.path);
    }
    if (upload.extractedDir && fs.existsSync(upload.extractedDir)) {
      fs.rmSync(upload.extractedDir, { recursive: true, force: true });
    }

    this.uploads.delete(uploadId);
    this._saveState();
    return true;
  }

  /**
   * Store analysis result
   */
  setAnalysis(uploadId, analysis) {
    const upload = this.uploads.get(uploadId);
    if (upload) {
      upload.analysis = analysis;
      upload.analyzedAt = new Date().toISOString();
      this._saveState();
    }
  }
}

export const uploadService = new UploadService();
export default uploadService;
