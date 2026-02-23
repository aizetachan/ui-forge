/**
 * EffectsSection
 * 
 * Opacity, cursor, overflow, pointer-events, user-select, transition, transform.
 * Uses VisualSectionProps — reads merged CSS values and writes to file on change.
 */

import React from 'react';
import { Eclipse } from 'lucide-react';
import { SectionTitle, TokenInput } from '../primitives';
import { VisualSectionProps } from '../types';

export const EffectsSection: React.FC<VisualSectionProps> = ({
    isOpen,
    onToggle,
    getValue,
    onPropertyChange,
    tokens,
}) => (
    <>
        <SectionTitle title="Effects" icon={Eclipse} isOpen={isOpen} onToggle={onToggle} />
        {isOpen && (
            <div className="p-4 space-y-4">
                <TokenInput
                    label="OPACITY"
                    value={getValue('opacity') || '1'}
                    onChange={val => onPropertyChange('opacity', val)}
                    placeholder="0, 0.5, 1"
                    tokens={tokens}
                />
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1.5 block">CURSOR</label>
                        <select
                            value={getValue('cursor') || 'auto'}
                            onChange={e => onPropertyChange('cursor', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                        >
                            {['auto', 'default', 'pointer', 'wait', 'text', 'move', 'not-allowed', 'grab', 'grabbing'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1.5 block">OVERFLOW</label>
                        <select
                            value={getValue('overflow') || 'visible'}
                            onChange={e => onPropertyChange('overflow', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                        >
                            <option value="visible">Visible</option>
                            <option value="hidden">Hidden</option>
                            <option value="scroll">Scroll</option>
                            <option value="auto">Auto</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800/50">
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1.5 block">POINTER EVENTS</label>
                        <select
                            value={getValue('pointerEvents') || 'auto'}
                            onChange={e => onPropertyChange('pointerEvents', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                        >
                            <option value="auto">auto</option>
                            <option value="none">none</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1.5 block">USER SELECT</label>
                        <select
                            value={getValue('userSelect') || 'auto'}
                            onChange={e => onPropertyChange('userSelect', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                        >
                            <option value="auto">auto</option>
                            <option value="none">none</option>
                            <option value="text">text</option>
                            <option value="all">all</option>
                        </select>
                    </div>
                </div>
                <div className="pt-3 border-t border-zinc-800/50 space-y-3">
                    <TokenInput
                        label="TRANSITION"
                        value={getValue('transition')}
                        onChange={val => onPropertyChange('transition', val)}
                        placeholder="all 0.2s ease, color 0.3s"
                        tokens={tokens}
                    />
                    <TokenInput
                        label="TRANSFORM"
                        value={getValue('transform')}
                        onChange={val => onPropertyChange('transform', val)}
                        placeholder="none, scale(1.1), rotate(45deg)"
                        tokens={tokens}
                    />
                </div>
            </div>
        )}
    </>
);
