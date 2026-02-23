/**
 * useAppState — Centralized application state management using useReducer.
 * 
 * Replaces the 12+ individual useState calls that were in App.tsx.
 * All state mutations go through typed actions for predictability.
 */

import { useReducer, useCallback, useMemo, useState } from 'react';
import React from 'react';
import { Repository, ComponentNode, ElementType, SyncPayload, Token } from '../types';
import { ComputedStylesData } from '../components/ReactSandbox';
import { ForceState } from '../components/StateSelector';
import { INITIAL_REPO } from '../constants';

// ─── State Shape ─────────────────────────────────────────────

export interface AppState {
    repo: Repository;
    selectedId: string | null;
    selectionType: 'component' | 'token';
    isConnected: boolean;
    repoPath: string;
    viewMode: 'single' | 'matrix' | 'states';
    isSyncing: boolean;
    showSyncModal: boolean;
    showConnectModal: boolean;
    toast: { message: string; type: 'success' | 'error'; icon?: React.ReactNode } | null;
    computedStyles: ComputedStylesData | null;
    forceState: ForceState;
    selectedSubElement: string | null; // E2: Currently selected sub-element in the CSS rule dropdown
    inspectorMode: boolean; // Inspector mode: Chrome DevTools-like element inspector
    availableSubElements: string[]; // Phase 9: Available subelements for interactive overlay
    interactiveSelectorEnabled: boolean; // Phase 9: Toggle an interactive overlay
    gitStatus: { behind: number; ahead: number } | null;
}

const INITIAL_STATE: AppState = {
    repo: INITIAL_REPO,
    selectedId: 'comp-1',
    selectionType: 'component',
    isConnected: false,
    repoPath: '',
    viewMode: 'matrix',
    isSyncing: false,
    showSyncModal: false,
    showConnectModal: false,
    toast: null,
    computedStyles: null,
    forceState: 'default',
    selectedSubElement: null,
    inspectorMode: false,
    availableSubElements: [],
    interactiveSelectorEnabled: true,
    gitStatus: null,
};

// ─── Actions ─────────────────────────────────────────────────

type AppAction =
    | { type: 'SET_REPO'; payload: Partial<Repository> }
    | { type: 'LOAD_REPO'; payload: { repo: Partial<Repository>; selectId?: string } }
    | { type: 'SELECT_ITEM'; payload: { id: string; selectionType: 'component' | 'token' } }
    | { type: 'SET_CONNECTED'; payload: boolean }
    | { type: 'SET_REPO_PATH'; payload: string }
    | { type: 'SET_VIEW_MODE'; payload: 'single' | 'matrix' | 'states' }
    | { type: 'SET_SYNCING'; payload: boolean }
    | { type: 'SHOW_SYNC_MODAL'; payload: boolean }
    | { type: 'SHOW_CONNECT_MODAL'; payload: boolean }
    | { type: 'SET_TOAST'; payload: AppState['toast'] }
    | { type: 'SET_COMPUTED_STYLES'; payload: ComputedStylesData | null }
    | { type: 'SET_FORCE_STATE'; payload: ForceState }
    | { type: 'SET_SELECTED_SUB_ELEMENT'; payload: string | null }
    | { type: 'UPDATE_COMPONENT'; payload: ComponentNode }
    | { type: 'UPDATE_TOKEN'; payload: Token }
    | { type: 'ADD_COMPONENT'; payload: ComponentNode }
    | { type: 'SELECT_VARIANT'; payload: { componentId: string; variantCssClass: string } }
    | { type: 'SYNC_COMPLETE'; payload: { branch: string } }
    | { type: 'TOGGLE_INSPECTOR' }
    | { type: 'TOGGLE_INTERACTIVE_SELECTOR' }
    | { type: 'SET_AVAILABLE_SUB_ELEMENTS'; payload: string[] }
    | { type: 'SET_GIT_STATUS'; payload: { behind: number; ahead: number } | null };

// ─── Reducer ─────────────────────────────────────────────────

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'SET_REPO':
            return { ...state, repo: { ...state.repo, ...action.payload } };

        case 'LOAD_REPO':
            return {
                ...state,
                repo: { ...state.repo, ...action.payload.repo },
                ...(action.payload.selectId ? {
                    selectedId: action.payload.selectId,
                    selectionType: 'component' as const,
                } : {}),
            };

        case 'SELECT_ITEM':
            return { ...state, selectedId: action.payload.id, selectionType: action.payload.selectionType, selectedSubElement: null };

        case 'SET_CONNECTED':
            return { ...state, isConnected: action.payload };

        case 'SET_REPO_PATH':
            return { ...state, repoPath: action.payload };

        case 'SET_VIEW_MODE':
            return { ...state, viewMode: action.payload };

        case 'SET_SYNCING':
            return { ...state, isSyncing: action.payload };

        case 'SHOW_SYNC_MODAL':
            return { ...state, showSyncModal: action.payload };

        case 'SHOW_CONNECT_MODAL':
            return { ...state, showConnectModal: action.payload };

        case 'SET_TOAST':
            return { ...state, toast: action.payload };

        case 'SET_COMPUTED_STYLES':
            return { ...state, computedStyles: action.payload };

        case 'SET_FORCE_STATE':
            return { ...state, forceState: action.payload };

        case 'SET_SELECTED_SUB_ELEMENT':
            // G1: Clear computed styles when switching sub-elements to prevent stale data
            return { ...state, selectedSubElement: action.payload, computedStyles: null };

        case 'UPDATE_COMPONENT':
            return {
                ...state,
                repo: {
                    ...state.repo,
                    components: state.repo.components.map(c =>
                        c.id === action.payload.id ? action.payload : c
                    ),
                },
            };

        case 'UPDATE_TOKEN':
            return {
                ...state,
                repo: {
                    ...state.repo,
                    tokens: state.repo.tokens.map(t =>
                        t.id === action.payload.id ? action.payload : t
                    ),
                },
            };

        case 'ADD_COMPONENT':
            return {
                ...state,
                repo: {
                    ...state.repo,
                    components: [...state.repo.components, action.payload],
                },
                selectedId: action.payload.id,
                selectionType: 'component',
            };

        case 'SELECT_VARIANT':
            return {
                ...state,
                repo: {
                    ...state.repo,
                    components: state.repo.components.map(c =>
                        c.id === action.payload.componentId
                            ? { ...c, selectedVariant: action.payload.variantCssClass }
                            : c
                    ),
                },
            };

        case 'SYNC_COMPLETE':
            return {
                ...state,
                showSyncModal: false,
                isSyncing: false,
                repo: { ...state.repo, branch: action.payload.branch, lastSync: 'Just now' },
            };

        case 'TOGGLE_INSPECTOR':
            return { ...state, inspectorMode: !state.inspectorMode };

        case 'TOGGLE_INTERACTIVE_SELECTOR':
            return { ...state, interactiveSelectorEnabled: !state.interactiveSelectorEnabled };

        case 'SET_AVAILABLE_SUB_ELEMENTS':
            // Prevent state update if array contents are exactly the same
            if (state.availableSubElements === action.payload) return state;
            if (state.availableSubElements.length === action.payload.length &&
                state.availableSubElements.every((val, index) => val === action.payload[index])) {
                return state;
            }
            return { ...state, availableSubElements: action.payload };

        case 'SET_GIT_STATUS':
            return { ...state, gitStatus: action.payload };

        default:
            return state;
    }
}

// ─── Hook ────────────────────────────────────────────────────

// ─── Repo History (localStorage) ────────────────────────────
interface RecentRepo {
    name: string;
    path: string;
    url: string;
    lastUsed: number;
}

const REPO_HISTORY_KEY = 'ui-forge-repos';
const MAX_RECENT_REPOS = 10;

function loadRepoHistory(): RecentRepo[] {
    try {
        const raw = localStorage.getItem(REPO_HISTORY_KEY);
        if (!raw) return [];
        const repos: RecentRepo[] = JSON.parse(raw);
        return repos.sort((a, b) => b.lastUsed - a.lastUsed).slice(0, MAX_RECENT_REPOS);
    } catch {
        return [];
    }
}

function saveRepoToHistory(repo: { name: string; path: string; url: string }) {
    const existing = loadRepoHistory();
    const filtered = existing.filter(r => r.path !== repo.path);
    const updated = [{ ...repo, lastUsed: Date.now() }, ...filtered].slice(0, MAX_RECENT_REPOS);
    localStorage.setItem(REPO_HISTORY_KEY, JSON.stringify(updated));
}

function removeRepoFromHistory(path: string) {
    const existing = loadRepoHistory();
    const filtered = existing.filter(r => r.path !== path);
    localStorage.setItem(REPO_HISTORY_KEY, JSON.stringify(filtered));
}

export type { RecentRepo };

export function useAppState() {
    const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
    const [recentRepos, setRecentRepos] = useState<RecentRepo[]>(loadRepoHistory);

    const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

    // ─── Derived State ─────────────────────────────────────────
    const selectedItem = useMemo(() => {
        if (state.selectionType === 'component') {
            return state.repo.components.find(c => c.id === state.selectedId) || null;
        }
        return state.repo.tokens.find(t => t.id === state.selectedId) || null;
    }, [state.repo.components, state.repo.tokens, state.selectedId, state.selectionType]);

    // ─── Toast Helper ──────────────────────────────────────────
    const showToast = useCallback((message: string, type: 'success' | 'error', icon?: React.ReactNode) => {
        dispatch({ type: 'SET_TOAST', payload: { message, type, icon } });
        setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 4000);
    }, []);

    // ─── Repo Parsing ──────────────────────────────────────────
    const parseAndLoadRepo = useCallback(async (
        targetRepoPath: string,
        repoName?: string,
        repoUrl?: string,
        silent?: boolean
    ): Promise<boolean> => {
        if (!window.electronAPI?.repo?.parse) return false;

        try {
            const result = await window.electronAPI.repo.parse(targetRepoPath);
            if (!result.success || !result.data) return false;

            const { components, tokens, themeCSS, utilities, aliases, preview, repoAssets, runtime } = result.data;

            const mappedComponents = components.map(c => {
                if (c.showcase) console.log(`[App] ✅ Showcase received for ${c.name}:`, c.showcase.substring(0, 50));
                const initialProps = { ...c.props };

                // STEP 1: Normalize propDef types — Electron IPC may lose type info  
                // Uses heuristics (defaultValue, naming patterns) to correct types
                const normalizedPropDefs = c.propDefs?.map(def => {
                    // Enum types with options are always correct — keep as-is
                    if (def.type === 'enum' && def.options && def.options.length > 0) return def;

                    // Detect boolean from defaultValue (true/false)
                    if (typeof def.defaultValue === 'boolean') {
                        return { ...def, type: 'boolean' };
                    }

                    // Detect boolean prop names (common React patterns)
                    const BOOLEAN_NAMES = /^(is[A-Z]|has[A-Z]|show[A-Z]|hide[A-Z]|enable|disable|full[A-Z]|no[A-Z]|allow|close[A-Z]|collapsed|checked|selected|indeterminate|interactive|required|error$|open$|disabled$)/;
                    if (BOOLEAN_NAMES.test(def.name) && !def.options) {
                        return { ...def, type: 'boolean' };
                    }

                    // Detect ReactNode/Element props → boolean toggle (on/off with placeholder)
                    const REACTNODE_NAMES = /^(icon|leftIcon|rightIcon|leftElement|rightElement|startIcon|endIcon|prefix|suffix|adornment|trigger|header|footer|actions)$/;
                    if (REACTNODE_NAMES.test(def.name) && !def.options) {
                        return { ...def, type: 'boolean' };
                    }

                    // Detect callbacks (onXxx pattern)
                    if (/^on[A-Z]/.test(def.name) && !def.options) {
                        return { ...def, type: 'function' };
                    }

                    // Detect array from defaultValue
                    if (Array.isArray(def.defaultValue)) {
                        return { ...def, type: 'array' };
                    }

                    return def;
                });

                // STEP 2: Auto-default simple value types + booleans
                // ReactNode/Function props are skipped to avoid React render errors
                if (normalizedPropDefs) {
                    const SKIP_AUTO_INIT = new Set(['reactnode', 'reactelement', 'function']);
                    normalizedPropDefs.forEach(def => {
                        if (SKIP_AUTO_INIT.has(def.type)) {
                            // STEP 2b: Strip ReactNode values from initialProps
                            delete initialProps[def.name];
                            return;
                        }
                        if (initialProps[def.name] === undefined && def.defaultValue !== undefined) {
                            initialProps[def.name] = def.defaultValue;
                        }
                    });
                }

                const absoluteCssModulePath = c.cssModulePath
                    ? (c.cssModulePath.startsWith('/') ? c.cssModulePath : `${targetRepoPath}/${c.cssModulePath}`)
                    : undefined;

                return {
                    id: c.id,
                    name: c.name,
                    tagName: c.tagName as ElementType,
                    classes: c.classes,
                    content: c.content || c.name,
                    sourceCode: c.sourceCode,
                    showcase: c.showcase,
                    props: initialProps,
                    propDefs: normalizedPropDefs,
                    rawCSS: c.rawCSS,
                    cssModulePath: absoluteCssModulePath,
                    filePath: c.filePath,
                    forgecorePath: `${targetRepoPath}/forgecore.json`,
                    dependencies: c.dependencies,
                    componentType: c.componentType,
                    model: c.model,
                    forgeConfig: c.forgeConfig,
                    previewConfig: c.previewConfig,
                    elementProps: c.elementProps,
                    callbacks: c.callbacks,
                    variants: c.variants?.map(v => ({
                        name: v.name,
                        type: v.type,
                        cssClass: v.cssClass,
                        isDefault: v.isDefault
                    })),
                    selectedVariant: c.variants?.find(v => v.type === 'variant' && v.isDefault)?.cssClass
                        || c.variants?.find(v => v.type === 'variant')?.cssClass,
                    selectedSize: c.variants?.find(v => v.type === 'size' && v.isDefault)?.cssClass
                        || c.variants?.find(v => v.type === 'size')?.cssClass || 'md'
                };
            });

            const mappedTokens = tokens.map(t => ({
                id: t.id,
                name: t.name,
                value: t.value,
                type: t.type
            }));

            dispatch({
                type: 'LOAD_REPO',
                payload: {
                    repo: {
                        ...(repoName ? { name: repoName } : {}),
                        ...(repoUrl ? { url: repoUrl } : {}),
                        lastSync: 'Just now',
                        components: mappedComponents.length > 0 ? mappedComponents : undefined,
                        tokens: mappedTokens.length > 0 ? mappedTokens : undefined,
                        themeCSS,
                        repoPath: targetRepoPath,
                        utilities,
                        aliases,
                        preview,
                        repoAssets: repoAssets ? {
                            icons: repoAssets.icons,
                            images: repoAssets.images,
                            baseURL: 'forge-asset://repo/',
                        } : undefined,
                        runtime: runtime ? {
                            theme: runtime.theme,
                            mount: runtime.mount,
                        } : undefined,
                    } as Partial<Repository>,
                    selectId: mappedComponents.length > 0 ? mappedComponents[0].id : undefined,
                },
            });

            if (!silent) {
                const displayName = repoName || state.repo.name;
                showToast(
                    `Loaded ${mappedComponents.length} components and ${mappedTokens.length} tokens from ${displayName}`,
                    'success',
                );
            }
            return true;
        } catch (error) {
            console.error('Failed to parse repo contents:', error);
            return false;
        }
    }, [state.repo.name, showToast]);

    // ─── Connection ────────────────────────────────────────────
    const handleFinalizeConnection = useCallback(async (
        data: { type: 'https' | 'ssh'; repoUrl: string; repoPath?: string }
    ) => {
        dispatch({ type: 'SHOW_CONNECT_MODAL', payload: false });
        dispatch({ type: 'SET_CONNECTED', payload: true });

        const parts = data.repoUrl.split('/');
        const rawName = parts[parts.length - 1];
        const repoName = rawName.replace('.git', '') || 'unknown-repo';

        if (data.repoPath) {
            dispatch({ type: 'SET_REPO_PATH', payload: data.repoPath });
            const success = await parseAndLoadRepo(data.repoPath, repoName, data.repoUrl);
            if (success) {
                // Save to repo history
                saveRepoToHistory({ name: repoName, path: data.repoPath, url: data.repoUrl });
                setRecentRepos(loadRepoHistory());
                return;
            }
        }

        dispatch({
            type: 'SET_REPO',
            payload: { name: repoName, url: data.repoUrl, lastSync: 'Just now' },
        });

        const message = isElectron && data.repoPath
            ? `Cloned ${repoName} to ${data.repoPath}`
            : `Connected to ${repoName}`;
        showToast(message, 'success');
    }, [parseAndLoadRepo, isElectron, showToast]);

    // ─── Refresh & Pull ────────────────────────────────────────
    const handleRefreshRepo = useCallback(async () => {
        if (!state.repoPath) return;
        showToast('Refreshing components...', 'success');
        const success = await parseAndLoadRepo(state.repoPath);
        if (!success) showToast('Failed to refresh repo', 'error');
    }, [state.repoPath, parseAndLoadRepo, showToast]);

    const silentRefreshRepo = useCallback(async () => {
        if (!state.repoPath) return;
        await parseAndLoadRepo(state.repoPath, undefined, undefined, true);
    }, [state.repoPath, parseAndLoadRepo]);

    const handlePullRepo = useCallback(async () => {
        console.log('[Pull] handlePullRepo called. repoPath:', state.repoPath, 'electronAPI:', !!window.electronAPI, 'pull:', !!window.electronAPI?.git?.pull);
        if (!state.repoPath || !window.electronAPI?.git?.pull) {
            console.warn('[Pull] Early return — missing repoPath or electronAPI.git.pull');
            return;
        }

        try {
            showToast('Pulling from GitHub...', 'success');
            console.log('[Pull] Calling git.pull with path:', state.repoPath);
            const pullResult = await window.electronAPI.git.pull(state.repoPath);
            console.log('[Pull] Pull result:', JSON.stringify(pullResult));

            if (!pullResult.success) {
                showToast(`Pull failed: ${pullResult.error}`, 'error');
                return;
            }

            const data = pullResult.data;
            const success = await parseAndLoadRepo(state.repoPath);

            if (success) {
                if (data?.alreadyUpToDate) {
                    showToast('Already up to date', 'success');
                } else {
                    const count = data?.filesChanged?.length || 0;
                    const stashNote = data?.hadLocalChanges ? ' (local changes preserved)' : '';
                    showToast(`Pulled ${count} file(s) updated${stashNote} — components refreshed`, 'success');
                }
            }
        } catch (error: any) {
            console.error('[Pull] Error:', error);
            showToast(`Pull failed: ${error.message}`, 'error');
        }
    }, [state.repoPath, parseAndLoadRepo, showToast]);

    const checkGitStatus = useCallback(async () => {
        if (!state.repoPath || !window.electronAPI?.git?.fetchStatus) return;
        try {
            const result = await window.electronAPI.git.fetchStatus(state.repoPath);
            if (result.success && result.data) {
                dispatch({
                    type: 'SET_GIT_STATUS',
                    payload: { behind: result.data.behind, ahead: result.data.ahead }
                });
            }
        } catch (error) {
            console.error('[GitStatus] Error fetching status:', error);
        }
    }, [state.repoPath]);

    const handleSwitchBranch = useCallback(async (branchName: string) => {
        if (!state.repoPath || !window.electronAPI?.git?.switchBranch) return;
        showToast(`Switching to branch ${branchName}...`, 'success');
        try {
            const result = await window.electronAPI.git.switchBranch(state.repoPath, branchName);
            if (result.success) {
                showToast(`Switched to branch: ${branchName}`, 'success');
                dispatch({ type: 'SET_REPO', payload: { branch: branchName } });
                await parseAndLoadRepo(state.repoPath);
                await checkGitStatus();
            } else {
                showToast(`Failed to switch branch: ${result.error}`, 'error');
            }
        } catch (error: any) {
            showToast(`Failed to switch branch: ${error.message}`, 'error');
        }
    }, [state.repoPath, parseAndLoadRepo, showToast, checkGitStatus]);

    const handleCreateBranch = useCallback(async (branchName: string) => {
        if (!state.repoPath || !window.electronAPI?.git?.createBranch) return;
        showToast(`Creating branch ${branchName}...`, 'success');
        try {
            const result = await window.electronAPI.git.createBranch(state.repoPath, branchName);
            if (result.success) {
                showToast(`Created and switched to: ${branchName}`, 'success');
                dispatch({ type: 'SET_REPO', payload: { branch: branchName } });
                await parseAndLoadRepo(state.repoPath);
                await checkGitStatus();
            } else {
                showToast(`Failed to create branch: ${result.error}`, 'error');
            }
        } catch (error: any) {
            showToast(`Failed to create branch: ${error.message}`, 'error');
        }
    }, [state.repoPath, parseAndLoadRepo, showToast, checkGitStatus]);

    const handleDiscardAll = useCallback(async () => {
        if (!state.repoPath || !window.electronAPI?.git?.discardAll) return;
        try {
            const result = await window.electronAPI.git.discardAll(state.repoPath);
            if (result.success) {
                showToast('All local changes discarded successfully', 'success');
                await parseAndLoadRepo(state.repoPath);
            } else {
                showToast(`Failed to discard changes: ${result.error}`, 'error');
            }
        } catch (error: any) {
            showToast(`Error discarding changes: ${error.message}`, 'error');
        }
    }, [state.repoPath, parseAndLoadRepo, showToast]);

    // ─── Sync ──────────────────────────────────────────────────
    const handleConfirmSync = useCallback((payload: SyncPayload & { success?: boolean }) => {
        dispatch({ type: 'SYNC_COMPLETE', payload: { branch: payload.branch } });

        const successMessage = payload.createPR
            ? `Pull Request created for branch '${payload.branch}'`
            : `Changes pushed to '${payload.branch}'`;
        showToast(successMessage, 'success');
    }, [showToast]);

    // ─── Component/Token Updates ───────────────────────────────
    const handleUpdateComponent = useCallback((updated: ComponentNode) => {
        dispatch({ type: 'UPDATE_COMPONENT', payload: updated });
    }, []);

    const handleUpdateToken = useCallback((updated: Token) => {
        dispatch({ type: 'UPDATE_TOKEN', payload: updated });
    }, []);

    // ─── Repo Switching ────────────────────────────────────────
    const handleSwitchRepo = useCallback(async (repo: RecentRepo) => {
        showToast(`Switching to ${repo.name}...`, 'success');
        dispatch({ type: 'SET_REPO_PATH', payload: repo.path });
        dispatch({ type: 'SET_CONNECTED', payload: true });

        const success = await parseAndLoadRepo(repo.path, repo.name, repo.url);
        if (success) {
            saveRepoToHistory(repo);
            setRecentRepos(loadRepoHistory());
        } else {
            showToast(`Failed to load ${repo.name}`, 'error');
        }
    }, [parseAndLoadRepo, showToast]);

    const handleRemoveRecentRepo = useCallback((path: string) => {
        removeRepoFromHistory(path);
        setRecentRepos(loadRepoHistory());
    }, []);

    return {
        state,
        dispatch,
        isElectron,
        selectedItem,
        showToast,
        recentRepos,
        handleFinalizeConnection,
        handleRefreshRepo,
        silentRefreshRepo,
        handlePullRepo,
        handleConfirmSync,
        handleUpdateComponent,
        handleUpdateToken,
        handleSwitchRepo,
        handleRemoveRecentRepo,
        checkGitStatus,
        handleSwitchBranch,
        handleCreateBranch,
        handleDiscardAll,
    };
}
