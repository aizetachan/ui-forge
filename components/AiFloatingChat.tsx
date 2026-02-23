/**
 * AiFloatingChat
 * 
 * Standalone floating chat window for the AI assistant.
 * Supports text responses and action proposals with Allow/Deny approval.
 * Draggable, portal-rendered, anchored to bottom-left.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { MessageSquare, Send, RefreshCw, Trash2, X, Minus, Check, XCircle, Wrench } from 'lucide-react';
import { ComponentNode, Repository } from '../types';
import {
    askAssistant,
    confirmAction,
    AiMessage,
    AiAction,
    AiResponse,
    RepoContext,
} from '../services/geminiService';

interface AiFloatingChatProps {
    component: ComponentNode | null;
    repo?: Repository;
    visible: boolean;
    onClose: () => void;
    onMinimize: () => void;
    onCSSChange?: (prop: string, value: string) => void;
    onPropChange?: (prop: string, value: any) => void;
    onVariantChange?: (variantCssClass: string) => void;
}

export const AiFloatingChat: React.FC<AiFloatingChatProps> = ({
    component,
    repo,
    visible,
    onClose,
    onMinimize,
    onCSSChange,
    onPropChange,
    onVariantChange,
}) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Drag logic ───
    const PANEL_W = 360;
    const PANEL_H = 520;
    const SIDEBAR_W = 256;
    const PROPS_PANEL_W = 320;
    const MIN_X = SIDEBAR_W;

    const [useTop, setUseTop] = useState(false);
    const defaultPos = useMemo(() => ({
        x: SIDEBAR_W + 16,
        y: 16,
    }), []);

    const [position, setPosition] = useState(defaultPos);
    const posRef = useRef(defaultPos);
    const dragRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({ dragging: false, offsetX: 0, offsetY: 0 });

    useEffect(() => { posRef.current = position; }, [position]);

    const createOverlay = useCallback(() => {
        if (overlayRef.current) return;
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;inset:0;z-index:9998;cursor:grabbing;';
        document.body.appendChild(el);
        overlayRef.current = el;
    }, []);
    const removeOverlay = useCallback(() => {
        if (overlayRef.current) { overlayRef.current.remove(); overlayRef.current = null; }
    }, []);

    const MIN_Y = 80;
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!dragRef.current.dragging) return;
            const maxX = window.innerWidth - PROPS_PANEL_W - PANEL_W;
            const newX = Math.max(MIN_X, Math.min(maxX, e.clientX - dragRef.current.offsetX));
            const newY = Math.max(MIN_Y, e.clientY - dragRef.current.offsetY);
            setPosition({ x: newX, y: newY });
        };
        const onMouseUp = () => {
            if (!dragRef.current.dragging) return;
            dragRef.current.dragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            removeOverlay();
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            removeOverlay();
        };
    }, [removeOverlay]);

    const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (!useTop) {
            const panelEl = panelRef.current;
            if (panelEl) {
                const rect = panelEl.getBoundingClientRect();
                posRef.current = { x: rect.left, y: rect.top };
                setPosition({ x: rect.left, y: rect.top });
                setUseTop(true);
            }
        }
        const cur = posRef.current;
        dragRef.current = {
            dragging: true,
            offsetX: e.clientX - cur.x,
            offsetY: e.clientY - cur.y,
        };
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        createOverlay();
    }, [createOverlay, useTop]);

    // ─── Build context ───
    const buildContext = useCallback((): RepoContext | undefined => {
        if (!repo) return undefined;

        const ctx: RepoContext = {
            repoName: repo.name,
            componentNames: repo.components.map(c => c.name),
            tokenCount: repo.tokens.length,
            selectedComponent: component?.name,
            selectedComponentProps: component?.propDefs?.map(p => `${p.name}: ${p.type}`),
        };

        // Deep component context
        if (component) {
            ctx.componentDetails = {
                name: component.name,
                tagName: component.tagName,
                variants: component.variants?.map(v => ({ name: v.name, type: v.type, cssClass: v.cssClass })),
                propDefs: component.propDefs?.map(p => ({
                    name: p.name, type: p.type, defaultValue: p.defaultValue, options: p.options,
                })),
                content: component.content,
            };
        }

        // Tokens by type
        if (repo.tokens.length > 0) {
            const byType: Record<string, Array<{ name: string; value: string }>> = {};
            for (const t of repo.tokens) {
                if (!byType[t.type]) byType[t.type] = [];
                byType[t.type].push({ name: t.name, value: t.value });
            }
            ctx.tokensByType = byType;
        }

        return ctx;
    }, [component, repo]);

    // ─── Execute action ───
    const executeAction = useCallback((action: AiAction) => {
        switch (action.tool) {
            case 'set_css_property':
                onCSSChange?.(action.args.property, action.args.value);
                break;
            case 'set_component_prop':
                onPropChange?.(action.args.propName, action.args.value);
                break;
            case 'set_variant':
                onVariantChange?.(action.args.variantCssClass);
                break;
        }
    }, [onCSSChange, onPropChange, onVariantChange]);

    // ─── Handle approval ───
    const handleApproval = useCallback(async (msgIndex: number, approved: boolean) => {
        const msg = messages[msgIndex];
        if (!msg.action || msg.action.status !== 'pending') return;

        // Update the action status
        const updatedMessages = [...messages];
        updatedMessages[msgIndex] = {
            ...msg,
            action: { ...msg.action, status: approved ? 'approved' : 'denied' },
        };
        setMessages(updatedMessages);

        if (approved) {
            executeAction(msg.action);
        }

        // Get AI's follow-up response
        setIsLoading(true);
        try {
            const response = await confirmAction(msg.action, approved, buildContext());
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (e) {
            setError('Failed to get follow-up response.');
        } finally {
            setIsLoading(false);
        }
    }, [messages, executeAction, buildContext]);

    // ─── Send message ───
    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMessage: AiMessage = { role: 'user', content: trimmed };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setError(null);
        setIsLoading(true);

        try {
            const result: AiResponse = await askAssistant(
                trimmed,
                buildContext(),
                messages,
                repo ? { components: repo.components, tokens: repo.tokens } : undefined,
            );

            if (result.type === 'text') {
                setMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
            } else if (result.type === 'action') {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: result.action.description,
                    action: result.action,
                }]);
            }
        } catch (e) {
            setError('Failed to get response. Check your API key in .env.local.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleClear = () => {
        setMessages([]);
        setError(null);
    };

    // ─── Render ───
    if (!visible) return null;

    return ReactDOM.createPortal(
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                left: position.x,
                ...(useTop
                    ? { top: position.y }
                    : { bottom: position.y }),
                width: PANEL_W,
                height: PANEL_H,
                zIndex: 9999,
            }}
            className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden flex flex-col"
        >
            {/* Draggable header */}
            <div
                onMouseDown={onHeaderMouseDown}
                className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0"
                style={{ cursor: 'grab' }}
            >
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">AI Assistant</span>
                </div>
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={onMinimize}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="Minimize (keep conversation)"
                    >
                        <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Close (new conversation)"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="text-xs text-zinc-500 text-center py-8 px-4 leading-relaxed">
                        Ask about {component?.name ? `"${component.name}"` : 'your components'}, props, variants, or tokens.
                        <br /><br />
                        <span className="text-zinc-600">You can also ask me to change CSS properties or switch variants — I'll ask for your approval first.</span>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i}>
                        {/* Action proposal card */}
                        {msg.action ? (
                            <div className="rounded-lg border border-zinc-700 overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 border-b border-zinc-700/50">
                                    <Wrench className="w-3 h-3 text-amber-400" />
                                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                                        {msg.action.tool.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <div className="px-3 py-2.5">
                                    <div className="text-xs text-zinc-300 font-mono">{msg.action.description}</div>
                                </div>
                                {msg.action.status === 'pending' ? (
                                    <div className="flex border-t border-zinc-700/50">
                                        <button
                                            onClick={() => handleApproval(i, true)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-green-400 hover:bg-green-950/30 transition-colors border-r border-zinc-700/50"
                                        >
                                            <Check className="w-3 h-3" />
                                            Allow
                                        </button>
                                        <button
                                            onClick={() => handleApproval(i, false)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 transition-colors"
                                        >
                                            <XCircle className="w-3 h-3" />
                                            Deny
                                        </button>
                                    </div>
                                ) : (
                                    <div className={`px-3 py-1.5 text-[10px] font-medium border-t border-zinc-700/50 ${msg.action.status === 'approved'
                                        ? 'text-green-500 bg-green-950/20'
                                        : 'text-red-500 bg-red-950/20'
                                        }`}>
                                        {msg.action.status === 'approved' ? '✓ Approved & executed' : '✗ Denied'}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Regular message bubble */
                            <div
                                className={`text-xs leading-relaxed rounded-lg p-2.5 ${msg.role === 'user'
                                    ? 'bg-blue-600/20 text-blue-200 ml-6'
                                    : 'bg-zinc-800 text-zinc-300 mr-2'
                                    }`}
                            >
                                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500 p-2">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Thinking...
                    </div>
                )}
                {error && (
                    <div className="text-xs text-red-400 p-2 bg-red-950/30 rounded">
                        {error}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-zinc-800 p-2 flex gap-2 shrink-0">
                <textarea
                    placeholder={`Ask about ${component?.name || 'your components'}...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none resize-none"
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    title="Send"
                >
                    <Send className="w-3 h-3" />
                </button>
                {messages.length > 0 && (
                    <button
                        onClick={handleClear}
                        className="px-2 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-400"
                        title="Clear chat"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>,
        document.body,
    );
};
