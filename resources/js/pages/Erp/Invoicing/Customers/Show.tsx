import { router } from '@inertiajs/react';
import { route } from 'ziggy-js';

type Invoice = {
    id: number;
    document_number: string;
    status: string;
    invoice_date: string;
    due_date: string;
    currency_code: string;
    total_amount: string;
    balance_due: string;
};
type CreditNote = {
    id: number;
    document_number: string;
    status: string;
    credit_note_date: string;
    currency_code: string;
    total_amount: string;
};
type PaymentTerm = { id: number; name: string; net_days: number; discount_days: number | null; discount_percent: number | null };
type Customer = {
    id: number;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    tax_no: string | null;
    billing_address: string | null;
    shipping_address: string | null;
    currency_code: string;
    payment_term: PaymentTerm | null;
    credit_limit: string;
    is_active: boolean;
    outstanding_balance: string;
    is_over_credit_limit: boolean;
    invoices: Invoice[];
    credit_notes: CreditNote[];
    created_at: string;
    updated_at: string;
};
type Company = { id: number; code: string; name: string; default_currency: string };
type Props = {
    company: Company;
    customer: Customer;
    outstandingBalance: string;
    isOverCreditLimit: boolean;
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

const cnStatusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    issued: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    applied: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const formatCurrency = (currency: string, amount: string) => {
    return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

export default function CustomerShow(props: Props) {
    const { customer } = props;

    const deleteCustomer = () => {
        if (window.confirm('Delete this customer? This action cannot be undone.')) {
            router.delete(route('erp.invoicing.customers.destroy', customer.id), {
                onSuccess: () => router.visit(route('erp.invoicing.customers.index')),
            });
        }
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header className="flex flex-wrap justify-between gap-4 items-start">
                <div>
                    <p className="text-muted-foreground text-sm">{props.company.code}</p>
                    <div className="flex flex-wrap items-baseline gap-3 mt-1">
                        <h1 className="text-2xl font-semibold">{customer.code} — {customer.name}</h1>
                        <span className={`px-2 py-1 rounded text-xs ${customer.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                        {customer.email ?? 'No email'} · {customer.phone ?? 'No phone'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href={route('erp.invoicing.customers.edit', customer.id)}
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Edit
                    </a>
                    <a
                        href={route('erp.invoicing.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        New Invoice
                    </a>
                    <button
                        onClick={deleteCustomer}
                        className="text-destructive inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-destructive/10"
                    >
                        Delete
                    </button>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                {/* Main Content */}
                <div className="space-y-6">
                    {/* Customer Details */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Details</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <p className="text-muted-foreground text-sm">Tax Number</p>
                                <p className="font-medium">{customer.tax_no ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Currency</p>
                                <p className="font-medium">{customer.currency_code}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Payment Terms</p>
                                <p className="font-medium">{customer.payment_term?.name ?? '—'} (Net {customer.payment_term?.net_days ?? 0})</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Credit Limit</p>
                                <p className="font-medium">{formatCurrency(customer.currency_code, customer.credit_limit)}</p>
                            </div>
                            {customer.billing_address && (
                                <div className="sm:col-span-2">
                                    <p className="text-muted-foreground text-sm">Billing Address</p>
                                    <p className="font-medium whitespace-pre-wrap">{customer.billing_address}</p>
                                </div>
                            )}
                            {customer.shipping_address && (
                                <div className="sm:col-span-2">
                                    <p className="text-muted-foreground text-sm">Shipping Address</p>
                                    <p className="font-medium whitespace-pre-wrap">{customer.shipping_address}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Invoices */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <div className="flex flex-wrap justify-between gap-3 items-center mb-4">
                            <h2 className="text-lg font-medium">Recent Invoices</h2>
                            <a
                                href={route('erp.invoicing.index', { customer_id: customer.id })}
                                className="text-primary text-sm underline"
                            >
                                View All
                            </a>
                        </div>
                        {customer.invoices.length > 0 ? (
                            <div className="space-y-2">
                                {customer.invoices.map((invoice) => (
                                    <div key={invoice.id} className="flex flex-wrap justify-between gap-3 rounded-md border p-3">
                                        <div>
                                            <p className="font-medium">
                                                <a href={route('erp.invoicing.show', invoice.id)} className="hover:underline">
                                                    {invoice.document_number}
                                                </a>
                                            </p>
                                            <p className="text-muted-foreground text-sm">{invoice.invoice_date} · Due: {invoice.due_date}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs ${statusColors[invoice.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                                {invoice.status.replaceAll('_', ' ')}
                                            </span>
                                            <span className="font-medium">{formatCurrency(invoice.currency_code, invoice.total_amount)}</span>
                                            <span className={Number(invoice.balance_due) > 0 ? 'text-destructive' : 'text-green-600'}>
                                                Balance: {formatCurrency(invoice.currency_code, invoice.balance_due)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground py-4 text-center">No invoices yet.</p>
                        )}
                    </section>

                    {/* Credit Notes */}
                    {customer.credit_notes.length > 0 && (
                        <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                            <h2 className="text-lg font-medium">Recent Credit Notes</h2>
                            <div className="space-y-2">
                                {customer.credit_notes.map((cn) => (
                                    <div key={cn.id} className="flex flex-wrap justify-between gap-3 rounded-md border p-3">
                                        <div>
                                            <p className="font-medium">
                                                <a href={route('erp.invoicing.credit-notes.show', cn.id)} className="hover:underline">
                                                    {cn.document_number}
                                                </a>
                                            </p>
                                            <p className="text-muted-foreground text-sm">{cn.credit_note_date}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs ${cnStatusColors[cn.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                                {cn.status.replaceAll('_', ' ')}
                                            </span>
                                            <span className="font-medium">{formatCurrency(cn.currency_code, cn.total_amount)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Timestamps */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-muted-foreground text-sm">Created</p>
                                <p className="font-medium">{new Date(customer.created_at).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Updated</p>
                                <p className="font-medium">{new Date(customer.updated_at).toLocaleString()}</p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium mb-4">Account Summary</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Credit Limit</span>
                                <span className="font-medium">{formatCurrency(customer.currency_code, customer.credit_limit)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Outstanding Balance</span>
                                <span className="font-medium">{formatCurrency(customer.currency_code, customer.outstanding_balance)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Available Credit</span>
                                <span className="font-medium text-green-600">
                                    {formatCurrency(customer.currency_code, (Number(customer.credit_limit) - Number(customer.outstanding_balance)).toFixed(2))}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold border-t pt-2">
                                <span>Status</span>
                                <span className={customer.isOverCreditLimit ? 'text-destructive' : 'text-green-600'}>
                                    {customer.isOverCreditLimit ? 'OVER LIMIT' : 'Within Limit'}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Quick Actions */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
                        <div className="space-y-2">
                            <a
                                href={route('erp.invoicing.create', { customer_id: customer.id })}
                                className="flex items-center gap-2 bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                Create Invoice
                            </a>
                            <a
                                href={route('erp.invoicing.credit-notes.create', { customer_id: customer.id })}
                                className="flex items-center gap-2 text-primary underline text-sm"
                            >
                                Create Credit Note
                            </a>
                            <a
                                href={route('erp.invoicing.index', { customer_id: customer.id })}
                                className="flex items-center gap-2 text-primary underline text-sm"
                            >
                                View All Invoices
                            </a>
                        </div>
                    </section>

                    {/* Navigation */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <div className="flex flex-wrap gap-2">
                            <a
                                href={route('erp.invoicing.customers.index')}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Back to List
                            </a>
                            <a
                                href={route('erp.invoicing.customers.create')}
                                className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                New Customer
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}