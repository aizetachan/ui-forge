/**
 * AppearanceSection
 * 
 * Background color, border toggle + controls, border radius, box shadow, outline.
 * Uses VisualSectionProps — reads merged CSS values and writes to file on change.
 */

import React from 'react';
import { Palette } from 'lucide-react';
import { SectionTitle, ColorField, TokenInput } from '../primitives';
import { VisualSectionProps } from '../types';

export const AppearanceSection: React.FC<VisualSectionProps> = ({
    isOpen,
    onToggle,
    getValue,
    onPropertyChange,
    computedStyles,
    tokens,
}) => {
    // Border is "on" when: shorthand is not "none", or individual props indicate a border
    const borderRaw = getValue('border');
    const borderStyle = getValue('borderStyle');
    const borderWidth = getValue('borderWidth');
    const hasBorder = (() => {
        // Check shorthand first
        if (borderRaw === 'none' || borderRaw === '0') return false;
        if (borderRaw && borderRaw !== '') return true;
        // Check individual properties
        if (borderStyle === 'none') return false;
        if (borderWidth === '0' || borderWidth === '0px') return false;
        if (borderStyle && borderStyle !== '') return true;
        if (borderWidth && borderWidth !== '') return true;
        return false;
    })();

    const handleBorderToggle = () => {
        if (hasBorder) {
            // Single call to turn off
            onPropertyChange('border', 'none');
        } else {
            // Single call to turn on with shorthand
            onPropertyChange('border', '1px solid #3f3f46');
        }
    };

    return (
        <>
            <SectionTitle title="Fill & Border" icon={Palette} isOpen={isOpen} onToggle={onToggle} />
            {isOpen && (
                <div className="p-4 space-y-4">
                    {/* Background color — inline swatch */}
                    <ColorField
                        label="BACKGROUND"
                        value={getValue('backgroundColor')}
                        computedValue={computedStyles?.backgroundColor}
                        onChange={val => onPropertyChange('backgroundColor', val)}
                        placeholder="#fff, rgb(), var(--token)"
                        tokens={tokens}
                    />

                    {/* Border toggle */}
                    <div className="pt-3 border-t border-zinc-800/50">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase">Border</label>
                            <button
                                onClick={handleBorderToggle}
                                className={`relative w-7 h-4 rounded-full transition-colors ${hasBorder ? 'bg-blue-600' : 'bg-zinc-700'}`}
                            >
                                <span
                                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${hasBorder ? 'left-3.5' : 'left-0.5'}`}
                                />
                            </button>
                        </div>

                        {/* Border fields — visible only when border is on */}
                        {hasBorder && (
                            <div className="mt-3 space-y-3">
                                {/* Border Color */}
                                <ColorField
                                    label="BORDER COLOR"
                                    value={getValue('borderColor')}
                                    computedValue={computedStyles?.borderColor}
                                    onChange={val => onPropertyChange('borderColor', val)}
                                    placeholder="#color, var(--token)"
                                    tokens={tokens}
                                />

                                {/* WIDTH / STYLE — 2-column row */}
                                <div className="grid grid-cols-2 gap-2">
                                    <TokenInput
                                        label="WIDTH"
                                        value={getValue('borderWidth')}
                                        onChange={val => onPropertyChange('borderWidth', val)}
                                        placeholder="1px"
                                        tokens={tokens}
                                    />
                                    <div>
                                        <label className="text-[10px] text-zinc-500 font-bold mb-1 block">STYLE</label>
                                        <select
                                            value={getValue('borderStyle') || ''}
                                            onChange={e => onPropertyChange('borderStyle', e.target.value)}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                        >
                                            <option value="solid">solid</option>
                                            <option value="dashed">dashed</option>
                                            <option value="dotted">dotted</option>
                                            <option value="double">double</option>
                                            <option value="groove">groove</option>
                                            <option value="none">none</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RADIUS / SHADOW / OUTLINE — bottom row */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800/50">
                        <TokenInput
                            label="RADIUS"
                            value={getValue('borderRadius')}
                            onChange={val => onPropertyChange('borderRadius', val)}
                            placeholder="0, 4px"
                            tokens={tokens}
                        />
                        <TokenInput
                            label="SHADOW"
                            value={getValue('boxShadow')}
                            onChange={val => onPropertyChange('boxShadow', val)}
                            placeholder="none"
                            tokens={tokens}
                        />
                        <TokenInput
                            label="OUTLINE"
                            value={getValue('outline')}
                            onChange={val => onPropertyChange('outline', val)}
                            placeholder="none"
                            tokens={tokens}
                        />
                    </div>
                </div>
            )}
        </>
    );
};
