import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type StatementLine = {
    date: string;
    type: 'invoice' | 'credit_note' | 'payment';
    reference: string;
    description: string;
    debit: string;
    credit: string;
    balance: string;
    currency_code: string;
    status: string;
};
type Customer = {
    id: number;
    code: string;
    name: string;
    currency_code: string;
    email?: string;
    phone?: string;
    billing_address?: string;
    tax_no?: string;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    customer: Customer;
    statementLines: StatementLine[];
    totals: {
        total_invoiced: string;
        total_credited: string;
        total_paid: string;
        balance: string;
        currency_code: string;
    };
    dateFrom?: string;
    dateTo?: string;
};

const typeLabels: Record<string, string> = {
    invoice: 'Invoice',
    credit_note: 'Credit Note',
    payment: 'Payment',
};

const typeColors: Record<string, string> = {
    invoice: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    credit_note: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    payment: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export default function CustomerStatementShow(props: Props) {
    const filterForm = useForm({
        date_from: props.dateFrom ?? '',
        date_to: props.dateTo ?? '',
    });

    const submitFilters = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.invoicing.statements.show', props.customer.id), params, { preserveState: true, preserveScroll: true });
    };

    const downloadPdf = () => {
        const params = new URLSearchParams();
        if (filterForm.data.date_from) params.set('date_from', filterForm.data.date_from);
        if (filterForm.data.date_to) params.set('date_to', filterForm.data.date_to);
        window.open(route('erp.invoicing.statements.pdf', props.customer.id) + '?' + params.toString(), '_blank');
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header className="flex flex-wrap justify-between gap-3 items-center">
                <div>
                    <p className="text-muted-foreground text-sm">{props.company.code}</p>
                    <h1 className="text-2xl font-semibold">Customer Statement</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        {props.customer.code} — {props.customer.name}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={downloadPdf}
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Download PDF
                    </button>
                </div>
            </header>

            {/* Filters */}
            <section className="space-y-4 rounded-xl border bg-card/70 p-4 sm:p-6">
                <form onSubmit={submitFilters} className="grid gap-3 sm:grid-cols-4">
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Date From</span>
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
                            <span className="text-foreground/85 font-medium">Date To</span>
                            <input
                                type="date"
                                value={filterForm.data.date_to}
                                onChange={(e) => filterForm.setData('date_to', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div className="sm:col-span-2 flex flex-wrap gap-2 items-end">
                        <button
                            type="submit"
                            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            Apply
                        </button>
                        <a
                            href={route('erp.invoicing.statements.show', props.customer.id)}
                            className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                        >
                            Reset
                        </a>
                    </div>
                </form>
            </section>

            {/* Customer Info */}
            <section className="space-y-4 rounded-xl border bg-card/70 p-4 sm:p-6">
                <h2 className="text-lg font-medium">Customer Details</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Code</p>
                        <p className="font-medium">{props.customer.code}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Currency</p>
                        <p className="font-medium">{props.customer.currency_code}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Email</p>
                        <p className="font-medium">{props.customer.email ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium">{props.customer.phone ?? '—'}</p>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-2">
                        <p className="text-muted-foreground">Billing Address</p>
                        <p className="font-medium whitespace-pre-wrap">{props.customer.billing_address ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Tax Number</p>
                        <p className="font-medium">{props.customer.tax_no ?? '—'}</p>
                    </div>
                </div>
            </section>

            {/* Totals Summary */}
            <section className="space-y-4 rounded-xl border bg-card/70 p-4 sm:p-6">
                <h2 className="text-lg font-medium">Account Summary</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border bg-muted/30 p-4">
                        <p className="text-muted-foreground text-sm">Total Invoiced</p>
                        <p className="text-2xl font-semibold mt-1">
                            {props.totals.currency_code} {Number(props.totals.total_invoiced).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-4">
                        <p className="text-muted-foreground text-sm">Total Credited</p>
                        <p className="text-2xl font-semibold mt-1 text-purple-600">
                            {props.totals.currency_code} {Number(props.totals.total_credited).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-4">
                        <p className="text-muted-foreground text-sm">Total Paid</p>
                        <p className="text-2xl font-semibold mt-1 text-green-600">
                            {props.totals.currency_code} {Number(props.totals.total_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="rounded-xl border bg-primary/5 border-primary/20 p-4">
                        <p className="text-muted-foreground text-sm">Outstanding Balance</p>
                        <p className="text-2xl font-semibold mt-1 {Number(props.totals.balance) > 0 ? 'text-destructive' : 'text-green-600'}">
                            {props.totals.currency_code} {Number(props.totals.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </section>

            {/* Statement Lines */}
            <section className="space-y-4">
                <h2 className="text-lg font-medium">Transaction History</h2>
                {props.statementLines.map((line, index) => (
                    <article
                        key={index}
                        className="rounded-xl border bg-card/70 p-4 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl"
                    >
                        <div className="grid gap-3 sm:grid-cols-[100px_80px_1fr_80px_80px_80px] items-center">
                            <div className="text-sm">
                                <p className="text-muted-foreground">Date</p>
                                <p className="font-medium">{new Date(line.date).toLocaleDateString()}</p>
                            </div>
                            <div className="text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${typeColors[line.type] ?? 'bg-gray-100 text-gray-800'}`}>
                                    {typeLabels[line.type] ?? line.type}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground text-sm">Ref</p>
                                <p className="font-medium">{line.reference}</p>
                            </div>
                            <div className="text-sm text-right">
                                <p className="text-muted-foreground">Debit</p>
                                <p className="font-medium text-destructive">
                                    {Number(line.debit) > 0 ? `${line.currency_code} ${Number(line.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                </p>
                            </div>
                            <div className="text-sm text-right">
                                <p className="text-muted-foreground">Credit</p>
                                <p className="font-medium text-green-600">
                                    {Number(line.credit) > 0 ? `${line.currency_code} ${Number(line.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                </p>
                            </div>
                            <div className="text-sm text-right">
                                <p className="text-muted-foreground">Balance</p>
                                <p className="font-medium {Number(line.balance) > 0 ? 'text-destructive' : 'text-green-600'}">
                                    {line.currency_code} {Number(line.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/50 text-sm text-muted-foreground">
                            {line.description}
                        </div>
                    </article>
                ))}
                {props.statementLines.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No transactions found for the selected period.
                    </div>
                )}
            </section>
        </main>
    );
}