import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

// Default directory for cloned repositories
const DEFAULT_REPOS_DIR = path.join(os.homedir(), 'ui-forge-repos');

export interface RepoInfo {
    name: string;
    path: string;
    branch: string;
    url: string;
}

export interface GitStatus {
    current: string | null;
    tracking: string | null;
    files: Array<{
        path: string;
        status: string;
    }>;
    ahead: number;
    behind: number;
}

export class GitService {
    private reposDir: string;

    constructor(reposDir?: string) {
        this.reposDir = reposDir || DEFAULT_REPOS_DIR;
    }

    /**
     * Ensure the repos directory exists
     */
    private async ensureReposDir(): Promise<void> {
        try {
            await fs.access(this.reposDir);
        } catch {
            await fs.mkdir(this.reposDir, { recursive: true });
        }
    }

    /**
     * Extract repo name from URL
     */
    private extractRepoName(url: string): string {
        const parts = url.split('/');
        const rawName = parts[parts.length - 1];
        return rawName.replace('.git', '') || 'unknown-repo';
    }

    /**
     * Clone a repository
     */
    async cloneRepo(repoUrl: string): Promise<RepoInfo> {
        await this.ensureReposDir();

        const repoName = this.extractRepoName(repoUrl);
        const repoPath = path.join(this.reposDir, repoName);

        // Check if repo already exists
        try {
            await fs.access(repoPath);
            // Directory exists, check if it's a git repo
            const git: SimpleGit = simpleGit(repoPath);
            const isRepo = await git.checkIsRepo();
            if (isRepo) {
                // Pull latest changes instead
                await git.pull();
                const branch = (await git.branch()).current;
                return { name: repoName, path: repoPath, branch, url: repoUrl };
            }
        } catch {
            // Directory doesn't exist, proceed with clone
        }

        // Clone the repository
        const git: SimpleGit = simpleGit(this.reposDir);
        await git.clone(repoUrl, repoName);

        // Get the current branch
        const repoGit = simpleGit(repoPath);
        const branch = (await repoGit.branch()).current;

        return { name: repoName, path: repoPath, branch, url: repoUrl };
    }

    /**
     * Pull latest changes from remote.
     * Fetch-first approach with dirty working directory handling.
     */
    async pullRepo(repoPath: string): Promise<{
        success: boolean;
        summary: string;
        filesChanged: string[];
        alreadyUpToDate: boolean;
        hadLocalChanges: boolean;
    }> {
        const git: SimpleGit = simpleGit(repoPath);

        // Verify it's a git repo
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
            throw new Error('Not a git repository');
        }

        try {
            // 1. Fetch first to get latest remote info
            await git.fetch();

            // 2. Check for dirty working directory
            const status = await git.status();
            const isDirty = status.files.length > 0;
            let hadLocalChanges = false;

            // 3. Stash if dirty
            if (isDirty) {
                hadLocalChanges = true;
                await git.stash(['push', '-m', 'UI Forge auto-stash before pull']);
                console.log(`[GitService] Stashed ${status.files.length} local changes before pull`);
            }

            // 4. Pull — explicitly specify remote + branch to handle untracked branches
            const currentBranch = status.current || 'main';
            console.log(`[GitService] Pulling origin/${currentBranch} (tracking: ${status.tracking || 'none'})`);
            const pullResult = status.tracking
                ? await git.pull()
                : await git.pull('origin', currentBranch);
            const filesChanged = pullResult.files || [];
            const alreadyUpToDate = filesChanged.length === 0;

            // 5. Unstash if we stashed
            if (hadLocalChanges) {
                try {
                    await git.stash(['pop']);
                    console.log('[GitService] Restored stashed changes after pull');
                } catch (stashErr: any) {
                    console.warn('[GitService] Stash pop failed (possible conflict):', stashErr.message);
                    // Don't throw — the pull succeeded, user can resolve conflicts manually
                }
            }

            const summary = alreadyUpToDate
                ? 'Already up to date'
                : `Pulled ${filesChanged.length} file(s): ${filesChanged.slice(0, 3).join(', ')}${filesChanged.length > 3 ? '...' : ''}`;

            return {
                success: true,
                summary,
                filesChanged,
                alreadyUpToDate,
                hadLocalChanges,
            };
        } catch (error: any) {
            throw new Error(`Pull failed: ${error.message}`);
        }
    }

    /**
     * Fetch remote status — for future "review before pull" feature.
     * Returns how many commits behind/ahead and which files would change.
     */
    async fetchStatus(repoPath: string): Promise<{
        behind: number;
        ahead: number;
        currentBranch: string;
        remoteBranch: string;
    }> {
        const git: SimpleGit = simpleGit(repoPath);

        const isRepo = await git.checkIsRepo();
        if (!isRepo) throw new Error('Not a git repository');

        await git.fetch();
        const status = await git.status();

        return {
            behind: status.behind,
            ahead: status.ahead,
            currentBranch: status.current || 'unknown',
            remoteBranch: status.tracking || 'origin/main',
        };
    }

    /**
     * Get repository status
     */
    async getStatus(repoPath: string): Promise<GitStatus> {
        const git: SimpleGit = simpleGit(repoPath);
        const status = await git.status();

        return {
            current: status.current,
            tracking: status.tracking,
            files: status.files.map(f => ({
                path: f.path,
                status: f.working_dir || f.index || 'unknown'
            })),
            ahead: status.ahead,
            behind: status.behind
        };
    }

    /**
     * Commit all changes and push
     */
    async commitAndPush(repoPath: string, message: string, branch?: string): Promise<{ commit: string; pushed: boolean }> {
        const git: SimpleGit = simpleGit(repoPath);

        // Stage all changes
        await git.add('.');

        // Commit
        const commitResult = await git.commit(message);
        const commitHash = commitResult.commit || 'no-commit';

        // Push
        const targetBranch = branch || (await git.branch()).current || 'main';
        try {
            await git.push('origin', targetBranch);
            return { commit: commitHash, pushed: true };
        } catch (error) {
            // Push failed (maybe no upstream or auth issues)
            console.error('Push failed:', error);
            return { commit: commitHash, pushed: false };
        }
    }

    /**
     * Create a new branch and optionally push to origin
     */
    async createBranch(repoPath: string, branchName: string): Promise<{ branch: string; created: boolean }> {
        try {
            const git: SimpleGit = simpleGit(repoPath);

            // Create and checkout new branch locally
            await git.checkoutLocalBranch(branchName);

            // Removed automatic push to origin so it remains a 'Local' branch ('L').
            // The user must manually "Push Changes" to sync it to GitHub.

            return { branch: branchName, created: true };
        } catch (error: any) {
            throw new Error(`Failed to create branch: ${error.message}`);
        }
    }

    /**
     * List all branches (fetches from remote first to ensure colleagues' branches are visible)
     */
    async getBranches(repoPath: string): Promise<{ current: string; all: { name: string; type: 'local' | 'remote' }[] }> {
        const git: SimpleGit = simpleGit(repoPath);

        try {
            console.log(`[GitService] getBranches: Starting 'git fetch' for ${repoPath}...`);
            // Set env to prevent hanging on auth prompts
            await git.env({ ...process.env, GIT_TERMINAL_PROMPT: '0' }).fetch();
            console.log('[GitService] getBranches: fetch complete.');
        } catch (e: any) {
            console.warn('[GitService] Failed to fetch remote branches', e.message || e);
        }

        const branchSummary = await git.branch(['-a']); // Get both local and remote

        const branchMap = new Map<string, 'local' | 'remote'>();

        branchSummary.all.forEach(b => {
            // Ignore the HEAD pointer
            if (b.includes('->') || b.includes('HEAD')) return;

            if (b.startsWith('remotes/origin/')) {
                const cleanName = b.replace(/^remotes\/origin\//, '');
                // It exists on remote (GitHub) -> upgrade status to remote
                branchMap.set(cleanName, 'remote');
            } else {
                // It's a local branch list
                if (!branchMap.has(b)) {
                    branchMap.set(b, 'local');
                }
            }
        });

        const allBranches = Array.from(branchMap.entries())
            .map(([name, type]) => ({ name, type }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return {
            current: branchSummary.current,
            all: allBranches
        };
    }

    /**
     * Switch to an existing branch
     */
    async switchBranch(repoPath: string, branchName: string): Promise<{ success: boolean; currentBranch: string }> {
        try {
            const git: SimpleGit = simpleGit(repoPath);
            await git.checkout(branchName);
            const branchSummary = await git.branch();
            return { success: true, currentBranch: branchSummary.current };
        } catch (error: any) {
            throw new Error(`Failed to switch branch: ${error.message}`);
        }
    }

    /**
     * Discard all local changes (hard reset & clean)
     */
    async discardAll(repoPath: string): Promise<{ success: boolean }> {
        try {
            const git: SimpleGit = simpleGit(repoPath);
            await git.reset(['--hard']);
            await git.clean('f', ['-d']);
            return { success: true };
        } catch (error: any) {
            throw new Error(`Failed to discard changes: ${error.message}`);
        }
    }

    /**
     * List all cloned repositories
     */
    async listRepos(): Promise<RepoInfo[]> {
        await this.ensureReposDir();

        const entries = await fs.readdir(this.reposDir, { withFileTypes: true });
        const repos: RepoInfo[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const repoPath = path.join(this.reposDir, entry.name);
                try {
                    const git: SimpleGit = simpleGit(repoPath);
                    const isRepo = await git.checkIsRepo();
                    if (isRepo) {
                        const branch = (await git.branch()).current;
                        const remotes = await git.getRemotes(true);
                        const origin = remotes.find(r => r.name === 'origin');
                        repos.push({
                            name: entry.name,
                            path: repoPath,
                            branch: branch || 'main',
                            url: origin?.refs?.fetch || ''
                        });
                    }
                } catch {
                    // Not a git repo, skip
                }
            }
        }

        return repos;
    }
}
