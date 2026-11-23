import { ListToolbar } from '@/components/erp/list-toolbar';
import { ActionButton, useConfirmDelete } from '@/components/erp/record-actions';
import { OPPORTUNITY_STATUS_LABELS, money, type OpportunityStatus } from '@/components/erp/sales';
import { Empty, Field, Pagination, StatusBadge, formatDate, inputClass, primaryButton, secondaryButton, toDateInput, type Paginated } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { FilePlus2, Pencil, Plus, RotateCcw, Trash2, Trophy, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Person = { id: number; name: string };
type Customer = { id: number; code: string; name: string };
type Opportunity = {
    id: number;
    title: string;
    status: OpportunityStatus;
    expected_value: string;
    probability: number;
    close_date: string | null;
    customer: Customer | null;
    lead: { id: number; name: string } | null;
    assigned_to: Person | null;
    quotations_count: number;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    opportunities: Paginated<Opportunity> & { from: number | null; to: number | null };
    filters: { search: string; status: OpportunityStatus | 'all' };
    counts: Record<OpportunityStatus, number>;
    pipeline: { open_value: string; weighted_value: string; won_value: string };
    members: Person[];
    customers: Customer[];
    canManage: boolean;
};

const today = new Date().toISOString().slice(0, 10);

export default function OpportunitiesIndex({ company, opportunities, filters, counts, pipeline, members, customers, canManage }: Props) {
    const currency = company.default_currency;
    const [editing, setEditing] = useState<Opportunity | 'new' | null>(null);
    const { askDelete, deleteDialog } = useConfirmDelete();
    const [busy, setBusy] = useState(false);
    const pageErrors = usePage().props.errors as Record<string, string>;
    const flowError = editing === null ? (pageErrors.opportunity ?? pageErrors.status) : undefined;

    const setStatus = (opportunity: Opportunity, status: OpportunityStatus) =>
        router.post(route('erp.sales.opportunities.status', opportunity.id), { status }, { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false) });

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const tabs = [
        ...(Object.keys(OPPORTUNITY_STATUS_LABELS) as OpportunityStatus[]).map((key) => ({ key, label: OPPORTUNITY_STATUS_LABELS[key], count: counts[key] })),
        { key: 'all', label: 'All', count: total },
    ];

    const actions = (opportunity: Opportunity) =>
        canManage && (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
                {opportunity.status === 'open' ? (
                    <>
                        <ActionButton icon={FilePlus2} label="New quotation" tone="view" href={route('erp.sales.quotations.create', { opportunity: opportunity.id })} />
                        <ActionButton icon={Pencil} label="Edit" tone="edit" onClick={() => setEditing(opportunity)} />
                        <ActionButton icon={Trophy} label="Mark won" disabled={busy} onClick={() => setStatus(opportunity, 'won')} />
                        <ActionButton icon={XCircle} label="Mark lost" disabled={busy} onClick={() => setStatus(opportunity, 'lost')} />
                    </>
                ) : (
                    <ActionButton icon={RotateCcw} label="Reopen" disabled={busy} onClick={() => setStatus(opportunity, 'open')} />
                )}
                {opportunity.quotations_count === 0 && (
                    <ActionButton
                        icon={Trash2}
                        label="Delete"
                        tone="delete"
                        onClick={() => askDelete({ url: route('erp.sales.opportunities.destroy', opportunity.id), title: `Delete “${opportunity.title}”?` })}
                    />
                )}
            </div>
        );

    const closeDate = (opportunity: Opportunity) => {
        if (!opportunity.close_date) return <span className="text-muted-foreground">—</span>;
        const late = opportunity.status === 'open' && opportunity.close_date.slice(0, 10) < today;
        return <span className={late ? 'font-medium text-amber-700 dark:text-amber-400' : ''}>{formatDate(opportunity.close_date)}{late && ' · overdue'}</span>;
    };

    const who = (opportunity: Opportunity) => opportunity.customer?.name ?? opportunity.lead?.name ?? 'No customer yet';

    const quotesLink = (opportunity: Opportunity) =>
        opportunity.quotations_count > 0 && (
            <Link href={route('erp.sales.quotations.index', { search: opportunity.customer?.name ?? '' })} className="text-primary text-xs hover:underline">
                {opportunity.quotations_count} quotation{opportunity.quotations_count === 1 ? '' : 's'}
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
                    <h1 className="text-2xl font-semibold">Opportunities</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Possible deals, what they are worth and how likely they are. Quote them from here.</p>
                </div>
                {canManage && (
                    <button type="button" onClick={() => setEditing('new')} className={`${primaryButton} gap-2`}>
                        <Plus className="size-4" /> New opportunity
                    </button>
                )}
            </header>

            <section className="grid gap-3 sm:grid-cols-3">
                <Stat label="Open pipeline" value={money(currency, pipeline.open_value)} note={`${counts.open} open`} />
                <Stat label="Weighted by chance" value={money(currency, pipeline.weighted_value)} note="Expected value × chance of winning" />
                <Stat label="Won" value={money(currency, pipeline.won_value)} note={`${counts.won} won`} />
            </section>

            {flowError && <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-4 py-3 text-sm">{flowError}</p>}

            <ListToolbar
                url={route('erp.sales.opportunities.index')}
                filters={filters}
                tabs={tabs}
                defaultStatus="open"
                placeholder="Title, customer or lead"
                label="Search opportunities"
            />

            {opportunities.data.length === 0 ? (
                <Empty>{filters.search ? `No opportunities match “${filters.search}”.` : 'No opportunities here yet. Add one, or make one from a lead.'}</Empty>
            ) : (
                <section className="bg-card/70 overflow-hidden rounded-xl border">
                    <ul className="divide-y md:hidden">
                        {opportunities.data.map((opportunity) => (
                            <li key={opportunity.id} className="space-y-2 px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="font-medium break-words">{opportunity.title}</span>
                                    <span className="shrink-0 font-medium tabular-nums">{money(currency, opportunity.expected_value)}</span>
                                </div>
                                <div className="text-muted-foreground text-sm">{who(opportunity)}</div>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <StatusBadge value={opportunity.status} label={OPPORTUNITY_STATUS_LABELS[opportunity.status]} />
                                    <span className="text-muted-foreground">{opportunity.probability}% chance</span>
                                    <span className="text-muted-foreground">Close {closeDate(opportunity)}</span>
                                    {quotesLink(opportunity)}
                                </div>
                                {actions(opportunity)}
                            </li>
                        ))}
                    </ul>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-muted-foreground text-left text-xs tracking-wide uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Opportunity</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Expected close</th>
                                    <th className="px-4 py-3 text-right font-medium">Value</th>
                                    <th className="px-4 py-3 text-right font-medium">Chance</th>
                                    {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {opportunities.data.map((opportunity) => (
                                    <tr key={opportunity.id} className="hover:bg-muted/20 align-top">
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{opportunity.title}</div>
                                            <div className="text-muted-foreground text-xs">
                                                {who(opportunity)}
                                                {opportunity.assigned_to && ` · ${opportunity.assigned_to.name}`}
                                            </div>
                                            {quotesLink(opportunity)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge value={opportunity.status} label={OPPORTUNITY_STATUS_LABELS[opportunity.status]} />
                                        </td>
                                        <td className="px-4 py-3">{closeDate(opportunity)}</td>
                                        <td className="px-4 py-3 text-right font-medium tabular-nums">{money(currency, opportunity.expected_value)}</td>
                                        <td className="px-4 py-3 text-right tabular-nums">{opportunity.probability}%</td>
                                        {canManage && <td className="px-4 py-3">{actions(opportunity)}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {opportunities.total > 0 && (
                <p className="text-muted-foreground text-center text-sm">
                    Showing {opportunities.from}–{opportunities.to} of {opportunities.total}
                </p>
            )}
            <Pagination page={opportunities} />

            {editing !== null && (
                <OpportunityDialog
                    opportunity={editing === 'new' ? null : editing}
                    customers={customers}
                    members={members}
                    currency={currency}
                    onClose={() => setEditing(null)}
                />
            )}
            {deleteDialog}
        </main>
    );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
    return (
        <div className="bg-card/70 rounded-xl border p-4">
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
            <p className="text-muted-foreground mt-1 text-xs">{note}</p>
        </div>
    );
}

function OpportunityDialog({
    opportunity,
    customers,
    members,
    currency,
    onClose,
}: {
    opportunity: Opportunity | null;
    customers: Customer[];
    members: Person[];
    currency: string;
    onClose: () => void;
}) {
    const form = useForm({
        title: opportunity?.title ?? '',
        customer_id: opportunity?.customer ? String(opportunity.customer.id) : '',
        expected_value: opportunity ? String(Number(opportunity.expected_value)) : '',
        probability: opportunity ? String(opportunity.probability) : '25',
        close_date: toDateInput(opportunity?.close_date),
        assigned_to: opportunity?.assigned_to ? String(opportunity.assigned_to.id) : '',
    });
    const errors = form.errors as Record<string, string>;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            customer_id: data.customer_id || null,
            expected_value: data.expected_value || null,
            close_date: data.close_date || null,
            assigned_to: data.assigned_to || null,
        }));
        const options = { preserveScroll: true, onSuccess: onClose };
        if (opportunity) form.put(route('erp.sales.opportunities.update', opportunity.id), options);
        else form.post(route('erp.sales.opportunities.store'), options);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && !form.processing && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{opportunity ? 'Edit opportunity' : 'New opportunity'}</DialogTitle>
                        <DialogDescription>A possible deal: who it is with, what it could be worth and when you expect to close it.</DialogDescription>
                    </DialogHeader>
                    {errors.opportunity && <p className="text-destructive text-sm">{errors.opportunity}</p>}
                    <Field label="Title" error={form.errors.title}>
                        <input className={inputClass} value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} required autoFocus />
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
                            {form.processing ? 'Saving…' : opportunity ? 'Save changes' : 'Add opportunity'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
