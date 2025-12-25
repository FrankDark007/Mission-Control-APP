
import simpleGit from 'simple-git';
import { existsSync } from 'fs';

export class GitManager {
    constructor(repoPath) {
        this.git = simpleGit(repoPath);
        this.repoPath = repoPath;
    }

    async getLog(limit = 10) {
        try {
            if (!existsSync(this.repoPath)) throw new Error('Repository path not found');
            const log = await this.git.log({ maxCount: limit });
            return log.all;
        } catch (e) {
            console.error('Git Log Error:', e.message);
            return [];
        }
    }

    async pull() {
        try {
            const result = await this.git.pull();
            return { success: true, files: result.files, summary: result.summary };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async merge(branch) {
        try {
            const result = await this.git.merge([branch]);
            return { success: true, result };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async resetHard(target = 'HEAD') {
        try {
            await this.git.reset(['--hard', target]);
            return { success: true, target };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async getStatus() {
        try {
            return await this.git.status();
        } catch (e) {
            return { error: e.message };
        }
    }
}
