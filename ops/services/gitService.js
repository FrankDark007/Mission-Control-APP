import simpleGit from 'simple-git';
import { existsSync } from 'fs';

/**
 * Service for managing Git repository operations.
 */
export class GitService {
    constructor(repoPath) {
        this.git = simpleGit(repoPath);
        this.repoPath = repoPath;
    }

    /**
     * Retrieves the commit log.
     */
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

    /**
     * Performs a git pull.
     */
    async pull() {
        try {
            const result = await this.git.pull();
            return { success: true, result };
        } catch (e) {
            console.error('Git Pull Error:', e.message);
            throw e;
        }
    }

    /**
     * Resets the repository to a target state (hard reset).
     */
    async reset(target = 'HEAD') {
        try {
            const result = await this.git.reset(['--hard', target]);
            return { success: true, target: result };
        } catch (e) {
            console.error('Git Reset Error:', e.message);
            throw e;
        }
    }

    /**
     * Merges a branch into the current one.
     */
    async merge(branch) {
        try {
            const result = await this.git.merge([branch]);
            return { success: true, result };
        } catch (e) {
            console.error('Git Merge Error:', e.message);
            throw e;
        }
    }

    /**
     * Performs a git push.
     */
    async push() {
        try {
            const result = await this.git.push();
            return { success: true, result };
        } catch (e) {
            console.error('Git Push Error:', e.message);
            throw e;
        }
    }

    /**
     * Gets current repository status.
     */
    async status() {
        return await this.git.status();
    }
}