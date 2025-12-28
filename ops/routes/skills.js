/**
 * Mission Control V8 — Skills API Routes
 *
 * Manage master skill sets that Directors use for task execution.
 */

import express from 'express';
import { skillsLoader } from '../services/skillsLoader.js';

const router = express.Router();

/**
 * Get all skills (index only, no content)
 */
router.get('/', (req, res) => {
  try {
    const skills = skillsLoader.getIndex();
    res.json({ success: true, skills, count: skills.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all skills with full content
 */
router.get('/full', (req, res) => {
  try {
    const skills = skillsLoader.getAllSkills();
    res.json({ success: true, skills, count: skills.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific skill by ID
 */
router.get('/:skillId', (req, res) => {
  try {
    const skill = skillsLoader.getSkill(req.params.skillId);
    if (!skill) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }
    res.json({ success: true, skill });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Find relevant skills based on context
 */
router.post('/find', (req, res) => {
  try {
    const { taskType, taskDescription, projectName, keywords } = req.body;
    const skills = skillsLoader.findRelevantSkills({
      taskType,
      taskDescription,
      projectName,
      keywords
    });
    res.json({
      success: true,
      skills: skills.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        triggers: s.triggers
      })),
      count: skills.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get skills formatted for Director prompt injection
 */
router.post('/for-director', (req, res) => {
  try {
    const { taskType, taskDescription, projectName, keywords } = req.body;
    const result = skillsLoader.getSkillsForDirector({
      taskType,
      taskDescription,
      projectName,
      keywords
    });

    if (!result) {
      return res.json({ success: true, found: false, message: 'No matching skills found' });
    }

    res.json({
      success: true,
      found: true,
      skills: result.skills,
      prompt: result.prompt
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new skill
 */
router.post('/', (req, res) => {
  try {
    const { id, name, description, triggers, category, priority, content } = req.body;

    if (!id || !name || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: id, name, content'
      });
    }

    const result = skillsLoader.createSkill({
      id,
      name,
      description,
      triggers,
      category,
      priority,
      content
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update an existing skill
 */
router.put('/:skillId', (req, res) => {
  try {
    const result = skillsLoader.updateSkill(req.params.skillId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a skill
 */
router.delete('/:skillId', (req, res) => {
  try {
    const result = skillsLoader.deleteSkill(req.params.skillId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Reload skills from disk
 */
router.post('/reload', (req, res) => {
  try {
    const result = skillsLoader.reload();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
