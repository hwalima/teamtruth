import { useLiveSearch } from '@/hooks/use-live-search';
import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Customer = { id: number; code: string; name: string };
type Invoice = { id: number; document_number: string; customer_id: number; total_amount: string; balance_due: string; status: string; customer: { code: string; name: string } };
type CreditNote = {
    id: number;
    document_number: string;
    credit_note_date: string;
    status: string;
    currency_code: string;
    total_amount: string;
    customer: { id: number; code: string; name: string };
    original_invoice: { id: number; document_number: string } | null;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    creditNotes: {
        data: CreditNote[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    customers: Customer[];
    filters: { search?: string; status?: string };
    statusOptions: Record<string, string>;
};

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    issued: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    applied: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default function CreditNotesIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        status: props.filters.status ?? '',
    });
    const filterErrors = filterForm.errors as Record<string, string>;

    useLiveSearch(filterForm.data.search, () => submitFilters());
    const submitFilters = (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.invoicing.credit-notes.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'status');
        router.get(route('erp.invoicing.credit-notes.index'), {}, { preserveState: true, preserveScroll: true });
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} Credit Notes</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Create and manage credit notes for returns, adjustments, and refunds.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Credit Notes</h2>
                    <a
                        href={route('erp.invoicing.credit-notes.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Create Credit Note
                    </a>
                </div>

                <form onSubmit={submitFilters} className="grid gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Search</span>
                            <input
                                type="text"
                                value={filterForm.data.search}
                                onChange={(e) => filterForm.setData('search', e.target.value)}
                                placeholder="Document #, customer..."
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Status</span>
                            <select
                                value={filterForm.data.status}
                                onChange={(e) => filterForm.setData('status', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All statuses</option>
                                {Object.entries(props.statusOptions).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-4">
                        <button
                            type="submit"
                            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            Apply Filters
                        </button>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </form>
            </section>

            <section className="space-y-4">
                {props.creditNotes.data.map((cn) => (
                    <article
                        key={cn.id}
                        className="space-y-3 rounded-xl border bg-card/70 p-4 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl transition-shadow hover:shadow-[0_12px_40px_rgba(0,26,77,0.09)]"
                    >
                        <header className="flex flex-wrap justify-between gap-3 items-start">
                            <div>
                                <h3 className="font-semibold text-lg">
                                    <a href={route('erp.invoicing.credit-notes.show', cn.id)} className="hover:underline">
                                        {cn.document_number}
                                    </a>
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {cn.customer.code} — {cn.customer.name}
                                    {cn.original_invoice && ` · From Invoice: ${cn.original_invoice.document_number}`}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-right">
                                <span className={`px-2 py-1 rounded text-xs ${statusColors[cn.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                    {props.statusOptions[cn.status] ?? cn.status.replaceAll('_', ' ')}
                                </span>
                                <div>
                                    <p className="text-muted-foreground text-sm">{cn.credit_note_date}</p>
                                    <p className="font-medium">{cn.currency_code} {Number(cn.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </header>
                        <div className="flex flex-wrap gap-2">
                            <a
                                href={route('erp.invoicing.credit-notes.show', cn.id)}
                                className="text-primary underline text-sm"
                            >
                                View
                            </a>
                            <a
                                href={route('erp.invoicing.credit-notes.pdf', cn.id)}
                                target="_blank"
                                className="text-primary underline text-sm"
                            >
                                PDF
                            </a>
                        </div>
                    </article>
                ))}
                {props.creditNotes.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No credit notes found. <a href={route('erp.invoicing.credit-notes.create')} className="text-primary underline">Create your first credit note</a>.
                    </div>
                )}

                {/* Pagination */}
                {props.creditNotes.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.creditNotes.current_page > 1 && (
                            <a
                                href={route('erp.invoicing.credit-notes.index', { ...props.filters, page: props.creditNotes.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.creditNotes.current_page} of {props.creditNotes.last_page}
                        </span>
                        {props.creditNotes.current_page < props.creditNotes.last_page && (
                            <a
                                href={route('erp.invoicing.credit-notes.index', { ...props.filters, page: props.creditNotes.current_page + 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Next
                            </a>
                        )}
                    </nav>
                )}
            </section>
        </main>
    );
}