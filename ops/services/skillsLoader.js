/**
 * Mission Control V8 — Skills Loader
 *
 * Loads and manages skill sets that Directors reference when executing tasks.
 * Skills are markdown files with frontmatter metadata stored in /ops/skills/
 *
 * Directors automatically fetch relevant skills based on:
 * - Task type (seo, content, development, design, etc.)
 * - Keywords in the task description
 * - Project category
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.join(__dirname, '../skills');

// Ensure skills directory exists
fs.ensureDirSync(SKILLS_DIR);

/**
 * Parse frontmatter from markdown skill files
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content };
  }

  const frontmatter = match[1];
  const body = match[2];

  // Parse YAML-like frontmatter
  const metadata = {};
  frontmatter.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Handle arrays (comma-separated)
      if (value.includes(',')) {
        value = value.split(',').map(v => v.trim());
      }

      metadata[key] = value;
    }
  });

  return { metadata, content: body };
}

class SkillsLoader {
  constructor() {
    this.skills = new Map();
    this.skillIndex = [];
    this._loadSkills();
  }

  /**
   * Load all skills from the skills directory
   */
  _loadSkills() {
    try {
      const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(SKILLS_DIR, file);
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        const { metadata, content } = parseFrontmatter(rawContent);

        const skillId = file.replace('.md', '');
        const skill = {
          id: skillId,
          name: metadata.name || skillId,
          description: metadata.description || '',
          triggers: Array.isArray(metadata.triggers)
            ? metadata.triggers
            : (metadata.triggers || '').split(',').map(t => t.trim()).filter(Boolean),
          category: metadata.category || 'general',
          priority: parseInt(metadata.priority) || 5,
          content,
          filePath,
          loadedAt: new Date().toISOString()
        };

        this.skills.set(skillId, skill);
        this.skillIndex.push({
          id: skillId,
          name: skill.name,
          triggers: skill.triggers,
          category: skill.category
        });
      }

      console.log(`[SkillsLoader] Loaded ${this.skills.size} skills`);
    } catch (error) {
      console.error('[SkillsLoader] Error loading skills:', error.message);
    }
  }

  /**
   * Reload skills from disk (call after adding/modifying skill files)
   */
  reload() {
    this.skills.clear();
    this.skillIndex = [];
    this._loadSkills();
    return { success: true, count: this.skills.size };
  }

  /**
   * Get a specific skill by ID
   */
  getSkill(skillId) {
    return this.skills.get(skillId);
  }

  /**
   * Get all skills
   */
  getAllSkills() {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill index (metadata only, no content)
   */
  getIndex() {
    return this.skillIndex;
  }

  /**
   * Find relevant skills based on task context
   * @param {Object} context - Task context
   * @returns {Array} Matching skills sorted by relevance
   */
  findRelevantSkills(context) {
    const {
      taskType = '',
      taskDescription = '',
      projectName = '',
      keywords = []
    } = context;

    const searchText = `${taskType} ${taskDescription} ${projectName} ${keywords.join(' ')}`.toLowerCase();
    const matches = [];

    for (const skill of this.skills.values()) {
      let score = 0;

      // Check triggers
      for (const trigger of skill.triggers) {
        if (searchText.includes(trigger.toLowerCase())) {
          score += 10;
        }
      }

      // Check category match
      if (taskType && skill.category.toLowerCase() === taskType.toLowerCase()) {
        score += 5;
      }

      // Check name/description for keywords
      const skillText = `${skill.name} ${skill.description}`.toLowerCase();
      for (const keyword of keywords) {
        if (skillText.includes(keyword.toLowerCase())) {
          score += 3;
        }
      }

      // Check if any word from search appears in triggers
      const searchWords = searchText.split(/\s+/).filter(w => w.length > 3);
      for (const word of searchWords) {
        for (const trigger of skill.triggers) {
          if (trigger.toLowerCase().includes(word)) {
            score += 2;
          }
        }
      }

      if (score > 0) {
        matches.push({ skill, score });
      }
    }

    // Sort by score (highest first), then by priority
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.skill.priority - b.skill.priority;
    });

    return matches.map(m => m.skill);
  }

  /**
   * Get skills for a Director to use
   * Returns formatted skills ready to inject into Director prompt
   */
  getSkillsForDirector(context) {
    const relevantSkills = this.findRelevantSkills(context);

    if (relevantSkills.length === 0) {
      return null;
    }

    // Limit to top 3 most relevant skills to avoid token overload
    const topSkills = relevantSkills.slice(0, 3);

    let prompt = `\n\n## MASTER SKILL INSTRUCTIONS\n`;
    prompt += `The following skill sets contain your master instructions for this type of task. `;
    prompt += `Follow these guidelines precisely when executing related work.\n\n`;

    for (const skill of topSkills) {
      prompt += `### Skill: ${skill.name}\n`;
      prompt += `**Category:** ${skill.category}\n`;
      prompt += `**Description:** ${skill.description}\n\n`;
      prompt += skill.content;
      prompt += `\n\n---\n\n`;
    }

    return {
      prompt,
      skills: topSkills.map(s => ({ id: s.id, name: s.name, category: s.category }))
    };
  }

  /**
   * Create a new skill from content
   */
  createSkill({ id, name, description, triggers, category, priority, content }) {
    const frontmatter = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      `triggers: ${Array.isArray(triggers) ? triggers.join(', ') : triggers}`,
      `category: ${category || 'general'}`,
      `priority: ${priority || 5}`,
      '---',
      '',
      content
    ].join('\n');

    const filePath = path.join(SKILLS_DIR, `${id}.md`);
    fs.writeFileSync(filePath, frontmatter, 'utf-8');

    // Reload to pick up new skill
    this.reload();

    return { success: true, skill: this.getSkill(id) };
  }

  /**
   * Update an existing skill
   */
  updateSkill(skillId, updates) {
    const skill = this.getSkill(skillId);
    if (!skill) {
      return { success: false, error: 'Skill not found' };
    }

    const merged = {
      id: skillId,
      name: updates.name || skill.name,
      description: updates.description || skill.description,
      triggers: updates.triggers || skill.triggers,
      category: updates.category || skill.category,
      priority: updates.priority || skill.priority,
      content: updates.content || skill.content
    };

    return this.createSkill(merged);
  }

  /**
   * Delete a skill
   */
  deleteSkill(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill) {
      return { success: false, error: 'Skill not found' };
    }

    fs.removeSync(skill.filePath);
    this.reload();

    return { success: true };
  }
}

// Export singleton
export const skillsLoader = new SkillsLoader();
export default skillsLoader;
