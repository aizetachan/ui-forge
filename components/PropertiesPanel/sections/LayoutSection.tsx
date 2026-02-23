/**
 * LayoutSection
 * 
 * Display mode, flexbox controls, gap, width/height (3-col grid), padding/margin (side-by-side 2x2).
 * Uses VisualSectionProps — reads merged CSS values and writes to file on change.
 */

import React from 'react';
import {
    Layout, Box,
    MoveHorizontal, MoveVertical, Maximize2,
    AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';
import { SectionTitle, TokenButton } from '../primitives';
import { VisualSectionProps } from '../types';

/** Small input with optional token picker — pill-shaped for the sizing grid */
const SizingInput: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    tokens?: { name: string; value: string; type?: string }[];
}> = ({ label, value, onChange, tokens }) => (
    <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '9px', color: '#71717a', marginBottom: '3px', fontWeight: 600 }}>{label}</div>
        <div className="relative" style={{
            display: 'flex',
            alignItems: 'center',
            background: '#09090b',
            borderRadius: '8px',
            border: '1px solid #27272a',
            overflow: 'visible',
        }}>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                title={value || undefined}
                style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#d4d4d8',
                    fontSize: '11px',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                    padding: '5px 6px',
                    paddingRight: tokens && tokens.length > 0 ? '22px' : '6px',
                    minWidth: 0,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                }}
            />
            {tokens && tokens.length > 0 && (
                <TokenButton tokens={tokens} onSelect={onChange} />
            )}
        </div>
    </div>
);

/** Small input for padding/margin cells — with token picker */
const SpacingInput: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    tokens?: { name: string; value: string; type?: string }[];
}> = ({ label, value, onChange, tokens }) => (
    <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '8px', color: '#52525b', marginBottom: '2px' }}>{label}</div>
        <div className="relative" style={{
            background: '#09090b',
            borderRadius: '8px',
            border: '1px solid #27272a',
            overflow: 'visible',
        }}>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                title={value || undefined}
                style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: '#d4d4d8',
                    fontSize: '10px',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                    padding: '5px 4px',
                    paddingRight: tokens && tokens.length > 0 ? '22px' : '4px',
                    textAlign: 'center',
                    outline: 'none',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                }}
            />
            {tokens && tokens.length > 0 && (
                <TokenButton tokens={tokens} onSelect={onChange} />
            )}
        </div>
    </div>
);

export const LayoutSection: React.FC<VisualSectionProps> = ({
    isOpen,
    onToggle,
    getValue,
    onPropertyChange,
    tokens,
}) => {
    const displayValue = getValue('display') || '';
    const isFlex = displayValue === 'flex' || displayValue === 'inline-flex';

    return (
        <>
            <SectionTitle title="Layout" icon={Layout} isOpen={isOpen} onToggle={onToggle} />
            {isOpen && (
                <div className="p-4 space-y-4">
                    {/* Display Mode */}
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1.5 block">DISPLAY</label>
                        <div className="flex bg-zinc-950 p-1 rounded-md border border-zinc-800">
                            {['block', 'flex', 'grid', 'inline-flex', 'none'].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => onPropertyChange('display', d)}
                                    className={`flex-1 py-1 text-[10px] font-medium rounded capitalize ${displayValue === d ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {d === 'inline-flex' ? 'Inline' : d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Flex Controls — shown when display is flex */}
                    {isFlex && (
                        <div className="space-y-3 pt-2 border-t border-zinc-800/50 animate-in fade-in slide-in-from-top-1">
                            {/* Direction */}
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-medium text-zinc-400">Direction</span>
                                <div className="flex bg-zinc-950 rounded border border-zinc-800 p-0.5 gap-0.5">
                                    <button onClick={() => onPropertyChange('flexDirection', 'row')} className={`p-1 rounded hover:bg-zinc-800 ${(!getValue('flexDirection') || getValue('flexDirection') === 'row') ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`} title="Row"><MoveHorizontal className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => onPropertyChange('flexDirection', 'column')} className={`p-1 rounded hover:bg-zinc-800 ${getValue('flexDirection') === 'column' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`} title="Column"><MoveVertical className="w-3.5 h-3.5" /></button>
                                    <div className="w-px bg-zinc-800 mx-0.5"></div>
                                    <button onClick={() => onPropertyChange('flexWrap', getValue('flexWrap') === 'wrap' ? 'nowrap' : 'wrap')} className={`p-1 rounded hover:bg-zinc-800 ${getValue('flexWrap') === 'wrap' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`} title="Wrap"><Maximize2 className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>

                            {/* Justify + Align */}
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <div className="text-[8px] text-zinc-600 mb-1">Justify</div>
                                    <div className="bg-zinc-950 rounded border border-zinc-800 p-0.5 flex justify-between">
                                        {([['flex-start', AlignLeft], ['center', AlignCenter], ['space-between', AlignRight]] as [string, typeof AlignLeft][]).map(([val, Icon]) => (
                                            <button key={val} onClick={() => onPropertyChange('justifyContent', val)} className={`p-1 rounded flex-1 flex justify-center ${getValue('justifyContent') === val ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}><Icon className="w-3.5 h-3.5" /></button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="text-[8px] text-zinc-600 mb-1">Align</div>
                                    <div className="bg-zinc-950 rounded border border-zinc-800 p-0.5 flex justify-between">
                                        {([['flex-start', AlignLeft, '-rotate-90'], ['center', AlignCenter, '-rotate-90'], ['flex-end', AlignLeft, 'rotate-90']] as [string, typeof AlignLeft, string][]).map(([val, Icon, rotate]) => (
                                            <button key={val} onClick={() => onPropertyChange('alignItems', val)} className={`p-1 rounded flex-1 flex justify-center ${getValue('alignItems') === val ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}><Icon className={`w-3.5 h-3.5 ${rotate}`} /></button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Gap */}
                            <SizingInput label="GAP" value={getValue('gap')} onChange={v => onPropertyChange('gap', v)} tokens={tokens} />
                        </div>
                    )}

                    {/* Width & Height — 3-column grid: W / MIN W / MAX W, then H / MIN H / MAX H */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '6px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(39,39,42,0.5)',
                    }}>
                        <SizingInput label="W" value={getValue('width')} onChange={v => onPropertyChange('width', v)} tokens={tokens} />
                        <SizingInput label="MIN W" value={getValue('minWidth')} onChange={v => onPropertyChange('minWidth', v)} tokens={tokens} />
                        <SizingInput label="MAX W" value={getValue('maxWidth')} onChange={v => onPropertyChange('maxWidth', v)} tokens={tokens} />
                        <SizingInput label="H" value={getValue('height')} onChange={v => onPropertyChange('height', v)} tokens={tokens} />
                        <SizingInput label="MIN H" value={getValue('minHeight')} onChange={v => onPropertyChange('minHeight', v)} tokens={tokens} />
                        <SizingInput label="MAX H" value={getValue('maxHeight')} onChange={v => onPropertyChange('maxHeight', v)} tokens={tokens} />
                    </div>

                    {/* Padding & Margin — side by side, each with 2x2 grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(39,39,42,0.5)',
                    }}>
                        {/* Padding */}
                        <div>
                            <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase mb-2">
                                <Box className="w-3 h-3" /> Padding
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '4px',
                            }}>
                                <SpacingInput label="T" value={getValue('paddingTop')} onChange={v => onPropertyChange('paddingTop', v)} tokens={tokens} />
                                <SpacingInput label="R" value={getValue('paddingRight')} onChange={v => onPropertyChange('paddingRight', v)} tokens={tokens} />
                                <SpacingInput label="B" value={getValue('paddingBottom')} onChange={v => onPropertyChange('paddingBottom', v)} tokens={tokens} />
                                <SpacingInput label="L" value={getValue('paddingLeft')} onChange={v => onPropertyChange('paddingLeft', v)} tokens={tokens} />
                            </div>
                        </div>
                        {/* Margin */}
                        <div>
                            <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase mb-2">
                                <Box className="w-3 h-3 border-dashed border border-current p-px" /> Margin
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '4px',
                            }}>
                                <SpacingInput label="T" value={getValue('marginTop')} onChange={v => onPropertyChange('marginTop', v)} tokens={tokens} />
                                <SpacingInput label="R" value={getValue('marginRight')} onChange={v => onPropertyChange('marginRight', v)} tokens={tokens} />
                                <SpacingInput label="B" value={getValue('marginBottom')} onChange={v => onPropertyChange('marginBottom', v)} tokens={tokens} />
                                <SpacingInput label="L" value={getValue('marginLeft')} onChange={v => onPropertyChange('marginLeft', v)} tokens={tokens} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
