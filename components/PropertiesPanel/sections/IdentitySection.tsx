/**
 * IdentitySection
 * 
 * Component name, HTML tag, content, variant selectors, state selector (pills),
 * and prop controls (booleans in 2 columns).
 * Shows all editable properties with their actual values from the component.
 */

import React, { useState, useRef, useCallback } from 'react';
import { ComponentNode, ElementType } from '../../../types';
import type { ForceState } from '../../StateSelector';

interface IdentitySectionProps {
    component: ComponentNode;
    onUpdateComponent: (updated: ComponentNode) => void;
    writePropToFile: (propName: string, value: any) => void;
    /** Available pseudo-states extracted from CSS (e.g. ['hover','focus','active']) */
    availableStates?: string[];
    forceState?: ForceState;
    onForceStateChange?: (state: ForceState) => void;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({
    component,
    onUpdateComponent,
    writePropToFile,
    availableStates,
    forceState = 'default',
    onForceStateChange,
}) => {
    const [propsExpanded, setPropsExpanded] = useState(false);

    // Build state options from available CSS pseudo-states
    const stateOptions = React.useMemo(() => {
        if (!availableStates || availableStates.length === 0) return [];
        // Always include 'default' first, then the states found in CSS
        const opts: { value: ForceState; label: string }[] = [
            { value: 'default', label: 'Default' },
        ];
        for (const s of availableStates) {
            const label = s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ');
            opts.push({ value: s as ForceState, label });
        }
        return opts;
    }, [availableStates]);

    return (
        <div className="px-4 py-2 space-y-2">

            {/* Variant & State Selectors — dropdowns in 2-column grid */}
            {(() => {
                const variantPropDefs = (component.propDefs || []).filter(def =>
                    def.type === 'enum' && def.options && def.options.length > 0 &&
                    component.variants?.some(v => def.options!.includes(v.cssClass))
                );

                const hasVariants = variantPropDefs.length > 0;
                const hasStates = stateOptions.length > 0 && onForceStateChange;

                if (!hasVariants && !hasStates) return null;

                return (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        {variantPropDefs.map(def => {
                            const currentVal = def.name === 'size'
                                ? (component.selectedSize || component.props?.size || '')
                                : (component.selectedVariant || component.props?.variant || '');
                            return (
                                <div key={def.name}>
                                    <label className="text-[10px] text-zinc-500 font-bold mb-1 block">{def.name.toUpperCase()}</label>
                                    <select
                                        value={currentVal}
                                        onChange={e => {
                                            const opt = e.target.value;
                                            onUpdateComponent({
                                                ...component,
                                                props: { ...component.props, [def.name]: opt },
                                                ...(def.name === 'size'
                                                    ? { selectedSize: opt }
                                                    : { selectedVariant: opt }),
                                            });
                                            writePropToFile(def.name, opt);
                                        }}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 capitalize"
                                    >
                                        {def.options!.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}

                        {hasStates && (
                            <div>
                                <label className="text-[10px] text-zinc-500 font-bold mb-1 block">STATE</label>
                                <select
                                    value={forceState}
                                    onChange={e => onForceStateChange!(e.target.value as ForceState)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 capitalize"
                                >
                                    {stateOptions.map(({ value, label }) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Controls (Props) - Shows all editable props except those with dedicated UI */}
            {component.propDefs && component.propDefs.length > 0 && (() => {
                const variantPropNames = component.propDefs!
                    .filter(def =>
                        def.type === 'enum' && def.options && def.options.length > 0 &&
                        component.variants?.some(v => def.options!.includes(v.cssClass))
                    )
                    .map(def => def.name);

                const editableProps = component.propDefs!.filter(def =>
                    !variantPropNames.includes(def.name)
                );

                if (editableProps.length === 0) return null;

                const booleanProps = editableProps.filter(d => d.type === 'boolean');
                const otherProps = editableProps.filter(d => d.type !== 'boolean');

                return (
                    <div className="space-y-2 pt-2 border-t border-zinc-800/50 mt-2">
                        {otherProps.length > 0 && (
                            <div>
                                <button
                                    onClick={() => setPropsExpanded(prev => !prev)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '0 0 6px 0',
                                        width: '100%',
                                    }}
                                >
                                    <span style={{
                                        fontSize: '8px',
                                        color: '#71717a',
                                        transition: 'transform 0.15s ease',
                                        transform: propsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    }}>▶</span>
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        color: '#71717a',
                                        letterSpacing: '0.05em',
                                    }}>PROPS</span>
                                    <span style={{
                                        fontSize: '9px',
                                        color: '#52525b',
                                        marginLeft: '2px',
                                    }}>{otherProps.length}</span>
                                </button>
                                {propsExpanded && (
                                    <div className="space-y-3">
                                        {otherProps.map(def => (
                                            <div key={def.name} className="flex flex-col gap-1">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs text-zinc-400 font-medium">{def.name}</label>
                                                    <span className="text-[9px] text-zinc-600 font-mono">{def.type}</span>
                                                </div>

                                                {/* Enum Select */}
                                                {def.type === 'enum' && def.options && (
                                                    <select
                                                        value={String(component.props[def.name] !== undefined ? component.props[def.name] : (def.defaultValue !== undefined ? def.defaultValue : ''))}
                                                        onChange={e => {
                                                            onUpdateComponent({ ...component, props: { ...component.props, [def.name]: e.target.value } });
                                                            writePropToFile(def.name, e.target.value);
                                                        }}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                                                    >
                                                        <option value="">Select...</option>
                                                        {def.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                )}

                                                {/* String/Number Input */}
                                                {(def.type === 'string' || def.type === 'number') && (
                                                    <input
                                                        type={def.type === 'number' ? 'number' : 'text'}
                                                        value={component.props[def.name] !== undefined ? component.props[def.name] : ''}
                                                        onChange={e => {
                                                            const newVal = def.type === 'number' ? Number(e.target.value) : e.target.value;
                                                            onUpdateComponent({ ...component, props: { ...component.props, [def.name]: newVal } });
                                                        }}
                                                        onBlur={e => {
                                                            const newVal = def.type === 'number' ? Number(e.target.value) : e.target.value;
                                                            writePropToFile(def.name, newVal);
                                                        }}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                                                        placeholder={def.defaultValue !== undefined ? String(def.defaultValue) : ''}
                                                    />
                                                )}

                                                {/* JSON Editor for arrays and objects */}
                                                {(def.type === 'array' || def.type === 'object') && (
                                                    <textarea
                                                        value={(() => {
                                                            const val = component.props[def.name] ?? def.defaultValue;
                                                            if (val === undefined || val === null) return '';
                                                            try { return JSON.stringify(val, null, 2); } catch { return String(val); }
                                                        })()}
                                                        onChange={e => {
                                                            try {
                                                                const parsed = JSON.parse(e.target.value);
                                                                onUpdateComponent({ ...component, props: { ...component.props, [def.name]: parsed } });
                                                            } catch {
                                                                // Allow invalid JSON while typing
                                                            }
                                                        }}
                                                        onBlur={e => {
                                                            try {
                                                                const parsed = JSON.parse(e.target.value);
                                                                writePropToFile(def.name, parsed);
                                                            } catch {
                                                                // Don't write invalid JSON
                                                            }
                                                        }}
                                                        rows={3}
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white font-mono focus:border-blue-500 outline-none resize-y"
                                                        placeholder={def.type === 'array' ? '["item1", "item2"]' : '{ "key": "value" }'}
                                                    />
                                                )}

                                                {/* Function callback indicator (read-only) */}
                                                {def.type === 'function' && (
                                                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-950 border border-zinc-800/50 rounded text-[10px] text-zinc-500 italic">
                                                        <span>⚡</span>
                                                        <span>Event callback</span>
                                                    </div>
                                                )}

                                                {/* ReactNode Toggle */}
                                                {(def.type === 'reactnode' || def.type === 'reactelement') && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                const isActive = !!component.props[def.name];
                                                                const newVal = isActive ? null : '⬡';
                                                                onUpdateComponent({
                                                                    ...component,
                                                                    props: { ...component.props, [def.name]: newVal },
                                                                });
                                                                writePropToFile(def.name, newVal);
                                                            }}
                                                            className={`flex-1 text-left px-2 py-1.5 rounded text-xs border transition-colors flex items-center justify-between ${component.props[def.name]
                                                                ? 'bg-indigo-600/10 border-indigo-600/50 text-indigo-400'
                                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                                                                }`}
                                                        >
                                                            <span>🧩 {component.props[def.name] ? 'Enabled' : 'Disabled'}</span>
                                                            <div className={`w-2 h-2 rounded-full ${component.props[def.name] ? 'bg-indigo-500' : 'bg-zinc-600'}`} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Boolean props — 2-column compact toggle switches */}
                        {booleanProps.length > 0 && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '2px 8px',
                            }}>
                                {booleanProps.map(def => {
                                    const ICON_PROPS = /^(icon|leftIcon|rightIcon|leftElement|rightElement|startIcon|endIcon|prefix|suffix|adornment|trigger)$/;
                                    const isIconProp = ICON_PROPS.test(def.name);
                                    const currentVal = component.props[def.name];
                                    const isActive = !!currentVal;

                                    return (
                                        <button
                                            key={def.name}
                                            onClick={() => {
                                                const newVal = isIconProp
                                                    ? (isActive ? null : '⬡')
                                                    : !currentVal;
                                                onUpdateComponent({ ...component, props: { ...component.props, [def.name]: newVal } });
                                                writePropToFile(def.name, newVal);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '5px 0',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                minWidth: 0,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <span style={{
                                                fontSize: '11px',
                                                color: isActive ? '#e4e4e7' : '#71717a',
                                                fontWeight: 500,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                minWidth: 0,
                                                marginRight: '6px',
                                            }}>{def.name}</span>
                                            {/* Mini toggle switch */}
                                            <div style={{
                                                width: '28px',
                                                height: '16px',
                                                borderRadius: '8px',
                                                backgroundColor: isActive ? '#6366f1' : '#27272a',
                                                position: 'relative',
                                                transition: 'background-color 0.2s ease',
                                                flexShrink: 0,
                                            }}>
                                                <div style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#fff',
                                                    position: 'absolute',
                                                    top: '2px',
                                                    left: isActive ? '14px' : '2px',
                                                    transition: 'left 0.2s ease',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                                }} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div >
                );
            })()}
        </div >
    );
};
