import { QUOTATION_STATUS_LABELS, money, type QuotationStatus } from '@/components/erp/sales';
import { Card, Detail, StatusBadge, formatDate, humanize, inputClass, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { FileDown, Mail, Send, ShoppingCart } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Line = {
    id: number;
    description: string;
    quantity: string;
    unit_price: string;
    discount: string;
    tax_rate: string;
    total: string;
    notes: string | null;
    product: { id: number; sku: string; name: string } | null;
};
type Quotation = {
    id: number;
    document_number: string;
    status: QuotationStatus;
    currency_code: string;
    subtotal: string;
    discount_total: string;
    tax_total: string;
    total: string;
    notes: string | null;
    terms: string | null;
    valid_until: string | null;
    created_at: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    sent_at: string | null;
    sent_to: string | null;
    customer: { id: number; code: string; name: string; email: string | null; phone: string | null; billing_address: string | null };
    opportunity: { id: number; title: string } | null;
    creator: { id: number; name: string } | null;
    lines: Line[];
    sales_orders: { id: number; document_number: string; status: string; total: string; currency_code: string }[];
};
type Props = { quotation: Quotation; canManage: boolean; canSend: boolean };

const quantity = (value: string) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
const percent = (value: string) => (Number(value) > 0 ? `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%` : '—');

function SendForm({ quotation }: { quotation: Quotation }) {
    const [open, setOpen] = useState(false);
    const form = useForm({ email: quotation.sent_to ?? quotation.customer.email ?? '', message: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.sales.quotations.send', quotation.id), { preserveScroll: true, onSuccess: () => setOpen(false) });
    };

    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)} className={`${primaryButton} gap-2`}>
                <Mail className="size-4" /> {quotation.sent_at ? 'Send to customer again' : 'Email to customer'}
            </button>
        );
    }

    return (
        <form onSubmit={submit} className="bg-muted/30 w-full space-y-3 rounded-xl border p-4">
            <p className="text-sm font-medium">Email the quotation PDF to the customer</p>
            <label className="grid gap-1.5 text-sm">
                <span className="text-foreground/85 font-medium">Send to</span>
                <input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} className={inputClass} required />
                {form.errors.email && <span className="text-destructive text-xs">{form.errors.email}</span>}
            </label>
            <label className="grid gap-1.5 text-sm">
                <span className="text-foreground/85 font-medium">Message (optional)</span>
                <textarea
                    rows={3}
                    value={form.data.message}
                    onChange={(e) => form.setData('message', e.target.value)}
                    className={inputClass}
                    maxLength={2000}
                    placeholder="Leave blank for the standard covering note."
                />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
                    Cancel
                </button>
                <button type="submit" className={`${primaryButton} gap-2`} disabled={form.processing}>
                    <Send className="size-4" /> {form.processing ? 'Sending…' : 'Send'}
                </button>
            </div>
        </form>
    );
}

export default function QuotationShow({ quotation, canManage, canSend }: Props) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [busy, setBusy] = useState(false);
    const hasDiscount = quotation.lines.some((line) => Number(line.discount) > 0);
    const hasTax = quotation.lines.some((line) => Number(line.tax_rate) > 0);
    const flowError = errors.approval ?? errors.quotation;

    const post = (name: string, message: string) => {
        if (!window.confirm(message)) return;
        router.post(route(name, quotation.id), {}, { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false) });
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="space-y-4">
                <p className="text-muted-foreground text-sm">
                    <Link href={route('erp.sales.index')} className="hover:underline">
                        Sales
                    </Link>{' '}
                    ·{' '}
                    <Link href={route('erp.sales.quotations.index')} className="hover:underline">
                        Quotations
                    </Link>
                </p>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold break-all">{quotation.document_number}</h1>
                            <StatusBadge value={quotation.status} label={QUOTATION_STATUS_LABELS[quotation.status]} />
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {quotation.customer.name} · {money(quotation.currency_code, quotation.total)}
                        </p>
                        {quotation.sent_at && (
                            <p className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-sm">
                                <Mail className="size-3.5" /> Sent to {quotation.sent_to} on {formatDate(quotation.sent_at)}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <a href={route('erp.sales.quotations.pdf', quotation.id)} target="_blank" rel="noreferrer" className={`${secondaryButton} gap-2`}>
                            <FileDown className="size-4" /> View PDF
                        </a>
                        {canManage && quotation.status === 'draft' && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => post('erp.sales.quotations.submit', `Submit ${quotation.document_number} for approval?`)}
                                className={primaryButton}
                            >
                                Submit for approval
                            </button>
                        )}
                        {canManage && quotation.status === 'approved' && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    post('erp.sales.quotations.orders.store', `The customer accepted? Create a sales order from ${quotation.document_number}?`)
                                }
                                className={`${secondaryButton} gap-2`}
                            >
                                <ShoppingCart className="size-4" /> Create sales order
                            </button>
                        )}
                    </div>
                </div>
                {flowError && <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-xl border px-4 py-3 text-sm">{flowError}</p>}
                {quotation.status === 'pending_approval' && (
                    <p className="bg-muted/40 rounded-xl border px-4 py-3 text-sm">
                        Waiting for approval. Approvers see it in the{' '}
                        <a href={route('erp.approvals.index')} className="text-primary font-medium hover:underline">
                            approval inbox
                        </a>
                        .
                    </p>
                )}
                {canManage && canSend && <SendForm quotation={quotation} />}
            </header>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card title="Lines" className="min-w-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-sm">
                            <thead className="text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
                                <tr>
                                    <th className="py-2 pr-3 font-medium">Item</th>
                                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                                    <th className="px-3 py-2 text-right font-medium">Unit price</th>
                                    {hasDiscount && <th className="px-3 py-2 text-right font-medium">Disc.</th>}
                                    {hasTax && <th className="px-3 py-2 text-right font-medium">Tax</th>}
                                    <th className="py-2 pl-3 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {quotation.lines.map((line) => (
                                    <tr key={line.id}>
                                        <td className="py-3 pr-3">
                                            <div className="font-medium">{line.description}</div>
                                            {line.product && (
                                                <div className="text-muted-foreground text-xs">
                                                    {line.product.name !== line.description && <>{line.product.name} · </>}
                                                    {line.product.sku}
                                                </div>
                                            )}
                                            {line.notes && <div className="text-muted-foreground text-xs">{line.notes}</div>}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums">{quantity(line.quantity)}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">{money(quotation.currency_code, line.unit_price)}</td>
                                        {hasDiscount && <td className="px-3 py-3 text-right tabular-nums">{percent(line.discount)}</td>}
                                        {hasTax && <td className="px-3 py-3 text-right tabular-nums">{percent(line.tax_rate)}</td>}
                                        <td className="py-3 pl-3 text-right font-medium tabular-nums">{money(quotation.currency_code, line.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <dl className="ml-auto grid w-full max-w-xs gap-1.5 border-t pt-4 text-sm">
                        {Number(quotation.discount_total) > 0 && (
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">Discount</dt>
                                <dd className="tabular-nums">- {money(quotation.currency_code, quotation.discount_total)}</dd>
                            </div>
                        )}
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Subtotal</dt>
                            <dd className="tabular-nums">{money(quotation.currency_code, quotation.subtotal)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Tax</dt>
                            <dd className="tabular-nums">{money(quotation.currency_code, quotation.tax_total)}</dd>
                        </div>
                        <div className="flex justify-between gap-4 text-base font-semibold">
                            <dt>Total</dt>
                            <dd className="tabular-nums">{money(quotation.currency_code, quotation.total)}</dd>
                        </div>
                    </dl>
                </Card>

                <div className="min-w-0 space-y-6">
                    <Card title="Details">
                        <dl className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Detail
                                    label="Customer"
                                    value={
                                        <>
                                            {quotation.customer.name} <span className="text-muted-foreground">({quotation.customer.code})</span>
                                            {quotation.customer.email && <div className="text-muted-foreground break-all">{quotation.customer.email}</div>}
                                        </>
                                    }
                                />
                            </div>
                            <Detail label="Created" value={formatDate(quotation.created_at)} />
                            <Detail label="Valid until" value={formatDate(quotation.valid_until)} />
                            <Detail label="Prepared by" value={quotation.creator?.name} />
                            <Detail label="Approved" value={quotation.approved_at ? formatDate(quotation.approved_at) : null} />
                            {quotation.opportunity && (
                                <div className="col-span-2">
                                    <Detail label="Opportunity" value={quotation.opportunity.title} />
                                </div>
                            )}
                        </dl>
                    </Card>

                    {quotation.sales_orders.length > 0 && (
                        <Card title="Sales orders">
                            <ul className="divide-y text-sm">
                                {quotation.sales_orders.map((order) => (
                                    <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                                        <span className="font-medium break-all">{order.document_number}</span>
                                        <span className="flex shrink-0 items-center gap-2">
                                            <StatusBadge value={order.status} label={humanize(order.status)} />
                                            <span className="tabular-nums">{money(order.currency_code, order.total)}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}

                    {(quotation.notes || quotation.terms) && (
                        <Card title="Notes and terms">
                            {quotation.notes && <p className="text-sm whitespace-pre-line">{quotation.notes}</p>}
                            {quotation.terms && (
                                <div>
                                    <p className="text-muted-foreground text-xs tracking-wide uppercase">Terms</p>
                                    <p className="mt-1 text-sm whitespace-pre-line">{quotation.terms}</p>
                                </div>
                            )}
                        </Card>
                    )}
                </div>
            </div>
        </main>
    );
}
