import { Button } from '@/components/ui/button';
import { usePage } from '@inertiajs/react';
import {
    BarChart3, Bot, ChevronDown, CircleDot, Clock, DollarSign,
    FolderOpen, Loader2, Send, Sparkles, Square, Trash2, X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    loading?: boolean;
}

type ContextType = 'general' | 'projects' | 'tasks' | 'bugs' | 'finance' | 'timesheets';

const CONTEXT_OPTIONS: { value: ContextType; label: string; icon: React.ReactNode }[] = [
    { value: 'general',     label: 'General',     icon: <Bot className="w-3.5 h-3.5" /> },
    { value: 'projects',    label: 'Projects',    icon: <FolderOpen className="w-3.5 h-3.5" /> },
    { value: 'tasks',       label: 'Tasks',       icon: <CircleDot className="w-3.5 h-3.5" /> },
    { value: 'bugs',        label: 'Bugs',        icon: <Square className="w-3.5 h-3.5" /> },
    { value: 'finance',     label: 'Finance',     icon: <DollarSign className="w-3.5 h-3.5" /> },
    { value: 'timesheets',  label: 'Timesheets',  icon: <Clock className="w-3.5 h-3.5" /> },
];

const QUICK_ACTIONS = [
    { label: 'Project Overview',  context: 'projects',   prompt: 'Give me a full overview of all my projects with insights and recommendations.' },
    { label: 'Task Analysis',     context: 'tasks',      prompt: 'Analyse my tasks: what are overdue, high priority, and what should I focus on today?' },
    { label: 'Finance Summary',   context: 'finance',    prompt: 'Summarise my financial position: invoices, outstanding payments, and expenses.' },
    { label: 'Bug Report',        context: 'bugs',       prompt: 'Give me a bug analysis: open bugs by severity, and which projects need attention.' },
    { label: 'Timesheet Report',  context: 'timesheets', prompt: 'Summarise my timesheet data and billable hours.' },
    { label: 'Workspace Health',  context: 'general',    prompt: 'Give me an overall health check of my workspace: what is going well and what needs attention?' },
];

const STORAGE_KEY = 'mzitshwa_history';

// ── Simple markdown renderer ──────────────────────────────────────────────────

function MarkdownText({ text }: { text: string }) {
    const lines = text.split('\n');
    return (
        <div className="text-sm leading-relaxed space-y-1.5">
            {lines.map((line, i) => {
                if (line.startsWith('### ')) return <h3 key={i} className="font-bold text-base mt-2">{line.slice(4)}</h3>;
                if (line.startsWith('## '))  return <h2 key={i} className="font-bold text-base mt-2">{line.slice(3)}</h2>;
                if (line.startsWith('# '))   return <h1 key={i} className="font-bold text-lg mt-2">{line.slice(2)}</h1>;
                if (line.startsWith('- ') || line.startsWith('• ')) {
                    return <div key={i} className="flex gap-1.5"><span className="text-primary mt-0.5">•</span><span>{renderInline(line.slice(2))}</span></div>;
                }
                if (/^\d+\.\s/.test(line)) {
                    const [num, ...rest] = line.split(/\.\s/);
                    return <div key={i} className="flex gap-1.5"><span className="text-primary font-mono text-xs mt-0.5">{num}.</span><span>{renderInline(rest.join('. '))}</span></div>;
                }
                if (line.trim() === '') return <div key={i} className="h-1" />;
                if (line.startsWith('---')) return <hr key={i} className="border-border my-2" />;
                return <p key={i}>{renderInline(line)}</p>;
            })}
        </div>
    );
}

function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))   return <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        if (part.startsWith('*') && part.endsWith('*'))   return <em key={i}>{part.slice(1, -1)}</em>;
        return part;
    });
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface MzitshwaPanelProps {
    isOpen: boolean;
    onClose: () => void;
    /** Optional: pre-fill a prompt and send immediately (for inline field helpers) */
    initialPrompt?: string;
    /** Callback when content is generated (for inline field helpers) */
    onGenerate?: (content: string) => void;
}

export function MzitshwaPanel({ isOpen, onClose, initialPrompt, onGenerate }: MzitshwaPanelProps) {
    const { t } = useTranslation();
    const { csrf_token, auth } = usePage().props as any;

    const [messages, setMessages]   = useState<Message[]>(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
        catch { return []; }
    });
    const [input, setInput]         = useState('');
    const [context, setContext]     = useState<ContextType>('general');
    const [streaming, setStreaming] = useState(false);
    const [showCtxMenu, setShowCtxMenu] = useState(false);

    const bottomRef   = useRef<HTMLDivElement>(null);
    const inputRef    = useRef<HTMLTextAreaElement>(null);
    const abortRef    = useRef<AbortController | null>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Persist history
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    }, [messages]);

    // Auto-send if initialPrompt provided
    useEffect(() => {
        if (isOpen && initialPrompt) {
            setInput(initialPrompt);
        }
    }, [isOpen, initialPrompt]);

    const addMessage = (role: Message['role'], content: string, loading = false): string => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        setMessages(prev => [...prev, { id, role, content, loading }]);
        return id;
    };

    const updateMessage = (id: string, content: string, loading = false) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content, loading } : m));
    };

    const send = useCallback(async (promptOverride?: string) => {
        const text = (promptOverride ?? input).trim();
        if (!text || streaming) return;

        setInput('');
        const userMsgId = addMessage('user', text);
        const aiMsgId   = addMessage('assistant', '', true);
        setStreaming(true);

        const history = messages
            .filter(m => !m.loading)
            .map(m => ({ role: m.role, content: m.content }));

        history.push({ role: 'user', content: text });

        abortRef.current = new AbortController();

        try {
            // Use non-streaming JSON — SSE is buffered by LiteSpeed shared hosting
            const res = await fetch(route('mzitshwa.chat'), {
                method: 'POST',
                signal: abortRef.current.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf_token,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ messages: history, context, stream: false }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Request failed' }));
                updateMessage(aiMsgId, `Error: ${err.message}`, false);
                return;
            }

            const data = await res.json();
            const content = data.content || data.message || '(No response)';
            updateMessage(aiMsgId, content, false);

            if (onGenerate && promptOverride) onGenerate(content);

        } catch (err: any) {
            if (err.name !== 'AbortError') {
                updateMessage(aiMsgId, `Connection error. Please try again.`, false);
            } else {
                updateMessage(aiMsgId, messages.find(m => m.id === aiMsgId)?.content || '(Stopped)', false);
            }
        } finally {
            setStreaming(false);
            abortRef.current = null;
        }
    }, [input, streaming, messages, context, csrf_token, onGenerate]);

    const stopStreaming = () => abortRef.current?.abort();

    const clearHistory = () => {
        setMessages([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    const quickAction = (action: typeof QUICK_ACTIONS[0]) => {
        setContext(action.context as ContextType);
        setTimeout(() => send(action.prompt), 50);
    };

    const currentCtx = CONTEXT_OPTIONS.find(c => c.value === context)!;

    if (!isOpen) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[89999] bg-black/20 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="fixed right-0 top-0 bottom-0 z-[90000] w-full max-w-[420px] flex flex-col shadow-2xl"
                style={{ background: 'var(--popover)', borderLeft: '1px solid var(--border)' }}>

                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
                    style={{ background: 'var(--sidebar)', borderColor: 'var(--sidebar-border)' }}>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: '#E3B448' }}>
                        <Sparkles className="w-4 h-4 text-[#001a4d]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: 'var(--sidebar-foreground)' }}>Mzitshwa</p>
                        <p className="text-xs opacity-60" style={{ color: 'var(--sidebar-foreground)' }}>AI Assistant · Team Truth</p>
                    </div>
                    <button onClick={clearHistory} className="p-1.5 rounded opacity-60 hover:opacity-100 transition-opacity" title="Clear history" style={{ color: 'var(--sidebar-foreground)' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded opacity-60 hover:opacity-100 transition-opacity" style={{ color: 'var(--sidebar-foreground)' }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Quick actions */}
                <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                    {QUICK_ACTIONS.map((a) => (
                        <button
                            key={a.label}
                            onClick={() => quickAction(a)}
                            disabled={streaming}
                            className="flex items-center gap-1 whitespace-nowrap text-xs px-2.5 py-1 rounded-full border transition-colors hover:border-primary/60 disabled:opacity-40"
                            style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--muted)' }}
                        >
                            <BarChart3 className="w-3 h-3 opacity-60" />
                            {a.label}
                        </button>
                    ))}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-center opacity-60 py-8">
                            <Sparkles className="w-10 h-10" style={{ color: '#E3B448' }} />
                            <p className="font-medium text-sm">Hi! I'm Mzitshwa.</p>
                            <p className="text-xs max-w-[200px]">Ask me anything about your workspace, or use a quick action above.</p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : ''}`}
                                style={msg.role === 'assistant' ? { background: '#E3B448', color: '#001a4d' } : {}}>
                                {msg.role === 'user'
                                    ? (auth?.user?.name?.[0] ?? 'U').toUpperCase()
                                    : <Sparkles className="w-3.5 h-3.5" />}
                            </div>

                            {/* Bubble */}
                            <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                                style={msg.role === 'user'
                                    ? { background: '#E3B448', color: '#001a4d' }
                                    : { background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
                                {msg.loading && !msg.content
                                    ? <div className="flex gap-1 py-0.5 items-center">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin opacity-60" />
                                        <span className="text-xs opacity-50">Thinking…</span>
                                      </div>
                                    : msg.role === 'assistant'
                                        ? <MarkdownText text={msg.content} />
                                        : <p className="text-sm">{msg.content}</p>}
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Input area */}
                <div className="shrink-0 px-3 pb-3 pt-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                    {/* Context selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowCtxMenu(v => !v)}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors hover:border-primary/50"
                            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--muted)' }}
                        >
                            {currentCtx.icon}
                            <span>{currentCtx.label}</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>

                        {showCtxMenu && (
                            <div className="absolute bottom-full mb-1 left-0 z-10 rounded-lg border p-1 shadow-lg min-w-[140px]"
                                style={{ background: 'var(--popover)', borderColor: 'var(--border)' }}>
                                {CONTEXT_OPTIONS.map(opt => (
                                    <button key={opt.value}
                                        onClick={() => { setContext(opt.value); setShowCtxMenu(false); }}
                                        className={`w-full flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors ${opt.value === context ? 'text-primary font-medium' : ''}`}
                                        style={{ color: opt.value === context ? '#E3B448' : 'var(--foreground)' }}>
                                        {opt.icon} {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Text input + send */}
                    <div className="flex gap-2 items-end">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                            }}
                            placeholder="Ask Mzitshwa anything... (Shift+Enter for newline)"
                            rows={2}
                            className="flex-1 resize-none rounded-xl text-sm px-3 py-2 border outline-none focus:ring-1 transition-all"
                            style={{
                                background: 'var(--input)',
                                borderColor: 'var(--border)',
                                color: 'var(--foreground)',
                                maxHeight: '120px',
                            }}
                            disabled={streaming}
                        />
                        {streaming
                            ? <button onClick={stopStreaming} className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#ef4444', color: '#fff' }} title="Stop">
                                <Square className="w-4 h-4 fill-current" />
                              </button>
                            : <button onClick={() => send()} disabled={!input.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-opacity disabled:opacity-40" style={{ background: '#E3B448', color: '#001a4d' }}>
                                <Send className="w-4 h-4" />
                              </button>}
                    </div>
                    <p className="text-center text-[10px] opacity-40">Mzitshwa · Powered by Groq · llama-3.3-70b</p>
                </div>
            </div>
        </>,
        document.body
    );
}

// ── Floating trigger button ────────────────────────────────────────────────────

export function MzitshwaButton() {
    const [open, setOpen] = useState(false);
    const { auth, globalSettings } = usePage().props as any;

    // Use Groq key from env (always enabled when key exists)
    const hasKey = !!(globalSettings?.groqKey || true); // key is in .env, always available
    if (!hasKey || !auth?.user) return null;

    return (
        <>
            {!open && createPortal(
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-[79000] w-14 h-14 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
                    style={{ background: '#E3B448' }}
                    title="Open Mzitshwa AI"
                >
                    <Sparkles className="w-6 h-6 text-[#001a4d]" />
                </button>,
                document.body
            )}
            <MzitshwaPanel isOpen={open} onClose={() => setOpen(false)} />
        </>
    );
}

// ── Inline field helper ────────────────────────────────────────────────────────

interface MzitshwaFieldProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    type?: 'input' | 'textarea';
    rows?: number;
    fieldType?: string;
    promptHint?: string;
    contextData?: string;
    className?: string;
}

export function MzitshwaField({
    value, onChange, placeholder, type = 'input', rows = 3,
    fieldType = 'text', promptHint, contextData, className = ''
}: MzitshwaFieldProps) {
    const { csrf_token } = usePage().props as any;
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalPrompt, setModalPrompt] = useState('');

    const generate = async (prompt: string) => {
        if (!prompt.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(route('mzitshwa.complete'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf_token },
                body: JSON.stringify({ prompt, field_type: fieldType, context: contextData }),
            });
            const data = await res.json();
            if (data.success) onChange(data.content);
            else toast.error(data.message);
        } catch { toast.error('AI request failed'); }
        finally { setLoading(false); setShowModal(false); }
    };

    const inputClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 transition-all`;
    const style = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' } as React.CSSProperties;

    return (
        <div className={`relative group ${className}`}>
            {type === 'textarea'
                ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={`${inputClass} resize-none pr-10`} style={style} />
                : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${inputClass} pr-10`} style={style} />}

            <button
                type="button"
                onClick={() => setShowModal(true)}
                disabled={loading}
                className="absolute right-2 top-2 p-1 rounded-md opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                style={{ color: '#E3B448' }}
                title="Generate with Mzitshwa"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>

            {/* Quick-generate modal */}
            {showModal && createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                    <div className="rounded-xl border p-5 shadow-2xl w-full max-w-sm mx-4" style={{ background: 'var(--popover)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4" style={{ color: '#E3B448' }} />
                            <span className="font-semibold text-sm">Generate with Mzitshwa</span>
                        </div>
                        <p className="text-xs opacity-60 mb-2">{promptHint ?? `Describe what you want for the ${fieldType} field.`}</p>
                        <textarea
                            autoFocus
                            value={modalPrompt}
                            onChange={e => setModalPrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && e.ctrlKey && generate(modalPrompt)}
                            placeholder="e.g. A professional project description for a mobile app redesign..."
                            rows={3}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 resize-none mb-3"
                            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        />
                        <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                            <Button size="sm" onClick={() => generate(modalPrompt)} disabled={loading || !modalPrompt.trim()} style={{ background: '#E3B448', color: '#001a4d' }}>
                                {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Generating…</> : <>Generate</>}
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
