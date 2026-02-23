"use strict";
const { contextBridge, ipcRenderer } = require('electron');
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Git operations
    git: {
        clone: (repoUrl) => ipcRenderer.invoke('git:clone', repoUrl),
        status: (repoPath) => ipcRenderer.invoke('git:status', repoPath),
        commitAndPush: (repoPath, message, branch) => ipcRenderer.invoke('git:commit-push', repoPath, message, branch),
        createBranch: (repoPath, branchName) => ipcRenderer.invoke('git:create-branch', repoPath, branchName),
        listRepos: () => ipcRenderer.invoke('git:list-repos'),
        pull: (repoPath) => ipcRenderer.invoke('git:pull', repoPath),
        fetchStatus: (repoPath) => ipcRenderer.invoke('git:fetch-status', repoPath),
        getBranches: (repoPath) => ipcRenderer.invoke('git:get-branches', repoPath),
        switchBranch: (repoPath, branchName) => ipcRenderer.invoke('git:switch-branch', repoPath, branchName),
        discardAll: (repoPath) => ipcRenderer.invoke('git:discard-all', repoPath),
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
        parse: (repoPath) => ipcRenderer.invoke('repo:parse', repoPath),
        readFile: (filePath) => ipcRenderer.invoke('repo:read-file', filePath),
    },
    // Code write-back operations
    code: {
        writeCSS: (params) => ipcRenderer.invoke('code:write-css', params),
        writeProp: (params) => ipcRenderer.invoke('code:write-prop', params),
        writeToken: (params) => ipcRenderer.invoke('code:write-token', params),
    },
    // Check if running in Electron
    isElectron: true,
});
