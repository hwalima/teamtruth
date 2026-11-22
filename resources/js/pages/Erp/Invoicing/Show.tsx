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
type CreditNote = {
    id: number;
    document_number: string;
    status: string;
    total_amount: string;
    credit_note_date: string;
};
type FiscalDocument = {
    id: number;
    document_number: string;
    status: string;
    fiscal_device: { name: string } | null;
    fiscalized_at: string | null;
};
type JournalEntry = {
    id: number;
    document_number: string;
    entry_date: string;
    currency_code: string;
    total_debit: string;
    total_credit: string;
    lines: Array<{
        id: number;
        account: { code: string; name: string };
        debit: string;
        credit: string;
        description: string | null;
    }>;
};
type Invoice = {
    id: number;
    document_number: string;
    type: string;
    status: string;
    invoice_date: string;
    due_date: string;
    currency_code: string;
    exchange_rate: string;
    subtotal: string;
    tax_amount: string;
    total_amount: string;
    paid_amount: string;
    balance_due: string;
    notes: string | null;
    terms: string | null;
    footer_notes: string | null;
    customer: Customer;
    lines: Line[];
    payments: Payment[];
    credit_notes: CreditNote[];
    fiscal_documents: FiscalDocument[];
    journal_entry: JournalEntry | null;
    created_at: string;
    updated_at: string;
};
type Company = { id: number; code: string; name: string; default_currency: string; branding: { logo_url: string | null; letterhead_url: string | null } | null; signatories: Array<{ name: string; title: string; signature_url: string | null }> | null };
type Props = {
    company: Company;
    invoice: Invoice;
    payments: Payment[];
    canSend: boolean;
    canPost: boolean;
    canCancel: boolean;
    canRecordPayment: boolean;
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

const formatCurrency = (currency: string, amount: string) => {
    return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

export default function InvoicingShow(props: Props) {
    const { invoice } = props;
    const paymentForm = useForm({
        amount: invoice.balance_due,
        payment_date: new Date().toISOString().slice(0, 10),
        currency_code: invoice.currency_code,
        payment_method: '',
        reference: '',
        notes: '',
    });
    const paymentErrors = paymentForm.errors as Record<string, string>;

    const recordPayment = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        paymentForm.post(route('erp.invoicing.payments.store', invoice.id), {
            onSuccess: () => {
                paymentForm.reset('amount', 'payment_method', 'reference', 'notes');
                router.visit(route('erp.invoicing.show', invoice.id));
            },
        });
    };

    const postInvoice = () => {
        if (window.confirm('Post this invoice to accounting? This will create a journal entry and cannot be undone without a reversal.')) {
            router.post(route('erp.invoicing.post', invoice.id), {
                onSuccess: () => router.visit(route('erp.invoicing.show', invoice.id)),
            });
        }
    };

    const sendInvoice = () => {
        if (window.confirm('Send this invoice to the customer? This will change status to "Sent".')) {
            router.post(route('erp.invoicing.send', invoice.id), {
                onSuccess: () => router.visit(route('erp.invoicing.show', invoice.id)),
            });
        }
    };

    const cancelInvoice = () => {
        if (window.confirm('Cancel this invoice? This action cannot be undone.')) {
            router.post(route('erp.invoicing.cancel', invoice.id), {
                onSuccess: () => router.visit(route('erp.invoicing.show', invoice.id)),
            });
        }
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header className="flex flex-wrap justify-between gap-4 items-start">
                <div>
                    <p className="text-muted-foreground text-sm">{props.company.code}</p>
                    <div className="flex flex-wrap items-baseline gap-3 mt-1">
                        <h1 className="text-2xl font-semibold">
                            {invoice.type === 'proforma' ? 'Proforma' : 'Invoice'} {invoice.document_number}
                        </h1>
                        <span className={`px-2 py-1 rounded text-xs ${statusColors[invoice.status] ?? 'bg-gray-100 text-gray-800'}`}>
                            {invoice.status.replaceAll('_', ' ')}
                        </span>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                        {invoice.type === 'proforma' ? 'Proforma for' : 'Invoice for'} {invoice.customer.code} — {invoice.customer.name}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href={route('erp.invoicing.pdf', invoice.id)}
                        target="_blank"
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Download PDF
                    </a>
                    <a
                        href={route('erp.invoicing.edit', invoice.id)}
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Edit
                    </a>
                    {props.canSend && invoice.status === 'draft' && (
                        <button
                            onClick={sendInvoice}
                            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            Send
                        </button>
                    )}
                    {props.canPost && ['sent', 'draft'].includes(invoice.status) && (
                        <button
                            onClick={postInvoice}
                            className="bg-green-600 text-white inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            Post to Accounting
                        </button>
                    )}
                    {props.canCancel && !['paid', 'cancelled'].includes(invoice.status) && (
                        <button
                            onClick={cancelInvoice}
                            className="text-destructive inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-destructive/10"
                        >
                            Cancel
                        </button>
                    )}
                    {props.canRecordPayment && Number(invoice.balance_due) > 0 && (
                        <button
                            onClick={() => document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth' })}
                            className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                        >
                            Record Payment
                        </button>
                    )}
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                {/* Main Content */}
                <div className="space-y-6">
                    {/* Invoice Details */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Invoice Details</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <p className="text-muted-foreground text-sm">Invoice Date</p>
                                <p className="font-medium">{invoice.invoice_date}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Due Date</p>
                                <p className="font-medium">{invoice.due_date}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Currency</p>
                                <p className="font-medium">{invoice.currency_code} @ {invoice.exchange_rate}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Type</p>
                                <p className="font-medium capitalize">{invoice.type}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-muted-foreground text-sm">Notes</p>
                                <p className="font-medium">{invoice.notes ?? '—'}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-muted-foreground text-sm">Terms</p>
                                <p className="font-medium">{invoice.terms ?? '—'}</p>
                            </div>
                        </div>
                    </section>

                    {/* Customer Details */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Customer</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-muted-foreground text-sm">Name</p>
                                <p className="font-medium">{invoice.customer.name}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Code</p>
                                <p className="font-medium">{invoice.customer.code}</p>
                            </div>
                            {invoice.customer.email && (
                                <div>
                                    <p className="text-muted-foreground text-sm">Email</p>
                                    <p className="font-medium">{invoice.customer.email}</p>
                                </div>
                            )}
                            {invoice.customer.tax_no && (
                                <div>
                                    <p className="text-muted-foreground text-sm">Tax No</p>
                                    <p className="font-medium">{invoice.customer.tax_no}</p>
                                </div>
                            )}
                            {invoice.customer.billing_address && (
                                <div className="sm:col-span-2">
                                    <p className="text-muted-foreground text-sm">Billing Address</p>
                                    <p className="font-medium whitespace-pre-wrap">{invoice.customer.billing_address}</p>
                                </div>
                            )}
                            {invoice.customer.shipping_address && (
                                <div className="sm:col-span-2">
                                    <p className="text-muted-foreground text-sm">Shipping Address</p>
                                    <p className="font-medium whitespace-pre-wrap">{invoice.customer.shipping_address}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Invoice Lines */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Invoice Lines</h2>
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
                                    {invoice.lines.map((line) => (
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
                                            <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(invoice.currency_code, line.unit_price)}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{line.discount_percent}%</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{line.tax_rate}%</td>
                                            <td className="px-3 py-3 text-right font-medium tabular-nums">{formatCurrency(invoice.currency_code, line.line_total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/30 font-semibold">
                                        <td className="px-3 py-3 text-right" colSpan={6}>Subtotal</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(invoice.currency_code, invoice.subtotal)}</td>
                                    </tr>
                                    <tr className="bg-muted/30">
                                        <td className="px-3 py-3 text-right" colSpan={6}>Tax</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(invoice.currency_code, invoice.tax_amount)}</td>
                                    </tr>
                                    <tr className="bg-primary/10 font-bold">
                                        <td className="px-3 py-3 text-right" colSpan={6}>Total</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(invoice.currency_code, invoice.total_amount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {invoice.footer_notes && (
                            <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
                                <p className="font-medium">Footer Notes:</p>
                                <p className="text-muted-foreground">{invoice.footer_notes}</p>
                            </div>
                        )}
                    </section>

                    {/* Payments */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl" id="payment-form">
                        <div className="flex flex-wrap justify-between gap-3 items-center">
                            <h2 className="text-lg font-medium">Payments</h2>
                            {props.canRecordPayment && Number(invoice.balance_due) > 0 && (
                                <button
                                    onClick={() => document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="text-primary text-sm underline"
                                >
                                    Record Payment
                                </button>
                            )}
                        </div>

                        {props.payments.length > 0 ? (
                            <div className="space-y-3">
                                {props.payments.map((payment) => (
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
                                                        href={route('erp.accounting.index')}
                                                        className="text-primary underline text-xs"
                                                    >
                                                        Journal: {payment.journal_entry.document_number}
                                                    </a>
                                                )}
                                            </div>
                                        </header>
                                        {payment.notes && <p className="text-sm text-muted-foreground">{payment.notes}</p>}
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground py-4 text-center">No payments recorded yet.</p>
                        )}

                        {/* Record Payment Form */}
                        {props.canRecordPayment && Number(invoice.balance_due) > 0 && (
                            <form onSubmit={recordPayment} className="mt-4 space-y-3 rounded-md border p-4">
                                <h3 className="font-medium">Record New Payment</h3>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <label className="grid gap-1.5 text-sm">
                                            <span className="text-foreground/85 font-medium">Amount</span>
                                            <input
                                                type="number"
                                                min="0.0001"
                                                step="0.0001"
                                                value={paymentForm.data.amount}
                                                onChange={(e) => paymentForm.setData('amount', e.target.value)}
                                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                                required
                                            />
                                            {paymentErrors.amount && <span className="text-destructive text-sm">{paymentErrors.amount}</span>}
                                        </label>
                                    </div>
                                    <div>
                                        <label className="grid gap-1.5 text-sm">
                                            <span className="text-foreground/85 font-medium">Payment Date</span>
                                            <input
                                                type="date"
                                                value={paymentForm.data.payment_date}
                                                onChange={(e) => paymentForm.setData('payment_date', e.target.value)}
                                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                                required
                                            />
                                            {paymentErrors.payment_date && <span className="text-destructive text-sm">{paymentErrors.payment_date}</span>}
                                        </label>
                                    </div>
                                    <div>
                                        <label className="grid gap-1.5 text-sm">
                                            <span className="text-foreground/85 font-medium">Currency</span>
                                            <select
                                                value={paymentForm.data.currency_code}
                                                onChange={(e) => paymentForm.setData('currency_code', e.target.value)}
                                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                            >
                                                <option value={invoice.currency_code}>{invoice.currency_code}</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div>
                                        <label className="grid gap-1.5 text-sm">
                                            <span className="text-foreground/85 font-medium">Method</span>
                                            <select
                                                value={paymentForm.data.payment_method}
                                                onChange={(e) => paymentForm.setData('payment_method', e.target.value)}
                                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                            >
                                                <option value="">Select method</option>
                                                <option value="cash">Cash</option>
                                                <option value="bank_transfer">Bank Transfer</option>
                                                <option value="card">Card</option>
                                                <option value="check">Check</option>
                                                <option value="mobile_money">Mobile Money</option>
                                                <option value="other">Other</option>
                                            </select>
                                            {paymentErrors.payment_method && <span className="text-destructive text-sm">{paymentErrors.payment_method}</span>}
                                        </label>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="grid gap-1.5 text-sm">
                                            <span className="text-foreground/85 font-medium">Reference</span>
                                            <input
                                                type="text"
                                                value={paymentForm.data.reference}
                                                onChange={(e) => paymentForm.setData('reference', e.target.value)}
                                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                            />
                                            {paymentErrors.reference && <span className="text-destructive text-sm">{paymentErrors.reference}</span>}
                                        </label>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="grid gap-1.5 text-sm">
                                            <span className="text-foreground/85 font-medium">Notes</span>
                                            <textarea
                                                value={paymentForm.data.notes}
                                                onChange={(e) => paymentForm.setData('notes', e.target.value)}
                                                rows={2}
                                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 resize-none"
                                            />
                                            {paymentErrors.notes && <span className="text-destructive text-sm">{paymentErrors.notes}</span>}
                                        </label>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={paymentForm.processing}
                                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
                                    >
                                        {paymentForm.processing ? 'Recording...' : 'Record Payment'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </section>

                    {/* Credit Notes Applied */}
                    {invoice.credit_notes.length > 0 && (
                        <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                            <h2 className="text-lg font-medium">Credit Notes Applied</h2>
                            <div className="space-y-2">
                                {invoice.credit_notes.map((cn) => (
                                    <div key={cn.id} className="flex flex-wrap justify-between gap-3 rounded-md border p-3">
                                        <div>
                                            <p className="font-medium">{cn.document_number}</p>
                                            <p className="text-muted-foreground text-sm">{cn.credit_note_date}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs ${statusColors[cn.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                                {cn.status.replaceAll('_', ' ')}
                                            </span>
                                            <span className="font-medium">{formatCurrency(invoice.currency_code, cn.total_amount)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Fiscal Documents */}
                    {invoice.fiscal_documents.length > 0 && (
                        <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                            <h2 className="text-lg font-medium">Fiscal Documents (ZIMRA)</h2>
                            <div className="space-y-2">
                                {invoice.fiscal_documents.map((fd) => (
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

                    {/* Journal Entry */}
                    {invoice.journal_entry && (
                        <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                            <div className="flex flex-wrap justify-between gap-3 items-center">
                                <h2 className="text-lg font-medium">Journal Entry</h2>
                                <a
                                    href={route('erp.accounting.index')}
                                    className="text-primary text-sm underline"
                                >
                                    View Full Entry
                                </a>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-4">
                                <div>
                                    <p className="text-muted-foreground text-sm">Entry Date</p>
                                    <p className="font-medium">{invoice.journal_entry.entry_date}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm">Document</p>
                                    <p className="font-medium">{invoice.journal_entry.document_number}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm">Currency</p>
                                    <p className="font-medium">{invoice.journal_entry.currency_code}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-muted-foreground text-sm">Total Debit / Credit</p>
                                    <p className="font-medium">{formatCurrency(invoice.journal_entry.currency_code, invoice.journal_entry.total_debit)} / {formatCurrency(invoice.journal_entry.currency_code, invoice.journal_entry.total_credit)}</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px] text-left text-sm">
                                    <thead>
                                        <tr className="text-muted-foreground bg-muted/40 border-b">
                                            <th className="px-3 py-3 font-medium">Account</th>
                                            <th className="px-3 py-3 text-right font-medium">Debit</th>
                                            <th className="px-3 py-3 text-right font-medium">Credit</th>
                                            <th className="px-3 py-3 font-medium">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.journal_entry.lines.map((line) => (
                                            <tr key={line.id} className="border-border/60 border-b last:border-0">
                                                <td className="px-3 py-2.5">{line.account.code} — {line.account.name}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(invoice.journal_entry.currency_code, line.debit)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(invoice.journal_entry.currency_code, line.credit)}</td>
                                                <td className="px-3 py-2.5">{line.description ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* Timestamps */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-muted-foreground text-sm">Created</p>
                                <p className="font-medium">{new Date(invoice.created_at).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Updated</p>
                                <p className="font-medium">{new Date(invoice.updated_at).toLocaleString()}</p>
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
                                <span className="font-medium">{formatCurrency(invoice.currency_code, invoice.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax</span>
                                <span className="font-medium">{formatCurrency(invoice.currency_code, invoice.tax_amount)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-semibold border-t pt-2">
                                <span>Total</span>
                                <span>{formatCurrency(invoice.currency_code, invoice.total_amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Paid</span>
                                <span className="font-medium">{formatCurrency(invoice.currency_code, invoice.paid_amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold text-destructive">
                                <span>Balance Due</span>
                                <span>{formatCurrency(invoice.currency_code, invoice.balance_due)}</span>
                            </div>
                        </div>
                    </section>

                    {/* Quick Actions */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
                        <div className="space-y-2">
                            <a
                                href={route('erp.invoicing.pdf', invoice.id)}
                                target="_blank"
                                className="flex items-center gap-2 text-primary underline text-sm"
                            >
                                Download PDF
                            </a>
                            {props.canSend && invoice.status === 'draft' && (
                                <button
                                    onClick={sendInvoice}
                                    className="w-full text-left text-primary underline text-sm"
                                >
                                    Send to Customer
                                </button>
                            )}
                            {props.canPost && ['sent', 'draft'].includes(invoice.status) && (
                                <button
                                    onClick={postInvoice}
                                    className="w-full text-left text-green-600 underline text-sm"
                                >
                                    Post to Accounting
                                </button>
                            )}
                            {props.canCancel && !['paid', 'cancelled'].includes(invoice.status) && (
                                <button
                                    onClick={cancelInvoice}
                                    className="w-full text-left text-destructive underline text-sm"
                                >
                                    Cancel Invoice
                                </button>
                            )}
                            {props.canRecordPayment && Number(invoice.balance_due) > 0 && (
                                <button
                                    onClick={() => document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="w-full text-left text-primary underline text-sm"
                                >
                                    Record Payment
                                </button>
                            )}
                            <a
                                href={route('erp.invoicing.credit-notes.create')}
                                className="flex items-center gap-2 text-primary underline text-sm"
                            >
                                Create Credit Note
                            </a>
                        </div>
                    </section>

                    {/* Navigation */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <div className="flex flex-wrap gap-2">
                            <a
                                href={route('erp.invoicing.index')}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Back to List
                            </a>
                            <a
                                href={route('erp.invoicing.create')}
                                className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                New Invoice
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}