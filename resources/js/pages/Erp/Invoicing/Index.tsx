import { useLiveSearch } from '@/hooks/use-live-search';
import { formatDay } from '@/lib/utils';
import { router, useForm } from '@inertiajs/react';
import { Ban, Eye, FileDown, Pencil } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { route } from 'ziggy-js';

function IconAction({
    label,
    href,
    onClick,
    danger,
    newTab,
    children,
}: {
    label: string;
    href?: string;
    onClick?: () => void;
    danger?: boolean;
    newTab?: boolean;
    children: ReactNode;
}) {
    const className = `inline-flex size-8 items-center justify-center rounded-lg border transition-colors ${
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'
    }`;
    return href ? (
        <a
            href={href}
            title={label}
            aria-label={label}
            className={className}
            target={newTab ? '_blank' : undefined}
            rel={newTab ? 'noreferrer' : undefined}
        >
            {children}
        </a>
    ) : (
        <button type="button" title={label} aria-label={label} className={className} onClick={onClick}>
            {children}
        </button>
    );
}

type Customer = {
    id: number;
    code: string;
    name: string;
    currency_code: string;
    payment_term: { id: number; name: string; net_days: number } | null;
};
type Invoice = {
    id: number;
    document_number: string;
    type: string;
    invoice_date: string;
    due_date: string;
    status: string;
    currency_code: string;
    subtotal: string;
    tax_amount: string;
    total_amount: string;
    paid_amount: string;
    balance_due: string;
    can_edit: boolean;
    can_cancel: boolean;
    is_posted: boolean;
    customer: { id: number; code: string; name: string };
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    invoices: {
        data: Invoice[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    customers: Customer[];
    filters: {
        search?: string;
        status?: string;
        customer_id?: string;
        date_from?: string;
        date_to?: string;
        type?: string;
        sort_by?: string;
        sort_order?: string;
    };
    statusOptions: Record<string, string>;
    typeOptions: Record<string, string>;
};

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    partial_paid: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    proforma: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function InvoicingIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        status: props.filters.status ?? '',
        customer_id: props.filters.customer_id ?? '',
        date_from: props.filters.date_from ?? '',
        date_to: props.filters.date_to ?? '',
        type: props.filters.type ?? '',
        sort_by: props.filters.sort_by ?? 'invoice_date',
        sort_order: props.filters.sort_order ?? 'desc',
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
        router.get(route('erp.invoicing.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'status', 'customer_id', 'date_from', 'date_to', 'type', 'sort_by', 'sort_order');
        router.get(route('erp.invoicing.index'), {}, { preserveState: true, preserveScroll: true });
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} Invoicing</h1>
                <p className="text-muted-foreground mt-2 text-sm">Create and manage customer invoices, credit notes, and recurring invoices.</p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-medium">Invoices</h2>
                    <a
                        href={route('erp.invoicing.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Create Invoice
                    </a>
                </div>

                <form onSubmit={submitFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
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
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Customer</span>
                            <select
                                value={filterForm.data.customer_id}
                                onChange={(e) => filterForm.setData('customer_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All customers</option>
                                {props.customers.map((customer) => (
                                    <option key={customer.id} value={customer.id.toString()}>
                                        {customer.code} — {customer.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Type</span>
                            <select
                                value={filterForm.data.type}
                                onChange={(e) => filterForm.setData('type', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All types</option>
                                {Object.entries(props.typeOptions).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Date from</span>
                            <input
                                type="date"
                                value={filterForm.data.date_from}
                                onChange={(e) => filterForm.setData('date_from', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Date to</span>
                            <input
                                type="date"
                                value={filterForm.data.date_to}
                                onChange={(e) => filterForm.setData('date_to', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Sort by</span>
                            <select
                                value={filterForm.data.sort_by}
                                onChange={(e) => filterForm.setData('sort_by', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="invoice_date">Invoice Date</option>
                                <option value="document_number">Document Number</option>
                                <option value="due_date">Due Date</option>
                                <option value="total_amount">Total Amount</option>
                                <option value="status">Status</option>
                                <option value="created_at">Created At</option>
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Order</span>
                            <select
                                value={filterForm.data.sort_order}
                                onChange={(e) => filterForm.setData('sort_order', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="desc">Descending</option>
                                <option value="asc">Ascending</option>
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
                {props.invoices.data.map((invoice) => (
                    <article
                        key={invoice.id}
                        className="bg-card/70 space-y-3 rounded-xl border p-4 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl transition-shadow hover:shadow-[0_12px_40px_rgba(0,26,77,0.09)]"
                    >
                        <header className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    <a href={route('erp.invoicing.show', invoice.id)} className="hover:underline">
                                        {invoice.document_number}
                                    </a>
                                </h3>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    {invoice.type === 'proforma' ? 'Proforma' : 'Invoice'} · {invoice.customer.code} — {invoice.customer.name}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-right">
                                <span className={`rounded px-2 py-1 text-xs ${statusColors[invoice.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                    {props.statusOptions[invoice.status] ?? invoice.status.replaceAll('_', ' ')}
                                </span>
                                <div>
                                    <p className="text-muted-foreground text-sm">{formatDay(invoice.invoice_date)}</p>
                                    <p className="font-medium">
                                        {invoice.currency_code} {Number(invoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </header>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                            <div className="text-muted-foreground flex flex-wrap gap-4">
                                <span>Due: {formatDay(invoice.due_date)}</span>
                                <span>
                                    Paid: {invoice.currency_code}{' '}
                                    {Number(invoice.paid_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <span className={Number(invoice.balance_due) > 0 ? 'text-destructive' : 'text-green-600'}>
                                    Balance: {invoice.currency_code}{' '}
                                    {Number(invoice.balance_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex gap-1.5">
                                <IconAction label="View" href={route('erp.invoicing.show', invoice.id)}>
                                    <Eye className="size-4" />
                                </IconAction>
                                {invoice.can_edit && (
                                    <IconAction label="Edit" href={route('erp.invoicing.edit', invoice.id)}>
                                        <Pencil className="size-4" />
                                    </IconAction>
                                )}
                                <IconAction label="PDF" href={route('erp.invoicing.pdf', invoice.id)} newTab>
                                    <FileDown className="size-4" />
                                </IconAction>
                                {invoice.can_cancel && (
                                    <IconAction
                                        label="Cancel invoice"
                                        danger
                                        onClick={() => {
                                            if (confirm(`Cancel invoice ${invoice.document_number}?`)) {
                                                router.post(route('erp.invoicing.cancel', invoice.id), {}, { preserveScroll: true });
                                            }
                                        }}
                                    >
                                        <Ban className="size-4" />
                                    </IconAction>
                                )}
                            </div>
                        </div>
                    </article>
                ))}
                {props.invoices.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No invoices found.{' '}
                        <a href={route('erp.invoicing.create')} className="text-primary underline">
                            Create your first invoice
                        </a>
                        .
                    </div>
                )}

                {/* Pagination */}
                {props.invoices.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.invoices.current_page > 1 && (
                            <a
                                href={route('erp.invoicing.index', { ...props.filters, page: props.invoices.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-muted-foreground text-sm">
                            Page {props.invoices.current_page} of {props.invoices.last_page}
                        </span>
                        {props.invoices.current_page < props.invoices.last_page && (
                            <a
                                href={route('erp.invoicing.index', { ...props.filters, page: props.invoices.current_page + 1 })}
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
