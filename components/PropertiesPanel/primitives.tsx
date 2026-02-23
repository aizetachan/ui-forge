/**
 * PropertiesPanel UI Primitives
 * 
 * Shared, reusable UI components used across all panel sections.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// ── Section Title ──────────────────────────────────────────

interface SectionTitleProps {
    title: string;
    icon: React.FC<{ className?: string }>;
    isOpen: boolean;
    onToggle: () => void;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, icon: Icon, isOpen, onToggle }) => (
    <button onClick={onToggle} className="w-full flex items-center justify-between p-3 bg-zinc-900/50 hover:bg-zinc-800 transition-colors border-y border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <Icon className="w-3.5 h-3.5" />
            {title}
        </div>
        <div className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        </div>
    </button>
);

// ── Input Group ────────────────────────────────────────────

interface InputGroupProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    tokens?: Array<{ name: string; value: string; type: string }>;
}

export const InputGroup: React.FC<InputGroupProps> = ({ label, value, onChange, placeholder, tokens }) => (
    <div className="flex items-center gap-2">
        <label className="text-[10px] text-zinc-500 font-bold w-12">
            {label}
        </label>
        <div className="flex-1 relative">
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} title={value || undefined} className={`w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white outline-none font-mono focus:border-blue-500 text-ellipsis overflow-hidden ${tokens && tokens.length > 0 ? 'pr-6' : ''}`} />
            {tokens && tokens.length > 0 && <TokenButton tokens={tokens} onSelect={onChange} />}
        </div>
    </div>
);

// ── Color Field ────────────────────────────────────────────

interface ColorFieldProps {
    label?: string;
    value: string;
    computedValue?: string;
    onChange: (val: string) => void;
    placeholder?: string;
    tokens?: Array<{ name: string; value: string; type: string }>;
}

/**
 * Color field with inline swatch + text input inside a single container.
 * The swatch sits inside the input field on the left, with native color picker.
 */
export const ColorField: React.FC<ColorFieldProps> = ({ label, value, computedValue, onChange, placeholder, tokens }) => {
    const displayValue = value || computedValue || '';
    const swatchColor = computedValue || value || 'transparent';

    return (
        <div>
            {label && (
                <label className="text-[10px] text-zinc-500 font-bold mb-1 block">
                    {label}
                </label>
            )}
            <div className="relative flex items-center bg-zinc-950 border border-zinc-800 rounded overflow-visible">
                {/* Color swatch with native picker — inside the field */}
                <div className="relative w-4 h-4 shrink-0 ml-1.5 rounded-sm border border-zinc-700 overflow-hidden cursor-pointer">
                    <div className="absolute inset-0 opacity-20" style={{
                        backgroundImage: `linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)`,
                        backgroundSize: '4px 4px'
                    }}></div>
                    <div className="absolute inset-0" style={{ backgroundColor: swatchColor }}></div>
                    <input
                        type="color"
                        value={swatchColor.startsWith('#') ? swatchColor : '#000000'}
                        onChange={e => onChange(e.target.value)}
                        className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0 opacity-0"
                    />
                </div>
                {/* Text input */}
                <input
                    type="text"
                    value={displayValue}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder || '#hex, rgb(), var(--token)'}
                    title={displayValue || undefined}
                    className={`flex-1 bg-transparent border-none px-2 py-1 text-xs text-white font-mono outline-none min-w-0 text-ellipsis overflow-hidden ${tokens && tokens.length > 0 ? 'pr-6' : ''}`}
                />
                {tokens && tokens.length > 0 && <TokenButton tokens={tokens} onSelect={onChange} />}
            </div>
        </div>
    );
};

// ── Token Input — text input with inline ◆ token picker ──────

interface TokenInputProps {
    label?: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    tokens?: Array<{ name: string; value: string; type?: string }>;
}

/**
 * Text input with optional ◆ token picker button inline.
 * Use this for any CSS value field that can accept a var(--token).
 */
export const TokenInput: React.FC<TokenInputProps> = ({ label, value, onChange, placeholder, tokens }) => (
    <div>
        {label && <label className="text-[10px] text-zinc-500 font-bold mb-1 block">{label}</label>}
        <div className="relative">
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                title={value || undefined}
                className={`w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-blue-500 text-ellipsis overflow-hidden ${tokens && tokens.length > 0 ? 'pr-6' : ''}`}
            />
            {tokens && tokens.length > 0 && <TokenButton tokens={tokens} onSelect={onChange} />}
        </div>
    </div>
);

import ReactDOM from 'react-dom';

// ── Token Button + Dropdown ───────────────────────────────

interface TokenButtonProps {
    tokens: Array<{ name: string; value: string; type?: string }>;
    onSelect: (value: string) => void;
}

/**
 * Small ◆ button that opens a dropdown to pick a CSS variable/token.
 * The button is `absolute right-1` inside its parent container.
 * The dropdown is rendered via a portal with `position: fixed` so it
 * escapes all overflow ancestors and always appears above the button.
 */
export const TokenButton: React.FC<TokenButtonProps> = ({ tokens, onSelect }) => {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const btnRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const filterRef = useRef<HTMLInputElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    // Compute fixed position when opening
    useEffect(() => {
        if (!open || !btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        // Dropdown width = 224px (w-56), height up to 192px (max-h-48)
        const dropdownW = 224;
        const dropdownH = 192;
        // Position above the button, aligned to the right edge
        let top = rect.top - dropdownH - 4;
        let left = rect.right - dropdownW;
        // If not enough space above, show below
        if (top < 8) top = rect.bottom + 4;
        // Clamp left
        if (left < 8) left = 8;
        setPos({ top, left });
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current?.contains(target)) return;
            if (dropdownRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus filter input when opened
    useEffect(() => {
        if (open && filterRef.current) filterRef.current.focus();
    }, [open, pos]);

    const filtered = filter
        ? tokens.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
        : tokens;

    return (
        <>
            <button
                ref={btnRef}
                onClick={() => { setOpen(!open); setFilter(''); }}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold hover:bg-zinc-700 text-indigo-400 hover:text-indigo-300 transition-colors z-10"
                title="Pick token variable"
            >
                ◆
            </button>

            {open && pos && ReactDOM.createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: pos.top,
                        left: pos.left,
                        width: 224,
                        maxHeight: 192,
                        zIndex: 9999,
                    }}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden flex flex-col"
                >
                    <input
                        ref={filterRef}
                        type="text"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="Search tokens..."
                        className="w-full px-2 py-1.5 text-[10px] bg-zinc-950 border-b border-zinc-700 text-white outline-none shrink-0"
                    />
                    <div className="overflow-y-auto flex-1">
                        {filtered.map((t, i) => (
                            <button
                                key={`${t.name}-${i}`}
                                onClick={() => { onSelect(`var(${t.name})`); setOpen(false); }}
                                className="w-full text-left px-2 py-1 text-[10px] font-mono text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                {t.type === 'color' && (
                                    <span className="w-3 h-3 rounded-sm shrink-0 border border-zinc-600" style={{ backgroundColor: t.value }} />
                                )}
                                <span className="truncate text-indigo-300">{t.name}</span>
                                <span className="ml-auto text-zinc-600 truncate max-w-[60px]">{t.value}</span>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <div className="px-2 py-2 text-[10px] text-zinc-600 text-center">No tokens found</div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

// ── Unset Dot (kept for CSSPropertiesSection backward compat) ──

export const UnsetDot: React.FC = () => (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="No value from source — editable via overrides" />
);
