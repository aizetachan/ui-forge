/**
 * CSSPropertiesSection
 * 
 * Renders a collapsible section of CSS properties from parsed CSS rules.
 * Each property shows its name, value (with variable detection), and an edit input.
 * Color values show a swatch preview. Variable values show the variable name.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import type { ParsedCSSRule, CSSPropertyValue, MergedCSSProperty } from '../../../lib/cssModuleParser';

/** Default/empty CSS values to hide in the computed-only section — reduces clutter */
const TRIVIAL_VALUES = new Set([
    '0px', '0', 'none', 'normal', 'auto', 'visible', 'static',
    'start', 'stretch', 'baseline', 'ease', 'medium', '""',
    'content-box', 'border-box', 'transparent',
]);

interface CSSPropertiesSectionProps {
    /** Section title (e.g. "Base", "primary", "md") */
    title: string;
    /** Optional subtitle (e.g. ":hover") */
    subtitle?: string;
    /** CSS rules to display */
    rules: ParsedCSSRule[];
    /** F2: Pre-merged properties from getMergedProperties (used for __main__ view) */
    mergedProperties?: MergedCSSProperty[];
    /** Whether section starts expanded */
    defaultOpen?: boolean;
    /** Called when a property value is changed */
    onPropertyChange: (selector: string, property: string, value: string) => void;
    /** Computed styles from sandbox for showing resolved values */
    computedStyles?: Record<string, string> | null;
    /** Available tokens for variable picker */
    tokens?: Array<{ name: string; value: string; type: string }>;
    /** Live style overrides from the panel — shown instead of original values */
    styleOverrides?: Record<string, string | number>;
    /** Base selector for writing new (computed-only) properties to CSS */
    baseSelector?: string;
}

/** Color-related CSS properties */
const COLOR_PROPS = new Set([
    'color', 'backgroundColor', 'borderColor', 'outlineColor',
    'boxShadow', 'textShadow', 'fill', 'stroke',
]);

/** Check if a value looks like a color */
function isColorValue(value: string): boolean {
    if (!value) return false;
    return /^(#|rgb|hsl|oklch|lch|lab|hwb|color\()/.test(value) ||
        /^(transparent|currentColor|inherit)$/i.test(value);
}

/** Try to resolve a CSS variable to a color for swatch preview */
function getSwatchColor(prop: string, propValue: CSSPropertyValue, computedValue?: string, overrideValue?: string): string | null {
    if (!COLOR_PROPS.has(prop)) return null;

    // E1: Prioritize override value (from panel edits) for immediate feedback
    if (overrideValue && isColorValue(overrideValue)) return overrideValue;
    // Check if override is a var() — try to use computed value instead
    if (overrideValue && /^var\(/.test(overrideValue) && computedValue && isColorValue(computedValue)) return computedValue;

    // Use computed value if available
    if (computedValue && isColorValue(computedValue)) return computedValue;

    // Use raw value if it's a direct color
    if (isColorValue(propValue.raw)) return propValue.raw;

    return null;
}

export const CSSPropertiesSection: React.FC<CSSPropertiesSectionProps> = ({
    title,
    subtitle,
    rules,
    mergedProperties: externalMerged,
    defaultOpen = false,
    onPropertyChange,
    computedStyles,
    tokens,
    styleOverrides,
    baseSelector,
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    // If mergedProperties is provided externally, use it directly.
    // Otherwise compute from rules (backward-compatible).
    const mergedProperties = React.useMemo(() => {
        if (externalMerged) {
            return externalMerged.map(m => ({
                property: m.property,
                value: m.value,
                selector: m.selector,
            }));
        }

        // Merge all properties from all rules for display
        // Later rules override earlier ones (CSS cascade)
        const merged: {
            property: string;
            value: CSSPropertyValue;
            selector: string;
        }[] = [];
        const seen = new Set<string>();

        for (const rule of rules) {
            const props = rule.properties;
            for (const prop of Object.keys(props)) {
                if (!seen.has(prop)) {
                    seen.add(prop);
                    merged.push({ property: prop, value: props[prop], selector: rule.selector });
                }
            }
        }

        return merged;
    }, [rules, externalMerged]);

    // Build undeclared computed-only properties
    const computedOnlyProps = React.useMemo(() => {
        if (!computedStyles || !baseSelector) return [];
        const declaredKeys = new Set(mergedProperties.map(m => m.property));
        return Object.entries(computedStyles)
            .filter(([prop, val]) => !declaredKeys.has(prop) && val && !TRIVIAL_VALUES.has(String(val).trim()))
            .map(([prop, val]) => ({
                property: prop,
                value: { raw: val, isVariable: false } as CSSPropertyValue,
                selector: baseSelector,
            }));
    }, [computedStyles, baseSelector, mergedProperties]);

    const [showComputed, setShowComputed] = useState(false);

    if (mergedProperties.length === 0 && computedOnlyProps.length === 0) return null;

    return (
        <div style={{
            borderBottom: '1px solid rgba(39, 39, 42, 0.6)',
        }}>
            {/* Section Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#e4e4e7',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    textAlign: 'left',
                }}
            >
                {isOpen
                    ? <ChevronDown style={{ width: 12, height: 12, color: '#71717a' }} />
                    : <ChevronRight style={{ width: 12, height: 12, color: '#71717a' }} />
                }
                <span>{title}</span>
                {subtitle && (
                    <span style={{
                        fontSize: '10px',
                        color: '#6366f1',
                        fontWeight: 500,
                        padding: '1px 5px',
                        background: 'rgba(99, 102, 241, 0.1)',
                        borderRadius: '3px',
                    }}>
                        {subtitle}
                    </span>
                )}
                <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    color: '#52525b',
                    fontWeight: 400,
                }}>
                    {mergedProperties.length}{computedOnlyProps.length > 0 ? ` + ${computedOnlyProps.length}` : ''}
                </span>
            </button>

            {/* Properties List */}
            {isOpen && (
                <div style={{ padding: '0 12px 8px 12px' }}>
                    {/* Declared CSS properties */}
                    {mergedProperties.map(({ property, value, selector }) => (
                        <CSSPropertyRow
                            key={`${selector}-${property}`}
                            property={property}
                            value={value}
                            selector={selector}
                            computedValue={computedStyles?.[property]}
                            onPropertyChange={onPropertyChange}
                            tokens={tokens}
                            overrideValue={styleOverrides?.[property] != null ? String(styleOverrides[property]) : undefined}
                        />
                    ))}

                    {/* Computed-only properties — not declared in CSS, from browser computed styles */}
                    {computedOnlyProps.length > 0 && (
                        <>
                            <button
                                onClick={() => setShowComputed(!showComputed)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    width: '100%',
                                    padding: '6px 0 4px',
                                    marginTop: '4px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderTop: '1px solid rgba(63, 63, 70, 0.3)',
                                    cursor: 'pointer',
                                    color: '#52525b',
                                    fontSize: '9px',
                                    fontWeight: 600,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                }}
                            >
                                {showComputed
                                    ? <ChevronDown style={{ width: 10, height: 10 }} />
                                    : <ChevronRight style={{ width: 10, height: 10 }} />
                                }
                                Computed ({computedOnlyProps.length})
                            </button>
                            {showComputed && (
                                <div style={{ opacity: 0.7 }}>
                                    {computedOnlyProps.map(({ property, value, selector }) => (
                                        <CSSPropertyRow
                                            key={`computed-${property}`}
                                            property={property}
                                            value={value}
                                            selector={selector}
                                            computedValue={computedStyles?.[property]}
                                            onPropertyChange={onPropertyChange}
                                            tokens={tokens}
                                            overrideValue={styleOverrides?.[property] != null ? String(styleOverrides[property]) : undefined}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Individual Property Row ────────────────────────────────────

interface CSSPropertyRowProps {
    property: string;
    value: CSSPropertyValue;
    selector: string;
    computedValue?: string;
    onPropertyChange: (selector: string, property: string, value: string) => void;
    tokens?: Array<{ name: string; value: string; type: string }>;
    /** Override value from panel edits — takes precedence over value.raw for display */
    overrideValue?: string;
}

/** Convert camelCase to kebab-case for display */
function toKebab(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

const CSSPropertyRow: React.FC<CSSPropertyRowProps> = ({
    property,
    value,
    selector,
    computedValue,
    onPropertyChange,
    tokens,
    overrideValue,
}) => {
    const [editing, setEditing] = useState(false);
    // Display override value if present, otherwise original CSS value
    const displayValue = overrideValue ?? value.raw;
    const [editValue, setEditValue] = useState(displayValue);
    const [showTokens, setShowTokens] = useState(false);
    const tokenDropdownRef = useRef<HTMLDivElement>(null);

    // F5: Close token picker on outside click
    useEffect(() => {
        if (!showTokens) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(e.target as Node)) {
                setShowTokens(false);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowTokens(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showTokens]);

    const swatchColor = getSwatchColor(property, value, computedValue, overrideValue);

    const handleSubmit = useCallback(() => {
        onPropertyChange(selector, property, editValue);
        setEditing(false);
    }, [selector, property, editValue, onPropertyChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') {
            setEditValue(displayValue);
            setEditing(false);
        }
    }, [handleSubmit, displayValue]);

    // Sync editValue when override changes (e.g., token picked while not editing)
    React.useEffect(() => {
        if (!editing) {
            setEditValue(displayValue);
        }
    }, [displayValue, editing]);

    const handleTokenSelect = useCallback((tokenVariable: string) => {
        const newValue = `var(${tokenVariable})`;
        setEditValue(newValue);
        onPropertyChange(selector, property, newValue);
        setShowTokens(false);
    }, [selector, property, onPropertyChange]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 0',
            fontSize: '11px',
            position: 'relative',
        }}>
            {/* Property Name */}
            <span style={{
                color: '#a1a1aa',
                minWidth: '90px',
                flexShrink: 0,
                fontFamily: 'monospace',
                fontSize: '10px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}
                title={toKebab(property)}
            >
                {toKebab(property)}
            </span>

            {/* Color Swatch */}
            {swatchColor && (
                <div style={{
                    width: 14,
                    height: 14,
                    borderRadius: '3px',
                    border: '1px solid rgba(63, 63, 70, 0.8)',
                    backgroundColor: swatchColor,
                    flexShrink: 0,
                    cursor: 'pointer',
                }}
                    title={computedValue || value.raw}
                />
            )}

            {/* Value Input */}
            {editing ? (
                <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSubmit}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    style={{
                        flex: 1,
                        background: 'rgba(9, 9, 11, 0.8)',
                        border: '1px solid rgba(99, 102, 241, 0.5)',
                        borderRadius: '3px',
                        color: '#e4e4e7',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        padding: '2px 4px',
                        outline: 'none',
                        minWidth: 0,
                    }}
                />
            ) : (
                <button
                    onClick={() => {
                        setEditValue(displayValue);
                        setEditing(true);
                    }}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: value.isVariable ? '#818cf8' : '#d4d4d8',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        textAlign: 'left',
                        cursor: 'text',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                    }}
                    title={value.raw + (computedValue ? ` → ${computedValue}` : '')}
                >
                    {overrideValue
                        ? overrideValue
                        : value.isVariable && value.variableName
                            ? value.variableName.replace(/^--/, '')
                            : value.raw
                    }
                </button>
            )}

            {/* Variable indicator / token picker trigger — E7: show for all eligible properties */}
            {tokens && tokens.length > 0 && (
                <button
                    onClick={() => setShowTokens(!showTokens)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6366f1',
                        fontSize: '10px',
                        cursor: 'pointer',
                        padding: '0 2px',
                        flexShrink: 0,
                    }}
                    title="Pick token"
                >
                    ◆
                </button>
            )}

            {/* Inline Token Picker Dropdown */}
            {showTokens && tokens && (
                <div ref={tokenDropdownRef} style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    zIndex: 50,
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    padding: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    minWidth: '180px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                    {tokens
                        .filter(t => {
                            // Filter tokens by property type
                            if (COLOR_PROPS.has(property)) return t.type === 'color';
                            if (['fontSize', 'lineHeight', 'fontWeight'].includes(property)) return t.type === 'typography';
                            if (['borderRadius'].includes(property)) return t.type === 'radius';
                            return t.type === 'spacing';
                        })
                        .map(token => (
                            <button
                                key={token.name}
                                onClick={() => handleTokenSelect(token.name)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    width: '100%',
                                    padding: '4px 8px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#d4d4d8',
                                    fontSize: '10px',
                                    fontFamily: 'monospace',
                                    cursor: 'pointer',
                                    borderRadius: '3px',
                                    textAlign: 'left',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                {token.type === 'color' && (
                                    <div style={{
                                        width: 10, height: 10,
                                        borderRadius: '2px',
                                        backgroundColor: token.value,
                                        border: '1px solid #3f3f46',
                                    }} />
                                )}
                                <span style={{ color: '#818cf8' }}>{token.name}</span>
                                <span style={{ color: '#52525b', marginLeft: 'auto' }}>{token.value}</span>
                            </button>
                        ))
                    }
                </div>
            )}
        </div>
    );
};
