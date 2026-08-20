import { PageTemplate } from '@/components/page-template';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
    Clock, Filter, Loader2, MonitorSmartphone, Plus, Search, Ticket, UserCheck, X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TicketUser { id: number; name: string; email: string }

interface IctTicket {
    id: number; ticket_number: string; title: string; description?: string;
    status: string; priority: string; issue_type?: string; category: string;
    subsidiary?: string; department?: string; location?: string;
    reported_by: number; assigned_to?: number;
    reportedBy?: TicketUser; assignedTo?: TicketUser;
    created_at: string; due_date?: string; resolved_at?: string;
}

interface PaginatedTickets {
    data: IctTicket[];
    current_page: number; last_page: number; per_page: number; total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    tickets: PaginatedTickets;
    stats: { open: number; in_progress: number; pending: number; resolved: number; total: number; overdue?: number };
    members: TicketUser[];
    subsidiaries: string[];
    departments: string[];
    issue_types: Record<string, string>;
    categories: Record<string, string>;
    categories_by_type: Record<string, Record<string, string>>;
    statuses: Record<string, { label: string; color: string }>;
    priorities: Record<string, { label: string; color: string }>;
    filters: Record<string, string>;
    can: { create: boolean; assign: boolean };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400',
    high:     'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
    medium:   'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
    low:      'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_STYLE: Record<string, string> = {
    open:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    pending:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    resolved:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    closed:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function formatDate(d?: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Returns human-readable SLA remaining time or 'Overdue' */
function slaLabel(dueDate?: string, status?: string): { text: string; overdue: boolean } | null {
    if (!dueDate || status === 'resolved' || status === 'closed') return null;
    const diff = new Date(dueDate).getTime() - Date.now();
    const overdue = diff < 0;
    const abs = Math.abs(diff);
    const hours = Math.floor(abs / 3600000);
    const mins  = Math.floor((abs % 3600000) / 60000);
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return { text: overdue ? `${days}d overdue` : `${days}d left`, overdue };
    }
    return { text: overdue ? `${hours}h ${mins}m overdue` : `${hours}h ${mins}m left`, overdue };
}

// ── Create Ticket Modal ───────────────────────────────────────────────────────

function CreateTicketModal({ open, onClose, subsidiaries, departments, issue_types, categories_by_type, csrf }: {
    open: boolean; onClose: () => void;
    subsidiaries: string[]; departments: string[];
    issue_types: Record<string, string>;
    categories_by_type: Record<string, Record<string, string>>;
    csrf: string;
}) {
    const { t } = useTranslation();
    const emptyForm = { title: '', description: '', steps_to_reproduce: '', priority: 'medium', issue_type: 'it_systems', category: 'other', subsidiary: '', department: '', location: '' };
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const set = (k: string, v: string) => setForm(prev => {
        const updated = { ...prev, [k]: v };
        // Reset category when issue_type changes
        if (k === 'issue_type') updated.category = 'other';
        return updated;
    });

    const availableCategories = categories_by_type[form.issue_type] ?? { other: 'Other' };

    const submit = () => {
        if (!form.title.trim()) { toast.error('Title is required'); return; }
        setSaving(true);
        router.post(route('ict-tickets.store'), form as any, {
            onSuccess: () => { onClose(); setForm(emptyForm); },
            onError: () => toast.error('Failed to submit issue report'),
            onFinish: () => setSaving(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Ticket className="w-4 h-4" style={{ color: '#E3B448' }} />
                        {t('Report an Issue — Trukumb Holdings Group')}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                        <Label>{t('Issue Title')} *</Label>
                        <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('Brief description of the issue')} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>{t('Issue Type')}</Label>
                            <Select value={form.issue_type} onValueChange={v => set('issue_type', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="z-[110000]">
                                    {Object.entries(issue_types).map(([k, label]) => (
                                        <SelectItem key={k} value={k}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('Specific Category')}</Label>
                            <Select value={form.category} onValueChange={v => set('category', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="z-[110000]">
                                    {Object.entries(availableCategories).map(([k, label]) => (
                                        <SelectItem key={k} value={k}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>{t('Priority')}</Label>
                            <Select value={form.priority} onValueChange={v => set('priority', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="z-[110000]">
                                    {['low','medium','high','critical'].map(p => (
                                        <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('Subsidiary / Business Unit')}</Label>
                            <Select value={form.subsidiary} onValueChange={v => set('subsidiary', v)}>
                                <SelectTrigger><SelectValue placeholder={t('Select subsidiary')} /></SelectTrigger>
                                <SelectContent className="z-[110000]">
                                    {subsidiaries.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>{t('Department')}</Label>
                            <Select value={form.department} onValueChange={v => set('department', v)}>
                                <SelectTrigger><SelectValue placeholder={t('Select department')} /></SelectTrigger>
                                <SelectContent className="z-[110000]">
                                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('Location / Office')}</Label>
                            <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder={t('e.g. Filabusi Head Office, Room 204')} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>{t('Description')}</Label>
                        <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder={t('Describe the issue in detail — what happened, when, and the impact')} rows={3} />
                    </div>

                    <div className="space-y-1">
                        <Label>{t('Steps to Reproduce (if applicable)')}</Label>
                        <Textarea value={form.steps_to_reproduce} onChange={e => set('steps_to_reproduce', e.target.value)} placeholder={t('1. ...\n2. ...\n3. Error / issue appears')} rows={2} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>{t('Cancel')}</Button>
                    <Button onClick={submit} disabled={saving} style={{ background: '#E3B448', color: '#001a4d' }}>
                        {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{t('Submitting...')}</> : <>{t('Submit Issue Report')}</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IctTicketsIndex({ tickets, stats, members, subsidiaries, departments, issue_types, categories, categories_by_type, statuses, priorities, filters, can }: Props) {
    const { t } = useTranslation();
    const { csrf_token } = usePage().props as any;
    const [createOpen, setCreateOpen] = useState(false);
    const [localFilters, setLocalFilters] = useState(filters);

    const applyFilters = (newFilters: Record<string, string>) => {
        const clean = Object.fromEntries(Object.entries(newFilters).filter(([, v]) => v));
        router.get(route('ict-tickets.index'), clean, { preserveState: true, replace: true });
    };

    const setFilter = (k: string, v: string) => {
        const updated = { ...localFilters, [k]: v };
        setLocalFilters(updated);
        applyFilters(updated);
    };

    const clearFilters = () => {
        setLocalFilters({});
        router.get(route('ict-tickets.index'));
    };

    const hasFilters = Object.values(localFilters).some(Boolean);

    return (
        <PageTemplate
            title={t('Group Issue Reporting')}
            description={t('Trukumb Holdings — Group-wide issue reporting across all subsidiaries')}
            actions={can.create ? [{ label: t('New Ticket'), icon: <Plus className="w-3.5 h-3.5 mr-1" />, variant: 'default', onClick: () => setCreateOpen(true) }] : []}
        >
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                {[  
                    { label: t('Total'),       value: stats.total,       icon: <Ticket className="w-4 h-4" />,       color: '#E3B448' },
                    { label: t('Open'),        value: stats.open,        icon: <AlertCircle className="w-4 h-4" />,  color: '#3B82F6' },
                    { label: t('In Progress'), value: stats.in_progress, icon: <Clock className="w-4 h-4" />,       color: '#F59E0B' },
                    { label: t('Pending'),     value: stats.pending,     icon: <UserCheck className="w-4 h-4" />,   color: '#8B5CF6' },
                    { label: t('Resolved'),    value: stats.resolved,    icon: <CheckCircle2 className="w-4 h-4" />, color: '#10B981' },
                    { label: t('Overdue'),     value: stats.overdue ?? 0,icon: <AlertTriangle className="w-4 h-4" />, color: '#EF4444' },
                ].map(s => (
                    <div key={s.label} className="rounded-xl border p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}20`, color: s.color }}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="text-2xl font-bold leading-none">{s.value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input className="pl-8 h-8 text-sm" placeholder={t('Search tickets...')} value={localFilters.search ?? ''}
                        onChange={e => setFilter('search', e.target.value)} />
                </div>

                {[
                    { key: 'status', placeholder: t('Status'), options: Object.entries(statuses).map(([v, s]) => ({ value: v, label: s.label })) },
                    { key: 'priority', placeholder: t('Priority'), options: Object.entries(priorities).map(([v, p]) => ({ value: v, label: p.label })) },
                    { key: 'category', placeholder: t('Category'), options: Object.entries(categories).map(([v, l]) => ({ value: v, label: l })) },
                    { key: 'subsidiary', placeholder: t('Subsidiary'), options: subsidiaries.map(s => ({ value: s, label: s })) },
                ].map(f => (
                    <Select key={f.key} value={localFilters[f.key] || ''} onValueChange={v => setFilter(f.key, v === 'all' ? '' : v)}>
                        <SelectTrigger className="h-8 text-sm w-auto min-w-[120px]">
                            <Filter className="w-3 h-3 mr-1 opacity-50" />
                            <SelectValue placeholder={f.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('All')}</SelectItem>
                            {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                ))}

                {hasFilters && (
                    <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
                        <X className="w-3 h-3 mr-1" />{t('Clear')}
                    </Button>
                )}
            </div>

            {/* Ticket table */}
            <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/40">
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t('Ticket')}</th>
                            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">{t('Category')}</th>
                            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">{t('Subsidiary')}</th>
                            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">{t('Priority')}</th>
                            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">{t('Status')}</th>
                            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">{t('Reported By')}</th>
                            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">{t('Assigned To')}</th>
                            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">{t('SLA')}</th>
                            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">{t('Date')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.data.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">
                                <MonitorSmartphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p>{t('No tickets found')}</p>
                                {can.create && <Button size="sm" className="mt-3" onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" />{t('Submit first ticket')}</Button>}
                            </td></tr>
                        )}
                        {tickets.data.map(ticket => (
                            <tr key={ticket.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                    <Link href={route('ict-tickets.show', ticket.id)} className="hover:underline">
                                        <p className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</p>
                                        <p className="font-medium mt-0.5 line-clamp-1">{ticket.title}</p>
                                    </Link>
                                </td>
                                <td className="px-3 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                                    {categories[ticket.category] ?? ticket.category}
                                </td>
                                <td className="px-3 py-3 hidden md:table-cell text-xs text-muted-foreground max-w-[140px] truncate">
                                    {ticket.subsidiary || '—'}
                                </td>
                                <td className="px-3 py-3">
                                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_STYLE[ticket.priority]}`}>
                                        {priorities[ticket.priority]?.label ?? ticket.priority}
                                    </span>
                                </td>
                                <td className="px-3 py-3">
                                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[ticket.status]}`}>
                                        {statuses[ticket.status]?.label ?? ticket.status}
                                    </span>
                                </td>
                                <td className="px-3 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                                    {ticket.reportedBy?.name ?? '—'}
                                </td>
                                <td className="px-3 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                                    {ticket.assignedTo?.name ?? <span className="italic opacity-60">{t('Unassigned')}</span>}
                                </td>
                                <td className="px-3 py-3">
                                    {(() => {
                                        const sla = slaLabel(ticket.due_date, ticket.status);
                                        if (!sla) return <span className="text-xs text-muted-foreground">—</span>;
                                        return (
                                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                                sla.overdue
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>
                                                {sla.overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                {sla.text}
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td className="px-3 py-3 hidden xl:table-cell text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDate(ticket.created_at)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {tickets.last_page > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm">
                    <p className="text-muted-foreground">{t('Showing')} {(tickets.current_page - 1) * tickets.per_page + 1}–{Math.min(tickets.current_page * tickets.per_page, tickets.total)} {t('of')} {tickets.total}</p>
                    <div className="flex gap-1">
                        {tickets.links.map((link, i) => (
                            <Button key={i} size="sm" variant={link.active ? 'default' : 'outline'} className="h-7 px-2 text-xs"
                                disabled={!link.url} onClick={() => link.url && router.visit(link.url)}
                                dangerouslySetInnerHTML={{ __html: link.label }} />
                        ))}
                    </div>
                </div>
            )}

            <CreateTicketModal
                open={createOpen} onClose={() => setCreateOpen(false)}
                subsidiaries={subsidiaries} departments={departments}
                issue_types={issue_types} categories_by_type={categories_by_type}
                csrf={csrf_token}
            />
        </PageTemplate>
    );
}
