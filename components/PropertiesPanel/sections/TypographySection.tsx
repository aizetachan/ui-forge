/**
 * TypographySection
 * 
 * Text color, font family, font size, weight, line height, letter spacing,
 * text align, text decoration, text transform, white space, word break.
 * Uses VisualSectionProps — reads merged CSS values and writes to file on change.
 */

import React from 'react';
import {
    Type, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Underline, Strikethrough, Baseline,
    CaseSensitive, CaseUpper, CaseLower,
} from 'lucide-react';
import { SectionTitle, ColorField, TokenInput } from '../primitives';
import { VisualSectionProps } from '../types';

export const TypographySection: React.FC<VisualSectionProps> = ({
    isOpen,
    onToggle,
    getValue,
    onPropertyChange,
    computedStyles,
    tokens,
}) => (
    <>
        <SectionTitle title="Typography" icon={Type} isOpen={isOpen} onToggle={onToggle} />
        {isOpen && (
            <div className="p-4 space-y-3">
                {/* Text Color */}
                <ColorField
                    label="COLOR"
                    value={getValue('color')}
                    computedValue={computedStyles?.color}
                    onChange={val => onPropertyChange('color', val)}
                    placeholder="#000, rgb(), var(--token)"
                    tokens={tokens}
                />

                {/* FONT FAMILY + SIZE — same row */}
                <div className="grid grid-cols-[1fr_80px] gap-2">
                    <TokenInput
                        label="FONT FAMILY"
                        value={getValue('fontFamily')}
                        onChange={val => onPropertyChange('fontFamily', val)}
                        placeholder="Inter, sans-serif"
                        tokens={tokens}
                    />
                    <TokenInput
                        label="SIZE"
                        value={getValue('fontSize')}
                        onChange={val => onPropertyChange('fontSize', val)}
                        placeholder="14px"
                        tokens={tokens}
                    />
                </div>

                {/* WEIGHT + LINE HEIGHT + LETTER SPACING — same row */}
                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1 block">WEIGHT</label>
                        <select
                            value={getValue('fontWeight') || ''}
                            onChange={e => onPropertyChange('fontWeight', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                        >
                            <option value="">inherit</option>
                            <option value="100">100</option>
                            <option value="300">300</option>
                            <option value="400">400</option>
                            <option value="500">500</option>
                            <option value="600">600</option>
                            <option value="700">700</option>
                            <option value="800">800</option>
                            <option value="900">900</option>
                        </select>
                    </div>
                    <TokenInput
                        label="LINE HEIGHT"
                        value={getValue('lineHeight')}
                        onChange={val => onPropertyChange('lineHeight', val)}
                        placeholder="1.5"
                        tokens={tokens}
                    />
                    <TokenInput
                        label="SPACING"
                        value={getValue('letterSpacing')}
                        onChange={val => onPropertyChange('letterSpacing', val)}
                        placeholder="0"
                        tokens={tokens}
                    />
                </div>

                {/* ALIGN + DECORATION + TRANSFORM — icon button row */}
                <div className="flex items-end gap-3">
                    {/* Text Align */}
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1 block">ALIGN</label>
                        <div className="flex bg-zinc-950 rounded border border-zinc-800 p-0.5">
                            {[
                                { val: 'left', Icon: AlignLeft },
                                { val: 'center', Icon: AlignCenter },
                                { val: 'right', Icon: AlignRight },
                                { val: 'justify', Icon: AlignJustify },
                            ].map(({ val, Icon }) => (
                                <button
                                    key={val}
                                    onClick={() => onPropertyChange('textAlign', val)}
                                    className={`p-1 rounded ${getValue('textAlign') === val ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                ><Icon className="w-3 h-3" /></button>
                            ))}
                        </div>
                    </div>

                    {/* Text Decoration */}
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1 block">DECORATION</label>
                        <div className="flex bg-zinc-950 rounded border border-zinc-800 p-0.5">
                            {[
                                { val: 'none', label: '—' },
                                { val: 'underline', Icon: Underline },
                                { val: 'line-through', Icon: Strikethrough },
                                { val: 'overline', Icon: Baseline },
                            ].map(({ val, label, Icon }) => (
                                <button
                                    key={val}
                                    onClick={() => onPropertyChange('textDecoration', val)}
                                    className={`p-1 rounded ${getValue('textDecoration') === val ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    title={val}
                                >
                                    {Icon ? <Icon className="w-3 h-3" /> : <span className="text-[10px] w-3 h-3 flex items-center justify-center">{label}</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Text Transform */}
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1 block">TRANSFORM</label>
                        <div className="flex bg-zinc-950 rounded border border-zinc-800 p-0.5">
                            {[
                                { val: 'none', label: '—' },
                                { val: 'uppercase', Icon: CaseUpper },
                                { val: 'lowercase', Icon: CaseLower },
                                { val: 'capitalize', Icon: CaseSensitive },
                            ].map(({ val, label, Icon }) => (
                                <button
                                    key={val}
                                    onClick={() => onPropertyChange('textTransform', val)}
                                    className={`p-1 rounded ${getValue('textTransform') === val ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    title={val}
                                >
                                    {Icon ? <Icon className="w-3 h-3" /> : <span className="text-[10px] w-3 h-3 flex items-center justify-center">{label}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Divider + White Space / Word Break */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800/50">
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1 block">WHITE SPACE</label>
                        <select
                            value={getValue('whiteSpace') || ''}
                            onChange={e => onPropertyChange('whiteSpace', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                        >
                            <option value="">inherit</option>
                            <option value="normal">normal</option>
                            <option value="nowrap">nowrap</option>
                            <option value="pre">pre</option>
                            <option value="pre-wrap">pre-wrap</option>
                            <option value="pre-line">pre-line</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold mb-1 block">WORD BREAK</label>
                        <select
                            value={getValue('wordBreak') || ''}
                            onChange={e => onPropertyChange('wordBreak', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                        >
                            <option value="">inherit</option>
                            <option value="normal">normal</option>
                            <option value="break-all">break-all</option>
                            <option value="break-word">break-word</option>
                            <option value="keep-all">keep-all</option>
                        </select>
                    </div>
                </div>
            </div>
        )}
    </>
);
