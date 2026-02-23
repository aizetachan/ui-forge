/**
 * CodeBlock — Always-editable syntax highlighted code block.
 *
 * Architecture:
 *   Wrapper (overflow: auto, max-height) ← SINGLE scroll container
 *     └─ Inner (display: inline-block, min-width: 100%) — expands to content width
 *         ├─ Pre (normal flow, sizes inner, pointer-events: none)
 *         └─ Textarea (absolute, same size as inner, overflow: hidden)
 *
 * The wrapper scrolls BOTH layers together (horizontal + vertical).
 * The inner div expands to the widest line, so textarea covers all text.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import 'highlight.js/styles/github-dark.css';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);

// Shared text styling — identical on both pre and textarea
const TEXT_STYLE: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    tabSize: 2,
    whiteSpace: 'pre',
    wordBreak: 'keep-all',
    overflowWrap: 'normal',
    padding: '12px',
    margin: 0,
    border: 'none',
    letterSpacing: 'normal',
    wordSpacing: 'normal',
    boxSizing: 'border-box' as const,
};

interface CodeBlockProps {
    code: string;
    language: 'tsx' | 'css';
    label: string;
    onChange?: (newCode: string) => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, label, onChange }) => {
    const [copied, setCopied] = useState(false);
    const [localCode, setLocalCode] = useState(code);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { setLocalCode(code); }, [code]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(localCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [localCode]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLocalCode(val);
        onChange?.(val);
    }, [onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const s = ta.selectionStart;
            const end = ta.selectionEnd;
            const v = localCode.substring(0, s) + '  ' + localCode.substring(end);
            setLocalCode(v);
            onChange?.(v);
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = s + 2;
                    textareaRef.current.selectionEnd = s + 2;
                }
            });
        }
    }, [localCode, onChange]);

    const hljsLang = language === 'tsx' ? 'typescript' : 'css';
    let highlighted = '';
    try {
        highlighted = hljs.highlight(localCode, { language: hljsLang }).value;
    } catch {
        highlighted = localCode.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    if (!highlighted.endsWith('\n')) highlighted += '\n';
    const displayCode = localCode.endsWith('\n') ? localCode : localCode + '\n';

    return (
        <div style={{ borderRadius: 8, border: '1px solid #27272a', overflow: 'hidden', background: '#0d1117' }}>
            {/* Header bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 12px', borderBottom: '1px solid #27272a', background: 'rgba(255,255,255,0.03)',
            }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                </span>
                <button
                    onClick={handleCopy}
                    style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4ade80' : '#71717a', display: 'flex' }}
                    title="Copy code"
                >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
            </div>

            {/* Scroll wrapper — the ONLY element that scrolls */}
            <div style={{ maxHeight: 500, overflow: 'auto' }}>
                {/* Inner container — expands to the widest line using inline-block */}
                <div style={{ position: 'relative', display: 'inline-block', minWidth: '100%' }}>
                    {/* Highlighted layer — in normal flow, sizes the inner div */}
                    <pre
                        aria-hidden="true"
                        style={{
                            ...TEXT_STYLE,
                            pointerEvents: 'none',
                            background: 'transparent',
                            color: '#c9d1d9',
                            minHeight: 60,
                        }}
                    >
                        <code
                            className={`hljs language-${hljsLang}`}
                            dangerouslySetInnerHTML={{ __html: highlighted }}
                            style={{ background: 'transparent' }}
                        />
                    </pre>

                    {/* Textarea — absolute, same size as inner, captures all input */}
                    <textarea
                        ref={textareaRef}
                        value={displayCode}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        spellCheck={false}
                        style={{
                            ...TEXT_STYLE,
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            color: 'transparent',
                            caretColor: '#e4e4e7',
                            background: 'transparent',
                            outline: 'none',
                            resize: 'none',
                            overflow: 'hidden',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
