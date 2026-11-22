import { money, shortDate } from '@/components/banking/money';
import { Card, Empty, Field, Page, Pagination, Select, TextInput, primaryButton, secondaryButton, type Paginated } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { router, useForm } from '@inertiajs/react';
import { ArrowDownLeft, ArrowUpRight, Check, CheckCheck, FileText, Link2, MessageSquareText, Search, Undo2, Wand2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Payment = {
    key: string;
    type: 'customer_payment' | 'vendor_payment';
    id: number;
    date: string;
    amount: number;
    number: string | null;
    partner: string | null;
    reference: string | null;
    method: string | null;
    document_id: number | null;
    score?: number;
};

type Line = {
    id: number;
    date: string;
    type: string | null;
    description: string | null;
    reference: string | null;
    direction: 'in' | 'out';
    amount: number;
    state: 'open' | 'matched' | 'explained' | 'transfer';
    note: string | null;
    reconciled_by: string | null;
    reconciled_at: string | null;
    matched: Payment[];
    suggestions: Payment[];
};

type Props = {
    account: {
        id: number;
        account_number: string;
        account_name: string;
        currency: string;
        bank: string;
        company: { id: number; code: string; name: string };
    };
    accounts: { id: number; label: string }[];
    filters: { status: 'open' | 'reconciled' | 'all'; from: string; to: string };
    summary: {
        lines: number;
        reconciled: number;
        open: number;
        open_in: number;
        open_out: number;
        unbanked_receipts: number;
        unbanked_payments: number;
    };
    lines: Paginated<Line>;
    search?: { line_id: number; q: string; results: Payment[] } | null;
    canManage: boolean;
};

const tabs: { value: Props['filters']['status']; label: string }[] = [
    { value: 'open', label: 'To reconcile' },
    { value: 'reconciled', label: 'Reconciled' },
    { value: 'all', label: 'All lines' },
];

const explanations = ['Bank charges', 'Interest', 'Cash withdrawal', 'Tax deducted by the bank', 'Payroll'];

function daysApart(a: string, b: string): number {
    return Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

export default function Reconcile({ account, accounts, filters, summary, lines, search, canManage }: Props) {
    const [period, setPeriod] = useState({ from: filters.from, to: filters.to });
    const [finding, setFinding] = useState<Line | null>(null);
    const [explaining, setExplaining] = useState<Line | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const done = summary.lines === 0 ? 0 : Math.round((summary.reconciled / summary.lines) * 100);

    const visit = (changes: Partial<Props['filters']>) =>
        router.get(
            route('erp.banking.reconcile.show', account.id),
            Object.fromEntries(Object.entries({ ...filters, ...period, ...changes }).filter(([, value]) => value !== '')),
            { preserveScroll: true },
        );

    const apply = (event: FormEvent) => {
        event.preventDefault();
        visit({});
    };

    const match = (line: Line, keys: string[], onDone?: () => void) => {
        setBusy(line.id);
        router.post(
            route('erp.banking.reconcile.match', line.id),
            { payments: keys },
            { preserveScroll: true, onFinish: () => setBusy(null), onSuccess: onDone },
        );
    };

    const undo = (line: Line) => {
        setBusy(line.id);
        router.delete(route('erp.banking.reconcile.undo', line.id), { preserveScroll: true, onFinish: () => setBusy(null) });
    };

    const autoMatch = () => router.post(route('erp.banking.reconcile.auto', account.id), {}, { preserveScroll: true });

    return (
        <Page
            title={`Reconcile · ${account.account_number}`}
            subtitle={
                <>
                    {account.account_name} · {account.bank} · held by {account.company.name} · {account.currency}
                </>
            }
            actions={
                <>
                    <a href={route('erp.banking.accounts.show', account.id)} className={secondaryButton}>
                        <FileText className="mr-1.5 size-4" /> Statement
                    </a>
                    {canManage && (
                        <button
                            type="button"
                            className={primaryButton}
                            onClick={autoMatch}
                            disabled={summary.open === 0}
                            aria-description="Matches every line that has exactly one possible payment"
                        >
                            <Wand2 className="mr-1.5 size-4" /> Auto-match
                        </button>
                    )}
                </>
            }
        >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-card/70 rounded-xl border p-4">
                    <div className="text-muted-foreground text-xs tracking-wide uppercase">Reconciled</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">
                        {summary.reconciled.toLocaleString()}{' '}
                        <span className="text-muted-foreground text-sm font-normal">of {summary.lines.toLocaleString()} lines</span>
                    </div>
                    <div
                        className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuenow={done}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div className="bg-primary h-full rounded-full" style={{ width: `${done}%` }} />
                    </div>
                </div>
                <Stat label="Money in still to match" value={money(summary.open_in)} hint={`${account.currency}`} />
                <Stat label="Money out still to match" value={money(summary.open_out)} hint={`${account.currency}`} />
                <Stat
                    label="Recorded, not on statement"
                    value={`${summary.unbanked_receipts} in · ${summary.unbanked_payments} out`}
                    hint="Receipts and vendor payments in the books with no bank line yet"
                />
            </div>

            <Card>
                <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
                    <Field label="Account" className="min-w-64 flex-1">
                        <Select
                            value={String(account.id)}
                            onChange={(value) => router.get(route('erp.banking.reconcile.show', Number(value)), { status: filters.status })}
                            options={accounts.map((a) => ({ value: String(a.id), label: a.label }))}
                        />
                    </Field>
                    <Field label="From">
                        <TextInput type="date" value={period.from} onChange={(v) => setPeriod({ ...period, from: v })} />
                    </Field>
                    <Field label="To">
                        <TextInput type="date" value={period.to} onChange={(v) => setPeriod({ ...period, to: v })} />
                    </Field>
                    <button type="submit" className={secondaryButton}>
                        Show
                    </button>
                </form>
                <div className="mt-4 flex flex-wrap gap-1 border-b" role="tablist">
                    {tabs.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            role="tab"
                            aria-selected={filters.status === tab.value}
                            onClick={() => visit({ status: tab.value })}
                            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${filters.status === tab.value ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground border-transparent'}`}
                        >
                            {tab.label}
                            {tab.value === 'open' && <span className="bg-muted ml-1.5 rounded-full px-1.5 text-xs tabular-nums">{summary.open}</span>}
                        </button>
                    ))}
                </div>
            </Card>

            {lines.data.length === 0 ? (
                <Empty>{filters.status === 'open' ? 'Every statement line in this view is reconciled.' : 'No statement lines in this view.'}</Empty>
            ) : (
                <div className="divide-y overflow-hidden rounded-xl border">
                    {lines.data.map((line) => (
                        <LineRow
                            key={line.id}
                            line={line}
                            canManage={canManage}
                            busy={busy === line.id}
                            onMatch={(keys) => match(line, keys)}
                            onFind={() => setFinding(line)}
                            onExplain={() => setExplaining(line)}
                            onUndo={() => undo(line)}
                        />
                    ))}
                </div>
            )}
            <Pagination page={lines} />

            {finding && (
                <FindDialog
                    line={finding}
                    search={search?.line_id === finding.id ? search : null}
                    onClose={() => setFinding(null)}
                    onMatch={(keys) => match(finding, keys, () => setFinding(null))}
                />
            )}
            {explaining && <ExplainDialog line={explaining} onClose={() => setExplaining(null)} />}
        </Page>
    );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="bg-card/70 rounded-xl border p-4" title={hint}>
            <div className="text-muted-foreground text-xs tracking-wide uppercase">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
        </div>
    );
}

function PaymentText({ payment, against }: { payment: Payment; against?: string }) {
    const gap = against ? daysApart(payment.date, against) : null;
    return (
        <span className="min-w-0">
            <span className="font-medium">{payment.number ?? 'Payment'}</span>
            {payment.partner && <span> · {payment.partner}</span>}
            <span className="text-muted-foreground">
                {' '}
                · {shortDate(payment.date)}
                {gap !== null && gap > 0 && (
                    <>
                        {' '}
                        ({gap} {gap === 1 ? 'day' : 'days'} apart)
                    </>
                )}
                {payment.reference && <> · ref {payment.reference}</>}
            </span>
        </span>
    );
}

function LineRow({
    line,
    canManage,
    busy,
    onMatch,
    onFind,
    onExplain,
    onUndo,
}: {
    line: Line;
    canManage: boolean;
    busy: boolean;
    onMatch: (keys: string[]) => void;
    onFind: () => void;
    onExplain: () => void;
    onUndo: () => void;
}) {
    const isIn = line.direction === 'in';
    return (
        <div className="bg-background/40 grid gap-3 p-4 md:grid-cols-[7rem_1fr_9rem]">
            <div className="text-sm">
                <div className="font-medium">{shortDate(line.date)}</div>
                {line.type && <div className="text-muted-foreground text-xs">{line.type}</div>}
            </div>

            <div className="min-w-0 space-y-2">
                <div className="text-sm">
                    {line.description || <span className="text-muted-foreground">No description</span>}
                    {line.reference && <span className="text-muted-foreground"> · ref {line.reference}</span>}
                </div>

                {line.state === 'transfer' && (
                    <p className="text-muted-foreground text-xs">
                        Transfer between the group's own accounts. Both sides are already in Banking, so nothing to match.
                    </p>
                )}

                {line.state === 'matched' && (
                    <div className="space-y-1">
                        {line.matched.map((payment) => (
                            <div key={payment.key} className="flex items-start gap-2 text-xs">
                                <Link2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                {payment.document_id ? (
                                    <a href={route('erp.invoicing.show', payment.document_id)} className="hover:underline">
                                        <PaymentText payment={payment} />
                                    </a>
                                ) : (
                                    <PaymentText payment={payment} />
                                )}
                                {line.matched.length > 1 && <span className="ml-auto tabular-nums">{money(payment.amount)}</span>}
                            </div>
                        ))}
                    </div>
                )}

                {line.state === 'explained' && (
                    <div className="flex items-start gap-2 text-xs">
                        <MessageSquareText className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                        <span>{line.note}</span>
                    </div>
                )}

                {(line.state === 'matched' || line.state === 'explained') && line.reconciled_by && (
                    <p className="text-muted-foreground text-xs">
                        Reconciled by {line.reconciled_by} on {shortDate(line.reconciled_at)}
                    </p>
                )}

                {line.state === 'open' && (
                    <div className="space-y-1.5">
                        {line.suggestions.length > 0 ? (
                            line.suggestions.map((payment) => (
                                <div
                                    key={payment.key}
                                    className="bg-primary/5 border-primary/15 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                                >
                                    <span className="text-primary text-[11px] font-semibold tracking-wide uppercase">Suggested</span>
                                    <PaymentText payment={payment} against={line.date} />
                                    {canManage && (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => onMatch([payment.key])}
                                            className="bg-primary text-primary-foreground ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium disabled:opacity-60"
                                        >
                                            <Check className="size-3.5" /> Match
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-xs">
                                No {isIn ? 'customer receipt' : 'vendor payment'} of this amount within a week of this date.
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-end gap-2">
                <div
                    className={`flex items-center gap-1 text-base font-semibold tabular-nums ${isIn ? 'text-emerald-700 dark:text-emerald-400' : ''}`}
                >
                    {isIn ? <ArrowDownLeft className="size-4" aria-label="Money in" /> : <ArrowUpRight className="size-4" aria-label="Money out" />}
                    {money(line.amount)}
                </div>
                <StateBadge state={line.state} />
                {canManage && line.state === 'open' && (
                    <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                            type="button"
                            onClick={onFind}
                            className="hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
                        >
                            <Search className="size-3.5" /> Find
                        </button>
                        <button
                            type="button"
                            onClick={onExplain}
                            className="hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium"
                        >
                            <MessageSquareText className="size-3.5" /> Explain
                        </button>
                    </div>
                )}
                {canManage && (line.state === 'matched' || line.state === 'explained') && (
                    <button
                        type="button"
                        onClick={onUndo}
                        disabled={busy}
                        className="hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60"
                    >
                        <Undo2 className="size-3.5" /> Undo
                    </button>
                )}
            </div>
        </div>
    );
}

function StateBadge({ state }: { state: Line['state'] }) {
    const styles: Record<Line['state'], [string, string]> = {
        open: ['To reconcile', 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'],
        matched: ['Matched', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'],
        explained: ['Explained', 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'],
        transfer: ['Transfer', 'bg-primary/10 text-primary'],
    };
    const [label, className] = styles[state];
    return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${className}`}>{label}</span>;
}

function FindDialog({
    line,
    search,
    onClose,
    onMatch,
}: {
    line: Line;
    search: Props['search'];
    onClose: () => void;
    onMatch: (keys: string[]) => void;
}) {
    const [q, setQ] = useState(search?.q ?? '');
    const [picked, setPicked] = useState<Record<string, Payment>>({});
    const [loading, setLoading] = useState(false);
    const total = Object.values(picked).reduce((sum, payment) => sum + payment.amount, 0);
    const left = line.amount - total;

    const load = (term: string) => {
        setLoading(true);
        router.reload({ only: ['search'], data: { find: line.id, q: term || undefined }, onFinish: () => setLoading(false) });
    };

    useEffect(() => {
        if (!search) load('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [line.id]);

    useEffect(() => {
        if (q === (search?.q ?? '')) return;
        const timer = setTimeout(() => load(q), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const toggle = (payment: Payment) =>
        setPicked((current) => {
            const next = { ...current };
            if (next[payment.key]) delete next[payment.key];
            else next[payment.key] = payment;
            return next;
        });

    const results = search?.results ?? [];

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Find the {line.direction === 'in' ? 'customer receipt' : 'vendor payment'}</DialogTitle>
                    <DialogDescription>
                        Bank line of {shortDate(line.date)} for {money(line.amount)}. Tick one payment, or several that add up to it exactly.
                    </DialogDescription>
                </DialogHeader>

                <TextInput value={q} onChange={setQ} placeholder="Search by name, number, reference or amount" />

                <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
                    {loading && results.length === 0 && <p className="text-muted-foreground p-4 text-center text-sm">Searching…</p>}
                    {!loading && results.length === 0 && (
                        <p className="text-muted-foreground p-4 text-center text-sm">
                            {q ? 'Nothing unmatched fits that search.' : 'Nothing unmatched was recorded within a month of this date. Try a search.'}
                        </p>
                    )}
                    {results.map((payment) => (
                        <label key={payment.key} className="hover:bg-muted/40 flex cursor-pointer items-start gap-3 px-3 py-2 text-sm">
                            <input type="checkbox" className="mt-1" checked={Boolean(picked[payment.key])} onChange={() => toggle(payment)} />
                            <PaymentText payment={payment} against={line.date} />
                            <span
                                className={`ml-auto font-medium tabular-nums ${payment.amount === line.amount ? 'text-emerald-700 dark:text-emerald-400' : ''}`}
                            >
                                {money(payment.amount)}
                            </span>
                        </label>
                    ))}
                </div>

                <DialogFooter className="items-center gap-3 sm:justify-between">
                    <span className="text-sm tabular-nums">
                        Ticked {money(total)}
                        {total > 0 && left !== 0 && (
                            <span className="text-rose-600 dark:text-rose-400"> · {left > 0 ? `${money(left)} short` : `${money(-left)} over`}</span>
                        )}
                        {total > 0 && left === 0 && <span className="text-emerald-700 dark:text-emerald-400"> · adds up</span>}
                    </span>
                    <div className="flex gap-2">
                        <button type="button" className={secondaryButton} onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className={primaryButton}
                            disabled={total === 0 || left !== 0}
                            onClick={() => onMatch(Object.keys(picked))}
                        >
                            <CheckCheck className="mr-1.5 size-4" /> Match
                        </button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ExplainDialog({ line, onClose }: { line: Line; onClose: () => void }) {
    const form = useForm({ note: '' });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.banking.reconcile.explain', line.id), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Explain this line</DialogTitle>
                        <DialogDescription>
                            For bank lines with no payment behind them. {shortDate(line.date)} · {money(line.amount)}{' '}
                            {line.direction === 'in' ? 'in' : 'out'}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap gap-1.5">
                        {explanations.map((text) => (
                            <button
                                key={text}
                                type="button"
                                onClick={() => form.setData('note', text)}
                                className="hover:bg-muted rounded-full border px-2.5 py-1 text-xs"
                            >
                                {text}
                            </button>
                        ))}
                    </div>
                    <Field label="Note" error={form.errors.note}>
                        <TextInput value={form.data.note} onChange={(v) => form.setData('note', v)} placeholder="What is this line for?" />
                    </Field>
                    <DialogFooter>
                        <button type="button" className={secondaryButton} onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className={primaryButton} disabled={form.processing || !form.data.note.trim()}>
                            Save
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
