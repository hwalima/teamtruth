import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Customer = { id: number; code: string; name: string; currency_code: string };
type PaymentTerm = { id: number; name: string; net_days: number };
type RecurringInvoice = {
    id: number;
    name: string;
    status: string;
    frequency: string;
    interval: number;
    next_run_date: string;
    occurrences_count: number;
    max_occurrences: number | null;
    end_date: string | null;
    customer: { id: number; code: string; name: string };
    payment_term: { id: number; name: string } | null;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    recurringInvoices: {
        data: RecurringInvoice[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: { search?: string; status?: string };
    statusOptions: Record<string, string>;
};

const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const frequencyLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
};

export default function RecurringInvoicesIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        status: props.filters.status ?? '',
    });
    const filterErrors = filterForm.errors as Record<string, string>;

    const submitFilters = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.invoicing.recurring.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'status');
        router.get(route('erp.invoicing.recurring.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const pauseRecurring = (id: number) => {
        if (window.confirm('Pause this recurring invoice template?')) {
            router.post(route('erp.invoicing.recurring.pause', id), {
                onSuccess: () => router.visit(route('erp.invoicing.recurring.index')),
            });
        }
    };

    const resumeRecurring = (id: number) => {
        if (window.confirm('Resume this recurring invoice template?')) {
            router.post(route('erp.invoicing.recurring.resume', id), {
                onSuccess: () => router.visit(route('erp.invoicing.recurring.index')),
            });
        }
    };

    const generateNow = (id: number) => {
        if (window.confirm('Generate an invoice now from this template?')) {
            router.post(route('erp.invoicing.recurring.generate', id), {
                onSuccess: () => router.visit(route('erp.invoicing.recurring.index')),
            });
        }
    };

    const deleteRecurring = (id: number) => {
        if (window.confirm('Delete this recurring invoice template? This action cannot be undone.')) {
            router.delete(route('erp.invoicing.recurring.destroy', id), {
                onSuccess: () => router.visit(route('erp.invoicing.recurring.index')),
            });
        }
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} Recurring Invoices</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Create and manage recurring invoice templates for automatic invoice generation.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Recurring Invoice Templates</h2>
                    <a
                        href={route('erp.invoicing.recurring.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Create Recurring Invoice
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
                                placeholder="Name, customer..."
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
                {props.recurringInvoices.data.map((ri) => (
                    <article
                        key={ri.id}
                        className="space-y-3 rounded-xl border bg-card/70 p-4 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl transition-shadow hover:shadow-[0_12px_40px_rgba(0,26,77,0.09)]"
                    >
                        <header className="flex flex-wrap justify-between gap-3 items-start">
                            <div>
                                <h3 className="font-semibold text-lg">
                                    <a href={route('erp.invoicing.recurring.show', ri.id)} className="hover:underline">
                                        {ri.name}
                                    </a>
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {ri.customer.code} — {ri.customer.name}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-right">
                                <span className={`px-2 py-1 rounded text-xs ${statusColors[ri.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                    {props.statusOptions[ri.status] ?? ri.status.replaceAll('_', ' ')}
                                </span>
                                <div className="text-sm text-muted-foreground">
                                    <p>Every {ri.interval} {frequencyLabels[ri.frequency] ?? ri.frequency}</p>
                                    <p>Next: {ri.next_run_date}</p>
                                </div>
                            </div>
                        </header>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span>Occurrences: {ri.occurrences_count}{ri.max_occurrences ? ` / ${ri.max_occurrences}` : ''}</span>
                            {ri.end_date && <span>Ends: {ri.end_date}</span>}
                            {ri.payment_term && <span>Terms: {ri.payment_term.name}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <a
                                href={route('erp.invoicing.recurring.show', ri.id)}
                                className="text-primary underline text-sm"
                            >
                                View
                            </a>
                            {ri.status === 'active' && (
                                <>
                                    <button
                                        onClick={() => generateNow(ri.id)}
                                        className="text-primary underline text-sm"
                                    >
                                        Generate Now
                                    </button>
                                    <button
                                        onClick={() => pauseRecurring(ri.id)}
                                        className="text-yellow-600 underline text-sm"
                                    >
                                        Pause
                                    </button>
                                </>
                            )}
                            {ri.status === 'paused' && (
                                <button
                                    onClick={() => resumeRecurring(ri.id)}
                                    className="text-green-600 underline text-sm"
                                >
                                    Resume
                                </button>
                            )}
                            {['active', 'paused', 'completed'].includes(ri.status) && (
                                <button
                                    onClick={() => deleteRecurring(ri.id)}
                                    className="text-destructive underline text-sm"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    </article>
                ))}
                {props.recurringInvoices.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No recurring invoice templates found. <a href={route('erp.invoicing.recurring.create')} className="text-primary underline">Create your first template</a>.
                    </div>
                )}

                {/* Pagination */}
                {props.recurringInvoices.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.recurringInvoices.current_page > 1 && (
                            <a
                                href={route('erp.invoicing.recurring.index', { ...props.filters, page: props.recurringInvoices.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.recurringInvoices.current_page} of {props.recurringInvoices.last_page}
                        </span>
                        {props.recurringInvoices.current_page < props.recurringInvoices.last_page && (
                            <a
                                href={route('erp.invoicing.recurring.index', { ...props.filters, page: props.recurringInvoices.current_page + 1 })}
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