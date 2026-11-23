import { ListToolbar } from '@/components/erp/list-toolbar';
import { ActionButton, useConfirmDelete } from '@/components/erp/record-actions';
import { LEAD_STATUS_LABELS, type LeadStatus } from '@/components/erp/sales';
import { Empty, Field, Pagination, StatusBadge, formatDate, inputClass, primaryButton, secondaryButton, type Paginated } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowRightCircle, BadgeCheck, Pencil, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Person = { id: number; name: string };
type Lead = {
    id: number;
    name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    source: string | null;
    status: LeadStatus;
    assigned_to: Person | null;
    created_at: string | null;
    opportunities: { id: number; title: string }[];
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    leads: Paginated<Lead> & { from: number | null; to: number | null };
    filters: { search: string; status: LeadStatus | 'all' };
    counts: Record<LeadStatus, number>;
    members: Person[];
    customers: { id: number; code: string; name: string }[];
    canManage: boolean;
};

type Row = Lead;

export default function LeadsIndex({ company, leads, filters, counts, members, customers, canManage }: Props) {
    const [editing, setEditing] = useState<Row | 'new' | null>(null);
    const [converting, setConverting] = useState<Row | null>(null);
    const { askDelete, deleteDialog } = useConfirmDelete();
    const [busy, setBusy] = useState(false);
    const pageErrors = usePage().props.errors as Record<string, string>;
    const flowError = editing === null && converting === null ? (pageErrors.lead ?? pageErrors.status) : undefined;

    const setStatus = (lead: Row, status: LeadStatus) =>
        router.post(route('erp.sales.leads.status', lead.id), { status }, { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false) });

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const tabs = [
        { key: 'all', label: 'All', count: total },
        ...(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((key) => ({ key, label: LEAD_STATUS_LABELS[key], count: counts[key] })),
    ];

    const actions = (lead: Row, showLabels = false) =>
        canManage && (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
                {lead.status !== 'converted' && (
                    <>
                        <ActionButton icon={Pencil} label="Edit" tone="edit" onClick={() => setEditing(lead)} showLabel={showLabels} />
                        {lead.status !== 'lost' && (
                            <ActionButton icon={ArrowRightCircle} label="Make opportunity" tone="view" onClick={() => setConverting(lead)} showLabel={showLabels} />
                        )}
                        {lead.status === 'new' && (
                            <ActionButton icon={BadgeCheck} label="Qualify" disabled={busy} onClick={() => setStatus(lead, 'qualified')} showLabel={showLabels} />
                        )}
                        {lead.status === 'lost' ? (
                            <ActionButton icon={RotateCcw} label="Reopen" disabled={busy} onClick={() => setStatus(lead, 'new')} showLabel={showLabels} />
                        ) : (
                            <ActionButton icon={XCircle} label="Mark lost" disabled={busy} onClick={() => setStatus(lead, 'lost')} showLabel={showLabels} />
                        )}
                        <ActionButton
                            icon={Trash2}
                            label="Delete"
                            tone="delete"
                            onClick={() => askDelete({ url: route('erp.sales.leads.destroy', lead.id), title: `Delete the lead ${lead.name}?` })}
                            showLabel={showLabels}
                        />
                    </>
                )}
            </div>
        );

    const opportunityLink = (lead: Row) =>
        lead.opportunities[0] && (
            <Link href={route('erp.sales.opportunities.index', { search: lead.opportunities[0].title, status: 'all' })} className="text-primary text-xs hover:underline">
                → {lead.opportunities[0].title}
            </Link>
        );

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-muted-foreground text-sm">
                        <Link href={route('erp.sales.index')} className="hover:underline">
                            Sales
                        </Link>{' '}
                        · {company.name}
                    </p>
                    <h1 className="text-2xl font-semibold">Leads</h1>
                    <p className="text-muted-foreground mt-1 text-sm">People and organisations that may buy. Qualify them, then make them opportunities.</p>
                </div>
                {canManage && (
                    <button type="button" onClick={() => setEditing('new')} className={`${primaryButton} gap-2`}>
                        <Plus className="size-4" /> New lead
                    </button>
                )}
            </header>

            {flowError && <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-4 py-3 text-sm">{flowError}</p>}

            <ListToolbar
                url={route('erp.sales.leads.index')}
                filters={filters}
                tabs={tabs}
                placeholder="Name, contact, email, phone or source"
                label="Search leads"
            />

            {leads.data.length === 0 ? (
                <Empty>{filters.search ? `No leads match “${filters.search}”.` : 'No leads here yet.'}</Empty>
            ) : (
                <section className="bg-card/70 overflow-hidden rounded-xl border">
                    <ul className="divide-y md:hidden">
                        {leads.data.map((lead) => (
                            <li key={lead.id} className="space-y-2 px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="font-medium break-words">{lead.name}</span>
                                    <StatusBadge value={lead.status} label={LEAD_STATUS_LABELS[lead.status]} />
                                </div>
                                <div className="text-muted-foreground text-sm break-words">
                                    {[lead.contact_person, lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact details'}
                                </div>
                                <div className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                                    {lead.source && <span>From {lead.source}</span>}
                                    <span>{lead.assigned_to?.name ?? 'Unassigned'}</span>
                                    <span>Added {formatDate(lead.created_at)}</span>
                                </div>
                                {opportunityLink(lead)}
                                {actions(lead)}
                            </li>
                        ))}
                    </ul>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-muted-foreground text-left text-xs tracking-wide uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Lead</th>
                                    <th className="px-4 py-3 font-medium">Contact</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Assigned to</th>
                                    {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {leads.data.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-muted/20 align-top">
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{lead.name}</div>
                                            <div className="text-muted-foreground text-xs">
                                                Added {formatDate(lead.created_at)}
                                                {lead.source && ` · from ${lead.source}`}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {lead.contact_person ?? '—'}
                                            <div className="text-muted-foreground text-xs break-all">{[lead.email, lead.phone].filter(Boolean).join(' · ')}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge value={lead.status} label={LEAD_STATUS_LABELS[lead.status]} />
                                            <div className="mt-1">{opportunityLink(lead)}</div>
                                        </td>
                                        <td className="px-4 py-3">{lead.assigned_to?.name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                                        {canManage && <td className="px-4 py-3">{actions(lead)}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {leads.total > 0 && (
                <p className="text-muted-foreground text-center text-sm">
                    Showing {leads.from}–{leads.to} of {leads.total}
                </p>
            )}
            <Pagination page={leads} />

            {editing !== null && <LeadDialog lead={editing === 'new' ? null : editing} members={members} onClose={() => setEditing(null)} />}
            {converting && <ConvertDialog lead={converting} customers={customers} currency={company.default_currency} onClose={() => setConverting(null)} />}
            {deleteDialog}
        </main>
    );
}

function LeadDialog({ lead, members, onClose }: { lead: Row | null; members: Person[]; onClose: () => void }) {
    const form = useForm({
        name: lead?.name ?? '',
        contact_person: lead?.contact_person ?? '',
        email: lead?.email ?? '',
        phone: lead?.phone ?? '',
        source: lead?.source ?? '',
        assigned_to: lead?.assigned_to ? String(lead.assigned_to.id) : '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, assigned_to: data.assigned_to || null }));
        const options = { preserveScroll: true, onSuccess: onClose };
        if (lead) form.put(route('erp.sales.leads.update', lead.id), options);
        else form.post(route('erp.sales.leads.store'), options);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && !form.processing && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{lead ? `Edit ${lead.name}` : 'New lead'}</DialogTitle>
                        <DialogDescription>Who might buy, and how to reach them.</DialogDescription>
                    </DialogHeader>
                    {'lead' in form.errors && <p className="text-destructive text-sm">{(form.errors as Record<string, string>).lead}</p>}
                    <Field label="Organisation or person" error={form.errors.name}>
                        <input className={inputClass} value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} required autoFocus />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Contact person" error={form.errors.contact_person}>
                            <input className={inputClass} value={form.data.contact_person} onChange={(e) => form.setData('contact_person', e.target.value)} />
                        </Field>
                        <Field label="Phone" error={form.errors.phone}>
                            <input className={inputClass} value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} />
                        </Field>
                        <Field label="Email" error={form.errors.email}>
                            <input type="email" className={inputClass} value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                        </Field>
                        <Field label="Where it came from" error={form.errors.source}>
                            <input
                                className={inputClass}
                                value={form.data.source}
                                placeholder="Referral, website, trade show…"
                                onChange={(e) => form.setData('source', e.target.value)}
                            />
                        </Field>
                    </div>
                    <Field label="Assigned to" error={form.errors.assigned_to}>
                        <select className={inputClass} value={form.data.assigned_to} onChange={(e) => form.setData('assigned_to', e.target.value)}>
                            <option value="">Unassigned</option>
                            {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <DialogFooter className="gap-2">
                        <button type="button" onClick={onClose} className={secondaryButton} disabled={form.processing}>
                            Cancel
                        </button>
                        <button type="submit" className={primaryButton} disabled={form.processing}>
                            {form.processing ? 'Saving…' : lead ? 'Save changes' : 'Add lead'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ConvertDialog({ lead, customers, currency, onClose }: { lead: Row; customers: Props['customers']; currency: string; onClose: () => void }) {
    const match = customers.find((customer) => customer.name.toLowerCase() === lead.name.toLowerCase());
    const form = useForm({
        title: `${lead.name} opportunity`,
        customer_id: match ? String(match.id) : '',
        expected_value: '',
        probability: lead.status === 'qualified' ? '50' : '25',
        close_date: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, customer_id: data.customer_id || null, expected_value: data.expected_value || null, close_date: data.close_date || null }));
        form.post(route('erp.sales.leads.convert', lead.id), { onSuccess: onClose });
    };
    const errors = form.errors as Record<string, string>;

    return (
        <Dialog open onOpenChange={(open) => !open && !form.processing && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Make {lead.name} an opportunity</DialogTitle>
                        <DialogDescription>The lead is marked as converted and the deal moves to Opportunities, where you can quote it.</DialogDescription>
                    </DialogHeader>
                    {errors.lead && <p className="text-destructive text-sm">{errors.lead}</p>}
                    <Field label="Opportunity" error={form.errors.title}>
                        <input className={inputClass} value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} required />
                    </Field>
                    <Field label="Customer" error={form.errors.customer_id}>
                        <select className={inputClass} value={form.data.customer_id} onChange={(e) => form.setData('customer_id', e.target.value)}>
                            <option value="">Not a customer yet</option>
                            {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.name} ({customer.code})
                                </option>
                            ))}
                        </select>
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field label={`Expected value (${currency})`} error={form.errors.expected_value}>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                className={inputClass}
                                value={form.data.expected_value}
                                onChange={(e) => form.setData('expected_value', e.target.value)}
                            />
                        </Field>
                        <Field label="Chance (%)" error={form.errors.probability}>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                className={inputClass}
                                value={form.data.probability}
                                onChange={(e) => form.setData('probability', e.target.value)}
                            />
                        </Field>
                        <Field label="Expected close" error={form.errors.close_date}>
                            <input type="date" className={inputClass} value={form.data.close_date} onChange={(e) => form.setData('close_date', e.target.value)} />
                        </Field>
                    </div>
                    <DialogFooter className="gap-2">
                        <button type="button" onClick={onClose} className={secondaryButton} disabled={form.processing}>
                            Cancel
                        </button>
                        <button type="submit" className={primaryButton} disabled={form.processing}>
                            {form.processing ? 'Saving…' : 'Make opportunity'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
