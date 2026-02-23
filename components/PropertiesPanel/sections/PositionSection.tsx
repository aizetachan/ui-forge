/**
 * PositionSection
 * 
 * Position type, inset values, z-index.
 * Uses VisualSectionProps — reads merged CSS values and writes to file on change.
 */

import React from 'react';
import { Move } from 'lucide-react';
import { SectionTitle, InputGroup } from '../primitives';
import { VisualSectionProps } from '../types';

export const PositionSection: React.FC<VisualSectionProps> = ({
    isOpen,
    onToggle,
    getValue,
    onPropertyChange,
    tokens,
}) => {
    const posValue = getValue('position') || 'static';

    return (
        <>
            <SectionTitle title="Position" icon={Move} isOpen={isOpen} onToggle={onToggle} />
            {isOpen && (
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1 block">POSITION</label>
                        <select
                            value={posValue}
                            onChange={(e) => onPropertyChange('position', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white outline-none uppercase focus:border-blue-500"
                        >
                            {['static', 'relative', 'absolute', 'fixed', 'sticky'].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    {posValue !== 'static' && (
                        <>
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1">
                                {(['top', 'right', 'bottom', 'left'] as const).map(dir => (
                                    <InputGroup
                                        key={dir}
                                        label={dir.charAt(0).toUpperCase()}
                                        value={getValue(dir)}
                                        onChange={(v) => onPropertyChange(dir, v)}
                                        placeholder="0, 10px, auto"
                                        tokens={tokens}
                                    />
                                ))}
                            </div>
                            <InputGroup
                                label="Z-Index"
                                value={getValue('zIndex')}
                                onChange={(v) => onPropertyChange('zIndex', v)}
                                placeholder="auto, 0, 10, 50"
                            />
                        </>
                    )}
                </div>
            )}
        </>
    );
};
