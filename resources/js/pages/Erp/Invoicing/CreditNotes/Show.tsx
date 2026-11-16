import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Product = { id: number; sku: string; name: string; unit: { abbreviation: string } | null };
type Account = { id: number; code: string; name: string };
type Customer = { id: number; code: string; name: string; email: string | null; tax_no: string | null; billing_address: string | null; shipping_address: string | null; currency_code: string };
type Line = {
    id: number;
    product: Product | null;
    account: Account | null;
    name: string;
    description: string | null;
    quantity: string;
    unit: string;
    unit_price: string;
    discount_percent: string;
    tax_rate: string;
    line_total: string;
    sort_order: number;
};
type Payment = {
    id: number;
    document_number: string;
    status: string;
    currency_code: string;
    amount: string;
    payment_date: string;
    payment_method: string | null;
    reference: string | null;
    journal_entry: { id: number; document_number: string } | null;
};
type Invoice = { id: number; document_number: string; status: string; total_amount: string; balance_due: string; currency_code: string };
type FiscalDocument = {
    id: number;
    document_number: string;
    status: string;
    fiscal_device: { name: string } | null;
    fiscalized_at: string | null;
};
type CreditNote = {
    id: number;
    document_number: string;
    status: string;
    credit_note_date: string;
    currency_code: string;
    exchange_rate: string;
    subtotal: string;
    tax_amount: string;
    total_amount: string;
    applied_amount: string;
    balance_due: string;
    reason: string | null;
    notes: string | null;
    customer: Customer;
    original_invoice: Invoice | null;
    lines: Line[];
    payments: Payment[];
    fiscal_documents: FiscalDocument[];
    created_at: string;
    updated_at: string;
};
type Company = { id: number; code: string; name: string; default_currency: string; branding: { logo_url: string | null; letterhead_url: string | null } | null; signatories: Array<{ name: string; title: string; signature_url: string | null }> | null };
type Props = {
    company: Company;
    creditNote: CreditNote;
    canIssue: boolean;
    canCancel: boolean;
    canApply: boolean;
};

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    issued: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    applied: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const formatCurrency = (currency: string, amount: string) => {
    return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

export default function CreditNoteShow(props: Props) {
    const { creditNote } = props;
    const applyForm = useForm({
        invoice_id: '',
        amount: creditNote.balance_due,
    });
    const applyErrors = applyForm.errors as Record<string, string>;

    const issueCreditNote = () => {
        if (window.confirm('Issue this credit note? This will change status to "Issued" and make it available for application to invoices.')) {
            router.post(route('erp.invoicing.credit-notes.issue', creditNote.id), {
                onSuccess: () => router.visit(route('erp.invoicing.credit-notes.show', creditNote.id)),
            });
        }
    };

    const cancelCreditNote = () => {
        if (window.confirm('Cancel this credit note? This action cannot be undone.')) {
            router.post(route('erp.invoicing.credit-notes.cancel', creditNote.id), {
                onSuccess: () => router.visit(route('erp.invoicing.credit-notes.show', creditNote.id)),
            });
        }
    };

    const applyCreditNote = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        applyForm.post(route('erp.invoicing.credit-notes.apply', creditNote.id), {
            onSuccess: () => router.visit(route('erp.invoicing.credit-notes.show', creditNote.id)),
        });
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header className="flex flex-wrap justify-between gap-4 items-start">
                <div>
                    <p className="text-muted-foreground text-sm">{props.company.code}</p>
                    <div className="flex flex-wrap items-baseline gap-3 mt-1">
                        <h1 className="text-2xl font-semibold">Credit Note {creditNote.document_number}</h1>
                        <span className={`px-2 py-1 rounded text-xs ${statusColors[creditNote.status] ?? 'bg-gray-100 text-gray-800'}`}>
                            {creditNote.status.replaceAll('_', ' ')}
                        </span>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Credit Note for {creditNote.customer.code} — {creditNote.customer.name}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href={route('erp.invoicing.credit-notes.pdf', creditNote.id)}
                        target="_blank"
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Download PDF
                    </a>
                    {props.canIssue && creditNote.status === 'draft' && (
                        <button
                            onClick={issueCreditNote}
                            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            Issue
                        </button>
                    )}
                    {props.canCancel && creditNote.status === 'draft' && (
                        <button
                            onClick={cancelCreditNote}
                            className="text-destructive inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-destructive/10"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                {/* Main Content */}
                <div className="space-y-6">
                    {/* Credit Note Details */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Credit Note Details</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <p className="text-muted-foreground text-sm">Date</p>
                                <p className="font-medium">{creditNote.credit_note_date}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Currency</p>
                                <p className="font-medium">{creditNote.currency_code} @ {creditNote.exchange_rate}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Reason</p>
                                <p className="font-medium">{creditNote.reason ?? '—'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Original Invoice</p>
                                <p className="font-medium">
                                    {creditNote.original_invoice ? (
                                        <a href={route('erp.invoicing.show', creditNote.original_invoice.id)} className="text-primary underline">
                                            {creditNote.original_invoice.document_number}
                                        </a>
                                    ) : '—'}
                                </p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-muted-foreground text-sm">Notes</p>
                                <p className="font-medium">{creditNote.notes ?? '—'}</p>
                            </div>
                        </div>
                    </section>

                    {/* Customer Details */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Customer</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-muted-foreground text-sm">Name</p>
                                <p className="font-medium">{creditNote.customer.name}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Code</p>
                                <p className="font-medium">{creditNote.customer.code}</p>
                            </div>
                            {creditNote.customer.email && (
                                <div>
                                    <p className="text-muted-foreground text-sm">Email</p>
                                    <p className="font-medium">{creditNote.customer.email}</p>
                                </div>
                            )}
                            {creditNote.customer.tax_no && (
                                <div>
                                    <p className="text-muted-foreground text-sm">Tax No</p>
                                    <p className="font-medium">{creditNote.customer.tax_no}</p>
                                </div>
                            )}
                            {creditNote.customer.billing_address && (
                                <div className="sm:col-span-2">
                                    <p className="text-muted-foreground text-sm">Billing Address</p>
                                    <p className="font-medium whitespace-pre-wrap">{creditNote.customer.billing_address}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Credit Note Lines */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Credit Note Lines</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-left text-sm">
                                <thead>
                                    <tr className="text-muted-foreground bg-muted/40 border-b">
                                        <th className="px-3 py-3 font-medium">Description</th>
                                        <th className="px-3 py-3 text-right font-medium">Qty</th>
                                        <th className="px-3 py-3 text-right font-medium">Unit</th>
                                        <th className="px-3 py-3 text-right font-medium">Unit Price</th>
                                        <th className="px-3 py-3 text-right font-medium">Disc %</th>
                                        <th className="px-3 py-3 text-right font-medium">Tax %</th>
                                        <th className="px-3 py-3 text-right font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {creditNote.lines.map((line) => (
                                        <tr key={line.id} className="border-border/60 hover:bg-muted/30 border-b transition-colors last:border-0">
                                            <td className="px-3 py-3">
                                                <p className="font-medium">{line.name}</p>
                                                {line.description && <p className="text-muted-foreground text-xs">{line.description}</p>}
                                                {(line.product || line.account) && (
                                                    <p className="text-muted-foreground text-xs">
                                                        {line.product ? `Product: ${line.product.sku} — ${line.product.name}` : `Account: ${line.account?.code} — ${line.account?.name}`}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right tabular-nums">{Number(line.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-3 py-3 text-right">{line.unit}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(creditNote.currency_code, line.unit_price)}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{line.discount_percent}%</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{line.tax_rate}%</td>
                                            <td className="px-3 py-3 text-right font-medium tabular-nums">{formatCurrency(creditNote.currency_code, line.line_total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/30 font-semibold">
                                        <td className="px-3 py-3 text-right" colSpan={6}>Subtotal</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(creditNote.currency_code, creditNote.subtotal)}</td>
                                    </tr>
                                    <tr className="bg-muted/30">
                                        <td className="px-3 py-3 text-right" colSpan={6}>Tax</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(creditNote.currency_code, creditNote.tax_amount)}</td>
                                    </tr>
                                    <tr className="bg-primary/10 font-bold">
                                        <td className="px-3 py-3 text-right" colSpan={6}>Total</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(creditNote.currency_code, creditNote.total_amount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>

                    {/* Apply to Invoice */}
                    {props.canApply && creditNote.status === 'issued' && Number(creditNote.balance_due) > 0 && (
                        <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl" id="apply-form">
                            <h2 className="text-lg font-medium">Apply Credit Note to Invoice</h2>
                            <p className="text-muted-foreground text-sm">Available balance: {formatCurrency(creditNote.currency_code, creditNote.balance_due)}</p>
                            <form onSubmit={applyCreditNote} className="grid gap-3 sm:grid-cols-4">
                                <div className="sm:col-span-2">
                                    <label className="grid gap-1.5 text-sm">
                                        <span className="text-foreground/85 font-medium">Invoice to Apply To</span>
                                        <select
                                            value={applyForm.data.invoice_id}
                                            onChange={(e) => applyForm.setData('invoice_id', e.target.value)}
                                            className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                            required
                                        >
                                            <option value="">Select an outstanding invoice</option>
                                            {/* Invoices would be passed from controller */}
                                        </select>
                                        {applyErrors.invoice_id && <span className="text-destructive text-sm">{applyErrors.invoice_id}</span>}
                                    </label>
                                </div>
                                <div>
                                    <label className="grid gap-1.5 text-sm">
                                        <span className="text-foreground/85 font-medium">Amount</span>
                                        <input
                                            type="number"
                                            min="0.0001"
                                            step="0.0001"
                                            max={creditNote.balance_due}
                                            value={applyForm.data.amount}
                                            onChange={(e) => applyForm.setData('amount', e.target.value)}
                                            className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                            required
                                        />
                                        {applyErrors.amount && <span className="text-destructive text-sm">{applyErrors.amount}</span>}
                                    </label>
                                </div>
                                <div className="flex items-end sm:col-span-4">
                                    <button
                                        type="submit"
                                        disabled={applyForm.processing}
                                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
                                    >
                                        {applyForm.processing ? 'Applying...' : 'Apply Credit Note'}
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                    {/* Payments/Allocations */}
                    {creditNote.payments.length > 0 && (
                        <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                            <h2 className="text-lg font-medium">Allocations & Refunds</h2>
                            <div className="space-y-3">
                                {creditNote.payments.map((payment) => (
                                    <article key={payment.id} className="space-y-2 rounded-md border p-3">
                                        <header className="flex flex-wrap justify-between gap-2">
                                            <div>
                                                <h3 className="font-medium">{payment.document_number}</h3>
                                                <p className="text-muted-foreground text-sm">
                                                    {payment.payment_date} · {payment.payment_method ?? '—'} {payment.reference ? `· Ref: ${payment.reference}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-3 text-sm">
                                                <span className={`px-2 py-1 rounded text-xs ${statusColors[payment.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                                    {payment.status.replaceAll('_', ' ')}
                                                </span>
                                                <span className="font-medium">{formatCurrency(payment.currency_code, payment.amount)}</span>
                                                {payment.journal_entry && (
                                                    <a
                                                        href={route('erp.accounting.entries.show', payment.journal_entry.id)}
                                                        className="text-primary underline text-xs"
                                                    >
                                                        Journal: {payment.journal_entry.document_number}
                                                    </a>
                                                )}
                                            </div>
                                        </header>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Fiscal Documents */}
                    {creditNote.fiscal_documents.length > 0 && (
                        <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                            <h2 className="text-lg font-medium">Fiscal Documents (ZIMRA)</h2>
                            <div className="space-y-2">
                                {creditNote.fiscal_documents.map((fd) => (
                                    <div key={fd.id} className="flex flex-wrap justify-between gap-3 rounded-md border p-3">
                                        <div>
                                            <p className="font-medium">{fd.document_number}</p>
                                            <p className="text-muted-foreground text-sm">{fd.fiscal_device?.name ?? 'Unknown device'}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs ${statusColors[fd.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                                {fd.status.replaceAll('_', ' ')}
                                            </span>
                                            {fd.fiscalized_at && (
                                                <span className="text-muted-foreground">
                                                    Fiscalized: {new Date(fd.fiscalized_at).toLocaleString()}
                                                </span>
                                            )}
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
                                <p className="font-medium">{new Date(creditNote.created_at).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Updated</p>
                                <p className="font-medium">{new Date(creditNote.updated_at).toLocaleString()}</p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sidebar Totals */}
                <div className="space-y-6">
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium mb-4">Totals</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-medium">{formatCurrency(creditNote.currency_code, creditNote.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax</span>
                                <span className="font-medium">{formatCurrency(creditNote.currency_code, creditNote.tax_amount)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-semibold border-t pt-2">
                                <span>Total</span>
                                <span>{formatCurrency(creditNote.currency_code, creditNote.total_amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Applied</span>
                                <span className="font-medium">{formatCurrency(creditNote.currency_code, creditNote.applied_amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold">
                                <span>Available Balance</span>
                                <span>{formatCurrency(creditNote.currency_code, creditNote.balance_due)}</span>
                            </div>
                        </div>
                    </section>

                    {/* Quick Actions */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
                        <div className="space-y-2">
                            <a
                                href={route('erp.invoicing.credit-notes.pdf', creditNote.id)}
                                target="_blank"
                                className="flex items-center gap-2 text-primary underline text-sm"
                            >
                                Download PDF
                            </a>
                            {props.canIssue && creditNote.status === 'draft' && (
                                <button
                                    onClick={issueCreditNote}
                                    className="w-full text-left text-primary underline text-sm"
                                >
                                    Issue Credit Note
                                </button>
                            )}
                            {props.canApply && creditNote.status === 'issued' && Number(creditNote.balance_due) > 0 && (
                                <button
                                    onClick={() => document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="w-full text-left text-primary underline text-sm"
                                >
                                    Apply to Invoice
                                </button>
                            )}
                            {props.canCancel && creditNote.status === 'draft' && (
                                <button
                                    onClick={cancelCreditNote}
                                    className="w-full text-left text-destructive underline text-sm"
                                >
                                    Cancel Credit Note
                                </button>
                            )}
                        </div>
                    </section>

                    {/* Navigation */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <div className="flex flex-wrap gap-2">
                            <a
                                href={route('erp.invoicing.credit-notes.index')}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Back to List
                            </a>
                            <a
                                href={route('erp.invoicing.credit-notes.create')}
                                className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                New Credit Note
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}