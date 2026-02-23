
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ComponentNode, ElementType, Token, Repository } from '../types';
import { ComputedStylesData } from './ReactSandbox';
import { Sliders, Code, Settings2, X, Info, Settings, EllipsisVertical } from 'lucide-react';
import { useStyleOverrides } from './PropertiesPanel/hooks/useStyleOverrides';
import { useFileWriteback } from './PropertiesPanel/hooks/useFileWriteback';
import { CodeBlock } from './PropertiesPanel/CodeBlock';
import { IdentitySection } from './PropertiesPanel/sections/IdentitySection';
// CSSPropertiesSection kept available for potential future use with modifiers
import { LayoutSection } from './PropertiesPanel/sections/LayoutSection';
import { AppearanceSection } from './PropertiesPanel/sections/AppearanceSection';
import { TypographySection } from './PropertiesPanel/sections/TypographySection';
import { EffectsSection } from './PropertiesPanel/sections/EffectsSection';
import { PositionSection } from './PropertiesPanel/sections/PositionSection';
import { OtherPropertiesSection } from './PropertiesPanel/sections/OtherPropertiesSection';
import { parseCSSModule, getActiveRules, getSubElementNames, getSubElementRules, getMergedProperties } from '../lib/cssModuleParser';
import type { VariantInfo, ParsedCSSModule, CSSPropertyValue } from '../lib/cssModuleParser';
import type { ForceState } from './StateSelector';
import type { PushChangeParams } from '../hooks/useChangeHistory';

interface PropertiesPanelProps {
  selection: ComponentNode | Token | null;
  onUpdateComponent: (updated: ComponentNode) => void;
  onUpdateToken: (updated: Token) => void;
  repo?: Repository;
  computedStyles?: ComputedStylesData | null;
  /** Current forced pseudo-state for the preview */
  forceState?: ForceState;
  /** Callback to change the forced pseudo-state */
  onForceStateChange?: (state: ForceState) => void;
  /** Tokens from the repo for the token picker */
  tokens?: Token[];
  /** E2: Callback when user selects a sub-element in the CSS rule dropdown */
  onSelectedSubElementChange?: (subElement: string | null) => void;
  /** Phase 9: Callback to pass available sub-elements to the Parent/Sandbox */
  onAvailableSubElementsChange?: (subElements: string[]) => void;
  /** Change History: callback to push a change entry for undo/redo */
  onPushChange?: (params: PushChangeParams) => void;
  /** Phase 9: Active sub-element selected externally */
  selectedSubElement?: string | null;
  /** Phase 10B: Render an empty, uninteractive skeleton shell if not authenticated */
  isSkeletonMode?: boolean;
}

// ── Settings Floating Panel ──────────────────────────────────

interface SettingsPanelProps {
  comp: ComponentNode;
  onUpdateComponent: (updated: ComponentNode) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ comp, onUpdateComponent, onClose, anchorRef }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'settings'>('info');
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Default position: top-right of the preview area (to the left of properties panel)
  const defaultPos = useMemo(() => {
    // Properties panel is ~320px wide on the right
    const panelWidth = 280;
    const propertiesPanelWidth = 320;
    return {
      x: window.innerWidth - propertiesPanelWidth - panelWidth - 8,
      y: 88, // below TitleBar(40) + iframe toolbar(40) + 8px gap
    };
  }, []);

  const [position, setPosition] = useState(defaultPos);
  const posRef = useRef(defaultPos);
  const dragRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({ dragging: false, offsetX: 0, offsetY: 0 });

  // Keep posRef in sync
  useEffect(() => { posRef.current = position; }, [position]);

  // Overlay helpers — prevent iframe from swallowing mouse events during drag
  const createOverlay = useCallback(() => {
    if (overlayRef.current) return;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:9998;cursor:grabbing;';
    document.body.appendChild(el);
    overlayRef.current = el;
  }, []);
  const removeOverlay = useCallback(() => {
    if (overlayRef.current) { overlayRef.current.remove(); overlayRef.current = null; }
  }, []);

  // Drag handlers — use window events for reliable capture
  const SETTINGS_W = 280;
  const SIDEBAR_W = 256;
  const PROPS_PANEL_W = 320;
  const MIN_Y = 80; // TitleBar(40) + iframe toolbar(40)
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const maxX = window.innerWidth - PROPS_PANEL_W - SETTINGS_W;
      const newX = Math.max(SIDEBAR_W, Math.min(maxX, e.clientX - dragRef.current.offsetX));
      const newY = Math.max(MIN_Y, e.clientY - dragRef.current.offsetY);
      setPosition({ x: newX, y: newY });
    };
    const onMouseUp = () => {
      if (!dragRef.current.dragging) return;
      dragRef.current.dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      removeOverlay();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      removeOverlay();
    };
  }, [removeOverlay]);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking a button
    if ((e.target as HTMLElement).closest('button')) return;
    const cur = posRef.current;
    dragRef.current = {
      dragging: true,
      offsetX: e.clientX - cur.x,
      offsetY: e.clientY - cur.y,
    };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    createOverlay();
  }, [createOverlay]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: 280,
        zIndex: 9999,
      }}
      className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
    >
      {/* Header — draggable */}
      <div
        ref={headerRef}
        onMouseDown={onHeaderMouseDown}
        className="flex items-center justify-between px-3 py-2 border-b border-zinc-800"
        style={{ cursor: 'grab' }}
      >
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-2 py-1 text-[10px] rounded font-bold transition-colors ${activeTab === 'info'
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <span className="flex items-center gap-1"><Info className="w-3 h-3" /> More Info</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-2 py-1 text-[10px] rounded font-bold transition-colors ${activeTab === 'settings'
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <span className="flex items-center gap-1"><Settings className="w-3 h-3" /> Settings</span>
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        {activeTab === 'info' ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-zinc-500 font-bold mb-1 block">COMPONENT NAME</label>
              <input
                type="text"
                value={comp.name}
                onChange={(e) => onUpdateComponent({ ...comp, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold mb-1 block">HTML TAG</label>
                <select
                  value={comp.tagName}
                  onChange={(e) => onUpdateComponent({ ...comp, tagName: e.target.value as ElementType })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                >
                  {Object.values(ElementType).map(tag => <option key={tag} value={tag}>{tag}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-bold mb-1 block">CONTENT</label>
                <input
                  type="text"
                  value={comp.content || ''}
                  onChange={(e) => onUpdateComponent({ ...comp, content: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-4 bg-zinc-950 rounded-lg border border-zinc-800">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-[11px] text-zinc-400">Settings coming soon</span>
          </div>
        )}
      </div>
    </div>
  );
};


export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selection, onUpdateComponent, onUpdateToken, repo,
  computedStyles, forceState = 'default', onForceStateChange, tokens, selectedSubElement,
  onSelectedSubElementChange,
  onAvailableSubElementsChange,
  onPushChange,
  isSkeletonMode
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');

  const [selectedRule, setSelectedRule] = useState<'__main__' | '__modifiers__' | string>('__main__');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  // Accordion states
  const [sections, setSections] = useState({
    layout: true,
    appearance: true,
    typography: true,
    effects: false,
    position: false,
    other: false,

  });

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Determine selection type
  const isComponent = selection && 'tagName' in selection;
  const isToken = selection && 'type' in selection;
  const component = isComponent ? (selection as ComponentNode) : null;

  // G2: Reset selectedRule when component changes to avoid stale sub-element/modifier selection
  useEffect(() => {
    setSelectedRule('__main__');
  }, [component?.id]);

  // Ref to latest component — avoids stale closure in async callbacks
  const componentRef = useRef(component);
  useEffect(() => { componentRef.current = component; }, [component]);

  // Placeholder component for hooks when nothing is selected
  const placeholderComponent: ComponentNode = { id: '', name: '', tagName: 'div' as ElementType, classes: '', content: '', props: {} } as ComponentNode;
  const activeComponent = component || placeholderComponent;

  // --- Hooks (called unconditionally per React rules) ---
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  const { writePropToFile } = useFileWriteback({
    isElectron: !!isElectron,
    forgecorePath: activeComponent.forgecorePath,
    componentName: activeComponent.name,
    componentId: activeComponent.id,
    cssModulePath: activeComponent.cssModulePath,
    onPushChange,
  });

  const { getStyleOverride, updateStyleOverride, getCurrentStyleOverrides, getModifierStyleOverrides } = useStyleOverrides({
    component: activeComponent,
    onUpdateComponent,
    // Note: onWriteCSS intentionally NOT passed here.
    // handleCSSPropertyChange already writes to CSS file directly with the correct selector.
    // Passing onWriteCSS here caused a double-write race condition that corrupted var() references.
  });

  // --- Parse CSS Module into structured rules ---
  const parsedCSS: ParsedCSSModule | null = useMemo(() => {
    if (!component?.rawCSS || !component?.name) return null;

    // Build VariantInfo from ComponentVariant[]
    const variantInfos: VariantInfo[] = [];
    if (component.variants) {
      // Group by type: variant vs size
      const variantValues: string[] = [];
      const sizeValues: string[] = [];

      for (const v of component.variants) {
        if (v.type === 'size') {
          sizeValues.push(v.cssClass);
        } else {
          variantValues.push(v.cssClass);
        }
      }

      if (variantValues.length > 0) {
        variantInfos.push({ prop: 'variant', values: variantValues });
      }
      if (sizeValues.length > 0) {
        variantInfos.push({ prop: 'size', values: sizeValues });
      }
    }

    return parseCSSModule(component.rawCSS, component.name, variantInfos);
  }, [component?.rawCSS, component?.name, component?.variants]);

  // --- Get active rules based on current selection ---
  const activeRules = useMemo(() => {
    if (!parsedCSS) return [];
    return getActiveRules(
      parsedCSS,
      component?.selectedVariant,
      component?.selectedSize,
      forceState
    );
  }, [parsedCSS, component?.selectedVariant, component?.selectedSize, forceState]);

  // --- Merged CSS properties (unified base + variant + size + state) ---
  const mergedCSS = useMemo(() => {
    if (!parsedCSS) return null;
    return getMergedProperties(
      parsedCSS,
      component?.selectedVariant,
      component?.selectedSize,
      forceState
    );
  }, [parsedCSS, component?.selectedVariant, component?.selectedSize, forceState]);

  const subElementNames = useMemo(() => {
    if (!parsedCSS) return [];
    return getSubElementNames(parsedCSS);
  }, [parsedCSS]);

  // Phase 9: Expose sub-elements to parent for interactive overlay
  useEffect(() => {
    if (onAvailableSubElementsChange) {
      // Pass with leading dot for CSS selector matching in the sandbox template
      const selectors = subElementNames.map(name => `.${name}`);
      onAvailableSubElementsChange(selectors);
    }
  }, [subElementNames, onAvailableSubElementsChange]);

  // Phase 9: Sync internal selectedRule with external selectedSubElement
  useEffect(() => {
    if (selectedSubElement !== undefined && selectedSubElement !== null) {
      const ruleValue = selectedSubElement.startsWith('.') ? selectedSubElement.substring(1) : selectedSubElement;
      setSelectedRule(ruleValue || '__main__');
    }
  }, [selectedSubElement]);

  // --- Available pseudo-states from the component's CSS ---
  const availableStates = useMemo(() => {
    if (!parsedCSS) return [];
    const stateSet = new Set<string>();
    const allRules = [
      ...parsedCSS.base,
      ...Object.values(parsedCSS.variants).flat(),
      ...Object.values(parsedCSS.sizes).flat(),
      ...parsedCSS.modifiers,
      ...Object.values(parsedCSS.subElements).flat(),
    ];
    for (const rule of allRules) {
      if (rule.pseudoStates) {
        for (const s of rule.pseudoStates) {
          stateSet.add(s);
        }
      }
    }
    return Array.from(stateSet);
  }, [parsedCSS]);

  // --- Build dropdown options for CSS rule selector ---
  const ruleOptions = useMemo(() => {
    if (!parsedCSS) return [];
    const baseName = component?.name
      ? component.name.charAt(0).toLowerCase() + component.name.slice(1)
      : 'component';
    const options: { label: string; value: string }[] = [
      { label: `.${baseName}`, value: '__main__' },
    ];
    if (parsedCSS.modifiers.length > 0) {
      options.push({ label: 'Modifiers', value: '__modifiers__' });
    }
    for (const name of subElementNames) {
      options.push({ label: `.${name}`, value: name });
    }
    return options;
  }, [parsedCSS, subElementNames, component?.name]);

  // --- Get properties for currently selected rule ---
  const selectedRuleData = useMemo(() => {
    if (!parsedCSS) return null;
    if (selectedRule === '__main__') {
      return { rules: [], mergedProperties: mergedCSS ?? undefined };
    }
    if (selectedRule === '__modifiers__') {
      return { rules: parsedCSS.modifiers, mergedProperties: undefined };
    }
    // Sub-element
    const subRules = getSubElementRules(parsedCSS, selectedRule, component?.selectedSize);
    return { rules: subRules, mergedProperties: undefined };
  }, [parsedCSS, selectedRule, mergedCSS, component?.selectedSize]);

  // --- Handle CSS property edits ---
  const handleCSSPropertyChange = useCallback((selector: string, property: string, value: string) => {
    // 1. Update style override for live preview
    // Only pass selector for sub-element or modifier edits.
    // For base/main element edits, pass undefined → stores under plain variantKey → "__main__" path.
    const overrideSelector = selectedRule !== '__main__'
      ? selector
      : undefined;
    updateStyleOverride(property, value, overrideSelector);

    // 2. Write to .module.css file with correct selector
    if (isElectron && component?.cssModulePath) {
      const cssProp = property.replace(/([A-Z])/g, '-$1').toLowerCase();
      // E5: Look up mediaQuery from parsed CSS rules for @media-aware writeback
      let mediaQuery: string | undefined;
      if (parsedCSS) {
        const allRules = [
          ...parsedCSS.base,
          ...Object.values(parsedCSS.variants).flat(),
          ...Object.values(parsedCSS.sizes).flat(),
          ...Object.values(parsedCSS.subElements).flat(),
          ...parsedCSS.modifiers,
        ];
        const matchingRule = allRules.find(r => r.selector === selector && r.mediaQuery);
        if (matchingRule?.mediaQuery) {
          mediaQuery = matchingRule.mediaQuery;
        }
      }
      // G5: Strip namespace prefix from selector before writing to disk.
      // rawCSS/parsedCSS use namespaced selectors like ".Button_button"
      // but the .module.css file on disk uses ".button".
      const nsPrefix = component.name + '_';
      const diskSelector = selector.replace(
        /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g,
        (match, cls: string) => cls.startsWith(nsPrefix) ? `.${cls.slice(nsPrefix.length)}` : match
      );
      window.electronAPI?.code.writeCSS({
        cssFilePath: component.cssModulePath,
        selector: diskSelector,
        changes: { [cssProp]: value },
        ...(mediaQuery ? { mediaQuery } : {}),
      }).then((result: { success: boolean; newContent?: string; previousValues?: Record<string, string>; error?: string }) => {
        if (result.success && result.newContent) {
          // Push change entry for undo/redo
          if (onPushChange && result.previousValues) {
            const prevVal = Object.values(result.previousValues)[0] || '';
            onPushChange({
              type: 'css',
              componentId: component.id,
              componentName: component.name,
              filePath: component.cssModulePath!,
              selector: diskSelector,
              property,
              previousValue: prevVal,
              newValue: value,
            });
          }
          // D12: Re-namespace using block-aware parser instead of fragile regex lookbehind
          const compName = component.name;
          const src = result.newContent!;
          let namespacedCSS = '';
          let inKeyframes = false;
          let keyframesDepth = 0;
          let ci = 0;

          while (ci < src.length) {
            // Detect @keyframes entry
            if (src.startsWith('@keyframes', ci)) {
              inKeyframes = true;
              keyframesDepth = 0;
              // Copy until opening brace
              while (ci < src.length) {
                namespacedCSS += src[ci];
                if (src[ci] === '{') { keyframesDepth = 1; ci++; break; }
                ci++;
              }
              continue;
            }

            // Track depth inside @keyframes
            if (inKeyframes) {
              namespacedCSS += src[ci];
              if (src[ci] === '{') keyframesDepth++;
              if (src[ci] === '}') { keyframesDepth--; if (keyframesDepth === 0) inKeyframes = false; }
              ci++;
              continue;
            }

            // Outside @keyframes: transform .className patterns
            if (src[ci] === '.' && ci + 1 < src.length && /[a-zA-Z_]/.test(src[ci + 1])) {
              // Don't transform decimal numbers like 0.5
              if (ci > 0 && /[0-9]/.test(src[ci - 1])) {
                namespacedCSS += src[ci];
                ci++;
                continue;
              }
              // Read the class name
              let className = '';
              let j = ci + 1;
              while (j < src.length && /[a-zA-Z0-9_-]/.test(src[j])) {
                className += src[j];
                j++;
              }
              namespacedCSS += `.${compName}_${className}`;
              ci = j;
              continue;
            }

            namespacedCSS += src[ci];
            ci++;
          }
          // Use ref to get latest component state — avoids stale closure
          // that would overwrite styleOverridesPerVariant from updateStyleOverride
          const latest = componentRef.current;
          if (latest) {
            onUpdateComponent({ ...latest, rawCSS: namespacedCSS });
          }
        }
      }).catch((err: Error) => console.error('[PropertiesPanel] CSS write error:', err));
    }
  }, [selectedRule, updateStyleOverride, isElectron, component, onUpdateComponent, parsedCSS, onPushChange]);

  // --- Token data for the token picker ---
  const tokenPickerData = useMemo(() => {
    if (!tokens) return [];
    return tokens.map(t => ({ name: t.name, value: t.value, type: t.type }));
  }, [tokens]);

  // --- Property map for the currently selected rule ---
  // For sub-elements/modifiers, flatten all rules' properties into a single Map
  const selectedRulePropertyMap = useMemo(() => {
    const map = new Map<string, { value: string; selector: string }>();
    if (selectedRule === '__main__' && mergedCSS) {
      for (const m of mergedCSS) {
        map.set(m.property, { value: m.value.raw, selector: m.selector });
      }
    } else if (selectedRuleData?.rules) {
      for (const rule of selectedRuleData.rules) {
        for (const [prop, val] of Object.entries(rule.properties) as [string, CSSPropertyValue][]) {
          map.set(prop, { value: val.raw, selector: rule.selector });
        }
      }
    }
    return map;
  }, [selectedRule, mergedCSS, selectedRuleData]);

  // --- getValue: unified value resolution for visual sections ---
  // Priority: style override > rule property > computed style
  const getValue = useCallback((prop: string): string => {
    // 1. Check style override (user-edited in this session)
    if (selectedRule !== '__main__') {
      const overrideSelector = selectedRulePropertyMap.get(prop)?.selector;
      if (overrideSelector) {
        const overrides = getCurrentStyleOverrides(overrideSelector);
        if (overrides[prop] !== undefined && overrides[prop] !== '') return String(overrides[prop]);
      }
    } else {
      // Phase 8A: If a pseudo-state is forced, check its specific override group first
      if (forceState && forceState !== 'default') {
        const pseudoOverrides = getCurrentStyleOverrides(`:${forceState}`);
        if (pseudoOverrides[prop] !== undefined && pseudoOverrides[prop] !== '') {
          return String(pseudoOverrides[prop]);
        }
      }

      const override = getStyleOverride(prop);
      if (override !== undefined && override !== '') return String(override);
    }

    // 2. Check property from the selected rule
    const entry = selectedRulePropertyMap.get(prop);
    if (entry) return entry.value;

    // 3. Fall back to computed styles from the sandbox
    if (computedStyles) {
      const cs = computedStyles as Record<string, string>;
      if (cs[prop]) return cs[prop];
    }

    return '';
  }, [getStyleOverride, getCurrentStyleOverrides, selectedRulePropertyMap, computedStyles, selectedRule]);

  // --- handleVisualPropertyChange: for visual section fields ---
  // Finds the correct selector and delegates to handleCSSPropertyChange
  const handleVisualPropertyChange = useCallback((prop: string, value: string) => {
    // Find selector from current rule data
    let selector: string | undefined;
    const entry = selectedRulePropertyMap.get(prop);
    if (entry) {
      selector = entry.selector;
    }
    // If property isn't in rule yet, pick the best selector
    if (!selector) {
      if (selectedRule === '__main__') {
        selector = parsedCSS?.base?.[0]?.selector;
      } else if (selectedRule !== '__modifiers__' && selectedRuleData?.rules?.[0]) {
        // Sub-element: use its first rule selector
        selector = selectedRuleData.rules[0].selector;
      }
    }
    if (selector) {
      // Phase 8A: If a pseudo-state is forced (e.g. 'hover'), automatically append it
      // so the user edits the state rule and not the base rule.
      if (forceState && forceState !== 'default') {
        const pseudo = `:${forceState}`;
        if (!selector.includes(pseudo)) {
          // If selector has multiple comma-separated parts, append pseudo to each part
          selector = selector.split(',').map(s => s.trim() + pseudo).join(', ');
        }
      }
      handleCSSPropertyChange(selector, prop, value);
    }
  }, [selectedRulePropertyMap, selectedRule, parsedCSS, selectedRuleData, handleCSSPropertyChange, forceState]);

  // --- Property names from the current selected rule for OtherPropertiesSection ---
  const activePropertyNames = useMemo(() => {
    return Array.from(selectedRulePropertyMap.keys());
  }, [selectedRulePropertyMap]);

  // --- Early Returns (AFTER all hooks) ---

  if (isSkeletonMode) {
    return (
      <div className="w-[320px] bg-zinc-950 border-l border-zinc-800 flex flex-col h-full select-none pointer-events-none">
        <div className="border-b border-zinc-800 p-4">
          <div className="flex gap-2 mb-4">
            <div className="flex-1 h-8 bg-zinc-900 rounded-md"></div>
            <div className="flex-1 h-8 bg-zinc-900 rounded-md"></div>
          </div>
        </div>
        <div className="p-4 space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="w-1/3 h-4 bg-zinc-900 rounded"></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 bg-zinc-900 rounded"></div>
                <div className="h-8 bg-zinc-900 rounded"></div>
                <div className="h-8 bg-zinc-900 rounded"></div>
                <div className="h-8 bg-zinc-900 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!selection) {
    return <div className="w-80 border-l border-zinc-800 bg-zinc-900 h-full flex items-center justify-center text-zinc-600 text-xs">No selection</div>;
  }

  // --- TOKEN EDITOR VIEW ---
  if (isToken) {
    const token = selection as Token;
    return (
      <div className="w-80 border-l border-zinc-800 bg-zinc-900 h-full flex flex-col shadow-xl">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Edit Token</span>
          </div>
          <h2 className="text-lg font-bold text-white truncate">{token.name}</h2>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-[10px] text-zinc-500 font-bold mb-1.5 block">TOKEN VALUE</label>
            <input
              type="text"
              value={token.value}
              onChange={(e) => onUpdateToken({ ...token, value: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-sm text-white focus:border-purple-500 outline-none font-mono"
            />
          </div>
          {token.type === 'color' && (
            <div className="h-24 rounded-lg border border-zinc-800" style={{ backgroundColor: token.value }}></div>
          )}
          <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded text-xs text-blue-200">
            Updating this token will affect all components using <code>{token.name}</code>.
          </div>
        </div>
      </div>
    );
  }

  // --- COMPONENT EDITOR VIEW ---
  const comp = component!;

  // Code to display
  const reactCode = comp.sourceCode || `
// Component source code not available
// This component was not loaded from a repository

export const ${comp.name} = (props) => {
  return (
    <${comp.tagName} 
      className="${comp.classes}"
      {...props}
    >
      ${comp.content}
    </${comp.tagName}>
  );
};`.trim();


  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900 h-full flex flex-col shadow-xl">
      {/* Tabs */}
      <div className="h-10 flex border-b border-zinc-800 shrink-0 bg-zinc-900">
        <button onClick={() => setActiveTab('visual')} className={`flex-1 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'visual' ? 'text-white border-b-2 border-blue-500 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}>
          <Sliders className="w-3.5 h-3.5" /> Design
        </button>
        <button onClick={() => setActiveTab('code')} className={`flex-1 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'code' ? 'text-white border-b-2 border-blue-500 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}>
          <Code className="w-3.5 h-3.5" /> Code
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'visual' ? (
          <div>
            {/* Sticky CSS Rules Header */}
            {parsedCSS && ruleOptions.length > 0 && (
              <div
                className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800"
              >
                <div className="flex items-center justify-between p-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <Code className="w-3.5 h-3.5" />
                    CSS Rules
                  </div>
                  <button
                    ref={settingsButtonRef}
                    onClick={() => setSettingsOpen(prev => !prev)}
                    className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    title="Component settings"
                  >
                    <EllipsisVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <select
                    value={selectedRule}
                    onChange={(e) => {
                      setSelectedRule(e.target.value);
                      const val = e.target.value;
                      if (onSelectedSubElementChange) {
                        if (val !== '__main__' && val !== '__modifiers__') {
                          onSelectedSubElementChange(`.${val}`);
                        } else {
                          onSelectedSubElementChange(null);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                      color: '#e4e4e7',
                      backgroundColor: '#09090b',
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 8px center',
                      paddingRight: '28px',
                    }}
                  >
                    {ruleOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Settings Floating Panel — opens to the left */}
            {settingsOpen && ReactDOM.createPortal(
              <SettingsPanel
                comp={comp}
                onUpdateComponent={onUpdateComponent}
                onClose={() => setSettingsOpen(false)}
                anchorRef={settingsButtonRef}
              />,
              document.body
            )}

            {/* 2. Identity & Props — includes state selector */}
            <IdentitySection
              component={comp}
              onUpdateComponent={onUpdateComponent}
              writePropToFile={writePropToFile}
              availableStates={availableStates}
              forceState={forceState}
              onForceStateChange={onForceStateChange}
            />



            {/* 4. Visual Property Sections — always rendered for all rules */}
            {parsedCSS && ruleOptions.length > 0 ? (
              <>
                <LayoutSection
                  isOpen={sections.layout}
                  onToggle={() => toggleSection('layout')}
                  getValue={getValue}
                  onPropertyChange={handleVisualPropertyChange}
                  computedStyles={computedStyles}
                  tokens={tokenPickerData}
                />
                <AppearanceSection
                  isOpen={sections.appearance}
                  onToggle={() => toggleSection('appearance')}
                  getValue={getValue}
                  onPropertyChange={handleVisualPropertyChange}
                  computedStyles={computedStyles}
                  tokens={tokenPickerData}
                />
                <TypographySection
                  isOpen={sections.typography}
                  onToggle={() => toggleSection('typography')}
                  getValue={getValue}
                  onPropertyChange={handleVisualPropertyChange}
                  computedStyles={computedStyles}
                  tokens={tokenPickerData}
                />
                <EffectsSection
                  isOpen={sections.effects}
                  onToggle={() => toggleSection('effects')}
                  getValue={getValue}
                  onPropertyChange={handleVisualPropertyChange}
                  computedStyles={computedStyles}
                  tokens={tokenPickerData}
                />
                <PositionSection
                  isOpen={sections.position}
                  onToggle={() => toggleSection('position')}
                  getValue={getValue}
                  onPropertyChange={handleVisualPropertyChange}
                  computedStyles={computedStyles}
                  tokens={tokenPickerData}
                />
                {activePropertyNames.length > 0 && (
                  <OtherPropertiesSection
                    isOpen={sections.other}
                    onToggle={() => toggleSection('other')}
                    getValue={getValue}
                    onPropertyChange={handleVisualPropertyChange}
                    computedStyles={computedStyles}
                    tokens={tokenPickerData}
                    propertyNames={activePropertyNames}
                  />
                )}
              </>
            ) : (
              <div style={{
                padding: '16px 12px',
                fontSize: '11px',
                color: '#52525b',
                textAlign: 'center',
              }}>
                No CSS Module data available
              </div>
            )}


          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {/* TSX Source Code */}
            <CodeBlock
              code={reactCode}
              language="tsx"
              label={`${comp.name}.tsx`}
              onChange={(newCode) => {
                onUpdateComponent({ ...comp, sourceCode: newCode });
              }}
            />

            {/* CSS Module Code */}
            {comp.rawCSS && (
              <CodeBlock
                code={comp.rawCSS}
                language="css"
                label={`${comp.name}.module.css`}
                onChange={(newCSS) => {
                  onUpdateComponent({ ...comp, rawCSS: newCSS });
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
