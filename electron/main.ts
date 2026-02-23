import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
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
