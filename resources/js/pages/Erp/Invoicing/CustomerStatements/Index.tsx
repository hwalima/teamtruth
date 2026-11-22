import { useLiveSearch } from '@/hooks/use-live-search';
import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Customer = {
    id: number;
    code: string;
    name: string;
    currency_code: string;
    payment_term: { id: number; name: string; net_days: number } | null;
    invoices_count: number;
    credit_notes_count: number;
    outstanding_balance: string;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    customers: {
        data: Customer[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search?: string;
    };
};

export default function CustomerStatementsIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
    });

    useLiveSearch(filterForm.data.search, () => submitFilters());
    const submitFilters = (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.invoicing.statements.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search');
        router.get(route('erp.invoicing.statements.index'), {}, { preserveState: true, preserveScroll: true });
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} Customer Statements</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    View and print customer account statements.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Customers</h2>
                </div>

                <form onSubmit={submitFilters} className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Search</span>
                            <input
                                type="text"
                                value={filterForm.data.search}
                                onChange={(e) => filterForm.setData('search', e.target.value)}
                                placeholder="Customer name, code..."
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                {props.customers.data.map((customer) => (
                    <article
                        key={customer.id}
                        className="space-y-3 rounded-xl border bg-card/70 p-4 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl transition-shadow hover:shadow-[0_12px_40px_rgba(0,26,77,0.09)]"
                    >
                        <header className="flex flex-wrap justify-between gap-3 items-start">
                            <div>
                                <h3 className="font-semibold text-lg">
                                    <a href={route('erp.invoicing.statements.show', customer.id)} className="hover:underline">
                                        {customer.code} — {customer.name}
                                    </a>
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {customer.invoices_count} invoices · {customer.credit_notes_count} credit notes
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-right">
                                <div>
                                    <p className="text-muted-foreground text-sm">Outstanding Balance</p>
                                    <p className="font-medium text-lg {Number(customer.outstanding_balance) > 0 ? 'text-destructive' : 'text-green-600'}">
                                        {customer.currency_code} {Number(customer.outstanding_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </header>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                            <div className="flex gap-2">
                                <a
                                    href={route('erp.invoicing.statements.show', customer.id)}
                                    className="text-primary underline text-sm"
                                >
                                    View Statement
                                </a>
                                <a
                                    href={route('erp.invoicing.statements.pdf', customer.id)}
                                    target="_blank"
                                    className="text-primary underline text-sm"
                                >
                                    PDF
                                </a>
                            </div>
                        </div>
                    </article>
                ))}
                {props.customers.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No customers found.
                    </div>
                )}

                {/* Pagination */}
                {props.customers.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.customers.current_page > 1 && (
                            <a
                                href={route('erp.invoicing.statements.index', { ...props.filters, page: props.customers.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.customers.current_page} of {props.customers.last_page}
                        </span>
                        {props.customers.current_page < props.customers.last_page && (
                            <a
                                href={route('erp.invoicing.statements.index', { ...props.filters, page: props.customers.current_page + 1 })}
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