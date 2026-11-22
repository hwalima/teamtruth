import { useLiveSearch } from '@/hooks/use-live-search';
import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Customer = {
    id: number;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    tax_no: string | null;
    currency_code: string;
    is_active: boolean;
    credit_limit: string;
    payment_term: { id: number; name: string; net_days: number } | null;
    outstanding_balance: string;
    is_over_credit_limit: boolean;
};
type PaymentTerm = { id: number; name: string; net_days: number };
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    customers: {
        data: Customer[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: { search?: string; is_active?: string };
};

const formatCurrency = (currency: string, amount: string) => {
    return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

export default function CustomersIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        is_active: props.filters.is_active ?? '',
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
        router.get(route('erp.invoicing.customers.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'is_active');
        router.get(route('erp.invoicing.customers.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const deleteCustomer = (id: number) => {
        if (window.confirm('Delete this customer? This action cannot be undone.')) {
            router.delete(route('erp.invoicing.customers.destroy', id), {
                onSuccess: () => router.visit(route('erp.invoicing.customers.index')),
            });
        }
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} Customers</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage your customer directory for invoicing.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Customers</h2>
                    <a
                        href={route('erp.invoicing.customers.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Add Customer
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
                                placeholder="Code, name, tax #, email..."
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Status</span>
                            <select
                                value={filterForm.data.is_active}
                                onChange={(e) => filterForm.setData('is_active', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
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
                {props.customers.data.map((customer) => (
                    <article
                        key={customer.id}
                        className="space-y-3 rounded-xl border bg-card/70 p-4 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl transition-shadow hover:shadow-[0_12px_40px_rgba(0,26,77,0.09)]"
                    >
                        <header className="flex flex-wrap justify-between gap-3 items-start">
                            <div>
                                <h3 className="font-semibold text-lg">
                                    <a href={route('erp.invoicing.customers.show', customer.id)} className="hover:underline">
                                        {customer.code} — {customer.name}
                                    </a>
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1 flex flex-wrap gap-4">
                                    {customer.email && <span>{customer.email}</span>}
                                    {customer.phone && <span>{customer.phone}</span>}
                                    {customer.tax_no && <span>Tax: {customer.tax_no}</span>}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-right">
                                <span className={`px-2 py-1 rounded text-xs ${customer.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {customer.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <div className="text-sm">
                                    <p className="text-muted-foreground">Credit Limit: {formatCurrency(customer.currency_code, customer.credit_limit)}</p>
                                    <p className={customer.is_over_credit_limit ? 'text-destructive font-medium' : 'font-medium text-green-600'}>
                                        Outstanding: {formatCurrency(customer.currency_code, customer.outstanding_balance)}
                                        {customer.is_over_credit_limit && ' ⚠ Over Limit'}
                                    </p>
                                </div>
                            </div>
                        </header>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span>Terms: {customer.payment_term?.name ?? '—'} ({customer.payment_term?.net_days ?? 0} days)</span>
                            <span>Currency: {customer.currency_code}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <a
                                href={route('erp.invoicing.customers.show', customer.id)}
                                className="text-primary underline text-sm"
                            >
                                View
                            </a>
                            <a
                                href={route('erp.invoicing.customers.edit', customer.id)}
                                className="text-primary underline text-sm"
                            >
                                Edit
                            </a>
                            <a
                                href={route('erp.invoicing.create')}
                                className="text-primary underline text-sm"
                            >
                                New Invoice
                            </a>
                            <button
                                onClick={() => deleteCustomer(customer.id)}
                                className="text-destructive underline text-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </article>
                ))}
                {props.customers.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No customers found. <a href={route('erp.invoicing.customers.create')} className="text-primary underline">Add your first customer</a>.
                    </div>
                )}

                {/* Pagination */}
                {props.customers.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.customers.current_page > 1 && (
                            <a
                                href={route('erp.invoicing.customers.index', { ...props.filters, page: props.customers.current_page - 1 })}
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
                                href={route('erp.invoicing.customers.index', { ...props.filters, page: props.customers.current_page + 1 })}
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