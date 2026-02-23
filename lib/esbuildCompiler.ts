/**
 * Browser-side esbuild compiler for transforming JSX/TSX to JavaScript
 * Uses esbuild-wasm which runs in the browser via WebAssembly
 */

import * as esbuild from 'esbuild-wasm';

let initialized = false;

/**
 * Initialize esbuild WASM - must be called before any compilation
 */
export async function initializeEsbuild(): Promise<void> {
  if (initialized) return;

  try {
    await esbuild.initialize({
      wasmURL: '/esbuild.wasm',
    });
    initialized = true;
    console.log('[esbuild] Initialized successfully');
  } catch (error) {
    // May already be initialized
    if ((error as Error).message?.includes('Cannot call "initialize" more than once')) {
      initialized = true;
      return;
    }
    console.error('[esbuild] Initialization failed:', error);
    throw error;
  }
}

export interface CompileResult {
  code: string;
  errors: string[];
  warnings: string[];
}

/**
 * Compile a single TSX/JSX file to JavaScript
 */
export async function compileComponent(
  code: string,
  filename: string = 'component.tsx'
): Promise<CompileResult> {
  if (!initialized) {
    await initializeEsbuild();
  }

  try {
    const result = await esbuild.transform(code, {
      loader: filename.endsWith('.tsx') ? 'tsx' : 'jsx',
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      target: 'es2020',
      // Don't use IIFE format - we want variables to stay in scope
      // format: 'esm' would add import/export which won't work in browser
    });

    return {
      code: result.code,
      errors: [],
      warnings: result.warnings.map(w => w.text),
    };
  } catch (error) {
    const err = error as esbuild.TransformFailure;
    return {
      code: '',
      errors: err.errors?.map(e => `${e.location?.line}:${e.location?.column} ${e.text}`) || [(error as Error).message],
      warnings: err.warnings?.map(w => w.text) || [],
    };
  }
}

/**
 * Preprocess source code for bundling:
 * - Remove import statements for local deps (they'll be inlined)
 * - Remove export statements
 * - Keep external package imports removed (stubs handle them)
 */
function preprocessForBundle(source: string, componentName: string = 'Component'): string {
  let processed = source;

  // 1. Handle CSS module imports specifically
  // e.g. import styles from './Button.module.css';
  const cssModuleRegex = /^import\s+([a-zA-Z0-9_]+)\s+from\s+['"][^'"]+\.module\.css['"];?\s*$/gm;

  // Extract all matches first before mutating the string
  const matches = [];
  let cssMatch;
  while ((cssMatch = cssModuleRegex.exec(processed)) !== null) {
    matches.push({
      fullMatch: cssMatch[0],
      varName: cssMatch[1]
    });
  }

  // Now replace them safely
  for (const { fullMatch, varName } of matches) {
    const uniqueVarName = `__styles_${componentName}__`;

    // Replace the import statement with the proxy definition
    const proxyDef = `var ${uniqueVarName} = new Proxy({}, { get: function(_, prop) { return "${componentName}_" + String(prop); } }); // [css module stub]`;
    processed = processed.replace(fullMatch, proxyDef);

    // Replace all usages of the variable in this file
    // Uses regex word boundaries to match exact variable name only
    const usageRegex = new RegExp(`\\b${varName}\\b`, 'g');
    processed = processed.replace(usageRegex, uniqueVarName);
  }

  return processed
    // Single-line imports
    .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '// [import removed]')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '// [import removed]')
    // Multi-line imports
    .replace(/^import\s+\{[^}]*\}\s*from\s+['"][^'"]+['"];?\s*$/gms, '// [import removed]')
    .replace(/^import\s+\w+\s*,\s*\{[^}]*\}\s*from\s+['"][^'"]+['"];?\s*$/gms, '// [import removed]')
    // Exports
    .replace(/^export\s+default\s+/gm, 'const __default__ = ')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '// [export removed]')
    .replace(/^export\s+const\s+/gm, 'const ')
    .replace(/^export\s+function\s+/gm, 'function ')
    .replace(/^export\s+interface\s+/gm, 'interface ')
    .replace(/^export\s+type\s+/gm, 'type ');
}

/**
 * Extract local import paths from source code.
 * Returns an array of { importPath, exportedNames } for relative imports.
 */
function extractLocalImports(source: string): Array<{ importPath: string; exportedNames: string[] }> {
  const imports: Array<{ importPath: string; exportedNames: string[] }> = [];

  // Match: import { Foo, Bar } from './path' or import Foo from '../path'
  const importRegex = /^import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\}\s*)?from\s+['"]([^'"]+)['"]/gm;
  let match;

  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[3];
    // Only process local imports (relative paths or @/ aliases)
    if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('@/')) {
      // Skip CSS module imports
      if (importPath.endsWith('.css') || importPath.endsWith('.module.css')) continue;

      const names: string[] = [];
      // Default import
      if (match[1]) names.push(match[1]);
      // Named imports
      if (match[2]) {
        names.push(...match[2].split(',').map(n => n.trim().replace(/\s+as\s+\w+/, '')).filter(Boolean));
      }
      imports.push({ importPath, exportedNames: names });
    }
  }

  return imports;
}

/**
 * Compile a component with its real local dependencies resolved from the repo.
 *
 * Uses a recursive approach:
 * 1. Extract local imports from the component source
 * 2. Fetch each dependency file from the repo via IPC
 * 3. Recursively resolve THEIR local imports
 * 4. Concatenate all dependency code (topological order) + main component
 * 5. Compile the combined source with esbuild.transform()
 *
 * External packages (react, lucide-react, etc.) are excluded and
 * handled by createImportStubs as before.
 *
 * @param mainCode - The preprocessed main component source (imports already removed for stubs)
 * @param componentName - Component name
 * @param resolveFile - Function to fetch a file from the repo by absolute path
 * @param componentDir - Directory of the component file (for resolving relative paths)
 * @param repoSrcPath - The repo's src/ directory (for resolving @/ aliases)
 * @param maxDepth - Maximum recursion depth to prevent infinite loops
 */
export async function compileComponentWithDeps(
  mainCode: string,
  componentName: string,
  resolveFile: (absolutePath: string) => Promise<string | null>,
  componentDir: string,
  repoSrcPath: string,
  explicitDeps: string[] = [],
  maxDepth: number = 3,
  aliases?: Record<string, string>,
): Promise<CompileResult> {
  if (!initialized) {
    await initializeEsbuild();
  }

  const resolved = new Set<string>(); // Track resolved paths to avoid cycles
  const depCodeBlocks: string[] = [];  // Dependency code in topological order

  /**
   * Recursively resolve a dependency file and its sub-dependencies.
   */
  async function resolveDep(importPath: string, fromDir: string, depth: number, exportedNames: string[] = []): Promise<void> {
    if (depth > maxDepth) return;

    // Resolve the absolute path
    let absolutePath: string;
    if (importPath.startsWith('/')) {
      absolutePath = importPath;
    } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Resolve relative to the importing file's directory
      absolutePath = resolveRelativePath(fromDir, importPath);
    } else {
      // Try alias resolution: check all aliases from forgecore.json
      let resolved = false;
      if (aliases) {
        for (const [alias, target] of Object.entries(aliases)) {
          // Aliases like "@/" → "src/" or "@components" → "src/components"
          const aliasPrefix = alias.endsWith('/') ? alias : alias + '/';
          if (importPath.startsWith(aliasPrefix) || importPath === alias) {
            const remainder = importPath.startsWith(aliasPrefix)
              ? importPath.slice(aliasPrefix.length)
              : '';
            // Target can be relative ("src/") or absolute
            const targetBase = target.startsWith('/')
              ? target
              : `${repoSrcPath.replace(/\/src$/, '')}/${target}`;
            absolutePath = remainder
              ? `${targetBase.replace(/\/$/, '')}/${remainder}`
              : targetBase.replace(/\/$/, '');
            resolved = true;
            break;
          }
        }
      }
      // Fallback: @/ → src/ (legacy behavior)
      if (!resolved) {
        if (importPath.startsWith('@/')) {
          absolutePath = `${repoSrcPath}/${importPath.slice(2)}`;
        } else {
          // External package — skip
          return;
        }
      }
    }

    // Try common extensions: .tsx, .ts, /index.tsx, /index.ts
    const candidates = [
      absolutePath,
      absolutePath + '.tsx',
      absolutePath + '.ts',
      absolutePath + '/index.tsx',
      absolutePath + '/index.ts',
    ];

    let fileContent: string | null = null;
    let resolvedPath = '';

    for (const candidate of candidates) {
      if (resolved.has(candidate)) return; // Already resolved
      fileContent = await resolveFile(candidate);
      if (fileContent) {
        resolvedPath = candidate;
        break;
      }
    }

    if (!fileContent || !resolvedPath) {
      console.log(`[compileWithDeps] Could not resolve: ${importPath} from ${fromDir}`);
      return;
    }

    resolved.add(resolvedPath);

    // Extract local imports from this dependency
    const subImports = extractLocalImports(fileContent);
    const depDir = resolvedPath.substring(0, resolvedPath.lastIndexOf('/'));

    // Resolve sub-dependencies first (topological order)
    for (const sub of subImports) {
      // Skip CSS
      if (sub.importPath.endsWith('.css')) continue;
      await resolveDep(sub.importPath, depDir, depth + 1, sub.exportedNames);
    }

    // Preprocess and add this dependency's code
    const subCompName = importPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Component';

    // Discover what this file actually exports before preprocessing removes the "export" keywords
    const discoveredExports = new Set<string>();
    const exportRegex = /export\s+(?:(?:const|let|var|function|class)\s+([a-zA-Z0-9_]+)|default\s+([a-zA-Z0-9_]+)?)/g;
    let exportMatch;
    while ((exportMatch = exportRegex.exec(fileContent)) !== null) {
      if (exportMatch[1]) discoveredExports.add(exportMatch[1]);
      else if (exportMatch[2]) discoveredExports.add(exportMatch[2]);
      else discoveredExports.add(subCompName); // default export without name
    }

    const preprocessed = preprocessForBundle(fileContent, subCompName);
    console.log(`\n\n--- PREPROCESSED DEP: ${subCompName} ---\n${preprocessed.substring(0, 300)}\n------------------------\n\n`);

    // The requested imports (from the file that included this one) might include aliases
    // For safety, expose anything we discovered AND anything specifically requested
    const allExportsToExpose = new Set([...exportedNames, ...Array.from(discoveredExports)]);

    // Wrap the dependency in an IIFE to prevent variable bleeding (e.g. multiple components defining 'cn')
    // but expose the actual exported functions/components to the global window scope
    const exportsAssignments = Array.from(allExportsToExpose).map(name =>
      `if (typeof window !== "undefined" && typeof ${name} !== "undefined") { window.${name} = ${name}; }`
    ).join('\n');

    depCodeBlocks.push(`
// ── Dependency: ${importPath} ──
(() => {
${preprocessed}
${exportsAssignments}
})();
`);
  }

  try {
    // Extract local imports from the main component's ORIGINAL source
    // (before stubs were prepended — we parse the raw preprocessed code)
    // The mainCode already has stubs at the top, so we look for the component section
    const componentSection = mainCode.substring(mainCode.indexOf('// Component code'));
    const localImports = extractLocalImports(componentSection.length > 50 ? componentSection : mainCode);

    console.log(`[compileWithDeps] ${componentName}: found ${localImports.length} local imports`);

    // Resolve each dependency found via imports
    for (const imp of localImports) {
      await resolveDep(imp.importPath, componentDir, 0, imp.exportedNames);
    }

    // Also resolve explicit dependencies (e.g., from forgecore.json for showcases)
    for (const depPath of explicitDeps) {
      // If it's a full path like "src/components/Button/Button.tsx", convert it to absolute repo path
      let importPath = depPath;
      if (depPath.startsWith('src/')) {
        importPath = `${repoSrcPath}/${depPath.slice(4)}`;
      }

      // Phase 7C: Check if this explicit dependency is the wrapper
      let explicitExportNames: string[] = [];
      const fallbackName = importPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || '';
      explicitExportNames.push(fallbackName);

      // We pass the exact wrapperName we extracted earlier if it matches
      // but resolveDep already uses regex to find all exports, so we're safe.

      await resolveDep(importPath, repoSrcPath, 0, explicitExportNames);
    }

    if (depCodeBlocks.length > 0) {
      console.log(`[compileWithDeps] ${componentName}: resolved ${depCodeBlocks.length} dependency files`);

      // Insert dependency code AFTER stubs but BEFORE the main component code
      const stubsEnd = mainCode.indexOf('// Component code');
      if (stubsEnd > 0) {
        mainCode = mainCode.substring(0, stubsEnd) +
          '\n// ═══ RESOLVED DEPENDENCIES ═══\n' +
          depCodeBlocks.join('\n') +
          '\n// ═══ END DEPENDENCIES ═══\n\n' +
          mainCode.substring(stubsEnd);
      } else {
        // Fallback: prepend deps before main code
        mainCode = depCodeBlocks.join('\n') + '\n' + mainCode;
      }
    }

    console.log('\n--- FULL MAIN CODE BEFORE ESBUILD ---\n', mainCode.substring(0, 5000), '\n--- END ---');

    // Compile the combined source
    const result = await esbuild.transform(mainCode, {
      loader: 'tsx',
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      target: 'es2020',
    });

    console.log('\n--- ESBUILD BUNDLE OUTPUT ---\n', result.code.substring(0, 10000), '\n--- END BUNDLE ---');

    return {
      code: result.code,
      errors: [],
      warnings: result.warnings.map(w => w.text),
    };
  } catch (error) {
    const err = error as esbuild.TransformFailure;
    return {
      code: '',
      errors: err.errors?.map(e => `${e.location?.line}:${e.location?.column} ${e.text}`) || [(error as Error).message],
      warnings: err.warnings?.map(w => w.text) || [],
    };
  }
}

/**
 * Resolve a relative import path from a directory.
 * Simple path resolution without Node.js path module (runs in browser).
 */
function resolveRelativePath(fromDir: string, importPath: string): string {
  const parts = fromDir.split('/');
  const importParts = importPath.split('/');

  for (const part of importParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return parts.join('/');
}

/**
 * Create a bundle from multiple component files
 * This wraps components so they can be used in the preview iframe
 */
export function createPreviewBundle(
  componentCode: string,
  componentName: string,
  cssContent: string = ''
): string {
  // Use a unique variable name to avoid conflicts with component code
  const uid = '_pc_' + Date.now();

  // The compiled code will have the component as a variable in global scope
  // We need to find it and expose it for rendering
  return `
(function() {
  try {
    // CSS injection (only if cssContent provided — normally CSS goes via LOAD_COMPONENT)
    if (${JSON.stringify(cssContent)}) {
      var ${uid}_style = document.createElement('style');
      ${uid}_style.textContent = ${JSON.stringify(cssContent)};
      document.head.appendChild(${uid}_style);
    }

    // Execute the compiled component code
    // This will define variables/functions in this scope
    ${componentCode}
    
    // Try to find the component using eval to avoid static reference issues
    var ${uid}_Component = null;
    
    // Try to get the component by name using eval (avoids "already declared" errors)
    try {
      ${uid}_Component = eval(${JSON.stringify(componentName)});
      if (${uid}_Component) {
        console.log('[Sandbox] Found component via eval: ${componentName}');
      }
    } catch(e) { 
      console.log('[Sandbox] Component not found via eval, trying fallbacks');
    }
    
    // Pattern 2: Check __default__ (from export default conversion)
    if (!${uid}_Component && typeof __default__ !== 'undefined') {
      ${uid}_Component = __default__;
      console.log('[Sandbox] Found component as __default__');
    }
    
    // Pattern 3: Check if component is a property of the IIFE result (__component__)
    if (!${uid}_Component && typeof __component__ !== 'undefined') {
      ${uid}_Component = __component__.default || __component__[${JSON.stringify(componentName)}] || __component__;
      console.log('[Sandbox] Found component in __component__');
    }
    
    if (!${uid}_Component) {
      console.error('[Sandbox] Could not find component: ${componentName}');
      console.log('[Sandbox] Available vars in scope - check code output');
    }
    
    // Store globally for iframe access
    window.__PreviewComponent__ = ${uid}_Component;
    window.__ComponentName__ = ${JSON.stringify(componentName)};
    window[${JSON.stringify(componentName)}] = ${uid}_Component;
    
    // Expose showcase render function if it was compiled with the component
    window.__showcaseRender__ = (typeof __showcaseRender__ !== 'undefined') ? __showcaseRender__ : null;
    
    // Notify parent that component is ready
    if (window.parent !== window) {
      window.parent.postMessage({ 
        type: 'COMPONENT_READY', 
        name: ${JSON.stringify(componentName)},
        found: !!${uid}_Component 
      }, '*');
    }
  } catch (error) {
    console.error('[Sandbox] Bundle execution error:', error);
    window.parent.postMessage({ 
      type: 'BUNDLE_ERROR', 
      error: error.message 
    }, '*');
  }
})();
`;
}

/**
     * Transform CSS Module to regular CSS with unique class names
     * For preview we don't need the mapping, just unique names
     */
export function transformCssModule(css: string, componentName: string): string {
  // For simplicity in preview, we'll use original class names
  // The iframe is isolated so no conflicts
  return css;
}

/**
 * Create stub for common imports that aren't available in browser
 * @param componentName - The main component being loaded (always skipped)
 * @param skipComponents - Additional components to skip stubs for (bundled dependencies)
 * @param customUtilities - Custom utility stubs from forgecore.json
 * @param repoIcons - SVG icon data from the repository for dynamic icon stubs
 */
export function createImportStubs(
  componentName?: string,
  skipComponents?: string[],
  customUtilities?: Record<string, { path: string; stub?: string }>,
  repoIcons?: Array<{ name: string; svgContent: string }>
): string {
  // Build a set of components to skip stubs for
  const skipped = new Set<string>(skipComponents || []);
  if (componentName) skipped.add(componentName);

  // Check if specific components should be skipped
  const skipButton = skipped.has('Button') || skipped.has('PrimaryButton');
  const skipSpinner = skipped.has('Spinner');

  // Generate custom utility stubs from forgecore.json
  let customStubs = '';
  if (customUtilities) {
    for (const [name, config] of Object.entries(customUtilities)) {
      if (config.stub) {
        // Use the exact stub from forgecore.json
        customStubs += `
// Custom utility: ${name} (from forgecore.json)
var ${name} = ${config.stub};
`;
      }
    }
  }

  return `
// ═══════════════════════════════════════════════════════════════════
// CUSTOM UTILITIES FROM FORGECORE.JSON
// ═══════════════════════════════════════════════════════════════════
${customStubs}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTION STUBS (for design systems)
// ═══════════════════════════════════════════════════════════════════

// cn - class name merger (used in most design systems)
// Only define if not already provided by custom utilities
if (typeof cn === 'undefined') {
  var cn = function cn() {
    return Array.from(arguments).filter(Boolean).join(' ');
  };
}

// clsx - popular class name utility
var clsx = cn;

// classnames - another popular class name utility  
var classnames = cn;

// CSS Modules proxy - returns namespaced class name to match transformCssModuleToGlobal
// Applies ONLY to the main component, because dependencies have their styles renamed via preprocessForBundle
var __componentName__ = ${componentName ? JSON.stringify(componentName) : "'Component'"};
var styles = new Proxy({}, {
  get: function(target, prop) {
    return __componentName__ + '_' + String(prop);
  }
});

// cva (class-variance-authority) stub
function cva(base, config) {
  return function(props) {
    var classes = [base];
    if (config && config.variants && props) {
      for (var key in config.variants) {
        if (props[key] && config.variants[key][props[key]]) {
          classes.push(config.variants[key][props[key]]);
        }
      }
    }
    return classes.filter(Boolean).join(' ');
  };
}

// ═══════════════════════════════════════════════════════════════════
// REACT HOOKS (from CDN)
// ═══════════════════════════════════════════════════════════════════

// React hooks - redirect to React.* since React is loaded from CDN
var useState = React.useState;
var useEffect = React.useEffect;
var useCallback = React.useCallback;
var useMemo = React.useMemo;
var useRef = React.useRef;
var useContext = React.useContext;
var useReducer = React.useReducer;
var useLayoutEffect = React.useLayoutEffect;
var useImperativeHandle = React.useImperativeHandle;
var useDebugValue = React.useDebugValue;
var useDeferredValue = React.useDeferredValue;
var useTransition = React.useTransition;
var useId = React.useId;
var useSyncExternalStore = React.useSyncExternalStore;
var useInsertionEffect = React.useInsertionEffect;

// React types/utilities - these are just to prevent errors
var forwardRef = React.forwardRef;
var createContext = React.createContext;
var memo = React.memo;
var Fragment = React.Fragment;
var Children = React.Children;
var cloneElement = React.cloneElement;
var isValidElement = React.isValidElement;
var lazy = React.lazy;
var Suspense = React.Suspense;

// ReactDOM utilities - createPortal for overlay components
// Uses #forge-portal-root in sandbox for proper z-index stacking
var createPortal = function(children, container) {
  // Try to use forge-portal-root if no container specified or container not found
  var portalRoot = document.getElementById('forge-portal-root');
  var targetContainer = container || portalRoot;
  
  // If ReactDOM.createPortal is available and container exists, use real portal
  if (typeof ReactDOM !== 'undefined' && ReactDOM.createPortal && targetContainer) {
    return ReactDOM.createPortal(children, targetContainer);
  }
  
  // Fallback: just return children inline
  return children;
};

// Stub for lucide-react icons - render visible SVG placeholders
var createIcon = function(name) {
  return function(props) {
    var size = props && props.size || 24;
    var className = props && props.className || '';
    var strokeWidth = props && props.strokeWidth || 2;
    
    // Create a visible placeholder SVG
    return React.createElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: 'lucide lucide-' + name.toLowerCase() + ' ' + className,
      'data-icon': name,
      style: { display: 'inline-block', verticalAlign: 'middle' }
    }, 
    // Draw a simple icon based on the name
    name === 'X' || name === 'Close' ? [
      React.createElement('line', { key: 1, x1: 18, y1: 6, x2: 6, y2: 18 }),
      React.createElement('line', { key: 2, x1: 6, y1: 6, x2: 18, y2: 18 })
    ] :
    name === 'Check' ? [
      React.createElement('polyline', { key: 1, points: '20 6 9 17 4 12' })
    ] :
    name === 'ChevronDown' ? [
      React.createElement('polyline', { key: 1, points: '6 9 12 15 18 9' })
    ] :
    name === 'ChevronUp' ? [
      React.createElement('polyline', { key: 1, points: '18 15 12 9 6 15' })
    ] :
    name === 'ChevronLeft' ? [
      React.createElement('polyline', { key: 1, points: '15 18 9 12 15 6' })
    ] :
    name === 'ChevronRight' ? [
      React.createElement('polyline', { key: 1, points: '9 18 15 12 9 6' })
    ] :
    name === 'Search' ? [
      React.createElement('circle', { key: 1, cx: 11, cy: 11, r: 8 }),
      React.createElement('line', { key: 2, x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
    ] :
    name === 'Plus' ? [
      React.createElement('line', { key: 1, x1: 12, y1: 5, x2: 12, y2: 19 }),
      React.createElement('line', { key: 2, x1: 5, y1: 12, x2: 19, y2: 12 })
    ] :
    name === 'Minus' ? [
      React.createElement('line', { key: 1, x1: 5, y1: 12, x2: 19, y2: 12 })
    ] :
    name === 'Eye' ? [
      React.createElement('path', { key: 1, d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
      React.createElement('circle', { key: 2, cx: 12, cy: 12, r: 3 })
    ] :
    name === 'EyeOff' ? [
      React.createElement('path', { key: 1, d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' }),
      React.createElement('line', { key: 2, x1: 1, y1: 1, x2: 23, y2: 23 })
    ] :
    name === 'Loader2' || name === 'Loader' ? [
      React.createElement('path', { key: 1, d: 'M21 12a9 9 0 1 1-6.219-8.56' })
    ] :
    name === 'AlertCircle' ? [
      React.createElement('circle', { key: 1, cx: 12, cy: 12, r: 10 }),
      React.createElement('line', { key: 2, x1: 12, y1: 8, x2: 12, y2: 12 }),
      React.createElement('line', { key: 3, x1: 12, y1: 16, x2: 12.01, y2: 16 })
    ] :
    name === 'CheckCircle' || name === 'CheckCircle2' ? [
      React.createElement('path', { key: 1, d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
      React.createElement('polyline', { key: 2, points: '22 4 12 14.01 9 11.01' })
    ] :
    name === 'Info' ? [
      React.createElement('circle', { key: 1, cx: 12, cy: 12, r: 10 }),
      React.createElement('line', { key: 2, x1: 12, y1: 16, x2: 12, y2: 12 }),
      React.createElement('line', { key: 3, x1: 12, y1: 8, x2: 12.01, y2: 8 })
    ] :
    // Default: draw a generic icon (circle with dot)
    [
      React.createElement('circle', { key: 1, cx: 12, cy: 12, r: 10, strokeDasharray: '4 2' }),
      React.createElement('circle', { key: 2, cx: 12, cy: 12, r: 2, fill: 'currentColor' })
    ]
    );
  };
};

// Common icon stubs
var X = createIcon('X');
var Check = createIcon('Check');
var ChevronDown = createIcon('ChevronDown');
var ChevronUp = createIcon('ChevronUp');
var ChevronLeft = createIcon('ChevronLeft');
var ChevronRight = createIcon('ChevronRight');
var Search = createIcon('Search');
var Plus = createIcon('Plus');
var Minus = createIcon('Minus');
var Edit = createIcon('Edit');
var Trash = createIcon('Trash');
var Copy = createIcon('Copy');
var Settings = createIcon('Settings');
var Menu = createIcon('Menu');
var Close = createIcon('Close');
var Info = createIcon('Info');
var AlertCircle = createIcon('AlertCircle');
var CheckCircle = createIcon('CheckCircle');
var Eye = createIcon('Eye');
var EyeOff = createIcon('EyeOff');
var Loader2 = createIcon('Loader2');

// ═══════════════════════════════════════════════════════════════════
// DYNAMIC ICON STUBS FROM REPOSITORY SVGs
// ═══════════════════════════════════════════════════════════════════
${(() => {
      if (!repoIcons || repoIcons.length === 0) return '// No repo icons found';

      const stubs: string[] = [];
      for (const icon of repoIcons) {
        // Sanitize SVG content for embedding in JS string
        const safeSvg = icon.svgContent
          .replace(/'/g, "\\'")  // escape single quotes
          .replace(/\n/g, ' ')     // remove newlines
          .replace(/\r/g, '')      // remove carriage returns
          .replace(/\s+/g, ' ')    // collapse whitespace
          .trim();

        // Only create stub if not already defined as a hardcoded icon
        stubs.push(`
// Repo icon: ${icon.name}
if (typeof ${icon.name} === 'undefined') {
  var ${icon.name} = function(props) {
    var size = props && props.size || 24;
    var className = props && props.className || '';
    return React.createElement('span', {
      className: 'repo-icon repo-icon-' + '${icon.name.toLowerCase()}' + ' ' + className,
      style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size },
      dangerouslySetInnerHTML: { __html: '${safeSvg}'.replace(/width="[^"]*"/, 'width="' + size + '"').replace(/height="[^"]*"/, 'height="' + size + '"') }
    });
  };
}`);
      }
      return stubs.join('\n');
    })()}

// ═══════════════════════════════════════════════════════════════════
// IMAGE / NEXT-IMAGE STUB
// ═══════════════════════════════════════════════════════════════════

// next/image stub — renders a standard <img> tag
if (typeof Image === 'undefined' || Image === window.Image) {
  var Image = function(props) {
    var imgProps = {
      src: props.src || '',
      alt: props.alt || '',
      style: Object.assign({
        maxWidth: '100%',
        height: 'auto'
      }, props.style || {})
    };
    if (props.width) imgProps.width = props.width;
    if (props.height) imgProps.height = props.height;
    if (props.className) imgProps.className = props.className;
    if (props.loading) imgProps.loading = props.loading;
    return React.createElement('img', imgProps);
  };
}

// ===== STUB COMPONENTS =====
// These are used by other components as dependencies
// Skip stubs if we're loading that component to avoid redeclaration errors

${skipButton ? '// Button stub skipped - loading actual Button component' : `// Button stub - simple button component for components that import Button
var Button = function(props) {
  var variant = props.variant || 'primary';
  var size = props.size || 'md';
  var disabled = props.disabled || props.loading;
  var style = {
    padding: size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 24px' : '8px 16px',
    fontSize: size === 'sm' ? '12px' : size === 'lg' ? '16px' : '14px',
    background: variant === 'primary' ? 'var(--sg-color-primary, #3b82f6)' : 
                variant === 'danger' ? 'var(--sg-color-danger, #ef4444)' :
                variant === 'secondary' ? 'var(--sg-color-bg-tertiary, #27272a)' : 'transparent',
    color: variant === 'ghost' ? 'var(--sg-color-text-primary, #fff)' : '#fff',
    border: variant === 'ghost' || variant === 'secondary' ? '1px solid var(--sg-color-border, #3f3f46)' : 'none',
    borderRadius: 'var(--sg-radius-md, 6px)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 500,
    width: props.fullWidth ? '100%' : 'auto'
  };
  return React.createElement('button', {
    style: style,
    disabled: disabled,
    onClick: props.onClick,
    type: props.type || 'button',
    className: props.className
  }, props.loading ? React.createElement(Loader2, { size: 16 }) : null, props.children);
};`}

${skipSpinner ? '// Spinner stub skipped - loading actual Spinner component' : `// Spinner stub
var Spinner = function(props) {
  var size = props.size === 'sm' ? 16 : props.size === 'lg' ? 32 : 24;
  return React.createElement('div', {
    style: {
      width: size,
      height: size,
      border: '2px solid var(--sg-color-border, #3f3f46)',
      borderTopColor: 'var(--sg-color-primary, #3b82f6)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }
  });
};`}

// ═══════════════════════════════════════════════════════════════════
// EXPOSE ICON FACTORY TO GLOBAL SCOPE
// processProps in the sandbox template needs this to convert icon markers
// ═══════════════════════════════════════════════════════════════════
window.__createIcon__ = createIcon;
`;
}

