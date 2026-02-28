const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Git operations
    git: {
        clone: (repoUrl: string) => ipcRenderer.invoke('git:clone', repoUrl),
        status: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
        commitAndPush: (repoPath: string, message: string, branch?: string) =>
            ipcRenderer.invoke('git:commit-push', repoPath, message, branch),
        createBranch: (repoPath: string, branchName: string) =>
            ipcRenderer.invoke('git:create-branch', repoPath, branchName),
        listRepos: () => ipcRenderer.invoke('git:list-repos'),
        pull: (repoPath: string) => ipcRenderer.invoke('git:pull', repoPath),
        fetchStatus: (repoPath: string) => ipcRenderer.invoke('git:fetch-status', repoPath),
        getBranches: (repoPath: string) => ipcRenderer.invoke('git:get-branches', repoPath),
        switchBranch: (repoPath: string, branchName: string) => ipcRenderer.invoke('git:switch-branch', repoPath, branchName),
        discardAll: (repoPath: string) => ipcRenderer.invoke('git:discard-all', repoPath),
    },

    // Dialog operations
    dialog: {
        selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    },

    // Window controls
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close'),
    },

    // Repository operations
    repo: {
        parse: (repoPath: string) => ipcRenderer.invoke('repo:parse', repoPath),
        readFile: (filePath: string) => ipcRenderer.invoke('repo:read-file', filePath),
    },

    // Code write-back operations
    code: {
        writeCSS: (params: { cssFilePath: string; selector: string; changes: Record<string, string>; mediaQuery?: string }) =>
            ipcRenderer.invoke('code:write-css', params),
        writeProp: (params: { forgecorePath: string; componentName: string; propName: string; value: any }) =>
            ipcRenderer.invoke('code:write-prop', params),
        writeToken: (params: { themeFilePath: string; tokenName: string; newValue: string }) =>
            ipcRenderer.invoke('code:write-token', params),
    },

    // Check if running in Electron
    isElectron: true,

    // Auth (native OAuth flow to bypass COOP issues)
    auth: {
        oauthSignIn: (params: { authDomain: string; apiKey: string; providerId: string; scopes: string }) =>
            ipcRenderer.invoke('auth:oauth-sign-in', params),
        oauthCancel: () => ipcRenderer.invoke('auth:oauth-cancel'),
    },

    // Stripe (bypass CORS by calling from main process)
    stripe: {
        checkout: (params: { url: string; token: string; data: any }) =>
            ipcRenderer.invoke('stripe:checkout', params),
        openUrl: (url: string) => ipcRenderer.invoke('stripe:open-url', url),
    },
});
