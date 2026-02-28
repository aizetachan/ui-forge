/**
 * Forgecore Manifest Types
 * 
 * Type definitions for the forgecore.json manifest schema (v1.0 Enhanced).
 * These types describe the configuration format for design system repositories
 * that UI Forge can parse and preview.
 */

// ─── Shared Types (mirrored from types.ts) ──────────────────
// These MUST be duplicated here because tsconfig.electron.json
// sets rootDir:"electron", which prevents importing from ../../types.ts.
// Keep in sync with the canonical definitions in types.ts.

export interface ComponentVariant {
    name: string;
    type: 'variant' | 'size' | 'state';
    cssClass: string;
    isDefault?: boolean;
}

export interface StoryVariant {
    name: string;
    args?: Record<string, any>;
    hasRender?: boolean;
}

export interface ComponentPropDef {
    name: string;
    type: string;
    control?: 'text' | 'number' | 'boolean' | 'select' | 'json' | 'slot' | 'none';
    options?: string[];
    defaultValue?: any;
    isRequired?: boolean;
}

// ─── Package Metadata ────────────────────────────────────────

export interface ForgecorePackage {
    displayName?: string;
    npmName?: string;
    version: string;
    license?: string;
    repoURL?: string;
    homepage?: string;
    author?: string;
}

// ─── Runtime Configuration ───────────────────────────────────

export interface ForgecoreRuntime {
    react?: { version: string };
    bundler?: {
        type: 'esbuild' | 'vite';
        platform?: 'browser' | 'node';
        jsx?: 'automatic' | 'classic';
        tsconfigPath?: string;
        define?: Record<string, string>;
    };
    aliases?: Record<string, string>;
    globalCss?: string[];
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
    portals?: {
        enabled?: boolean;
        rootId?: string;
        attachTo?: string;
        createIfMissing?: boolean;
    };
    stubs?: {
        icons?: {
            library?: string;
            enabled?: boolean;
            strategy?: 'component' | 'svg';
            fallback?: string;
        };
    };
}

// ─── Component Model ─────────────────────────────────────────

export interface ForgecoreComponentModel {
    patterns?: Record<string, {
        type: 'controlled' | 'uncontrolled';
        valueProp?: string;
        eventProp?: string;
    }>;
    actions?: {
        supported?: string[];
        selectors?: {
            strategy?: string;
            conventions?: string[];
        };
    };
}

// ─── Forge Preview Configuration ─────────────────────────────

export interface ForgecoreForge {
    requiresPortal?: boolean;
    slots?: Record<string, {
        kind?: string;
        props?: Record<string, any>;
        dataForge?: string;
    }>;
    selectors?: Record<string, string>;
    showcase?: string; // JSX template for rich preview
}

// ─── Component Scenario ──────────────────────────────────────

export interface ForgecoreScenario {
    name: string;
    props?: Record<string, any>;
    actions?: Array<{
        type: string;
        target?: string;
        text?: string;
        key?: string;
        ms?: number;
    }>;
}

// ─── Main Manifest Interface ─────────────────────────────────

export interface ForgecoreManifest {
    // Schema
    $schema?: string;
    forgecoreVersion?: string;

    // Identity
    name: string;
    version?: string;
    description?: string;

    // Package (new format)
    package?: ForgecorePackage;

    // Metadata
    metadata?: {
        author?: string;
        repoURL?: string;
        license?: string;
        framework?: 'react' | 'vue' | 'angular' | 'svelte' | 'vanilla';
        language?: 'typescript' | 'javascript';
        moduleFormat?: 'esm' | 'cjs';
        monorepo?: boolean;
        entryStrategy?: 'source' | 'build';
        notes?: string[];
    };

    // Preview
    preview?: {
        mode: 'esbuild' | 'vite' | 'auto';
        theme?: 'light' | 'dark';
        background?: string;
        viewport?: {
            width?: number;
            height?: number;
            deviceScaleFactor?: number;
        };
        behavior?: {
            disableAnimations?: boolean;
            preferReducedMotion?: boolean;
            logEvents?: boolean;
            captureConsole?: boolean;
        };
    };

    // Runtime
    runtime?: ForgecoreRuntime;

    // Component Model
    componentModel?: ForgecoreComponentModel;

    // Aliases (legacy — use runtime.aliases)
    aliases?: Record<string, string>;

    // Utilities
    utilities?: Record<string, {
        path: string;
        export: string | { type: 'named' | 'default'; name: string };
        stub?: string;
    }>;

    // Tokens
    tokens?: {
        type?: 'css-variables' | 'json';
        css?: string[];
        json?: string[];
        categories?: Record<string, string>;
        discovery?: {
            scanCssFiles?: boolean;
            includeComputedVars?: boolean;
            fallbackCategory?: string;
        };
    };

    // Components
    components: Record<string, ForgecoreComponent>;

    // Assets
    assets?: {
        icons?: {
            path?: string;
            library?: string;
            stub?: boolean;
        };
        images?: string;
        fonts?: string;
    };

    // Repo Scan
    repoScan?: {
        enabled?: boolean;
        roots?: string[];
        include?: string[];
        exclude?: string[];
    };

    // Build (for Vite mode)
    build?: {
        commands?: string[];
        output?: string;
        viteConfig?: string;
    };

    // Legacy
    icons?: {
        library: string;
        stub?: boolean;
    };
}

// ─── Component Definition ────────────────────────────────────

export interface ForgecoreComponent {
    // Entry & Exports
    entry: string;
    export?: { type: 'named' | 'default'; name: string };
    styles?: string | string[];
    types?: string;
    dependencies?: string[];
    externalDeps?: string[];

    // Component Type
    type?: 'display' | 'input' | 'layout' | 'navigation' | 'overlay' | 'feedback';

    // Component Model
    model?: {
        pattern?: string;
        events?: string[];
        a11y?: {
            role?: string;
            [key: string]: any;
        };
    };

    // Variants
    variants?: Array<{
        prop: string;
        values: string[];
        default?: string;
    }>;

    // Prop Definitions
    propDefs?: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'reactnode' | 'object' | 'function';
        options?: string[];
        defaultValue?: any;
        isRequired?: boolean;
    }>;

    // Default Props
    defaultProps?: Record<string, any>;

    // Forge Preview Config
    forge?: ForgecoreForge;

    // Preview Options
    preview?: {
        forceVisible?: boolean;
        disableAnimations?: boolean;
        portal?: boolean;
        wrapperStyle?: Record<string, any>;
    };

    // Scenarios
    scenarios?: ForgecoreScenario[];

    // Legacy
    elementProps?: string[];
    callbacks?: string[];
}

// ─── Parsed Output Interfaces ────────────────────────────────

export interface ParsedComponent {
    id: string;
    name: string;
    tagName: string;
    classes: string;
    content: string;
    sourceCode: string;
    props: Record<string, any>;
    filePath: string;
    forgecorePath?: string;

    importPath: string;
    dependencies: string[];
    storyVariants?: StoryVariant[];

    variants?: ComponentVariant[];
    cssModulePath?: string;
    rawCSS?: string;
    propDefs?: ComponentPropDef[];

    componentType?: 'display' | 'input' | 'layout' | 'navigation' | 'overlay' | 'feedback';
    model?: {
        pattern: string;
        events: string[];
    };
    forgeConfig?: ForgecoreForge;
    previewConfig?: {
        forceVisible?: boolean;
        disableAnimations?: boolean;
        portal?: boolean;
        wrapperStyle?: Record<string, any>;
    };
    showcase?: string;

    // Props that should be auto-wrapped as React elements
    elementProps?: string[];
    // Callback prop names that should be auto-stubbed
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
    utilities?: Record<string, {
        path: string;
        export: string | { type: 'named' | 'default'; name: string };
        stub?: string;
    }>;
    aliases?: Record<string, string>;
    runtime?: ForgecoreRuntime;
    preview?: {
        mode?: string;
        theme?: string;
        background?: string;
        behavior?: {
            disableAnimations?: boolean;
            preferReducedMotion?: boolean;
            logEvents?: boolean;
            captureConsole?: boolean;
        };
    };
    repoAssets?: {
        icons: Array<{ name: string; svgContent: string; relativePath: string }>;
        images: Array<{ name: string; relativePath: string; mimeType: string }>;
        repoPath: string;
    };
}
