import { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import http from 'http';
import { fileURLToPath, pathToFileURL } from 'url';
import { GitService } from './services/gitService.js';
import { RepoParser } from './services/repoParser.js';
import { CodeWriter } from './services/codeWriter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;

// Current repo path — updated when a repo is parsed, used by forge-asset:// protocol
let currentRepoPath: string | null = null;

// MIME type lookup for common asset extensions
const MIME_TYPES: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 16 },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        backgroundColor: '#09090b',
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // Register forge-asset:// protocol for serving repo files to the sandbox iframe
    protocol.handle('forge-asset', (request) => {
        try {
            if (!currentRepoPath) {
                return new Response('No repository loaded', { status: 404 });
            }

            // Parse the URL: forge-asset://repo/path/to/file.png
            const url = new URL(request.url);
            // pathname comes as /path/to/file — strip leading slash
            const relativePath = decodeURIComponent(url.pathname).replace(/^\//, '');
            const filePath = path.join(currentRepoPath, relativePath);

            // Security: ensure the resolved path is within the repo directory
            const resolved = path.resolve(filePath);
            const repoResolved = path.resolve(currentRepoPath);
            if (!resolved.startsWith(repoResolved + path.sep) && resolved !== repoResolved) {
                console.warn('[forge-asset] Path traversal blocked:', relativePath);
                return new Response('Forbidden', { status: 403 });
            }

            // Check file exists
            if (!fs.existsSync(resolved)) {
                console.warn('[forge-asset] File not found:', resolved);
                return new Response('Not found', { status: 404 });
            }

            // Serve using net.fetch with file:// URL
            return net.fetch(pathToFileURL(resolved).toString());
        } catch (error) {
            console.error('[forge-asset] Error serving asset:', error);
            return new Response('Internal error', { status: 500 });
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ========== Git Service Handlers ==========

const gitService = new GitService();

ipcMain.handle('git:clone', async (_event, repoUrl: string) => {
    try {
        const result = await gitService.cloneRepo(repoUrl);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git:status', async (_event, repoPath: string) => {
    try {
        const result = await gitService.getStatus(repoPath);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git:commit-push', async (_event, repoPath: string, message: string, branch?: string) => {
    try {
        const result = await gitService.commitAndPush(repoPath, message, branch);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git:create-branch', async (_event, repoPath: string, branchName: string) => {
    try {
        const result = await gitService.createBranch(repoPath, branchName);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git:list-repos', async () => {
    try {
        const repos = await gitService.listRepos();
        return { success: true, data: repos };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git:pull', async (_event, repoPath: string) => {
    try {
        console.log('[IPC git:pull] Pulling latest changes for:', repoPath);
        const result = await gitService.pullRepo(repoPath);
        console.log('[IPC git:pull] Result:', result.summary);
        return { success: true, data: result };
    } catch (error: any) {
        console.error('[IPC git:pull] Error:', error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git:fetch-status', async (_event, repoPath: string) => {
    try {
        const result = await gitService.fetchStatus(repoPath);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git:get-branches', async (_event, repoPath: string) => {
    console.log(`[IPC git:get-branches] Received request for ${repoPath}`);
    try {
        const result = await gitService.getBranches(repoPath);
        console.log(`[IPC git:get-branches] Returning ${result.all.length} branches`);
        return { success: true, data: result };
    } catch (error: any) {
        console.error('[IPC git:get-branches] Error:', error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git:switch-branch', async (_event, repoPath: string, branchName: string) => {
    try {
        const result = await gitService.switchBranch(repoPath, branchName);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});



ipcMain.handle('git:discard-all', async (_event, repoPath: string) => {
    try {
        const result = await gitService.discardAll(repoPath);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

// ========== Dialog Handlers ==========

ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory'],
    });
    if (result.canceled) {
        return { success: false, canceled: true };
    }
    return { success: true, data: result.filePaths[0] };
});

// ========== Repo Parser Handlers ==========

ipcMain.handle('repo:parse', async (_event, repoPath: string) => {
    try {
        console.log('[IPC repo:parse] Parsing repository at:', repoPath);

        // Store repo path for forge-asset:// protocol
        currentRepoPath = repoPath;
        console.log('[IPC repo:parse] Updated currentRepoPath for forge-asset:// protocol');

        const parser = new RepoParser();
        const result = await parser.parseRepository(repoPath);

        // Log summary of what was parsed (keep logging minimal to avoid EPIPE)
        const assetCount = result.repoAssets
            ? `${result.repoAssets.icons.length} icons, ${result.repoAssets.images.length} images`
            : 'no assets';
        console.log(`[IPC repo:parse] Complete: ${result.components.length} components, ${result.tokens.length} tokens, ${assetCount}`);

        return { success: true, data: result };
    } catch (error: any) {
        console.error('[IPC repo:parse] Error:', error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('repo:read-file', async (_event, filePath: string) => {
    try {
        // Security: verify the path is within the current repo
        const resolved = path.resolve(filePath);
        if (!currentRepoPath || !resolved.startsWith(path.resolve(currentRepoPath))) {
            return { success: false, error: 'Path outside repository' };
        }
        const content = fs.readFileSync(resolved, 'utf-8');
        return { success: true, data: content };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

// ========== Code Writer Handlers ==========

const codeWriter = new CodeWriter();

ipcMain.handle('code:write-css', async (_event, params: {
    cssFilePath: string;
    selector: string;
    changes: Record<string, string>;
    mediaQuery?: string;
}) => {
    try {
        return await codeWriter.writeCSSChange(params);
    } catch (error: any) {
        return { success: false, newContent: '', error: error.message };
    }
});

ipcMain.handle('code:write-prop', async (_event, params: {
    forgecorePath: string;
    componentName: string;
    propName: string;
    value: any;
}) => {
    try {
        return await codeWriter.writePropDefault(params);
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('code:write-token', async (_event, params: {
    themeFilePath: string;
    tokenName: string;
    newValue: string;
}) => {
    try {
        return await codeWriter.writeTokenValue(params);
    } catch (error: any) {
        return { success: false, newContent: '', error: error.message };
    }
});

ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.handle('window:close', () => {
    mainWindow?.close();
});
// ========== Auth IPC Handlers (bypass signInWithPopup COOP issues) ==========
// Singleton callback server — created once, reused for all auth attempts.

const OAUTH_PORT = 47831;
const CALLBACK_URL = `http://localhost:${OAUTH_PORT}/auth/callback`;

let authCallbackServer: http.Server | null = null;
let pendingAuthResolve: ((result: any) => void) | null = null;
let pendingProviderId: string = '';

function ensureAuthServer() {
    if (authCallbackServer) return; // Already running

    authCallbackServer = http.createServer((req, res) => {
        const reqUrl = new URL(req.url || '/', `http://localhost`);

        if (reqUrl.pathname === '/auth/callback') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>UI Forge — Authentication</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      background-color: #09090b;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 2.5rem 2rem 2rem;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,.5);
      animation: cardIn .4s cubic-bezier(.16,1,.3,1) both;
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(16px) scale(.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .logo { width: 48px; height: 48px; margin: 0 auto 1.5rem; color: #a1a1aa; }
    .icon-wrap {
      width: 64px; height: 64px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1.25rem;
      animation: popIn .35s cubic-bezier(.16,1,.3,1) .15s both;
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(.5); }
      to   { opacity: 1; transform: scale(1); }
    }
    .icon-wrap.success { background: rgba(34,197,94,.1); }
    .icon-wrap.error   { background: rgba(239,68,68,.1); }
    .icon-wrap.loading { background: rgba(161,161,170,.08); }
    .icon-wrap svg { width: 32px; height: 32px; }
    .icon-wrap.success svg { color: #22c55e; }
    .icon-wrap.error svg   { color: #ef4444; }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: .375rem; }
    .sub { font-size: .875rem; color: #71717a; line-height: 1.4; }
    .countdown {
      margin-top: 1.5rem;
      font-size: .75rem;
      color: #52525b;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .5rem;
    }
    .countdown-bar {
      width: 100%;
      height: 3px;
      background: #27272a;
      border-radius: 2px;
      margin-top: 1rem;
      overflow: hidden;
    }
    .countdown-bar-fill {
      height: 100%;
      background: #22c55e;
      border-radius: 2px;
      animation: shrink 10s linear forwards;
    }
    @keyframes shrink { from { width: 100%; } to { width: 0%; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner {
      width: 28px; height: 28px;
      border: 3px solid #27272a;
      border-top-color: #a1a1aa;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
  </style>
</head>
<body>
  <div class="card">
    <!-- Logo -->
    <svg class="logo" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M77.7041 15.4326C79.9132 15.4326 81.7041 17.2235 81.7041 19.4326V26.5176C81.7039 37.4554 73.3073 46.4294 62.6084 47.3516C61.6462 56.9437 53.5497 64.4326 43.7041 64.4326H38.6455C37.8806 74.2247 29.6926 81.9326 19.7041 81.9326H17.7041C16.6685 81.9326 15.8172 81.1453 15.7148 80.1367L15.7041 79.9326C15.7041 79.7996 15.7063 79.6666 15.709 79.5342C15.7073 79.5005 15.7041 79.4667 15.7041 79.4326V37.4326C15.7041 25.2824 25.5538 15.4326 37.7041 15.4326H77.7041ZM34.6279 64.4434C27.0068 64.7219 20.7898 70.5022 19.832 77.9307L20.0908 77.9277C27.6894 77.7354 33.8828 71.8921 34.6279 64.4434ZM37.7041 47.4326C27.763 47.4326 19.7041 55.4915 19.7041 65.4326V68.1006C23.2674 63.4397 28.8841 60.4326 35.2041 60.4326H43.7041C51.3101 60.4326 57.5934 54.7712 58.5713 47.4326H37.7041ZM37.7041 19.4326C27.763 19.4326 19.7041 27.4915 19.7041 37.4326V52.7812C23.6855 47.1269 30.2631 43.4326 37.7041 43.4326H60.7041C60.7181 43.4326 60.7321 43.4343 60.7461 43.4346C60.7604 43.4343 60.7747 43.4326 60.7891 43.4326C70.1308 43.4325 77.7039 35.8593 77.7041 26.5176V19.4326H37.7041Z" fill="currentColor"/>
    </svg>

    <!-- Dynamic content area -->
    <div id="state-loading">
      <div class="icon-wrap loading"><div class="spinner"></div></div>
      <h2>Processing sign-in…</h2>
      <p class="sub">Please wait while we verify your account.</p>
    </div>

    <div id="state-success" style="display:none">
      <div class="icon-wrap success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2>Sign-in successful</h2>
      <p class="sub" id="sub-msg">You're all set. This tab will close automatically.</p>
      <div class="countdown-bar"><div class="countdown-bar-fill"></div></div>
      <p class="countdown">Closing in <span id="seconds">10</span>s</p>
    </div>

    <div id="state-error" style="display:none">
      <div class="icon-wrap error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
      <h2>Authentication failed</h2>
      <p class="sub">No authentication data was received.<br/>Please close this tab and try again.</p>
    </div>
  </div>

  <script>
    const hash = window.location.hash.substring(1);
    const search = window.location.search.substring(1);
    const data = hash || search;

    function show(id) {
      document.getElementById('state-loading').style.display = 'none';
      document.getElementById('state-success').style.display = 'none';
      document.getElementById('state-error').style.display = 'none';
      document.getElementById(id).style.display = 'block';
    }

    if (data) {
      fetch('/auth/token?' + data).then(() => {
        show('state-success');
        let t = 10;
        const iv = setInterval(() => {
          t--;
          document.getElementById('seconds').textContent = t;
          if (t <= 0) {
            clearInterval(iv);
            window.open('', '_self');
            window.close();
            // Fallback if browser blocks window.close()
            setTimeout(() => {
              document.getElementById('sub-msg').textContent = 'You can safely close this tab now.';
              document.querySelector('.countdown').style.display = 'none';
              document.querySelector('.countdown-bar').style.display = 'none';
            }, 500);
          }
        }, 1000);
      });
    } else {
      show('state-error');
    }
  </script>
</body>
</html>`);
            return;
        }

        if (reqUrl.pathname === '/auth/token') {
            const idToken = reqUrl.searchParams.get('id_token');
            const accessToken = reqUrl.searchParams.get('access_token');

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');

            if (pendingAuthResolve) {
                if (idToken || accessToken) {
                    console.log('[Auth] Got OAuth tokens from browser');
                    pendingAuthResolve({ success: true, idToken, accessToken, providerId: pendingProviderId });
                } else {
                    pendingAuthResolve({ success: false, error: 'No tokens in callback' });
                }
                pendingAuthResolve = null;
            }
            return;
        }

        res.writeHead(404);
        res.end('Not found');
    });

    authCallbackServer.listen(OAUTH_PORT, 'localhost', () => {
        console.log(`[Auth] Callback server ready on port ${OAUTH_PORT}`);
    });

    authCallbackServer.on('error', (err) => {
        console.error('[Auth] Server error:', err);
        if (pendingAuthResolve) {
            pendingAuthResolve({ success: false, error: err.message });
            pendingAuthResolve = null;
        }
    });
}

ipcMain.handle('auth:oauth-sign-in', async (_event, params: {
    authDomain: string;
    apiKey: string;
    providerId: string;
    scopes: string;
    googleClientId?: string;
}) => {
    const { authDomain, apiKey, providerId, scopes, googleClientId } = params;

    // Start the singleton server if not running
    ensureAuthServer();

    return new Promise((resolve) => {
        pendingAuthResolve = resolve;
        pendingProviderId = providerId;

        const nonce = crypto.randomUUID();
        let authUrl: string;

        if (providerId === 'google.com' && googleClientId) {
            // Direct Google OAuth — returns id_token in the URL hash fragment
            authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
                client_id: googleClientId,
                redirect_uri: CALLBACK_URL,
                response_type: 'id_token token',
                scope: 'openid email profile',
                nonce,
                prompt: 'select_account',
            }).toString();
        } else {
            // Fallback: Firebase handler (GitHub, or Google without client ID)
            authUrl = `https://${authDomain}/__/auth/handler?` + new URLSearchParams({
                apiKey,
                authType: 'signInViaPopup',
                providerId,
                scopes: scopes.replace(/,/g, ' '),
                redirectUrl: CALLBACK_URL,
                v: '10.0.0',
                eventId: nonce,
            }).toString();
        }

        shell.openExternal(authUrl);

        // ── Auto-cancel when Electron window regains focus ──
        // If the user closes the browser tab and comes back to the app,
        // wait 3 seconds then cancel (gives time for the redirect to arrive).
        let focusTimer: ReturnType<typeof setTimeout> | null = null;

        // Cleanup helper — called when auth resolves by any path
        const originalResolve = resolve;
        const wrappedResolve = (result: any) => {
            mainWindow?.removeListener('focus', onFocus);
            if (focusTimer) clearTimeout(focusTimer);
            originalResolve(result);
        };

        // Patch the pending resolve so all code paths use the wrapped version
        pendingAuthResolve = wrappedResolve;

        const onFocus = () => {
            if (pendingAuthResolve !== wrappedResolve) return;
            console.log('[Auth] Window focused with pending auth — auto-cancelling');
            pendingAuthResolve = null;
            wrappedResolve({ success: false, error: '__cancelled__' });
        };

        if (mainWindow) {
            // Small delay before attaching listener so it doesn't fire immediately
            setTimeout(() => mainWindow?.on('focus', onFocus), 1000);
        }

        // Timeout after 3 minutes
        setTimeout(() => {
            if (pendingAuthResolve === wrappedResolve) {
                pendingAuthResolve = null;
                wrappedResolve({ success: false, error: 'Auth timeout' });
            }
        }, 180000);
    });
});

ipcMain.handle('auth:oauth-cancel', () => {
    if (pendingAuthResolve) {
        console.log('[Auth] OAuth sign-in cancelled by user');
        const resolve = pendingAuthResolve;
        pendingAuthResolve = null;
        resolve({ success: false, error: '__cancelled__' });
    }
});
