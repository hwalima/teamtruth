import { Button } from '@/components/ui/button';
import { usePage } from '@inertiajs/react';
import {
    AlertTriangle, BarChart3, Bot, Check, ChevronDown, CircleDot, Clock,
    DollarSign, FolderOpen, History, Loader2, MessageSquare, Plus,
    Send, Sparkles, Square, Target, Trash2, X, Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'action';
    content: string;
    loading?: boolean;
    metadata?: any;
}

interface Insight {
    type: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    items?: any[];
}

interface Conversation {
    id: number;
    title: string;
    context: string;
    pinned: boolean;
    updated_at: string;
    message_count: number;
}

type ContextType = 'general' | 'projects' | 'tasks' | 'bugs' | 'finance' | 'timesheets';
type ViewMode = 'chat' | 'insights' | 'history';

const CONTEXT_OPTIONS: { value: ContextType; label: string; icon: React.ReactNode }[] = [
    { value: 'general',    label: 'General',    icon: <Bot className="w-3.5 h-3.5" /> },
    { value: 'projects',   label: 'Projects',   icon: <FolderOpen className="w-3.5 h-3.5" /> },
    { value: 'tasks',      label: 'Tasks',      icon: <CircleDot className="w-3.5 h-3.5" /> },
    { value: 'bugs',       label: 'Bugs',       icon: <Square className="w-3.5 h-3.5" /> },
    { value: 'finance',    label: 'Finance',    icon: <DollarSign className="w-3.5 h-3.5" /> },
    { value: 'timesheets', label: 'Timesheets', icon: <Clock className="w-3.5 h-3.5" /> },
];

const SUGGESTED_PROMPTS = [
    { icon: <Target className="w-3.5 h-3.5" />, text: "What should I focus on today?", context: 'tasks' as ContextType },
    { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: "Show me overdue tasks", context: 'tasks' as ContextType },
    { icon: <BarChart3 className="w-3.5 h-3.5" />, text: "Project health overview", context: 'projects' as ContextType },
    { icon: <DollarSign className="w-3.5 h-3.5" />, text: "Finance summary", context: 'finance' as ContextType },
    { icon: <Zap className="w-3.5 h-3.5" />, text: "Create a task for...", context: 'general' as ContextType },
    { icon: <Clock className="w-3.5 h-3.5" />, text: "Log 2 hours on...", context: 'general' as ContextType },
];

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownText({ text }: { text: string }) {
    const lines = text.split('\n');
    return (
        <div className="text-[13px] leading-relaxed space-y-1">
            {lines.map((line, i) => {
                if (line.startsWith('### ')) return <h3 key={i} className="font-bold text-sm mt-2 mb-0.5">{line.slice(4)}</h3>;
                if (line.startsWith('## '))  return <h2 key={i} className="font-bold text-sm mt-2 mb-0.5">{line.slice(3)}</h2>;
                if (line.startsWith('# '))   return <h1 key={i} className="font-bold text-base mt-2 mb-0.5">{line.slice(2)}</h1>;
                if (line.startsWith('- ') || line.startsWith('• ')) {
                    return <div key={i} className="flex gap-1.5 pl-1"><span className="text-amber-500 mt-0.5 shrink-0">•</span><span>{renderInline(line.slice(2))}</span></div>;
                }
                if (/^\d+\.\s/.test(line)) {
                    const [num, ...rest] = line.split(/\.\s/);
                    return <div key={i} className="flex gap-1.5 pl-1"><span className="text-amber-500 font-mono text-xs mt-0.5 shrink-0">{num}.</span><span>{renderInline(rest.join('. '))}</span></div>;
                }
                if (line.trim() === '') return <div key={i} className="h-1" />;
                if (line.startsWith('---')) return <hr key={i} className="border-border/50 my-2" />;
                return <p key={i}>{renderInline(line)}</p>;
            })}
        </div>
    );
}

function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))   return <code key={i} className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        if (part.startsWith('*') && part.endsWith('*'))   return <em key={i}>{part.slice(1, -1)}</em>;
        return part;
    });
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
    return (
        <div className="flex items-center gap-1.5 py-1">
            <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-muted-foreground">Mzitshwa is thinking...</span>
        </div>
    );
}

// ── Action confirmation card ──────────────────────────────────────────────────

function ActionCard({ confirmation, onConfirm, onCancel, loading }: {
    confirmation: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
    return (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Action Requested</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{confirmation}</p>
                </div>
            </div>
            <div className="flex gap-2 pl-6">
                <button
                    onClick={onConfirm}
                    disabled={loading}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Confirm
                </button>
                <button onClick={onCancel} className="text-xs px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ── Insight card ──────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
    const severityColors = {
        high: 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20',
        medium: 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20',
        low: 'border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20',
    };
    const severityIcon = {
        high: <AlertTriangle className="w-4 h-4 text-red-500" />,
        medium: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        low: <CircleDot className="w-4 h-4 text-blue-500" />,
    };

    return (
        <div className={`rounded-xl border p-3 ${severityColors[insight.severity]}`}>
            <div className="flex items-start gap-2">
                {severityIcon[insight.severity]}
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                    {insight.items && insight.items.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {insight.items.slice(0, 3).map((item: any, i: number) => (
                                <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                                    <span className="truncate">{item.title}{item.project ? ` (${item.project})` : ''}</span>
                                </div>
                            ))}
                            {insight.items.length > 3 && (
                                <p className="text-xs text-muted-foreground/60 pl-2.5">+{insight.items.length - 3} more</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface MzitshwaPanelProps {
    isOpen: boolean;
    onClose: () => void;
    initialPrompt?: string;
    onGenerate?: (content: string) => void;
}

export function MzitshwaPanel({ isOpen, onClose, initialPrompt, onGenerate }: MzitshwaPanelProps) {
    const { t } = useTranslation();
    const { csrf_token, auth } = usePage().props as any;

    const [messages, setMessages]     = useState<Message[]>([]);
    const [input, setInput]           = useState('');
    const [context, setContext]       = useState<ContextType>('general');
    const [streaming, setStreaming]   = useState(false);
    const [showCtxMenu, setShowCtxMenu] = useState(false);
    const [viewMode, setViewMode]     = useState<ViewMode>('chat');
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [insights, setInsights]     = useState<Insight[]>([]);
    const [healthScore, setHealthScore] = useState<number | null>(null);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [pendingAction, setPendingAction] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef  = useRef<HTMLTextAreaElement>(null);
    const abortRef  = useRef<AbortController | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && initialPrompt) setInput(initialPrompt);
    }, [isOpen, initialPrompt]);

    useEffect(() => {
        if (isOpen && viewMode === 'insights' && insights.length === 0) loadInsights();
        if (isOpen && viewMode === 'history') loadConversations();
    }, [isOpen, viewMode]);

    const headers = { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf_token, 'Accept': 'application/json' };

    const addMessage = (role: Message['role'], content: string, loading = false, metadata?: any): string => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        setMessages(prev => [...prev, { id, role, content, loading, metadata }]);
        return id;
    };

    const updateMessage = (id: string, content: string, loading = false) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, content, loading } : m));
    };

    const send = useCallback(async (promptOverride?: string) => {
        const text = (promptOverride ?? input).trim();
        if (!text || streaming) return;

        setInput('');
        setViewMode('chat');
        addMessage('user', text);
        const aiMsgId = addMessage('assistant', '', true);
        setStreaming(true);

        const history = messages
            .filter(m => !m.loading && m.role !== 'action')
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        history.push({ role: 'user', content: text });

        abortRef.current = new AbortController();

        try {
            const isCommand = /^(create|add|make|assign|log|update|set|mark)\s/i.test(text);

            if (isCommand) {
                const parseRes = await fetch(route('mzitshwa.parseAction'), {
                    method: 'POST', signal: abortRef.current.signal, headers,
                    body: JSON.stringify({ command: text }),
                });
                const parseData = await parseRes.json();

                if (parseData.success && parseData.action !== 'none') {
                    updateMessage(aiMsgId, parseData.confirmation || 'I can do that for you.', false);
                    setPendingAction({ action: parseData.action, params: parseData.params, aiMsgId });
                    setStreaming(false);
                    return;
                }
            }

            const res = await fetch(route('mzitshwa.chat'), {
                method: 'POST', signal: abortRef.current.signal, headers,
                body: JSON.stringify({ messages: history, context, stream: false, conversation_id: conversationId }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Request failed' }));
                updateMessage(aiMsgId, `Something went wrong: ${err.message}`, false);
                return;
            }

            const data = await res.json();
            updateMessage(aiMsgId, data.content || '(No response)', false);
            if (data.conversation_id) setConversationId(data.conversation_id);
            if (onGenerate && promptOverride) onGenerate(data.content);
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                updateMessage(aiMsgId, 'Connection error. Please try again.', false);
            }
        } finally {
            setStreaming(false);
            abortRef.current = null;
        }
    }, [input, streaming, messages, context, csrf_token, conversationId, onGenerate]);

    const confirmAction = async () => {
        if (!pendingAction) return;
        setActionLoading(true);

        try {
            const res = await fetch(route('mzitshwa.action'), {
                method: 'POST', headers,
                body: JSON.stringify({ action: pendingAction.action, params: pendingAction.params }),
            });
            const data = await res.json();

            if (data.success) {
                addMessage('action', data.message, false, { type: 'success' });
            } else {
                addMessage('action', `Failed: ${data.message}`, false, { type: 'error' });
            }
        } catch {
            addMessage('action', 'Failed to execute action.', false, { type: 'error' });
        } finally {
            setPendingAction(null);
            setActionLoading(false);
        }
    };

    const cancelAction = () => setPendingAction(null);

    const loadInsights = async () => {
        setInsightsLoading(true);
        try {
            const res = await fetch(route('mzitshwa.insights'), { headers: { ...headers, 'Content-Type': undefined as any } });
            const data = await res.json();
            if (data.success) {
                setInsights(data.insights);
                setHealthScore(data.health_score);
            }
        } catch { /* ignore */ }
        finally { setInsightsLoading(false); }
    };

    const loadConversations = async () => {
        try {
            const res = await fetch(route('mzitshwa.conversations'), { headers: { ...headers, 'Content-Type': undefined as any } });
            const data = await res.json();
            if (data.success) setConversations(data.conversations);
        } catch { /* ignore */ }
    };

    const loadConversation = async (conv: Conversation) => {
        try {
            const res = await fetch(route('mzitshwa.conversation.messages', { conversation: conv.id }), { headers: { ...headers, 'Content-Type': undefined as any } });
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages);
                setConversationId(conv.id);
                setContext(conv.context as ContextType);
                setViewMode('chat');
            }
        } catch { /* ignore */ }
    };

    const newConversation = () => {
        setMessages([]);
        setConversationId(null);
        setContext('general');
        setViewMode('chat');
    };

    const stopStreaming = () => abortRef.current?.abort();

    const currentCtx = CONTEXT_OPTIONS.find(c => c.value === context)!;

    if (!isOpen) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 z-[89999] bg-black/30 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="fixed right-0 top-0 bottom-0 z-[90000] w-full max-w-[440px] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
                style={{ background: 'var(--popover)', borderLeft: '1px solid var(--border)' }}>

                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0 bg-gradient-to-r from-amber-500/10 to-transparent" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
                        <Sparkles className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground">Mzitshwa AI</p>
                        <p className="text-[10px] text-muted-foreground">Your intelligent workspace assistant</p>
                    </div>
                    <button onClick={newConversation} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="New conversation">
                        <Plus className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Tab bar */}
                <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                    {([
                        { mode: 'chat' as ViewMode, icon: <MessageSquare className="w-3.5 h-3.5" />, label: 'Chat' },
                        { mode: 'insights' as ViewMode, icon: <Target className="w-3.5 h-3.5" />, label: 'Insights' },
                        { mode: 'history' as ViewMode, icon: <History className="w-3.5 h-3.5" />, label: 'History' },
                    ]).map(tab => (
                        <button
                            key={tab.mode}
                            onClick={() => setViewMode(tab.mode)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                                viewMode === tab.mode
                                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {tab.icon} {tab.label}
                            {tab.mode === 'insights' && insights.length > 0 && (
                                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">{insights.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-y-auto">
                    {viewMode === 'chat' && (
                        <div className="px-4 py-3 space-y-3">
                            {messages.length === 0 ? (
                                <div className="space-y-4 py-4">
                                    <div className="text-center space-y-2">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                                            <Sparkles className="w-7 h-7 text-white" />
                                        </div>
                                        <p className="font-semibold text-sm">Hello! I'm Mzitshwa</p>
                                        <p className="text-xs text-muted-foreground max-w-[250px] mx-auto">
                                            I can analyze your workspace, execute actions, and provide insights. Try asking me anything!
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Suggestions</p>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {SUGGESTED_PROMPTS.map((sp, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { setContext(sp.context); send(sp.text); }}
                                                    className="flex items-center gap-2.5 text-left text-xs px-3 py-2.5 rounded-xl border hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all group"
                                                    style={{ borderColor: 'var(--border)' }}
                                                >
                                                    <span className="text-amber-500 group-hover:scale-110 transition-transform">{sp.icon}</span>
                                                    <span className="text-foreground/80">{sp.text}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id}>
                                        {msg.role === 'action' ? (
                                            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                                                msg.metadata?.type === 'success'
                                                    ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50'
                                                    : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50'
                                            }`}>
                                                {msg.metadata?.type === 'success' ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                                                {msg.content}
                                            </div>
                                        ) : (
                                            <div className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                                <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${
                                                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                                                }`}>
                                                    {msg.role === 'user'
                                                        ? (auth?.user?.name?.[0] ?? 'U').toUpperCase()
                                                        : <Sparkles className="w-3.5 h-3.5" />}
                                                </div>

                                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                                                    msg.role === 'user'
                                                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                                        : 'bg-muted border border-border/50 rounded-tl-sm'
                                                }`}>
                                                    {msg.loading && !msg.content
                                                        ? <TypingIndicator />
                                                        : msg.role === 'assistant'
                                                            ? <MarkdownText text={msg.content} />
                                                            : <p className="text-[13px]">{msg.content}</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}

                            {pendingAction && (
                                <ActionCard
                                    confirmation={pendingAction.params?.confirmation || messages[messages.length - 1]?.content || 'Execute this action?'}
                                    onConfirm={confirmAction}
                                    onCancel={cancelAction}
                                    loading={actionLoading}
                                />
                            )}

                            <div ref={bottomRef} />
                        </div>
                    )}

                    {viewMode === 'insights' && (
                        <div className="px-4 py-3 space-y-3">
                            {insightsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                                </div>
                            ) : (
                                <>
                                    {healthScore !== null && (
                                        <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border)' }}>
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Workspace Health</p>
                                            <p className={`text-3xl font-bold ${
                                                healthScore >= 70 ? 'text-green-500' : healthScore >= 40 ? 'text-amber-500' : 'text-red-500'
                                            }`}>{healthScore}%</p>
                                            <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${
                                                    healthScore >= 70 ? 'bg-green-500' : healthScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                                }`} style={{ width: `${healthScore}%` }} />
                                            </div>
                                        </div>
                                    )}

                                    {insights.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                            <p className="text-sm font-medium">All clear!</p>
                                            <p className="text-xs text-muted-foreground">No issues to report right now.</p>
                                        </div>
                                    ) : (
                                        insights.map((insight, i) => <InsightCard key={i} insight={insight} />)
                                    )}

                                    <button onClick={loadInsights} className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors">
                                        Refresh insights
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {viewMode === 'history' && (
                        <div className="px-4 py-3 space-y-2">
                            {conversations.length === 0 ? (
                                <div className="text-center py-8">
                                    <History className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No conversations yet.</p>
                                </div>
                            ) : (
                                conversations.map(conv => (
                                    <button
                                        key={conv.id}
                                        onClick={() => loadConversation(conv)}
                                        className="w-full text-left rounded-xl border p-3 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-all"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        <p className="text-xs font-medium text-foreground truncate">{conv.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-muted-foreground">{conv.updated_at}</span>
                                            <span className="text-[10px] text-muted-foreground">·</span>
                                            <span className="text-[10px] text-muted-foreground">{conv.message_count} messages</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{conv.context}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Input area */}
                {viewMode === 'chat' && (
                    <div className="shrink-0 px-3 pb-3 pt-2 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                        {/* Context selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowCtxMenu(v => !v)}
                                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border transition-colors hover:border-amber-400/50"
                                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--muted)' }}
                            >
                                {currentCtx.icon}
                                <span>{currentCtx.label}</span>
                                <ChevronDown className="w-3 h-3" />
                            </button>

                            {showCtxMenu && (
                                <div className="absolute bottom-full mb-1 left-0 z-10 rounded-xl border p-1 shadow-xl min-w-[150px]"
                                    style={{ background: 'var(--popover)', borderColor: 'var(--border)' }}>
                                    {CONTEXT_OPTIONS.map(opt => (
                                        <button key={opt.value}
                                            onClick={() => { setContext(opt.value); setShowCtxMenu(false); }}
                                            className={`w-full flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors ${
                                                opt.value === context ? 'text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30' : ''
                                            }`}>
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
                                placeholder="Ask anything or type a command..."
                                rows={2}
                                className="flex-1 resize-none rounded-xl text-sm px-3 py-2.5 border outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
                                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)', maxHeight: '100px' }}
                                disabled={streaming}
                            />
                            {streaming
                                ? <button onClick={stopStreaming} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-500 text-white hover:bg-red-600 transition-colors" title="Stop">
                                    <Square className="w-4 h-4 fill-current" />
                                  </button>
                                : <button onClick={() => send()} disabled={!input.trim()} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 disabled:opacity-40 disabled:shadow-none transition-all">
                                    <Send className="w-4 h-4" />
                                  </button>}
                        </div>
                        <p className="text-center text-[10px] text-muted-foreground/50">
                            Mzitshwa AI · Commands: "create task...", "log 2 hours...", "assign to..."
                        </p>
                    </div>
                )}
            </div>
        </>,
        document.body
    );
}

// ── Floating trigger button ────────────────────────────────────────────────────

export function MzitshwaButton() {
    const [open, setOpen] = useState(false);
    const { auth } = usePage().props as any;

    if (!auth?.user) return null;

    return (
        <>
            {!open && createPortal(
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-[79000] w-14 h-14 rounded-2xl shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600"
                    title="Open Mzitshwa AI"
                >
                    <Sparkles className="w-6 h-6 text-white" />
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
        } catch { /* ignore */ }
        finally { setLoading(false); setShowModal(false); }
    };

    const inputClass = 'w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all';
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
                className="absolute right-2.5 top-2.5 p-1 rounded-lg opacity-0 group-hover:opacity-100 focus-within:opacity-100 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all"
                title="Generate with Mzitshwa"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
            </button>

            {showModal && createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                    <div className="rounded-2xl border p-5 shadow-2xl w-full max-w-sm mx-4" style={{ background: 'var(--popover)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="font-semibold text-sm">Generate with Mzitshwa</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{promptHint ?? `Describe what you want for the ${fieldType} field.`}</p>
                        <textarea
                            autoFocus
                            value={modalPrompt}
                            onChange={e => setModalPrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && e.ctrlKey && generate(modalPrompt)}
                            placeholder="e.g. A professional project description for a mobile app redesign..."
                            rows={3}
                            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 resize-none mb-3"
                            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        />
                        <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                            <Button size="sm" onClick={() => generate(modalPrompt)} disabled={loading || !modalPrompt.trim()} className="bg-gradient-to-r from-amber-400 to-amber-600 text-white border-0 hover:from-amber-500 hover:to-amber-700">
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
