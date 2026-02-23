import simpleGit from 'simple-git';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
// Default directory for cloned repositories
const DEFAULT_REPOS_DIR = path.join(os.homedir(), 'ui-forge-repos');
export class GitService {
    reposDir;
    constructor(reposDir) {
        this.reposDir = reposDir || DEFAULT_REPOS_DIR;
    }
    /**
     * Ensure the repos directory exists
     */
    async ensureReposDir() {
        try {
            await fs.access(this.reposDir);
        }
        catch {
            await fs.mkdir(this.reposDir, { recursive: true });
        }
    }
    /**
     * Extract repo name from URL
     */
    extractRepoName(url) {
        const parts = url.split('/');
        const rawName = parts[parts.length - 1];
        return rawName.replace('.git', '') || 'unknown-repo';
    }
    /**
     * Clone a repository
     */
    async cloneRepo(repoUrl) {
        await this.ensureReposDir();
        const repoName = this.extractRepoName(repoUrl);
        const repoPath = path.join(this.reposDir, repoName);
        // Check if repo already exists
        try {
            await fs.access(repoPath);
            // Directory exists, check if it's a git repo
            const git = simpleGit(repoPath);
            const isRepo = await git.checkIsRepo();
            if (isRepo) {
                // Pull latest changes instead
                await git.pull();
                const branch = (await git.branch()).current;
                return { name: repoName, path: repoPath, branch, url: repoUrl };
            }
        }
        catch {
            // Directory doesn't exist, proceed with clone
        }
        // Clone the repository
        const git = simpleGit(this.reposDir);
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
    async pullRepo(repoPath) {
        const git = simpleGit(repoPath);
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
                }
                catch (stashErr) {
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
        }
        catch (error) {
            throw new Error(`Pull failed: ${error.message}`);
        }
    }
    /**
     * Fetch remote status — for future "review before pull" feature.
     * Returns how many commits behind/ahead and which files would change.
     */
    async fetchStatus(repoPath) {
        const git = simpleGit(repoPath);
        const isRepo = await git.checkIsRepo();
        if (!isRepo)
            throw new Error('Not a git repository');
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
    async getStatus(repoPath) {
        const git = simpleGit(repoPath);
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
    async commitAndPush(repoPath, message, branch) {
        const git = simpleGit(repoPath);
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
        }
        catch (error) {
            // Push failed (maybe no upstream or auth issues)
            console.error('Push failed:', error);
            return { commit: commitHash, pushed: false };
        }
    }
    /**
     * Create a new branch and optionally push to origin
     */
    async createBranch(repoPath, branchName) {
        try {
            const git = simpleGit(repoPath);
            // Create and checkout new branch locally
            await git.checkoutLocalBranch(branchName);
            // Removed automatic push to origin so it remains a 'Local' branch ('L').
            // The user must manually "Push Changes" to sync it to GitHub.
            return { branch: branchName, created: true };
        }
        catch (error) {
            throw new Error(`Failed to create branch: ${error.message}`);
        }
    }
    /**
     * List all branches (fetches from remote first to ensure colleagues' branches are visible)
     */
    async getBranches(repoPath) {
        const git = simpleGit(repoPath);
        try {
            console.log(`[GitService] getBranches: Starting 'git fetch' for ${repoPath}...`);
            // Set env to prevent hanging on auth prompts
            await git.env({ ...process.env, GIT_TERMINAL_PROMPT: '0' }).fetch();
            console.log('[GitService] getBranches: fetch complete.');
        }
        catch (e) {
            console.warn('[GitService] Failed to fetch remote branches', e.message || e);
        }
        const branchSummary = await git.branch(['-a']); // Get both local and remote
        const branchMap = new Map();
        branchSummary.all.forEach(b => {
            // Ignore the HEAD pointer
            if (b.includes('->') || b.includes('HEAD'))
                return;
            if (b.startsWith('remotes/origin/')) {
                const cleanName = b.replace(/^remotes\/origin\//, '');
                // It exists on remote (GitHub) -> upgrade status to remote
                branchMap.set(cleanName, 'remote');
            }
            else {
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
    async switchBranch(repoPath, branchName) {
        try {
            const git = simpleGit(repoPath);
            await git.checkout(branchName);
            const branchSummary = await git.branch();
            return { success: true, currentBranch: branchSummary.current };
        }
        catch (error) {
            throw new Error(`Failed to switch branch: ${error.message}`);
        }
    }
    /**
     * Discard all local changes (hard reset & clean)
     */
    async discardAll(repoPath) {
        try {
            const git = simpleGit(repoPath);
            await git.reset(['--hard']);
            await git.clean('f', ['-d']);
            return { success: true };
        }
        catch (error) {
            throw new Error(`Failed to discard changes: ${error.message}`);
        }
    }
    /**
     * List all cloned repositories
     */
    async listRepos() {
        await this.ensureReposDir();
        const entries = await fs.readdir(this.reposDir, { withFileTypes: true });
        const repos = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const repoPath = path.join(this.reposDir, entry.name);
                try {
                    const git = simpleGit(repoPath);
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
                }
                catch {
                    // Not a git repo, skip
                }
            }
        }
        return repos;
    }
}
