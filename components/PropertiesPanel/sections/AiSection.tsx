/**
 * AiSection
 * 
 * Chat-based AI assistant for the Properties Panel.
 * Allows users to ask questions about the connected repository,
 * its components, props, variants, and design tokens.
 * 
 * Future: execute actions like modifying CSS, creating variants, etc.
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, RefreshCw, Trash2 } from 'lucide-react';
import { SectionTitle } from '../primitives';
import { ComponentNode, Repository } from '../../../types';
import { askAssistant, AiMessage, RepoContext } from '../../../services/geminiService';

interface AiSectionProps {
    component: ComponentNode;
    repo?: Repository;
    isOpen: boolean;
    onToggle: () => void;
}

export const AiSection: React.FC<AiSectionProps> = ({
    component,
    repo,
    isOpen,
    onToggle,
}) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Build repo context from current state
    const buildContext = (): RepoContext | undefined => {
        if (!repo) return undefined;
        return {
            repoName: repo.name,
            componentNames: repo.components.map(c => c.name),
            tokenCount: repo.tokens.length,
            selectedComponent: component?.name,
            selectedComponentProps: component?.propDefs?.map(p => `${p.name}: ${p.type}`),
        };
    };

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
            const response = await askAssistant(trimmed, buildContext(), messages);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
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

    return (
        <>
            <SectionTitle title="AI Assistant" icon={MessageSquare} isOpen={isOpen} onToggle={onToggle} />
            {isOpen && (
                <div className="flex flex-col bg-zinc-900/30" style={{ maxHeight: '400px' }}>
                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: '120px', maxHeight: '300px' }}>
                        {messages.length === 0 && (
                            <div className="text-xs text-zinc-500 text-center py-4">
                                Ask about {component?.name ? `"${component.name}"` : 'your components'}, props, variants, or tokens...
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`text-xs leading-relaxed rounded-lg p-2 ${msg.role === 'user'
                                        ? 'bg-blue-600/20 text-blue-200 ml-6'
                                        : 'bg-zinc-800 text-zinc-300 mr-2'
                                    }`}
                            >
                                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
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
                    <div className="border-t border-zinc-800 p-2 flex gap-2">
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
                </div>
            )}
        </>
    );
};
