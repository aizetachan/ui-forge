/**
 * OtherPropertiesSection
 * 
 * Catch-all section for CSS properties not covered by the visual sections
 * (Layout, Fill & Border, Typography, Effects, Position).
 * Uses the same row format as CSSPropertiesSection for consistency.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MoreHorizontal, ChevronDown, ChevronRight } from 'lucide-react';
import { SectionTitle } from '../primitives';
import { VisualSectionProps } from '../types';

/** Set of all properties handled by visual sections — used to exclude them */
export const VISUAL_SECTION_PROPS = new Set([
    // Layout
    'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems',
    'gap', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    // Also match shorthand padding/margin (camelCase)
    'padding', 'margin',
    // Fill & Border
    'backgroundColor', 'border', 'borderWidth', 'borderStyle', 'borderColor',
    'borderRadius', 'boxShadow', 'outline', 'outlineColor',
    // Typography
    'color', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight',
    'letterSpacing', 'textAlign', 'textDecoration', 'textTransform',
    'whiteSpace', 'wordBreak',
    // Effects
    'opacity', 'cursor', 'overflow', 'pointerEvents', 'userSelect',
    'transition', 'transform',
    // Position
    'position', 'top', 'right', 'bottom', 'left', 'zIndex',
]);

/** Convert camelCase to kebab-case for display */
function toKebab(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

interface OtherPropertiesSectionProps extends VisualSectionProps {
    /** List of property names present in the merged CSS */
    propertyNames: string[];
}

export const OtherPropertiesSection: React.FC<OtherPropertiesSectionProps> = ({
    isOpen,
    onToggle,
    getValue,
    onPropertyChange,
    propertyNames,
}) => {
    // Filter to only uncovered properties
    const otherProps = propertyNames.filter(p => !VISUAL_SECTION_PROPS.has(p));

    if (otherProps.length === 0) return null;

    return (
        <>
            <SectionTitle title="Other Properties" icon={MoreHorizontal} isOpen={isOpen} onToggle={onToggle} />
            {isOpen && (
                <div style={{ padding: '0 12px 8px 12px' }}>
                    {otherProps.map(prop => (
                        <OtherPropertyRow
                            key={prop}
                            property={prop}
                            value={getValue(prop)}
                            onChange={(val) => onPropertyChange(prop, val)}
                        />
                    ))}
                </div>
            )}
        </>
    );
};

// ─── Individual Property Row (simplified) ────────────────────────

interface OtherPropertyRowProps {
    property: string;
    value: string;
    onChange: (value: string) => void;
}

const OtherPropertyRow: React.FC<OtherPropertyRowProps> = ({
    property,
    value,
    onChange,
}) => {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    // Sync when value changes externally
    useEffect(() => {
        if (!editing) setEditValue(value);
    }, [value, editing]);

    const handleSubmit = useCallback(() => {
        onChange(editValue);
        setEditing(false);
    }, [editValue, onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') {
            setEditValue(value);
            setEditing(false);
        }
    }, [handleSubmit, value]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 0',
            fontSize: '11px',
        }}>
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
                        setEditValue(value);
                        setEditing(true);
                    }}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: value && /^var\(/.test(value) ? '#818cf8' : '#d4d4d8',
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
                    title={value}
                >
                    {value || '—'}
                </button>
            )}
        </div>
    );
};
