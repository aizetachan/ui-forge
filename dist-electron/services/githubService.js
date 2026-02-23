import { Octokit } from '@octokit/rest';
import { EventEmitter } from 'events';
import https from 'https';
/**
 * GitHubService handles OAuth Device Flow authentication
 * and Pull Request creation via Octokit.
 */
export class GitHubService extends EventEmitter {
    octokit = null;
    accessToken = null;
    // GitHub OAuth App credentials (public app)
    clientId = 'Ov23liXXXXXXXXXXXXXX'; // TODO: Replace with real Client ID
    /**
     * Start Device Flow authentication
     * Returns user code and verification URL for user to complete auth
     */
    async startDeviceFlow() {
        return new Promise((resolve, reject) => {
            const postData = `client_id=${this.clientId}&scope=repo`;
            const options = {
                hostname: 'github.com',
                path: '/login/device/code',
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                },
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new Error(response.error_description || response.error));
                        }
                        else {
                            resolve(response);
                        }
                    }
                    catch (e) {
                        reject(new Error('Failed to parse GitHub response'));
                    }
                });
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }
    /**
     * Poll for access token after user completes Device Flow
     */
    async pollForToken(deviceCode, interval = 5) {
        return new Promise((resolve, reject) => {
            const poll = () => {
                const postData = `client_id=${this.clientId}&device_code=${deviceCode}&grant_type=urn:ietf:params:oauth:grant-type:device_code`;
                const options = {
                    hostname: 'github.com',
                    path: '/login/oauth/access_token',
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(postData),
                    },
                };
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            const response = JSON.parse(data);
                            if (response.access_token) {
                                this.accessToken = response.access_token;
                                this.octokit = new Octokit({ auth: response.access_token });
                                resolve(response);
                            }
                            else if (response.error === 'authorization_pending') {
                                // User hasn't completed auth yet, poll again
                                setTimeout(poll, interval * 1000);
                            }
                            else if (response.error === 'slow_down') {
                                // Need to poll slower
                                setTimeout(poll, (interval + 5) * 1000);
                            }
                            else if (response.error === 'expired_token') {
                                reject(new Error('Device code expired. Please try again.'));
                            }
                            else if (response.error === 'access_denied') {
                                reject(new Error('Access denied by user.'));
                            }
                            else {
                                reject(new Error(response.error_description || response.error || 'Unknown error'));
                            }
                        }
                        catch (e) {
                            reject(new Error('Failed to parse token response'));
                        }
                    });
                });
                req.on('error', reject);
                req.write(postData);
                req.end();
            };
            poll();
        });
    }
    /**
     * Set token directly (for stored tokens)
     */
    setToken(token) {
        this.accessToken = token;
        this.octokit = new Octokit({ auth: token });
    }
    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return this.octokit !== null;
    }
    /**
     * Get current user info
     */
    async getCurrentUser() {
        if (!this.octokit)
            return null;
        try {
            const { data } = await this.octokit.users.getAuthenticated();
            return {
                login: data.login,
                name: data.name || data.login,
                avatar_url: data.avatar_url,
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Create a Pull Request
     */
    async createPullRequest(owner, repo, title, body, head, base = 'main') {
        if (!this.octokit) {
            throw new Error('Not authenticated. Please authenticate first.');
        }
        const { data } = await this.octokit.pulls.create({
            owner,
            repo,
            title,
            body,
            head,
            base,
        });
        return {
            number: data.number,
            url: data.html_url,
            title: data.title,
        };
    }
    /**
     * Parse owner and repo from git remote URL
     */
    parseRepoFromUrl(url) {
        // Handle HTTPS: https://github.com/owner/repo.git
        const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
        if (httpsMatch) {
            return { owner: httpsMatch[1], repo: httpsMatch[2] };
        }
        // Handle SSH: git@github.com:owner/repo.git
        const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)/);
        if (sshMatch) {
            return { owner: sshMatch[1], repo: sshMatch[2] };
        }
        return null;
    }
    /**
     * Get access token (for storage)
     */
    getToken() {
        return this.accessToken;
    }
    /**
     * Clear authentication
     */
    logout() {
        this.accessToken = null;
        this.octokit = null;
    }
}
// Singleton instance
export const githubService = new GitHubService();
