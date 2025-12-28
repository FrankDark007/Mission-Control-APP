/**
 * Upload Routes
 * Handles file uploads and AI analysis
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadService } from '../services/uploadService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = req.params.projectId;
    const destDir = projectId
      ? uploadService.getProjectDir(projectId)
      : path.join(__dirname, '../uploads');
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

/**
 * Initialize routes with dependencies
 */
export function createUploadRouter({ callAI, integrations, artifactService, projectService, agentManager, io }) {

  // Upload file globally
  router.post('/', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const metadata = await uploadService.processUpload(req.file, null);
      res.json({
        success: true,
        upload: metadata
      });
    } catch (error) {
      console.error('[Uploads] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload file to a project
  router.post('/projects/:projectId', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { projectId } = req.params;
      const metadata = await uploadService.processUpload(req.file, projectId);

      // Create artifact for the upload
      if (artifactService && projectId) {
        const artifact = await artifactService.createArtifact({
          projectId,
          taskId: null,
          type: 'upload',
          label: `Upload: ${req.file.originalname}`,
          content: {
            uploadId: metadata.id,
            filename: metadata.originalName,
            extractedFiles: metadata.extractedFiles?.length || 0
          },
          contentType: metadata.mimetype?.includes('zip') ? 'json' : 'text',
          provenance: {
            producer: 'user_upload',
            agentId: null,
            model: null
          }
        });
        metadata.artifactId = artifact.id;
      }

      res.json({
        success: true,
        upload: metadata
      });
    } catch (error) {
      console.error('[Uploads] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all global uploads
  router.get('/', (req, res) => {
    const uploads = uploadService.getGlobalUploads();
    res.json({ uploads });
  });

  // Get uploads for a project
  router.get('/projects/:projectId', (req, res) => {
    const uploads = uploadService.getProjectUploads(req.params.projectId);
    res.json({ uploads });
  });

  // Get single upload
  router.get('/:uploadId', (req, res) => {
    const upload = uploadService.getUpload(req.params.uploadId);
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    res.json({ upload });
  });

  // Get extracted file content
  router.get('/:uploadId/files/:filePath(*)', (req, res) => {
    const content = uploadService.getFileContent(req.params.uploadId, req.params.filePath);
    if (content === null) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json({ content });
  });

  // Delete upload
  router.delete('/:uploadId', (req, res) => {
    const success = uploadService.deleteUpload(req.params.uploadId);
    res.json({ success });
  });

  // Analyze upload with AI
  router.post('/:uploadId/analyze', async (req, res) => {
    try {
      const { model, analysisType, customPrompt } = req.body;
      const upload = uploadService.getUpload(req.params.uploadId);

      if (!upload) {
        return res.status(404).json({ error: 'Upload not found' });
      }

      // Get content for analysis
      let content;
      if (upload.extractedFiles?.length > 0) {
        content = uploadService.getExtractedContent(req.params.uploadId);
      } else {
        content = uploadService.getFileContent(req.params.uploadId);
      }

      if (!content) {
        return res.status(400).json({ error: 'No analyzable content found' });
      }

      // Build analysis prompt based on type
      let prompt;
      const contentSummary = typeof content === 'string'
        ? content.slice(0, 30000)
        : content.map(f => `### ${f.path}\n\`\`\`${f.type}\n${f.content.slice(0, 5000)}\n\`\`\``).join('\n\n');

      switch (analysisType) {
        case 'seo':
          prompt = `Analyze this website for SEO optimization opportunities.

## Website Content:
${contentSummary}

## Tasks:
1. Identify all pages and their current meta tags (title, description)
2. Analyze keyword opportunities based on page content
3. Identify missing SEO elements (headings, alt tags, schema markup)
4. Suggest improvements for each page
5. Provide a prioritized action plan

Respond with a detailed SEO audit report.`;
          break;

        case 'competitor':
          prompt = `Analyze this website and provide competitor research insights.

## Website Content:
${contentSummary}

## Tasks:
1. Identify the business type and target audience
2. List key services/products offered
3. Analyze unique selling propositions
4. Suggest content gaps compared to typical competitors
5. Recommend content strategy improvements

Respond with actionable competitor analysis insights.`;
          break;

        case 'content':
          prompt = `Generate SEO-optimized content suggestions for this website.

## Website Content:
${contentSummary}

## Tasks:
1. Analyze existing content structure
2. Identify thin or missing content areas
3. Generate meta title and description suggestions for each page
4. Suggest new content topics based on the business
5. Provide keyword-rich content outlines

Respond with specific content recommendations and examples.`;
          break;

        case 'custom':
          prompt = customPrompt || 'Analyze this content and provide insights.';
          prompt += `\n\n## Content:\n${contentSummary}`;
          break;

        default:
          prompt = `Analyze the following website content and provide a comprehensive overview:

## Website Content:
${contentSummary}

## Provide:
1. Site structure overview
2. Key pages and their purpose
3. Technologies used
4. Content quality assessment
5. Recommendations for improvement`;
      }

      // Determine which AI to use
      const aiModel = model || 'claude-code';

      let result;

      if (aiModel === 'claude-code' && agentManager) {
        // Spawn Claude Code agent for analysis
        console.log('[Uploads] Spawning Claude Code agent for analysis');

        // Enable armed mode
        const wasArmed = agentManager.isArmedMode();
        agentManager.setArmedMode(true);

        const spawnResult = await agentManager.spawnAgentImmediate({
          missionId: upload.projectId || 'global',
          taskId: `analysis_${req.params.uploadId}`,
          taskName: `${analysisType.toUpperCase()} Analysis: ${upload.originalName}`,
          prompt: prompt,
          model: 'claude-sonnet-4',
          autoPilot: true,
          riskLevel: 'medium'
        }, {
          riskThreshold: 'high'
        });

        // Restore armed mode
        if (!wasArmed) {
          agentManager.setArmedMode(false);
        }

        if (spawnResult.success) {
          // Emit socket event
          if (io) {
            io.emit('analysis-started', {
              uploadId: req.params.uploadId,
              agentId: spawnResult.agentId,
              pid: spawnResult.pid,
              analysisType
            });
          }

          result = {
            model: 'claude-code',
            agentId: spawnResult.agentId,
            pid: spawnResult.pid,
            status: 'running',
            analysisType,
            message: `Claude Code agent spawned (PID: ${spawnResult.pid}). Analysis in progress...`
          };
        } else {
          return res.status(500).json({ error: spawnResult.error || 'Failed to spawn Claude Code agent' });
        }
      } else if (aiModel === 'perplexity' && integrations?.perplexity) {
        // Use Perplexity for web-grounded research
        const searchQuery = `${analysisType} analysis for ${upload.originalName.replace('.zip', '')} website`;
        const perplexityResult = await integrations.perplexity.search(searchQuery);
        result = {
          model: 'perplexity',
          research: perplexityResult,
          prompt,
          analysisType
        };
      } else if (callAI) {
        // Use Gemini or other model
        const response = await callAI(aiModel, prompt, 'You are an expert SEO and content strategist.');
        result = {
          model: aiModel,
          analysis: typeof response === 'string' ? response : response?.text,
          analysisType
        };
      } else {
        return res.status(500).json({ error: 'AI not configured' });
      }

      // Store analysis result
      uploadService.setAnalysis(req.params.uploadId, result);

      // Create artifact for analysis
      if (artifactService && upload.projectId) {
        await artifactService.createArtifact({
          projectId: upload.projectId,
          taskId: null,
          type: `${analysisType}_analysis`,
          label: `${analysisType.toUpperCase()} Analysis: ${upload.originalName}`,
          content: result,
          contentType: 'json',
          provenance: {
            producer: 'ai_analysis',
            model: result.model
          }
        });
      }

      res.json({
        success: true,
        result
      });
    } catch (error) {
      console.error('[Uploads] Analysis error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default router;
