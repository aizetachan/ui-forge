/**
 * ReactSandbox - Live React component preview using esbuild-wasm
 * 
 * Renders actual React components in an isolated iframe with:
 * - Real React 18 runtime
 * - Component CSS
 * - Theme CSS (design tokens)
 * - Props passed via postMessage
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ComponentNode, Token, RepoAssets } from '../types';
import { initializeEsbuild, compileComponent, compileComponentWithDeps, createPreviewBundle, createImportStubs } from '../lib/esbuildCompiler';
import { generateSandboxHTML } from './ReactSandbox/sandboxTemplate';
import { Inspect, Smartphone, Tablet, Monitor, Maximize, MousePointerClick } from 'lucide-react';

/** Computed CSS property values extracted from the sandbox DOM */
export type ComputedStylesData = Record<string, string>;

/** CSS properties to extract from the rendered component */
const COMPUTED_STYLE_PROPS = [
  'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'gap',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform',
  'color', 'backgroundColor', 'borderColor', 'borderWidth', 'borderRadius', 'borderStyle',
  'opacity', 'boxShadow', 'overflow', 'cursor', 'position', 'top', 'right', 'bottom', 'left', 'zIndex',
];

interface ReactSandboxProps {
  component: ComponentNode | null;
  allComponents?: ComponentNode[];
  token?: Token | null;
  zoom: number;
  themeCSS?: string;
  viewMode?: 'single' | 'matrix' | 'states';
  onComputedStyles?: (styles: ComputedStylesData | null) => void;
  utilities?: Record<string, { path: string; stub?: string }>;
  repoAssets?: RepoAssets;
  previewConfig?: Record<string, any>;
  forceState?: string | null;
  selectedSubElement?: string | null;
  inspectorMode?: boolean;
  onInspectorToggle?: () => void;
  aliases?: Record<string, string>;

  // Phase 9: Always-On Interactive Selector
  onInteractiveSelect?: (subElement: string) => void;
  availableSubElements?: string[];
  interactiveSelectorEnabled?: boolean;
  onInteractiveSelectorToggle?: () => void;
  // Phase 10: Hide iframe when not authenticated
  isSkeletonMode?: boolean;
}

/**
 * Preprocess component source code:
 * - Remove import statements (we provide stubs)
 * - Remove export statements (we handle exports differently)
 */
function preprocessSourceCode(source: string): string {
  // D3: Two-pass import removal to handle both single-line and multi-line imports
  let processed = source
    // Pass 1: Single-line imports — import { x } from 'y' or import 'y'
    .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '// [import removed]')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '// [import removed]')
    // Pass 2: Multi-line imports — import {\n  Foo,\n  Bar,\n} from 'y'
    .replace(/^import\s+\{[^}]*\}\s*from\s+['"][^'"]+['"];?\s*$/gms, '// [import removed]')
    // Also handle: import Foo,\n  { Bar } from 'y' (default + named, multi-line)
    .replace(/^import\s+\w+\s*,\s*\{[^}]*\}\s*from\s+['"][^'"]+['"];?\s*$/gms, '// [import removed]')
    // Remove export default
    .replace(/^export\s+default\s+/gm, 'const __default__ = ')
    // Remove export { x }
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '// [export removed]')
    // Change "export const" to just "const"
    .replace(/^export\s+const\s+/gm, 'const ')
    // Change "export function" to just "function"  
    .replace(/^export\s+function\s+/gm, 'function ')
    // Change "export interface" to just "interface"
    .replace(/^export\s+interface\s+/gm, 'interface ')
    // Change "export type" to just "type"
    .replace(/^export\s+type\s+/gm, 'type ');

  return processed;
}

/**
 * Generate default props from component propDefs
 * Returns JavaScript code string to be eval'd in the iframe
 * 
 * IMPORTANT: We only generate defaults for props that genuinely need them.
 * ReactNode/ReactElement props should be undefined so the component
 * conditionally hides those sub-elements (icons, spinners, etc.).
 * Boolean props already have defaults in the component destructuring.
 */
function generateDefaultPropsFromDefs(propDefs?: Array<{ name: string; type: string; options?: string[]; defaultValue?: any }>): string {
  if (!propDefs || propDefs.length === 0) {
    return '{}';
  }

  const propsEntries: string[] = [];

  // Types that should NEVER have auto-generated defaults regardless of defaultValue.
  // These control sub-element visibility and the component handles its own defaults.
  const SKIP_TYPES = new Set(['boolean', 'reactnode', 'reactelement', 'function']);

  for (const def of propDefs) {
    // FIRST: Skip types that the component handles internally
    // Boolean: component destructuring has `isLoading = false` etc.
    // ReactNode: leaving undefined hides sub-elements (icons, spinners)
    // Function: event callbacks should be undefined, not empty stubs
    if (SKIP_TYPES.has(def.type)) {
      continue;
    }

    // Include props that have an explicit default value
    if (def.defaultValue !== undefined) {
      let valueStr: string;
      if (typeof def.defaultValue === 'string') {
        valueStr = `'${def.defaultValue}'`;
      } else if (typeof def.defaultValue === 'boolean' || typeof def.defaultValue === 'number') {
        valueStr = String(def.defaultValue);
      } else {
        valueStr = JSON.stringify(def.defaultValue);
      }
      propsEntries.push(`${def.name}: ${valueStr}`);
      continue;
    }

    // Generate default based on type
    switch (def.type) {
      case 'string':
        propsEntries.push(`${def.name}: '${def.name === 'label' || def.name === 'title' ? 'Sample ' + def.name : 'Sample text'}'`);
        break;
      case 'number':
        propsEntries.push(`${def.name}: 0`);
        break;
      case 'enum':
        if (def.options && def.options.length > 0) {
          propsEntries.push(`${def.name}: '${def.options[0]}'`);
        }
        break;
      case 'array':
        // Generate sample array with one item
        propsEntries.push(`${def.name}: [{ label: 'Item 1' }, { label: 'Item 2' }]`);
        break;
      default:
        // For unknown types, skip to avoid injecting bad values
        break;
    }
  }

  return `{ ${propsEntries.join(', ')} }`;
}

// generateSandboxHTML is now imported from './ReactSandbox/sandboxTemplate'

export const ReactSandbox: React.FC<ReactSandboxProps> = ({
  component,
  allComponents,
  token,
  zoom,
  themeCSS,
  viewMode = 'single',
  onComputedStyles,
  utilities,
  repoAssets,
  previewConfig,
  forceState,
  selectedSubElement,
  inspectorMode = false,
  onInspectorToggle,
  aliases,
  onInteractiveSelect,
  availableSubElements = [],
  interactiveSelectorEnabled = true,
  onInteractiveSelectorToggle,
  isSkeletonMode,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [esbuildReady, setEsbuildReady] = useState(false);
  const [injectedCSS, setInjectedCSS] = useState<string>(''); // For debugging CSS injection
  const depCSSRef = useRef<string>(''); // Dependency CSS portion (excludes component's own rawCSS)

  // Phase 7E: Viewport Switching State
  const [viewportWidth, setViewportWidth] = useState<string>('100%');

  // Actual CSS selector reported by the sandbox after rendering
  const resolvedSelectorRef = useRef<string | null>(null);

  // Fix 4: Selector-ready gate — prevents sending overrides before the iframe reports
  // the real CSS selector. Pending overrides are flushed when the selector arrives.
  const selectorReadyRef = useRef(false);
  const pendingOverridesRef = useRef<any[] | null>(null);

  // F4: Keep a ref to the latest onComputedStyles callback to avoid stale closure
  const onComputedStylesRef = useRef(onComputedStyles);
  useEffect(() => { onComputedStylesRef.current = onComputedStyles; }, [onComputedStyles]);

  // Fix B7: Track whether the initial LOAD_COMPONENT has sent CSS to avoid redundant UPDATE_CSS
  const hasLoadedRef = useRef(false);

  // Track the actual component currently loaded in the iframe to prevent prop contamination
  const loadedComponentNameRef = useRef<string | null>(null);

  // Initialize esbuild on mount
  useEffect(() => {
    initializeEsbuild()
      .then(() => {
        setEsbuildReady(true);
        console.log('[ReactSandbox] esbuild ready');
      })
      .catch((err) => {
        setError(`Failed to initialize esbuild: ${err.message}`);
      });
  }, []);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, error: errorMsg } = event.data;

      switch (type) {
        case 'SANDBOX_READY':
          setIsReady(true);
          console.log('[ReactSandbox] Sandbox ready');
          break;
        case 'RENDER_SUCCESS':
          setError(null);
          break;
        case 'COMPUTED_STYLES':
          if (event.data.styles && onComputedStylesRef.current) {
            onComputedStylesRef.current(event.data.styles);
          }
          break;
        case 'COMPONENT_ROOT_SELECTOR':
          // Actual CSS class selector from the rendered component's root element
          resolvedSelectorRef.current = event.data.selector;
          selectorReadyRef.current = true;
          console.log('[ReactSandbox] Resolved selector:', event.data.selector);
          // Flush any pending overrides that were queued before selector arrived
          if (pendingOverridesRef.current) {
            const pending = pendingOverridesRef.current;
            pendingOverridesRef.current = null;
            // Re-build with real selector
            const realGroups = pending.map((g: any) => ({
              ...g,
              selector: g._isMain ? event.data.selector : g.selector.replace(g._fallbackMain || '', event.data.selector),
            }));
            iframeRef.current?.contentWindow?.postMessage({
              type: 'APPLY_STYLE_OVERRIDES',
              overrideGroups: realGroups,
            }, '*');
          }
          break;
        case 'RENDER_ERROR':
        case 'LOAD_ERROR':
          console.error('[ReactSandbox] Render error:', errorMsg);
          setError(errorMsg);
          break;
        case 'INSPECTOR_SELECT':
          // Inspector mode: user clicked an element in the iframe
          if (event.data.styles && onComputedStylesRef.current) {
            onComputedStylesRef.current(event.data.styles);
          }
          console.log('[ReactSandbox] Inspector selected:', event.data.elementInfo);
          break;
        case 'INTERACTIVE_SELECT':
          if (onInteractiveSelect) {
            onInteractiveSelect(event.data.subElement);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Compile and load component when it changes
  useEffect(() => {
    if (!isReady || !esbuildReady || !component?.sourceCode) return;

    console.log('[ReactSandbox] Loading component:', component.name, 'variant:', component.selectedVariant);

    const loadComponent = async () => {
      setIsCompiling(true);
      setError(null);

      try {
        // Preprocess source code: remove imports and add our stubs
        const preprocessedSource = preprocessSourceCode(component.sourceCode || '');

        // Resolve dependency component names from forgecore paths
        const depNames = (component.dependencies || [])
          .map(d => d.split('/').pop()?.replace('.tsx', '') || '')
          .filter(Boolean);

        // Build the showcase render function if available
        // IMPORTANT: This must be compiled together with the component code
        // so it can reference component definitions (Dropdown, DropdownItem, etc.)
        const showcaseFunction = component.showcase
          ? `\n// ── Showcase render function (compound component template) ──
function __showcaseRender__(props) {
  return (${component.showcase});
}\n`
          : '';

        // Create the full source with import stubs + component code + showcase
        // NOTE: depNames ARE passed as skipComponents — dependencies are now real bundled
        // files that don't need stubs. We skip stubs for any component we bundle.
        const fullSource = `
${createImportStubs(
          component.name,
          depNames,  // Skip generating stubs for bundled dependencies
          utilities,
          repoAssets?.icons
        )}

// Component code (preprocessed - imports removed, exports converted)
${preprocessedSource}

${showcaseFunction}
`;

        // Compile everything together so showcase shares scope with component definitions
        // Try dependency-aware compilation first (resolves real local imports),
        // fall back to stub-only compilation if it fails
        let result;

        console.log(`[ReactSandbox] DIAG: component.filePath = ${component.filePath}`);
        console.log(`[ReactSandbox] DIAG: window.electronAPI =`, window.electronAPI);

        if (component.filePath && window.electronAPI?.repo?.readFile) {
          try {
            const componentDir = component.filePath.substring(0, component.filePath.lastIndexOf('/'));
            // Derive src path: /path/to/repo/src/components/Button/Button.tsx → /path/to/repo/src
            const srcIdx = component.filePath.indexOf('/src/');
            const repoSrcPath = srcIdx >= 0 ? component.filePath.substring(0, srcIdx + 4) : componentDir;

            const resolveFile = async (absPath: string): Promise<string | null> => {
              try {
                const res = await window.electronAPI!.repo.readFile(absPath);
                return res?.success ? (res.data as string) : null;
              } catch {
                return null;
              }
            };

            // Phase 7C: Ensure context wrapper is compiled into the sandbox bundle
            const compileDeps = [...(component.dependencies || [])];
            const wrapperName = component.previewConfig?.mount?.wrapper || previewConfig?.mount?.wrapper;
            if (wrapperName && allComponents) {
              const wrapperComp = allComponents.find(c => c.name === wrapperName);
              if (wrapperComp && wrapperComp.filePath) {
                // Convert absolute filePath back to relative repo path matching dependencies format
                const relPath = wrapperComp.filePath.substring(repoSrcPath.length - 3); // '-3' keeps 'src/...'
                if (!compileDeps.includes(wrapperComp.filePath) && !compileDeps.includes(relPath)) {
                  compileDeps.push(wrapperComp.filePath);
                }
              }
            }

            result = await compileComponentWithDeps(
              fullSource,
              component.name,
              resolveFile,
              componentDir,
              repoSrcPath,
              compileDeps,
              3,  // maxDepth
              aliases  // Phase 7B: Pass forgecore aliases for dependency resolution
            );
            console.log('\n\n--- BUNDLE DUMP for', component.name, '---\n', result.code.substring(0, 1500), '\n-------------------------\n\n');
            console.log('[ReactSandbox] Compiled with dependency resolution for', component.name);
          } catch (depErr: any) {
            console.warn('[ReactSandbox] Dep-aware compile failed, using stub-only:', depErr.message);
            result = await compileComponent(fullSource, `${component.name}.tsx`);
          }
        } else {
          result = await compileComponent(fullSource, `${component.name}.tsx`);
        }

        if (result.errors.length > 0) {
          setError(result.errors.join('\n'));
          setIsCompiling(false);
          return;
        }


        // Create the preview bundle (CSS injected via LOAD_COMPONENT message, not here)
        const bundle = createPreviewBundle(
          result.code,
          component.name,
          ''  // CSS goes through LOAD_COMPONENT → #component-styles only (avoid double injection)
        );

        // Build props from component.props (includes forgecore defaults + user edits from panel)
        const componentProps: Record<string, any> = {
          ...component.props,
          variant: component.selectedVariant || component.props?.variant,
          size: component.selectedSize || component.props?.size,
        };

        // Phase 7A: Auto-stub callbacks with no-ops so components don't crash
        // when internally calling onClose(), onDismiss(), etc.
        if (component.callbacks) {
          for (const cbName of component.callbacks) {
            if (componentProps[cbName] === undefined || componentProps[cbName] === null) {
              componentProps[cbName] = '__CALLBACK_STUB__';
            }
          }
        }

        console.log('[ReactSandbox] Final props for', component.name, ':', componentProps);
        if (component.showcase) {
          console.log('[ReactSandbox] Showcase compiled inline for', component.name);
        }

        // Gather CSS from main component and ALL its dependencies recursively
        let combinedCSS = component.rawCSS || '';
        let dependencyCSS = ''; // Track dependency CSS separately for UPDATE_CSS hot-reload
        const wrapperName = component.previewConfig?.mount?.wrapper || previewConfig?.mount?.wrapper;

        console.log('[ReactSandbox] CSS gather check: allComponents=', allComponents?.length, 'deps=', component.dependencies?.length, 'rawCSS=', (component.rawCSS || '').length);
        if (allComponents && component.dependencies?.length) {
          const visited = new Set<string>();
          const normalizeDepName = (d: string) => d.split('/').pop()?.replace('.tsx', '') || '';

          const gatherCSS = (compName: string) => {
            if (visited.has(compName)) return;
            visited.add(compName);
            const depComp = allComponents.find(c => c.name === compName);
            if (depComp) {
              if (depComp.rawCSS && !combinedCSS.includes(depComp.rawCSS)) {
                const depBlock = `\n/* Dependency: ${compName} */\n${depComp.rawCSS}\n`;
                combinedCSS += depBlock;
                dependencyCSS += depBlock;
              }
              depComp.dependencies?.map(normalizeDepName).forEach(gatherCSS);
            }
          };

          const initialDepNames = component.dependencies.map(normalizeDepName).filter(Boolean);
          // Phase 7C: Also gather CSS for the wrapper component if specified
          if (wrapperName && !initialDepNames.includes(wrapperName)) {
            initialDepNames.push(wrapperName);
          }
          initialDepNames.forEach(gatherCSS);
        }

        // Store dependency CSS separately so UPDATE_CSS can reconstruct combined CSS
        depCSSRef.current = dependencyCSS;
        console.log('[ReactSandbox] LOAD depCSS set:', dependencyCSS.length, 'chars, combinedCSS:', combinedCSS.length, 'rawCSS:', (component.rawCSS || '').length);

        setInjectedCSS(combinedCSS);

        // Send to iframe
        iframeRef.current?.contentWindow?.postMessage({
          type: 'LOAD_COMPONENT',
          code: bundle,
          css: combinedCSS,
          props: componentProps,
          defaultProps: generateDefaultPropsFromDefs(component.propDefs),
          componentName: component.name,
          // Phase 7A: Send additional metadata to sandbox
          componentType: component.componentType,
          wrapperStyle: component.previewConfig?.wrapperStyle,
          disableAnimations: component.previewConfig?.disableAnimations,
          elementProps: component.elementProps,
          // Phase 7C: Context Provider Wrapping
          wrapper: wrapperName,
        }, '*');

        loadedComponentNameRef.current = component.name;

      } catch (err) {
        console.error('[ReactSandbox] Compilation error:', err);
        setError((err as Error).message);
      }

      setIsCompiling(false);
    };

    // Reset resolved selector and selector-ready gate when loading a new component
    resolvedSelectorRef.current = null;
    selectorReadyRef.current = false;
    pendingOverridesRef.current = null;
    hasLoadedRef.current = false;  // Will be set after first UPDATE_CSS skip

    loadComponent();
    // Compile only when component identity or source code changes (NOT on prop/variant/CSS edits)
  }, [component?.id, component?.sourceCode, isReady, esbuildReady]);

  // Send updated props to iframe WITHOUT recompiling (lightweight)
  useEffect(() => {
    if (!isReady || !component?.props) return;

    // Fix: Prevent sending new props if the iframe hasn't finished loading this component yet
    if (loadedComponentNameRef.current !== component.name) return;

    // Build complete props — include ALL propDef keys so the sandbox gets removals as null
    const componentProps: Record<string, any> = {};

    // First, seed with all propDef names (null = removed/unused)
    if (component.propDefs) {
      for (const def of component.propDefs) {
        componentProps[def.name] = null;
      }
    }

    // Then overlay actual prop values
    for (const [key, val] of Object.entries(component.props)) {
      // postMessage drops `undefined` — convert to `null` so sandbox can strip it
      componentProps[key] = val === undefined ? null : val;
    }

    // Override variant/size from selection
    componentProps.variant = component.selectedVariant || component.props?.variant;
    componentProps.size = component.selectedSize || component.props?.size;

    iframeRef.current?.contentWindow?.postMessage({
      type: 'UPDATE_PROPS',
      props: componentProps,
    }, '*');
  }, [component?.props, component?.propDefs, component?.selectedVariant, component?.selectedSize, isReady]);

  // Send style overrides to iframe when they change
  useEffect(() => {
    if (!isReady || !component) return;

    const variantKey = `${component.selectedVariant || 'default'}_${component.selectedSize || 'default'}`;

    // Prefer the actual selector resolved from the rendered DOM
    // Fall back to the naming-convention guess
    let mainSelector = resolvedSelectorRef.current;
    if (!mainSelector) {
      const baseName = component.name.charAt(0).toLowerCase() + component.name.slice(1);
      mainSelector = `.${component.name}_${baseName}`;
      if (component.selectedVariant) {
        mainSelector += `.${component.name}_${component.selectedVariant}`;
      }
      if (component.selectedSize) {
        mainSelector += `.${component.name}_${component.selectedSize}`;
      }
    }

    // Build override groups: separate main overrides from sub-element overrides
    const allOverrides = component.styleOverridesPerVariant || {};
    const overrideGroups: Array<{ selector: string; overrides: Record<string, string | number> }> = [];
    const mainOverrides: Record<string, string | number> = {};

    for (const [key, val] of Object.entries(allOverrides)) {
      if (!key.startsWith(variantKey)) continue;
      const overrideRecord = val as Record<string, string | number>;
      const separatorIdx = key.indexOf('::');
      const subSelector = separatorIdx >= 0 ? key.substring(separatorIdx + 2) : '__main__';

      if (subSelector === '__main__') {
        Object.assign(mainOverrides, overrideRecord);
      } else {
        // Namespace the selector for the sandbox
        // CSS module parser gives un-namespaced selectors like ".title"
        // but the iframe uses ComponentName_className format like ".AlertDialog_title"
        const namespacedSub = subSelector.replace(
          /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g,
          (_, cls: string) => `.${component.name}_${cls}`
        );

        // G4: Determine if this is a compound selector (modifier on same element)
        // or a descendant selector (sub-element as child).
        // Check rawCSS for the compound pattern: e.g. ".Button_button.Button_fullWidth"
        // vs descendant pattern: ".Button_button .Button_title"
        const isCompound = component.rawCSS?.includes(
          `${mainSelector.split(':')[0]}${namespacedSub.split(':')[0]}`
        );

        overrideGroups.push({
          selector: isCompound
            ? `${mainSelector}${namespacedSub}`  // compound: .root.modifier (same element)
            : `${mainSelector} ${namespacedSub}`, // descendant: .root .child (child element)
          overrides: { ...overrideRecord },
        });
      }
    }

    // Always include main overrides as the first group
    if (Object.keys(mainOverrides).length > 0 || overrideGroups.length === 0) {
      overrideGroups.unshift({
        selector: mainSelector,
        overrides: mainOverrides,
      });
    }

    console.log('[ReactSandbox] APPLY_STYLE_OVERRIDES:', overrideGroups.length, 'groups, main:', mainSelector);

    // Fix 4: If selector hasn't been resolved yet (iframe still rendering),
    // queue overrides and flush when COMPONENT_ROOT_SELECTOR arrives
    if (!selectorReadyRef.current) {
      // Tag each group so the flush handler knows which are main vs sub-element
      const taggedGroups = overrideGroups.map(g => ({
        ...g,
        _isMain: g.selector === mainSelector,
        _fallbackMain: mainSelector,
      }));
      pendingOverridesRef.current = taggedGroups;
      console.log('[ReactSandbox] Selector not ready, queuing', taggedGroups.length, 'override groups');
      return;
    }

    iframeRef.current?.contentWindow?.postMessage({
      type: 'APPLY_STYLE_OVERRIDES',
      overrideGroups,
    }, '*');
  }, [component?.styleOverridesPerVariant, component?.selectedVariant, component?.selectedSize, component?.name, isReady]);

  // Fix 5: Send forceState to iframe to simulate pseudo-states (hover/focus/active/disabled)
  // rawCSS is read via ref to avoid re-firing on every CSS writeback
  // (the sandbox already re-applies force state when it receives UPDATE_CSS)
  const rawCSSRef = useRef(component?.rawCSS || '');
  rawCSSRef.current = component?.rawCSS || '';

  useEffect(() => {
    if (!isReady || !component) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: 'FORCE_STATE',
      state: forceState || 'default',
      componentCSS: rawCSSRef.current,
    }, '*');
  }, [forceState, isReady, component?.name]);

  // Hot-reload component CSS when rawCSS changes (e.g. after file writeback)
  useEffect(() => {
    if (!isReady || !component?.rawCSS) return;
    // Fix B7: Skip on initial load — LOAD_COMPONENT already sends the CSS
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }
    // Reconstruct combined CSS: new rawCSS + cached dependency CSS
    const updatedCombinedCSS = component.rawCSS + depCSSRef.current;
    console.log('[ReactSandbox] UPDATE_CSS: rawCSS=' + component.rawCSS.length + ' depCSS=' + depCSSRef.current.length + ' combined=' + updatedCombinedCSS.length);
    iframeRef.current?.contentWindow?.postMessage({
      type: 'UPDATE_CSS',
      css: updatedCombinedCSS,
    }, '*');
  }, [component?.rawCSS, isReady]);

  // E2: Request sub-element computed styles when selection changes
  useEffect(() => {
    if (!isReady || !component) return;
    if (selectedSubElement) {
      // Build namespaced selector for the sub-element
      const namespacedSelector = selectedSubElement.replace(
        /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g,
        (_, cls: string) => `.${component.name}_${cls}`
      );
      iframeRef.current?.contentWindow?.postMessage({
        type: 'REQUEST_SUB_STYLES',
        subSelector: namespacedSelector,
      }, '*');
    } else {
      // When switching back to main, re-extract root styles
      iframeRef.current?.contentWindow?.postMessage({
        type: 'REQUEST_STYLES',
      }, '*');
    }
  }, [selectedSubElement, isReady, component?.name]);

  // Hot-update theme CSS without iframe reload
  useEffect(() => {
    if (!isReady || !themeCSS) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: 'UPDATE_THEME_CSS',
      themeCSS,
    }, '*');
  }, [themeCSS, isReady]);

  // E4: Send layout mode to sandbox when previewConfig changes
  useEffect(() => {
    if (!isReady) return;
    const layout = previewConfig?.layout || 'center';
    iframeRef.current?.contentWindow?.postMessage({
      type: 'SET_LAYOUT',
      layout,
    }, '*');
  }, [previewConfig?.layout, isReady]);

  // Inspector mode: send ENABLE/DISABLE_INSPECTOR to iframe
  useEffect(() => {
    if (!isReady) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: inspectorMode ? 'ENABLE_INSPECTOR' : 'DISABLE_INSPECTOR',
    }, '*');
  }, [inspectorMode, isReady]);

  // Phase 9: Sync Interactive Selector State
  useEffect(() => {
    if (!isReady) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: 'UPDATE_INTERACTIVE_STATE',
      subElements: availableSubElements,
      selectedSubElement: selectedSubElement,
      enabled: interactiveSelectorEnabled,
    }, '*');
  }, [availableSubElements, selectedSubElement, interactiveSelectorEnabled, isReady]);

  // Phase 7D: Theme Switching State
  const defaultTheme = previewConfig?.theme?.default || 'dark';
  const themeValues = previewConfig?.theme?.values || ['dark', 'light'];
  const themeStrategy = previewConfig?.theme?.strategy || 'attribute';
  const themeAttribute = previewConfig?.theme?.attribute || 'data-theme';
  const themeApplyTo = previewConfig?.theme?.applyTo || 'documentElement';

  const [currentTheme, setCurrentTheme] = useState(defaultTheme);

  // Send SET_THEME when theme changes or sandbox loads
  useEffect(() => {
    if (!isReady) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: 'SET_THEME',
      theme: currentTheme,
      values: themeValues,
      strategy: themeStrategy,
      attribute: themeAttribute,
      applyTo: themeApplyTo
    }, '*');
  }, [currentTheme, isReady, themeStrategy, themeAttribute, themeApplyTo]);

  // Generate iframe content
  const iframeContent = generateSandboxHTML(themeCSS);

  return (
    <div className="flex-1 bg-[#09090b] relative overflow-hidden flex flex-col">
      {/* Toolbar */}
      {isSkeletonMode ? (
        <div className="h-10 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-900/50 select-none pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-800 rounded"></div>
            <div className="w-6 h-6 bg-zinc-800 rounded"></div>
            <div className="ml-4 pl-4 border-l border-zinc-800 flex items-center gap-1">
              <div className="w-6 h-6 bg-zinc-800 rounded"></div>
              <div className="w-6 h-6 bg-zinc-800 rounded"></div>
              <div className="w-6 h-6 bg-zinc-800 rounded"></div>
            </div>
          </div>
          <div className="w-16 h-5 bg-zinc-800 rounded"></div>
        </div>
      ) : (
        <div className="h-10 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <button
              onClick={onInspectorToggle}
              className={`p-1 rounded transition-colors ${inspectorMode
                ? 'text-blue-400 bg-blue-500/15 hover:bg-blue-500/25'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              title={inspectorMode ? 'Disable Inspector' : 'Enable Inspector'}
            >
              <Inspect className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onInteractiveSelectorToggle}
              className={`p-1 rounded transition-colors ${interactiveSelectorEnabled
                ? 'text-blue-400 bg-blue-500/15 hover:bg-blue-500/25'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              title={interactiveSelectorEnabled ? 'Interactive Selection On' : 'Interactive Selection Off'}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
            </button>
            {isCompiling && (
              <span className="text-xs text-yellow-500">Compiling...</span>
            )}
            {error && (
              <span className="text-xs text-red-500">Error</span>
            )}
            {!esbuildReady && (
              <span className="text-xs text-blue-500">Loading esbuild...</span>
            )}

            {/* Viewport Controls */}
            <div className="flex items-center ml-4 border-l border-zinc-700 pl-4 gap-1">
              <button
                onClick={() => setViewportWidth('375px')}
                className={`p-1 rounded transition-colors ${viewportWidth === '375px' ? 'text-zinc-200 bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                title="Mobile (375px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewportWidth('768px')}
                className={`p-1 rounded transition-colors ${viewportWidth === '768px' ? 'text-zinc-200 bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                title="Tablet (768px)"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewportWidth('1280px')}
                className={`p-1 rounded transition-colors ${viewportWidth === '1280px' ? 'text-zinc-200 bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                title="Desktop (1280px)"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewportWidth('100%')}
                className={`p-1 rounded transition-colors ${viewportWidth === '100%' ? 'text-zinc-200 bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                title="Full Width"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {themeValues.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 hidden sm:inline">Theme:</span>
                <select
                  value={currentTheme}
                  onChange={(e) => setCurrentTheme(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded px-2 py-1 outline-none focus:border-zinc-500"
                >
                  {themeValues.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-xs text-zinc-500">{Math.round(zoom * 100)}%</div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute top-10 left-0 right-0 bg-red-950/90 border-b border-red-800 p-3 z-10">
          <pre className="text-xs text-red-300 whitespace-pre-wrap overflow-x-auto">
            {error}
          </pre>
        </div>
      )}

      {/* Sandbox iframe (Hidden completely in Skeleton Mode) */}
      <div className="flex-1 overflow-auto bg-checkered relative flex justify-center items-start pt-8">
        {!isSkeletonMode ? (
          <div style={{
            width: viewportWidth,
            height: '100%',
            transition: 'width 0.3s ease',
          }} className="relative shadow-2xl border border-zinc-800">
            <iframe
              ref={iframeRef}
              title="React Sandbox"
              srcDoc={iframeContent}
              className="w-full h-full border-0"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                width: `${100 / zoom}%`,
                height: `${100 / zoom}%`,
              }}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-0 pointer-events-none">
            {/* Invisible placeholder for skeleton layout structure */}
          </div>
        )}
      </div>

      {/* CSS Injection Debugger */}
      {/* <div className="absolute bottom-0 left-0 right-0 h-40 bg-zinc-950/90 border-t border-zinc-800 p-2 overflow-auto text-xs text-green-400 font-mono z-20">
        <div>// INJECTED CSS DEBUG ({injectedCSS.length} chars)</div>
        <pre>{injectedCSS}</pre>
      </div> */}

      <style>{`
        .bg-checkered {
          background: repeating-conic-gradient(#18181b 0% 25%, #111113 0% 50%) 50% / 20px 20px;
        }
      `}</style>
    </div >
  );
};

export default ReactSandbox;
