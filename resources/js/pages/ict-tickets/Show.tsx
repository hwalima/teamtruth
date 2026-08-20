import { PageTemplate } from '@/components/page-template';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { router, usePage } from '@inertiajs/react';
import {
    AlertTriangle, Building2, Calendar, CheckCircle2, Clock, Download, Edit,
    Loader2, MapPin, MessageSquare, Paperclip, Send, Ticket, Trash2, User, X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TicketUser { id: number; name: string; email: string }
interface Comment   { id: number; user_id: number; comment: string; is_internal: boolean; created_at: string; user: TicketUser }
interface Attachment { id: number; file_name: string; file_size: number; mime_type: string; created_at: string; uploader: TicketUser }

interface IctTicket {
    id: number; ticket_number: string; title: string; description?: string; steps_to_reproduce?: string;
    status: string; priority: string; category: string;
    subsidiary?: string; department?: string; location?: string; resolution_notes?: string;
    reported_by: number; assigned_to?: number;
    reportedBy: TicketUser; assignedTo?: TicketUser;
    created_at: string; due_date?: string; first_response_at?: string; resolved_at?: string; closed_at?: string;
    comments: Comment[]; attachments: Attachment[];
}

interface Props {
    ticket: IctTicket;
    members: TicketUser[];
    subsidiaries: string[]; departments: string[];
    categories: Record<string, string>;
    statuses: Record<string, { label: string; color: string }>;
    priorities: Record<string, { label: string; color: string }>;
    can: { update: boolean; delete: boolean; assign: boolean; comment: boolean };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400',
    high:     'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
    medium:   'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
    low:      'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_STYLE: Record<string, string> = {
    open:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    pending:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    resolved:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    closed:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function fmtDate(d?: string) {
    if (!d) return '—';
    return new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtBytes(b: number) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IctTicketShow({ ticket, members, categories, statuses, priorities, can }: Props) {
    const { t } = useTranslation();
    const { csrf_token, auth } = usePage().props as any;
    const currentUser = auth?.user;

    const [comment, setComment]         = useState('');
    const [isInternal, setIsInternal]   = useState(false);
    const [sending, setSending]         = useState(false);
    const [editOpen, setEditOpen]       = useState(false);
    const [deleteOpen, setDeleteOpen]   = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // ── Status change ─────────────────────────────────────────────────────────

    const changeStatus = (status: string) => {
        router.put(route('ict-tickets.change-status', ticket.id), { status }, {
            onSuccess: () => toast.success('Status updated'),
            onError: () => toast.error('Failed to update status'),
        });
    };

    // ── Assign ────────────────────────────────────────────────────────────────

    const assign = (userId: string) => {
        router.put(route('ict-tickets.assign', ticket.id), { assigned_to: userId === 'none' ? null : userId }, {
            onSuccess: () => toast.success('Ticket assigned'),
            onError: () => toast.error('Failed to assign'),
        });
    };

    // ── Comment ───────────────────────────────────────────────────────────────

    const submitComment = () => {
        if (!comment.trim()) return;
        setSending(true);
        router.post(route('ict-ticket-comments.store', ticket.id), { comment, is_internal: isInternal }, {
            onSuccess: () => { setComment(''); setIsInternal(false); },
            onError: () => toast.error('Failed to add comment'),
            onFinish: () => setSending(false),
        });
    };

    // ── Attachment upload ─────────────────────────────────────────────────────

    const uploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const form = new FormData();
        form.append('file', file);
        router.post(route('ict-ticket-attachments.store', ticket.id), form as any, {
            onSuccess: () => toast.success('File attached'),
            onError: () => toast.error('Upload failed'),
            forceFormData: true,
        });
        e.target.value = '';
    };

    const deleteAttachment = (id: number) => {
        router.delete(route('ict-ticket-attachments.destroy', id), {
            onSuccess: () => toast.success('Attachment removed'),
        });
    };

    // ── Delete ticket ─────────────────────────────────────────────────────────

    const deleteTicket = () => {
        router.delete(route('ict-tickets.destroy', ticket.id), {
            onSuccess: () => router.visit(route('ict-tickets.index')),
        });
    };

    const breadcrumbs = [
        { title: t('ICT Tickets'), href: route('ict-tickets.index') },
        { title: ticket.ticket_number },
    ];

    return (
        <PageTemplate title={ticket.ticket_number} description={ticket.title} breadcrumbs={breadcrumbs}
            actions={[
                ...(can.update ? [{ label: t('Edit'), icon: <Edit className="w-3.5 h-3.5 mr-1" />, variant: 'outline' as const, onClick: () => setEditOpen(true) }] : []),
                ...(can.delete ? [{ label: t('Delete'), icon: <Trash2 className="w-3.5 h-3.5 mr-1" />, variant: 'destructive' as const, onClick: () => setDeleteOpen(true) }] : []),
            ]}>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* ── Left: Details ── */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Title & description */}
                    <div className="rounded-xl border p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <h2 className="text-lg font-semibold">{ticket.title}</h2>
                            <div className="flex gap-2 flex-wrap">
                                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${PRIORITY_STYLE[ticket.priority]}`}>
                                    {priorities[ticket.priority]?.label}
                                </span>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[ticket.status]}`}>
                                    {statuses[ticket.status]?.label}
                                </span>
                            </div>
                        </div>

                        {ticket.description && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('Description')}</p>
                                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
                            </div>
                        )}

                        {ticket.steps_to_reproduce && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('Steps to Reproduce')}</p>
                                <p className="text-sm whitespace-pre-wrap">{ticket.steps_to_reproduce}</p>
                            </div>
                        )}
                    </div>

                    {/* Attachments */}
                    <div className="rounded-xl border p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-medium text-sm flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" />{t('Attachments')} ({ticket.attachments.length})</h3>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileRef.current?.click()}>
                                <Paperclip className="w-3 h-3 mr-1" />{t('Attach')}
                            </Button>
                            <input ref={fileRef} type="file" className="hidden" onChange={uploadFile} />
                        </div>
                        {ticket.attachments.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">{t('No attachments')}</p>
                        ) : (
                            <div className="space-y-1.5">
                                {ticket.attachments.map(a => (
                                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm group">
                                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="flex-1 truncate text-xs">{a.file_name}</span>
                                        <span className="text-xs text-muted-foreground">{fmtBytes(a.file_size)}</span>
                                        <a href={route('ict-ticket-attachments.download', a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Download className="w-3.5 h-3.5" />
                                        </a>
                                        {(can.delete || a.uploader?.id === currentUser?.id) && (
                                            <button onClick={() => deleteAttachment(a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Comments */}
                    <div className="rounded-xl border p-4">
                        <h3 className="font-medium text-sm flex items-center gap-1.5 mb-4"><MessageSquare className="w-3.5 h-3.5" />{t('Comments')} ({ticket.comments.filter(c => !c.is_internal).length})</h3>

                        <div className="space-y-3 mb-4">
                            {ticket.comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">{t('No comments yet')}</p>}
                            {ticket.comments.map(c => (
                                !c.is_internal || can.assign ? (
                                    <div key={c.id} className={`rounded-lg p-3 ${c.is_internal ? 'bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800' : 'bg-muted/40'}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold" style={{ background: '#E3B448', color: '#001a4d' }}>
                                                    {c.user?.name?.[0]?.toUpperCase()}
                                                </span>
                                                <span className="text-sm font-medium">{c.user?.name}</span>
                                                {c.is_internal && <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-300 text-amber-600">{t('Internal')}</Badge>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</span>
                                                {c.user_id === currentUser?.id && (
                                                    <button onClick={() => router.delete(route('ict-ticket-comments.destroy', c.id), { onSuccess: () => toast.success('Deleted') })} className="text-muted-foreground hover:text-destructive">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                                    </div>
                                ) : null
                            ))}
                        </div>

                        {can.comment && (
                            <div className="space-y-2">
                                <Textarea value={comment} onChange={e => setComment(e.target.value)}
                                    placeholder={t('Add a comment or update...')} rows={3}
                                    onKeyDown={e => e.key === 'Enter' && e.ctrlKey && submitComment()} />
                                <div className="flex items-center justify-between">
                                    {can.assign && (
                                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                            <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                                            {t('Internal note (IT staff only)')}
                                        </label>
                                    )}
                                    <Button size="sm" onClick={submitComment} disabled={sending || !comment.trim()} style={{ background: '#E3B448', color: '#001a4d' }} className="ml-auto">
                                        {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                                        {t('Send')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Meta panel ── */}
                <div className="space-y-3">

                    {/* Status & Actions */}
                    <div className="rounded-xl border p-4 space-y-3">
                        <h3 className="font-medium text-sm">{t('Status')}</h3>
                        <div className="grid grid-cols-2 gap-1.5">
                            {Object.entries(statuses).map(([k, s]) => (
                                <button key={k} onClick={() => changeStatus(k)} disabled={!can.update}
                                    className={`text-xs px-2 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${ticket.status === k ? STATUS_STYLE[k] + ' font-semibold' : 'hover:bg-muted'}`}>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Assign */}
                    {can.assign && (
                        <div className="rounded-xl border p-4 space-y-2">
                            <h3 className="font-medium text-sm">{t('Assigned To')}</h3>
                            <Select value={ticket.assigned_to ? String(ticket.assigned_to) : 'none'} onValueChange={assign}>
                                <SelectTrigger className="text-sm"><SelectValue placeholder={t('Unassigned')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{t('Unassigned')}</SelectItem>
                                    {members.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Details */}
                    <div className="rounded-xl border p-4 space-y-3 text-sm">
                        <h3 className="font-medium">{t('Details')}</h3>
                        {[
                            { icon: <Ticket className="w-3.5 h-3.5" />,   label: t('Ticket #'),    value: ticket.ticket_number },
                            { icon: <User className="w-3.5 h-3.5" />,     label: t('Reported By'), value: ticket.reportedBy?.name },
                            { icon: <Building2 className="w-3.5 h-3.5" />,label: t('Subsidiary'),  value: ticket.subsidiary || '—' },
                            { icon: <User className="w-3.5 h-3.5" />,     label: t('Department'),  value: ticket.department || '—' },
                            { icon: <MapPin className="w-3.5 h-3.5" />,   label: t('Location'),    value: ticket.location || '—' },
                            { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: t('Category'), value: categories[ticket.category] || ticket.category },
                            { icon: <Calendar className="w-3.5 h-3.5" />, label: t('Submitted'),   value: fmtDate(ticket.created_at) },
                            { icon: <Clock className="w-3.5 h-3.5" />,    label: t('Due'),         value: ticket.due_date ? fmtDate(ticket.due_date) : '—' },
                            { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: t('Resolved'), value: ticket.resolved_at ? fmtDate(ticket.resolved_at) : '—' },
                        ].map(row => (
                            <div key={row.label} className="flex items-start gap-2">
                                <span className="text-muted-foreground mt-0.5 shrink-0">{row.icon}</span>
                                <div>
                                    <p className="text-xs text-muted-foreground">{row.label}</p>
                                    <p className="font-medium text-xs">{row.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Resolution notes */}
                    {can.update && (
                        <div className="rounded-xl border p-4 space-y-2">
                            <h3 className="font-medium text-sm">{t('Resolution Notes')}</h3>
                            <Textarea defaultValue={ticket.resolution_notes ?? ''}
                                onBlur={e => {
                                    if (e.target.value !== ticket.resolution_notes) {
                                        router.put(route('ict-tickets.update', ticket.id), { resolution_notes: e.target.value });
                                    }
                                }}
                                placeholder={t('Describe how the issue was resolved...')} rows={3} className="text-sm" />
                        </div>
                    )}
                </div>
            </div>

            {/* Delete confirmation */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>{t('Delete')} {ticket.ticket_number}?</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">{t('This ticket and all its comments will be permanently deleted.')}</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t('Cancel')}</Button>
                        <Button variant="destructive" onClick={deleteTicket}>{t('Delete')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageTemplate>
    );
}
