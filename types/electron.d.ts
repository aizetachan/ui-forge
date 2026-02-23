// Types for Electron API exposed to renderer

export interface GitResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    canceled?: boolean;
}

export interface RepoInfo {
    name: string;
    path: string;
    branch: string;
    url: string;
}

export interface GitStatus {
    current: string | null;
    tracking: string | null;
    files: Array<{ path: string; status: string }>;
    ahead: number;
    behind: number;
}

export interface ComponentVariant {
    name: string;
    type: 'variant' | 'size' | 'state';
    cssClass: string;
    isDefault?: boolean;
}

export interface ComponentPropDef {
    name: string;
    type: string;
    options?: string[];
    defaultValue?: any;
}

export interface ParsedComponent {
    id: string;
    name: string;
    tagName: string;
    classes: string;
    content: string;
    sourceCode: string;
    props: Record<string, any>;
    filePath: string;
    importPath: string;
    dependencies: string[];
    variants?: ComponentVariant[];
    cssModulePath?: string;
    rawCSS?: string;
    propDefs?: ComponentPropDef[];
    showcase?: string;
    // Enhanced schema fields
    componentType?: 'display' | 'input' | 'layout' | 'navigation' | 'overlay' | 'feedback';
    model?: {
        pattern: string;
        events: string[];
    };
    forgeConfig?: {
        requiresPortal?: boolean;
        slots?: Record<string, { kind?: string; props?: Record<string, any> }>;
        showcase?: string;
    };
    previewConfig?: {
        forceVisible?: boolean;
        disableAnimations?: boolean;
        portal?: boolean;
        wrapperStyle?: Record<string, any>;
    };
    elementProps?: string[];
    callbacks?: string[];
}

export interface ParsedToken {
    id: string;
    name: string;
    value: string;
    type: 'color' | 'spacing' | 'typography' | 'radius';
}

export interface ParsedRepoContents {
    components: ParsedComponent[];
    tokens: ParsedToken[];
    themeCSS?: string;
    // Phase 1: Runtime config for sandbox
    utilities?: Record<string, {
        path: string;
        export: string | { type: 'named' | 'default'; name: string };
        stub?: string;
    }>;
    aliases?: Record<string, string>;
    // Phase 3: Preview config
    preview?: {
        mode?: string;
        theme?: string;
        background?: string;
        behavior?: {
            disableAnimations?: boolean;
            preferReducedMotion?: boolean;
        };
    };
    // Phase 4: Repository assets (icons & images)
    repoAssets?: {
        icons: Array<{ name: string; svgContent: string; relativePath: string }>;
        images: Array<{ name: string; relativePath: string; mimeType: string }>;
        repoPath: string;
    };
    runtime?: {
        theme?: {
            strategy?: 'attribute' | 'class';
            attribute?: string;
            values?: string[];
            default?: string;
            applyTo?: string;
        };
        mount?: {
            rootId?: string;
            wrapper?: {
                element?: string;
                props?: Record<string, any>;
            };
        };
    };
}

export interface ElectronAPI {
    git: {
        clone: (repoUrl: string) => Promise<GitResult<RepoInfo>>;
        status: (repoPath: string) => Promise<GitResult<GitStatus>>;
        commitAndPush: (repoPath: string, message: string, branch?: string) => Promise<GitResult<{ commit: string; pushed: boolean }>>;
        createBranch: (repoPath: string, branchName: string) => Promise<GitResult<{ branch: string; created: boolean }>>;
        listRepos: () => Promise<GitResult<RepoInfo[]>>;
        pull: (repoPath: string) => Promise<GitResult<{ success: boolean; summary: string; filesChanged: string[]; alreadyUpToDate: boolean; hadLocalChanges: boolean }>>;
        fetchStatus: (repoPath: string) => Promise<GitResult<{ behind: number; ahead: number; currentBranch: string; remoteBranch: string; }>>;
        getBranches: (repoPath: string) => Promise<GitResult<{ current: string; all: { name: string; type: 'local' | 'remote' }[]; }>>;
        switchBranch: (repoPath: string, branchName: string) => Promise<GitResult<{ success: boolean; currentBranch: string; }>>;
        discardAll: (repoPath: string) => Promise<GitResult<{ success: boolean; }>>;
    };
    dialog: {
        selectDirectory: () => Promise<GitResult<string>>;
    };
    window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
    };
    repo: {
        parse: (repoPath: string) => Promise<GitResult<ParsedRepoContents>>;
        readFile: (filePath: string) => Promise<GitResult<string>>;
    };
    code: {
        writeCSS: (params: { cssFilePath: string; selector: string; changes: Record<string, string>; mediaQuery?: string }) =>
            Promise<{ success: boolean; newContent: string; previousValues?: Record<string, string>; error?: string }>;
        writeProp: (params: { forgecorePath: string; componentName: string; propName: string; value: any }) =>
            Promise<{ success: boolean; previousValue?: string; error?: string }>;
        writeToken: (params: { themeFilePath: string; tokenName: string; newValue: string }) =>
            Promise<{ success: boolean; newContent: string; previousValue?: string; error?: string }>;
    };
    isElectron: boolean;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}
