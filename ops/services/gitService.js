
import simpleGit from 'simple-git';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Service for managing Git repository operations and isolated worktrees.
 */
export class GitService {
    constructor(repoPath) {
        this.git = simpleGit(repoPath);
        this.repoPath = repoPath;
    }

    async log(limit = 10) {
        try {
            if (!existsSync(this.repoPath)) throw new Error('Repository path not found');
            const log = await this.git.log({ maxCount: limit });
            return log.all;
        } catch (e) {
            console.error('Git Log Error:', e.message);
            throw e;
        }
    }

    async pull() {
        return await this.git.pull();
    }

    async push() {
        return await this.git.push();
    }

    /**
     * Creates an isolated worktree for a sub-agent.
     */
    async addWorktree(path, branch) {
        try {
            // Ensure parent directory exists
            const parentDir = join(path, '..');
            if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
            
            // git worktree add <path> <branch>
            await this.git.raw(['worktree', 'add', '-b', branch, path]);
            return { success: true, path, branch };
        } catch (e) {
            console.error('Git Worktree Add Error:', e.message);
            throw e;
        }
    }

    /**
     * Removes a worktree after task completion.
     */
    async removeWorktree(path) {
        try {
            await this.git.raw(['worktree', 'remove', path]);
            return { success: true };
        } catch (e) {
            console.error('Git Worktree Remove Error:', e.message);
            throw e;
        }
    }

    async status() {
        return await this.git.status();
    }
}
