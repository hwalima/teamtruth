import { cn } from '@/lib/utils';
import { usePage } from '@inertiajs/react';
import { ArrowUp, Check, History, Loader2, MessageSquarePlus, Search, Sparkles, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { route } from 'ziggy-js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Proposal {
    action: string;
    params: Record<string, unknown>;
    summary: string;
}

interface Message {
    id: number | string;
    role: 'user' | 'assistant' | 'action' | 'error';
    content: string;
    lookups?: string[];
    proposal?: Proposal | null;
}

interface Conversation {
    id: number;
    title: string;
    context: string;
    updated_at: string;
}

const OPEN_EVENT = 'mzitshwa:open';

/** Open the Mzitshwa panel from anywhere, optionally with a question. */
export function openMzitshwa(question?: string) {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { question } }));
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUT = isMac ? '⌘ /' : 'Ctrl /';

// ── Header button ─────────────────────────────────────────────────────────────

export function MzitshwaLauncher({ className }: { className?: string }) {
    const { t } = useTranslation();

    return (
        <button
            type="button"
            onClick={() => openMzitshwa()}
            className={cn(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border bg-white shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800',
                className,
            )}
            title={`${t('Ask Mzitshwa')} (${SHORTCUT})`}
            aria-label={t('Ask Mzitshwa')}
        >
            <Sparkles className="text-primary h-4 w-4" />
        </button>
    );
}

// ── Markdown (headings, lists, tables, bold, code) ────────────────────────────

function inline(text: string): React.ReactNode {
    return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="bg-muted rounded px-1 py-0.5 font-mono text-xs">{part.slice(1, -1)}</code>;
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
        return part;
    });
}

function cells(row: string): string[] {
    return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function Markdown({ text }: { text: string }) {
    const lines = text.split('\n');
    const out: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Table: header row, separator row, then body rows.
        if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
            const head = cells(line);
            const body: string[][] = [];
            i += 2;
            while (i < lines.length && lines[i].trim().startsWith('|')) body.push(cells(lines[i++]));
            i--;
            out.push(
                <div key={i} className="my-2 overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/60">
                            <tr>{head.map((h, k) => <th key={k} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{inline(h)}</th>)}</tr>
                        </thead>
                        <tbody>
                            {body.map((r, k) => (
                                <tr key={k} className="border-t">
                                    {r.map((c, j) => <td key={j} className={cn('px-2 py-1.5 align-top', /^[-\d\s.,%$A-Z]{1,20}$/.test(c) && /\d/.test(c) && 'text-right tabular-nums whitespace-nowrap')}>{inline(c)}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>,
            );
            continue;
        }

        const heading = line.match(/^(#{1,4})\s+(.*)/);
        if (heading) out.push(<p key={i} className="mt-2 font-semibold">{inline(heading[2])}</p>);
        else if (/^\s*[-*•]\s+/.test(line)) out.push(<div key={i} className={cn('flex gap-2', /^\s{2,}/.test(line) ? 'pl-5' : 'pl-1')}><span className="text-muted-foreground">•</span><span className="min-w-0">{inline(line.replace(/^\s*[-*•]\s+/, ''))}</span></div>);
        else if (/^\s*\d+[.)]\s/.test(line)) {
            const [, n, rest] = line.match(/^\s*(\d+)[.)]\s(.*)/) ?? [];
            out.push(<div key={i} className="flex gap-2 pl-1"><span className="text-muted-foreground tabular-nums">{n}.</span><span className="min-w-0">{inline(rest ?? '')}</span></div>);
        } else if (/^-{3,}$/.test(line.trim())) out.push(<hr key={i} className="my-2" />);
        else if (line.trim() === '') out.push(<div key={i} className="h-1.5" />);
        else out.push(<p key={i}>{inline(line)}</p>);
    }

    return <div className="space-y-0.5 text-sm leading-relaxed break-words">{out}</div>;
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function useCsrfHeaders() {
    const { csrf_token } = usePage().props as any;
    return useCallback(
        (json = true): HeadersInit => ({
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content || csrf_token,
            ...(json ? { 'Content-Type': 'application/json' } : {}),
        }),
        [csrf_token],
    );
}

function MzitshwaPanel({ open, onClose, pendingQuestion, onQuestionUsed }: { open: boolean; onClose: () => void; pendingQuestion: string | null; onQuestionUsed: () => void }) {
    const { t } = useTranslation();
    const { auth, erpContext } = usePage().props as any;
    const headers = useCsrfHeaders();

    const [view, setView] = useState<'chat' | 'history'>('chat');
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState<number | string | null>(null);
    const [history, setHistory] = useState<Conversation[] | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const company = erpContext?.activeCompany?.name as string | undefined;
    const workspace = auth?.user?.current_workspace?.name as string | undefined;
    const firstName = String(auth?.user?.name ?? '').split(' ')[0];
    const inErp = Boolean(company) && window.location.pathname.startsWith('/erp');

    const suggestions = inErp
        ? [t('How are we doing this month?'), t('Which invoices are overdue?'), t('What is in the bank?'), t('What needs my approval?')]
        : [t('What should I focus on today?'), t('Which tasks are overdue?'), t('Summarise my projects'), t('How do I raise a requisition?')];

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, busy]);

    useEffect(() => {
        if (open && view === 'chat') setTimeout(() => inputRef.current?.focus(), 50);
    }, [open, view]);

    const send = useCallback(
        async (text: string) => {
            const question = text.trim();
            if (!question || busy) return;
            setInput('');
            setView('chat');
            setMessages((m) => [...m.filter((x) => x.role !== 'error'), { id: `u${Date.now()}`, role: 'user', content: question }]);
            setBusy(true);

            try {
                const res = await fetch(route('mzitshwa.chat'), {
                    method: 'POST',
                    headers: headers(),
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        message: question,
                        conversation_id: conversationId,
                        page: { url: window.location.pathname, title: document.title },
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) {
                    const msg = res.status === 419 ? t('Your session expired. Reload the page and try again.')
                        : res.status === 429 ? t('Too many questions in a minute. Please wait a moment.')
                        : data.message || t('Mzitshwa ran into a problem. Please try again.');
                    setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'error', content: msg }]);
                    return;
                }
                setConversationId(data.conversation_id);
                setHistory(null);
                setMessages((m) => [...m, data.message]);
            } catch {
                setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'error', content: t('Could not reach the server. Check your connection.') }]);
            } finally {
                setBusy(false);
            }
        },
        [busy, conversationId, headers, t],
    );

    // A question passed in from elsewhere (openMzitshwa('...')).
    useEffect(() => {
        if (open && pendingQuestion) {
            onQuestionUsed();
            send(pendingQuestion);
        }
    }, [open, pendingQuestion, onQuestionUsed, send]);

    const confirm = async (message: Message) => {
        if (!message.proposal) return;
        setConfirming(message.id);
        try {
            const res = await fetch(route('mzitshwa.action'), {
                method: 'POST',
                headers: headers(),
                credentials: 'same-origin',
                body: JSON.stringify({ ...message.proposal, conversation_id: conversationId, message_id: message.id }),
            });
            const data = await res.json().catch(() => ({}));
            setMessages((m) => [
                ...m.map((x) => (x.id === message.id ? { ...x, proposal: null } : x)),
                { id: `a${Date.now()}`, role: res.ok ? 'action' : 'error', content: data.message || t('That did not work.') },
            ]);
        } finally {
            setConfirming(null);
        }
    };

    const dismiss = (message: Message) =>
        setMessages((m) => m.map((x) => (x.id === message.id ? { ...x, proposal: null } : x)).concat({ id: `c${Date.now()}`, role: 'action', content: t('Cancelled. Nothing was changed.') }));

    const newChat = () => {
        setMessages([]);
        setConversationId(null);
        setView('chat');
    };

    const openHistory = async () => {
        setView('history');
        const res = await fetch(route('mzitshwa.conversations'), { headers: headers(false), credentials: 'same-origin' });
        if (res.ok) setHistory((await res.json()).conversations);
    };

    const loadConversation = async (c: Conversation) => {
        const res = await fetch(route('mzitshwa.conversations.show', c.id), { headers: headers(false), credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        setMessages(data.messages);
        setConversationId(c.id);
        setView('chat');
    };

    const removeConversation = async (c: Conversation) => {
        await fetch(route('mzitshwa.conversations.destroy', c.id), { method: 'DELETE', headers: headers(false), credentials: 'same-origin' });
        setHistory((h) => (h ?? []).filter((x) => x.id !== c.id));
        if (conversationId === c.id) newChat();
    };

    if (!open) return null;

    return createPortal(
        <aside
            role="dialog"
            aria-label={t('Mzitshwa assistant')}
            className="bg-background fixed inset-0 z-[60] flex flex-col border-l shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[440px]"
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
        >
            {/* Header */}
            <header className="flex items-center gap-3 border-b px-4 py-3">
                <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight font-semibold">Mzitshwa</p>
                    <p className="text-muted-foreground truncate text-xs">{company ?? workspace ?? t('Your assistant')}</p>
                </div>
                <IconButton label={t('Past conversations')} onClick={openHistory} active={view === 'history'}><History className="h-4 w-4" /></IconButton>
                <IconButton label={t('New conversation')} onClick={newChat}><MessageSquarePlus className="h-4 w-4" /></IconButton>
                <IconButton label={t('Close')} onClick={onClose}><X className="h-4 w-4" /></IconButton>
            </header>

            {/* Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
                {view === 'history' ? (
                    <div className="space-y-1">
                        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">{t('Past conversations')}</p>
                        {history === null && <Loader2 className="text-muted-foreground mx-auto mt-6 h-5 w-5 animate-spin" />}
                        {history?.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">{t('No conversations yet.')}</p>}
                        {history?.map((c) => (
                            <div key={c.id} className={cn('group hover:bg-muted flex items-center gap-2 rounded-md px-2 py-2', conversationId === c.id && 'bg-muted')}>
                                <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => loadConversation(c)}>
                                    <p className="truncate text-sm">{c.title}</p>
                                    <p className="text-muted-foreground text-xs">{c.context === 'erp' ? 'ERP · ' : ''}{c.updated_at}</p>
                                </button>
                                <button className="text-muted-foreground hover:text-destructive cursor-pointer p-1 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => removeConversation(c)} aria-label={t('Delete conversation')}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col justify-end gap-4 pb-2">
                        <div>
                            <p className="text-lg font-semibold">{firstName ? t('Hi :name', { name: firstName }).replace(':name', firstName) : t('Hi')}</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {company
                                    ? t('Ask about :company figures, your tasks, or how to do something in the system.').replace(':company', company)
                                    : t('Ask about your projects and tasks, or how to do something in the system.')}
                            </p>
                        </div>
                        <div className="grid gap-2">
                            {suggestions.map((s) => (
                                <button key={s} onClick={() => send(s)} className="hover:bg-muted cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors">
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((m) => (
                            <MessageRow key={m.id} message={m} confirming={confirming === m.id} onConfirm={() => confirm(m)} onDismiss={() => dismiss(m)} />
                        ))}
                        {busy && (
                            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('Looking that up...')}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Composer */}
            <div className="border-t p-3">
                <div className="focus-within:ring-ring/40 flex items-end gap-2 rounded-xl border px-3 py-2 focus-within:ring-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        rows={1}
                        maxLength={4000}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                send(input);
                            }
                        }}
                        placeholder={t('Ask Mzitshwa...')}
                        className="placeholder:text-muted-foreground max-h-[140px] min-h-[24px] flex-1 resize-none bg-transparent text-sm outline-none"
                    />
                    <button
                        onClick={() => send(input)}
                        disabled={busy || !input.trim()}
                        className="bg-primary text-primary-foreground flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-opacity disabled:cursor-default disabled:opacity-40"
                        aria-label={t('Send')}
                    >
                        <ArrowUp className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-muted-foreground mt-2 text-center text-[11px]">
                    {t('Mzitshwa sees only what your role allows and can make mistakes. Check important figures.')}
                </p>
            </div>
        </aside>,
        document.body,
    );
}

function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
    return (
        <button onClick={onClick} title={label} aria-label={label} className={cn('text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-md p-1.5 transition-colors', active && 'bg-muted text-foreground')}>
            {children}
        </button>
    );
}

function MessageRow({ message: m, confirming, onConfirm, onDismiss }: { message: Message; confirming: boolean; onConfirm: () => void; onDismiss: () => void }) {
    const { t } = useTranslation();

    if (m.role === 'user') {
        return (
            <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap">{m.content}</div>
            </div>
        );
    }
    if (m.role === 'action') {
        return (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                {m.content}
            </div>
        );
    }
    if (m.role === 'error') {
        return <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">{m.content}</div>;
    }

    return (
        <div className="space-y-2">
            {m.lookups && m.lookups.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {m.lookups.map((l) => (
                        <span key={l} className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]">
                            <Search className="h-3 w-3" />
                            {l}
                        </span>
                    ))}
                </div>
            )}
            <Markdown text={m.content} />
            {m.proposal && (
                <div className="border-primary/30 bg-primary/5 rounded-lg border p-3">
                    <p className="text-sm">{m.proposal.summary}</p>
                    <div className="mt-2.5 flex gap-2">
                        <button onClick={onConfirm} disabled={confirming} className="bg-primary text-primary-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                            {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {t('Confirm')}
                        </button>
                        <button onClick={onDismiss} disabled={confirming} className="hover:bg-muted cursor-pointer rounded-md border px-3 py-1.5 text-xs">
                            {t('Cancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Host: mounted once in the app shell ───────────────────────────────────────

export function MzitshwaHost() {
    const [open, setOpen] = useState(false);
    const [question, setQuestion] = useState<string | null>(null);
    const clearQuestion = useCallback(() => setQuestion(null), []);

    useEffect(() => {
        const onOpen = (e: Event) => {
            setOpen(true);
            const q = (e as CustomEvent).detail?.question;
            if (q) setQuestion(q);
        };
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        window.addEventListener(OPEN_EVENT, onOpen);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener(OPEN_EVENT, onOpen);
            window.removeEventListener('keydown', onKey);
        };
    }, []);

    return <MzitshwaPanel open={open} onClose={() => setOpen(false)} pendingQuestion={question} onQuestionUsed={clearQuestion} />;
}
