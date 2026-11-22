import { QuotationActions } from '@/components/erp/quotation-actions';
import { QUOTATION_STATUS_LABELS, money, type QuotationStatus as Status } from '@/components/erp/sales';
import { Empty, Pagination, StatusBadge, formatDate, inputClass, primaryButton, type Paginated } from '@/components/hrm/ui';
import { useLiveSearch } from '@/hooks/use-live-search';
import { Link, router } from '@inertiajs/react';
import { Mail, Plus, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Quotation = {
    id: number;
    document_number: string;
    status: Status;
    currency_code: string;
    total: string;
    valid_until: string | null;
    created_at: string | null;
    sent_at: string | null;
    lines_count: number;
    customer: { id: number; name: string; code: string } | null;
    can_edit: boolean;
    can_cancel: boolean;
    can_delete: boolean;
};
type Props = {
    company: { id: number; code: string; name: string };
    quotations: Paginated<Quotation> & { from: number | null; to: number | null };
    filters: { search: string; status: Status | 'all' };
    counts: Record<Status, number>;
    canManage: boolean;
};

export default function QuotationsIndex({ company, quotations, filters, counts, canManage }: Props) {
    const [search, setSearch] = useState(filters.search);

    const go = (params: Partial<Props['filters']>) => {
        const next = { ...filters, ...params };
        router.get(
            route('erp.sales.quotations.index'),
            { ...(next.search ? { search: next.search } : {}), ...(next.status !== 'all' ? { status: next.status } : {}) },
            { preserveState: true, preserveScroll: true },
        );
    };

    useLiveSearch(search, () => go({ search: search.trim() }));

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        go({ search: search.trim() });
    };

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const tabs: { key: Props['filters']['status']; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: total },
        ...(Object.keys(QUOTATION_STATUS_LABELS) as Status[]).map((key) => ({ key, label: QUOTATION_STATUS_LABELS[key], count: counts[key] })),
    ];
    const today = new Date().toISOString().slice(0, 10);

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
                    <h1 className="text-2xl font-semibold">Quotations</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Price offers to customers, from draft through approval to a sales order.</p>
                </div>
                {canManage && (
                    <Link href={route('erp.sales.quotations.create')} className={`${primaryButton} gap-2`}>
                        <Plus className="size-4" /> New quotation
                    </Link>
                )}
            </header>

            <section className="flex flex-wrap items-center justify-between gap-3">
                <div className="-mx-4 max-w-[100vw] overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <div className="bg-muted/50 inline-flex rounded-xl p-1 whitespace-nowrap" role="tablist">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                role="tab"
                                aria-selected={filters.status === tab.key}
                                onClick={() => go({ status: tab.key })}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                    filters.status === tab.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.label} <span className="text-muted-foreground tabular-nums">{tab.count}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <form onSubmit={submitSearch} className="flex w-full gap-2 sm:w-auto">
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Quotation number or customer"
                        aria-label="Search quotations"
                        className={`${inputClass} min-w-0 flex-1 sm:w-72`}
                    />
                    <button
                        type="submit"
                        className="border-border/70 hover:bg-primary/10 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border"
                        aria-label="Search"
                        title="Search"
                    >
                        <Search className="size-4" />
                    </button>
                </form>
            </section>

            {quotations.data.length === 0 ? (
                <Empty>
                    {filters.search ? `No quotations match “${filters.search}”.` : 'No quotations here yet.'}
                    {canManage && !filters.search && (
                        <div className="mt-3">
                            <Link href={route('erp.sales.quotations.create')} className="text-primary font-medium hover:underline">
                                Create the first quotation
                            </Link>
                        </div>
                    )}
                </Empty>
            ) : (
                <section className="bg-card/70 overflow-hidden rounded-xl border">
                    <ul className="divide-y md:hidden">
                        {quotations.data.map((quotation) => (
                            <li key={quotation.id}>
                                <Link href={route('erp.sales.quotations.show', quotation.id)} className="hover:bg-muted/30 block space-y-1 px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="font-medium break-all">{quotation.document_number}</span>
                                        <span className="shrink-0 font-medium tabular-nums">{money(quotation.currency_code, quotation.total)}</span>
                                    </div>
                                    <div className="text-muted-foreground text-sm">{quotation.customer?.name ?? '—'}</div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <StatusBadge value={quotation.status} label={QUOTATION_STATUS_LABELS[quotation.status]} />
                                        {quotation.sent_at && (
                                            <span className="text-muted-foreground inline-flex items-center gap-1">
                                                <Mail className="size-3" /> Sent
                                            </span>
                                        )}
                                        <span className="text-muted-foreground">{formatDate(quotation.created_at)}</span>
                                    </div>
                                </Link>
                                <div className="px-4 pb-3">
                                    <QuotationActions quotation={quotation} canManage={canManage} />
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-muted-foreground text-left text-xs tracking-wide uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Quotation</th>
                                    <th className="px-4 py-3 font-medium">Customer</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Valid until</th>
                                    <th className="px-4 py-3 text-right font-medium">Total</th>
                                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {quotations.data.map((quotation) => {
                                    const expired =
                                        quotation.valid_until !== null &&
                                        quotation.valid_until < today &&
                                        ['draft', 'pending_approval', 'approved'].includes(quotation.status);
                                    return (
                                        <tr key={quotation.id} className="hover:bg-muted/20">
                                            <td className="px-4 py-3">
                                                <Link href={route('erp.sales.quotations.show', quotation.id)} className="font-medium hover:underline">
                                                    {quotation.document_number}
                                                </Link>
                                                <div className="text-muted-foreground text-xs">
                                                    {formatDate(quotation.created_at)} · {quotation.lines_count} {quotation.lines_count === 1 ? 'line' : 'lines'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {quotation.customer?.name ?? '—'}
                                                {quotation.customer && <div className="text-muted-foreground text-xs">{quotation.customer.code}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <StatusBadge value={quotation.status} label={QUOTATION_STATUS_LABELS[quotation.status]} />
                                                    {quotation.sent_at && (
                                                        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs" title="Emailed to the customer">
                                                            <Mail className="size-3" /> Sent
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`px-4 py-3 ${expired ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                {formatDate(quotation.valid_until)}
                                                {expired && <div className="text-xs">Expired</div>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium tabular-nums">{money(quotation.currency_code, quotation.total)}</td>
                                            <td className="px-4 py-3">
                                                <QuotationActions quotation={quotation} canManage={canManage} showView />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {quotations.total > 0 && (
                <p className="text-muted-foreground text-center text-sm">
                    Showing {quotations.from}–{quotations.to} of {quotations.total}
                </p>
            )}
            <Pagination page={quotations} />
        </main>
    );
}
