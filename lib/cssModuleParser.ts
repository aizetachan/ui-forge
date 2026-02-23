/**
 * CSSModuleParser
 * 
 * Parses a component's .module.css file into structured, categorized rules.
 * Maps selectors to variant/size/state categories using forgecore variant info.
 * Detects CSS variable values for token picker integration.
 * 
 * Used by the Design tab to show editable CSS properties grouped by
 * base, variant, size, pseudo-state, sub-element, and modifier.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface CSSPropertyValue {
    raw: string;               // "var(--sg-color-accent)" or "32px"
    isVariable: boolean;
    variableName?: string;     // "--sg-color-accent" (without var() wrapper)
}

export interface ParsedCSSRule {
    selector: string;          // Original selector string, e.g. ".primary:hover:not(:disabled)"
    category: 'base' | 'variant' | 'size' | 'state' | 'sub-element' | 'modifier';
    variantName?: string;      // "primary", "secondary" — for category 'variant'
    sizeName?: string;         // "sm", "md", "lg" — for category 'size'
    pseudoStates?: string[];   // ["hover"], ["focus-visible"] — extracted from selector
    subElement?: string;       // "header", "body", "icon" — for category 'sub-element'
    properties: Record<string, CSSPropertyValue>;
    startLine: number;         // 1-indexed line of selector in original CSS
    endLine: number;           // 1-indexed line of closing brace
    mediaQuery?: string;       // E5: @media condition if rule is inside a media block
}

export interface ParsedCSSModule {
    /** All parsed rules */
    rules: ParsedCSSRule[];
    /** Rules for the base class (e.g. .button) */
    base: ParsedCSSRule[];
    /** Variant rules grouped by variant name */
    variants: Record<string, ParsedCSSRule[]>;
    /** Size rules grouped by size name */
    sizes: Record<string, ParsedCSSRule[]>;
    /** Sub-element rules grouped by element name */
    subElements: Record<string, ParsedCSSRule[]>;
    /** Modifier rules (fullWidth, iconOnly, etc.) */
    modifiers: ParsedCSSRule[];
}

/** Variant info from forgecore.json components[name].variants */
export interface VariantInfo {
    prop: string;       // "variant" or "size"
    values: string[];   // ["primary", "secondary", ...]
    default?: string;
}

// ─── Known pseudo-states ─────────────────────────────────────────

const PSEUDO_STATES = [
    'hover', 'focus', 'focus-visible', 'focus-within',
    'active', 'disabled', 'checked', 'read-only',
    'placeholder', 'first-child', 'last-child',
];

// ─── Parser ─────────────────────────────────────────────────────

/**
 * Parse a raw CSS string into structured rules with categorization.
 * 
 * @param rawCSS - The raw CSS module content
 * @param componentName - Component name (e.g. "Button") for base class detection
 * @param forgecoreVariants - Variant definitions from forgecore.json
 * @returns Parsed and categorized CSS module
 */
export function parseCSSModule(
    rawCSS: string,
    componentName: string,
    forgecoreVariants?: VariantInfo[]
): ParsedCSSModule {
    const rules = extractRules(rawCSS);

    // Build lookup sets from forgecore variants
    const variantValues = new Set<string>();
    const sizeValues = new Set<string>();

    if (forgecoreVariants) {
        for (const v of forgecoreVariants) {
            if (v.prop === 'size') {
                v.values.forEach(val => sizeValues.add(val));
            } else {
                // All non-size props are treated as variants
                v.values.forEach(val => variantValues.add(val));
            }
        }
    }

    // The base class is the component name in camelCase (e.g. "Button" → "button")
    const baseClass = componentName.charAt(0).toLowerCase() + componentName.slice(1);

    // Detect CSS Module prefix: if selectors start with ComponentName_
    // e.g. .Button_button, .Button_primary → prefix is "Button_"
    const cssModulePrefix = componentName + '_';

    // Categorize each rule
    const categorized = rules.map(rule =>
        categorizeRule(rule, baseClass, variantValues, sizeValues, cssModulePrefix)
    );

    // Group into structured result
    const result: ParsedCSSModule = {
        rules: categorized,
        base: [],
        variants: {},
        sizes: {},
        subElements: {},
        modifiers: [],
    };

    for (const rule of categorized) {
        switch (rule.category) {
            case 'base':
                result.base.push(rule);
                break;
            case 'variant':
                if (rule.variantName) {
                    if (!result.variants[rule.variantName]) result.variants[rule.variantName] = [];
                    result.variants[rule.variantName].push(rule);
                }
                break;
            case 'size':
                if (rule.sizeName) {
                    if (!result.sizes[rule.sizeName]) result.sizes[rule.sizeName] = [];
                    result.sizes[rule.sizeName].push(rule);
                }
                break;
            case 'sub-element':
                if (rule.subElement) {
                    if (!result.subElements[rule.subElement]) result.subElements[rule.subElement] = [];
                    result.subElements[rule.subElement].push(rule);
                }
                break;
            case 'modifier':
                result.modifiers.push(rule);
                break;
            case 'state':
                // State-only rules go to base (they're base states like .button:disabled)
                result.base.push(rule);
                break;
        }
    }

    return result;
}

// ─── Rule Extraction ────────────────────────────────────────────

interface RawRule {
    selector: string;
    body: string;
    startLine: number;
    endLine: number;
    mediaQuery?: string;  // D13: @media condition if rule is inside a media block
}

/**
 * Extract rule blocks from raw CSS.
 * Skips @keyframes but descends into @media/@supports to extract nested rules (D13).
 */
function extractRules(css: string): RawRule[] {
    const rules: RawRule[] = [];
    const lines = css.split('\n');

    // D13: Recursive helper to parse rules, optionally inside a media query
    function parseRulesInBlock(startIdx: number, endIdx: number, mediaQuery?: string) {
        let i = startIdx;
        while (i < endIdx) {
            const line = lines[i].trim();

            // Skip empty lines, comments
            if (!line || line.startsWith('/*') || line.startsWith('*') || line.startsWith('//')) {
                if (line.startsWith('/*') && !line.includes('*/')) {
                    while (i < endIdx && !lines[i].includes('*/')) i++;
                }
                i++;
                continue;
            }

            // Skip @keyframes blocks entirely
            if (line.startsWith('@keyframes')) {
                let depth = 0;
                do {
                    if (lines[i]?.includes('{')) depth++;
                    if (lines[i]?.includes('}')) depth--;
                    i++;
                } while (i < endIdx && depth > 0);
                continue;
            }

            // D13: Descend into @media/@supports blocks instead of skipping
            if (line.startsWith('@media') || line.startsWith('@supports')) {
                // Extract the condition text (everything before the opening brace)
                let condParts: string[] = [];
                let j = i;
                let foundBrace = false;
                while (j < endIdx) {
                    const l = lines[j].trim();
                    if (l.includes('{')) {
                        const before = l.substring(0, l.indexOf('{')).trim();
                        if (before) condParts.push(before);
                        foundBrace = true;
                        break;
                    }
                    if (l) condParts.push(l);
                    j++;
                }
                if (!foundBrace) { i++; continue; }

                const condition = condParts.join(' ').trim();

                // Find the matching closing brace
                let depth = 1;
                const blockStart = j + 1;
                j++;
                while (j < endIdx && depth > 0) {
                    if (lines[j].includes('{')) depth++;
                    if (lines[j].includes('}')) depth--;
                    j++;
                }
                const blockEnd = j - 1; // line before the closing brace

                // Recursively parse rules inside this block
                parseRulesInBlock(blockStart, blockEnd, condition);
                i = j;
                continue;
            }

            // Look for selector { ... } blocks
            if (line.includes('{') || (i + 1 < endIdx && lines[i + 1]?.trim().startsWith('{'))) {
                const startLine = i + 1; // 1-indexed

                // Collect the selector (may span multiple lines before {)
                let selectorParts: string[] = [];
                let foundBrace = false;
                let j = i;

                while (j < endIdx) {
                    const l = lines[j].trim();
                    if (l.includes('{')) {
                        const beforeBrace = l.substring(0, l.indexOf('{')).trim();
                        if (beforeBrace) selectorParts.push(beforeBrace);
                        foundBrace = true;
                        break;
                    }
                    if (l) selectorParts.push(l);
                    j++;
                }

                if (!foundBrace) { i++; continue; }

                const selector = selectorParts.join(' ').trim();

                // If selector starts with @ (other at-rule), skip
                if (selector.startsWith('@')) {
                    let depth = 1;
                    j++;
                    while (j < endIdx && depth > 0) {
                        if (lines[j].includes('{')) depth++;
                        if (lines[j].includes('}')) depth--;
                        j++;
                    }
                    i = j;
                    continue;
                }

                // Find the closing brace
                let depth = 1;
                const bodyLines: string[] = [];
                j++;

                while (j < endIdx && depth > 0) {
                    if (lines[j].includes('{')) depth++;
                    if (lines[j].includes('}')) depth--;
                    if (depth > 0) bodyLines.push(lines[j]);
                    j++;
                }

                const endLineNum = j;
                const body = bodyLines.join('\n');

                // Handle multi-selector rules (comma-separated)
                const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);

                for (const sel of selectors) {
                    rules.push({
                        selector: sel,
                        body,
                        startLine,
                        endLine: endLineNum,
                        ...(mediaQuery ? { mediaQuery } : {}),
                    });
                }

                i = j;
                continue;
            }

            i++;
        }
    }

    parseRulesInBlock(0, lines.length);
    return rules;
}


// ─── Property Parsing ───────────────────────────────────────────

function parseProperties(body: string): Record<string, CSSPropertyValue> {
    const props: Record<string, CSSPropertyValue> = {};

    // Match property: value; lines
    // Handle multi-line values (e.g. transitions with commas)
    const lines = body.split('\n');
    let currentProp = '';
    let currentValue = '';

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//') || !trimmed) {
            continue;
        }

        // Check if this line has a property declaration
        const colonIdx = trimmed.indexOf(':');
        const semiIdx = trimmed.lastIndexOf(';');

        if (colonIdx > 0) {
            // Save previous prop if we were accumulating
            if (currentProp && currentValue) {
                props[camelCase(currentProp)] = parseValue(currentValue.replace(/;$/, '').trim());
                currentProp = '';
                currentValue = '';
            }

            const propName = trimmed.substring(0, colonIdx).trim();
            const valueRaw = trimmed.substring(colonIdx + 1).trim();

            // Skip CSS custom property declarations (--var-name: ...)
            if (propName.startsWith('--')) continue;

            if (semiIdx > colonIdx) {
                // Complete declaration on one line
                const value = trimmed.substring(colonIdx + 1, semiIdx).trim();
                props[camelCase(propName)] = parseValue(value);
            } else {
                // Multi-line value (e.g. transition)
                currentProp = propName;
                currentValue = valueRaw;
            }
        } else if (currentProp) {
            // Continuation of multi-line value
            if (semiIdx >= 0) {
                currentValue += ' ' + trimmed.substring(0, semiIdx).trim();
                props[camelCase(currentProp)] = parseValue(currentValue.trim());
                currentProp = '';
                currentValue = '';
            } else {
                currentValue += ' ' + trimmed;
            }
        }
    }

    // Handle last prop without semicolon
    if (currentProp && currentValue) {
        props[camelCase(currentProp)] = parseValue(currentValue.replace(/;$/, '').trim());
    }

    return props;
}

function parseValue(raw: string): CSSPropertyValue {
    // Detect var(--xxx) pattern
    const varMatch = raw.match(/^var\(([^,)]+)(?:,\s*(.+))?\)$/);
    if (varMatch) {
        return {
            raw,
            isVariable: true,
            variableName: varMatch[1].trim(),
        };
    }

    // Check if value CONTAINS var() but isn't purely a var()
    // e.g. "1px solid var(--sg-color-border-default)"
    const containsVar = /var\(--[^)]+\)/.test(raw);
    if (containsVar) {
        // Extract the primary variable name
        const firstVar = raw.match(/var\((--[^,)]+)\)/);
        return {
            raw,
            isVariable: true,
            variableName: firstVar?.[1]?.trim(),
        };
    }

    return { raw, isVariable: false };
}

/** Convert kebab-case to camelCase: "border-radius" → "borderRadius" */
function camelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ─── Selector Categorization ────────────────────────────────────

function categorizeRule(
    raw: RawRule,
    baseClass: string,
    variantValues: Set<string>,
    sizeValues: Set<string>,
    cssModulePrefix?: string
): ParsedCSSRule {
    const { selector, body, startLine, endLine, mediaQuery } = raw;
    const properties = parseProperties(body);

    // Extract pseudo-states from selector
    const pseudoStates = extractPseudoStates(selector);

    // Strip pseudo-states and :not() wrappers for class analysis
    const cleanSelector = stripPseudoStates(selector);

    // Extract class names from clean selector, stripping CSS Module prefix
    // e.g. "Button_button" → "button", "Button_primary" → "primary"
    const rawClassNames = extractClassNames(cleanSelector);
    const classNames = cssModulePrefix
        ? rawClassNames.map(cn => cn.startsWith(cssModulePrefix) ? cn.slice(cssModulePrefix.length) : cn)
        : rawClassNames;

    const rule: ParsedCSSRule = {
        selector,
        category: 'modifier', // default
        properties,
        startLine,
        endLine,
        ...(mediaQuery ? { mediaQuery } : {}),
        pseudoStates: pseudoStates.length > 0 ? pseudoStates : undefined,
    };

    if (classNames.length === 0) {
        rule.category = 'modifier';
        return rule;
    }

    const primaryClass = classNames[0];

    // 1. Check if it's the base class (e.g. ".button")
    if (primaryClass === baseClass) {
        if (pseudoStates.length > 0) {
            rule.category = 'state';
        } else {
            rule.category = 'base';
        }
        return rule;
    }

    // 2. Check if primary class is a known variant value
    if (variantValues.has(primaryClass)) {
        rule.category = 'variant';
        rule.variantName = primaryClass;
        return rule;
    }

    // 3. Check if primary class is a known size value
    if (sizeValues.has(primaryClass)) {
        rule.category = 'size';
        rule.sizeName = primaryClass;

        // Check if there's a nested sub-element (e.g. ".sm .input")
        if (classNames.length > 1) {
            rule.category = 'sub-element';
            rule.subElement = classNames[1];
            rule.sizeName = primaryClass;
        }
        return rule;
    }

    // 4. Check for compound selectors where a size/variant is part of selector
    //    e.g. ".iconOnly.sm", ".icon.md"
    for (const cn of classNames) {
        if (variantValues.has(cn)) {
            rule.category = 'variant';
            rule.variantName = cn;
            // The non-variant class is a sub-element
            const otherClasses = classNames.filter(c => c !== cn);
            if (otherClasses.length > 0) {
                rule.subElement = otherClasses[0];
            }
            return rule;
        }
        if (sizeValues.has(cn)) {
            rule.category = 'size';
            rule.sizeName = cn;
            const otherClasses = classNames.filter(c => c !== cn);
            if (otherClasses.length > 0) {
                rule.subElement = otherClasses[0];
            }
            return rule;
        }
    }

    // 5. If not matched, treat as sub-element or modifier
    //    Sub-elements are semantic parts of the component (header, body, footer, icon, etc.)
    //    Modifiers are behavioral (fullWidth, loading, disabled)
    const MODIFIER_PATTERNS = ['fullWidth', 'loading', 'disabled', 'selected', 'interactive', 'required'];

    if (MODIFIER_PATTERNS.some(m => primaryClass === m)) {
        rule.category = 'modifier';
        // Check for pseudo-states on modifiers (e.g. .interactive:hover)
        if (pseudoStates.length > 0) {
            rule.category = 'modifier';
        }
        return rule;
    }

    // Default: treat as sub-element
    rule.category = 'sub-element';
    rule.subElement = primaryClass;
    return rule;
}

// ─── Selector Utilities ─────────────────────────────────────────

function extractPseudoStates(selector: string): string[] {
    const states: string[] = [];

    for (const state of PSEUDO_STATES) {
        // Match :state or :state( patterns, including within :not()
        const pattern = new RegExp(`:${state}\\b`);
        if (pattern.test(selector)) {
            states.push(state);
        }
    }

    return states;
}

function stripPseudoStates(selector: string): string {
    // Remove pseudo-states, :not() wrappers, and ::pseudo-elements
    let clean = selector;

    // Remove :not(...) blocks
    clean = clean.replace(/:not\([^)]*\)/g, '');

    // Remove pseudo-states
    for (const state of PSEUDO_STATES) {
        clean = clean.replace(new RegExp(`:${state}\\b`, 'g'), '');
    }

    // Remove pseudo-elements
    clean = clean.replace(/::(before|after|placeholder|first-line|first-letter|selection|marker)/g, '');

    return clean.trim();
}

function extractClassNames(selector: string): string[] {
    // Extract class names from selector: ".button.primary" → ["button", "primary"]
    // Also handles ".sm .input.hasLeftIcon" → ["sm", "input", "hasLeftIcon"]
    const matches = selector.match(/\.([a-zA-Z_][\w-]*)/g);
    if (!matches) return [];
    return matches.map(m => m.substring(1)); // Remove leading dot
}

// ─── Query Helpers ──────────────────────────────────────────────

/**
 * Get the CSS rules that apply for a specific variant + size + state combination.
 * This is used by the Design tab to show only relevant properties.
 */
export function getActiveRules(
    parsed: ParsedCSSModule,
    selectedVariant?: string,
    selectedSize?: string,
    activeState?: string
): ParsedCSSRule[] {
    const active: ParsedCSSRule[] = [];

    // 1. Base rules (no pseudo-state filter — always show base)
    for (const rule of parsed.base) {
        if (activeState && activeState !== 'default') {
            // When a state is active, show base rules with that state
            if (rule.pseudoStates?.includes(activeState)) {
                active.push(rule);
            }
            // Also show base rules without any pseudo-state (they still apply)
            if (!rule.pseudoStates || rule.pseudoStates.length === 0) {
                active.push(rule);
            }
        } else {
            // Default state: show only rules without pseudo-states
            if (!rule.pseudoStates || rule.pseudoStates.length === 0) {
                active.push(rule);
            }
        }
    }

    // 2. Selected variant rules
    if (selectedVariant && parsed.variants[selectedVariant]) {
        for (const rule of parsed.variants[selectedVariant]) {
            if (activeState && activeState !== 'default') {
                if (rule.pseudoStates?.includes(activeState)) {
                    active.push(rule);
                }
                if (!rule.pseudoStates || rule.pseudoStates.length === 0) {
                    active.push(rule);
                }
            } else {
                if (!rule.pseudoStates || rule.pseudoStates.length === 0) {
                    active.push(rule);
                }
            }
        }
    }

    // 3. Selected size rules
    if (selectedSize && parsed.sizes[selectedSize]) {
        for (const rule of parsed.sizes[selectedSize]) {
            if (activeState && activeState !== 'default') {
                if (rule.pseudoStates?.includes(activeState)) {
                    active.push(rule);
                }
                if (!rule.pseudoStates || rule.pseudoStates.length === 0) {
                    active.push(rule);
                }
            } else {
                if (!rule.pseudoStates || rule.pseudoStates.length === 0) {
                    active.push(rule);
                }
            }
        }
    }

    return active;
}

/**
 * Merge all applicable CSS properties into a single flat list
 * with correct cascade order: base → variant → size → state overrides.
 * 
 * Later rules override earlier ones (variant overrides base, state overrides non-state).
 * Each property includes the correct selector for writeback.
 */
export interface MergedCSSProperty {
    property: string;          // camelCase CSS prop name
    value: CSSPropertyValue;   // The winning value after cascade
    selector: string;          // Original selector for writeback
    source: 'base' | 'variant' | 'size' | 'state'; // Where the winning value came from
}

export function getMergedProperties(
    parsed: ParsedCSSModule,
    selectedVariant?: string,
    selectedSize?: string,
    activeState?: string
): MergedCSSProperty[] {
    // Map: property name → MergedCSSProperty
    const propMap = new Map<string, MergedCSSProperty>();

    // Helper to process rules with a given source tag
    const processRules = (rules: ParsedCSSRule[], source: MergedCSSProperty['source']) => {
        for (const rule of rules) {
            for (const [prop, value] of Object.entries(rule.properties)) {
                propMap.set(prop, { property: prop, value, selector: rule.selector, source });
            }
        }
    };



    // 1. Base rules (no pseudo-state)
    const baseNormal = parsed.base.filter(r => !r.pseudoStates?.length);
    processRules(baseNormal, 'base');

    // 2. Variant rules (no pseudo-state) — override base
    if (selectedVariant && parsed.variants[selectedVariant]) {
        const variantNormal = parsed.variants[selectedVariant].filter(r => !r.pseudoStates?.length);
        processRules(variantNormal, 'variant');
    }

    // 3. Size rules (no pseudo-state) — override variant/base
    if (selectedSize && parsed.sizes[selectedSize]) {
        const sizeNormal = parsed.sizes[selectedSize].filter(r => !r.pseudoStates?.length && !r.subElement);
        processRules(sizeNormal, 'size');
    }

    // 4. State-specific overrides — override everything above
    if (activeState && activeState !== 'default') {
        // Base state rules
        const baseStates = parsed.base.filter(r => r.pseudoStates?.includes(activeState));
        processRules(baseStates, 'state');

        // Variant state rules
        if (selectedVariant && parsed.variants[selectedVariant]) {
            const variantStates = parsed.variants[selectedVariant].filter(r => r.pseudoStates?.includes(activeState));
            processRules(variantStates, 'state');
        }
    }

    // Convert to sorted array (maintain insertion order for consistency)
    return Array.from(propMap.values());
}

/**
 * Get all sub-element names found in the CSS module.
 */
export function getSubElementNames(parsed: ParsedCSSModule): string[] {
    return Object.keys(parsed.subElements);
}

/**
 * Get rules for a specific sub-element.
 */
export function getSubElementRules(
    parsed: ParsedCSSModule,
    subElement: string,
    selectedSize?: string
): ParsedCSSRule[] {
    const rules = parsed.subElements[subElement] || [];

    if (!selectedSize) return rules;

    // Filter to show only rules matching the selected size or with no size
    return rules.filter(r => !r.sizeName || r.sizeName === selectedSize);
}

/**
 * Find the correct selector to target when writing a CSS change.
 * Returns the original selector from the CSS file.
 */
export function findWritebackSelector(
    parsed: ParsedCSSModule,
    cssProp: string,
    selectedVariant?: string,
    selectedSize?: string,
    activeState?: string,
    subElement?: string
): string | null {
    // Get the rules that match the current selection
    let targetRules: ParsedCSSRule[];

    if (subElement) {
        targetRules = parsed.subElements[subElement] || [];
    } else {
        targetRules = getActiveRules(parsed, selectedVariant, selectedSize, activeState);
    }

    // Find the rule that currently defines this property
    for (const rule of targetRules) {
        if (rule.properties[cssProp]) {
            return rule.selector;
        }
    }

    // If property doesn't exist yet, determine best selector to add it to
    // Priority: variant+state > variant > size > base
    if (activeState && activeState !== 'default' && selectedVariant) {
        const stateRules = targetRules.filter(r => r.pseudoStates?.includes(activeState));
        if (stateRules.length > 0) return stateRules[0].selector;
    }

    if (selectedVariant && parsed.variants[selectedVariant]?.length) {
        const noState = parsed.variants[selectedVariant].filter(r => !r.pseudoStates?.length);
        if (noState.length > 0) return noState[0].selector;
    }

    if (selectedSize && parsed.sizes[selectedSize]?.length) {
        const noState = parsed.sizes[selectedSize].filter(r => !r.pseudoStates?.length);
        if (noState.length > 0) return noState[0].selector;
    }

    if (parsed.base.length > 0) {
        const noState = parsed.base.filter(r => !r.pseudoStates?.length);
        if (noState.length > 0) return noState[0].selector;
    }

    return null;
}
