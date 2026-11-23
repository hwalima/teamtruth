import { OrderActions, type OrderFlags } from '@/components/erp/order-actions';
import { ORDER_STATUS_LABELS, money, qty, type OrderStatus } from '@/components/erp/sales';
import { Card, Detail, StatusBadge, formatDate, humanize, inputClass, primaryButton } from '@/components/hrm/ui';
import { Link, useForm, usePage } from '@inertiajs/react';
import { Truck } from 'lucide-react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type StockRow = { location_id: number; location: string; lot_code: string | null; quantity: string };
type Line = {
    id: number;
    description: string;
    quantity: string;
    delivered_quantity: string;
    invoiced_quantity: string;
    unit_price: string;
    discount: string;
    tax_rate: string;
    total: string;
    notes: string | null;
    product: { id: number; sku: string; name: string; tracking: string; unit: string | null } | null;
    needs_delivery: boolean;
    to_deliver: string;
    to_invoice: string;
    stock: StockRow[];
};
type Order = OrderFlags & {
    status: OrderStatus;
    currency_code: string;
    subtotal: string;
    discount_total: string;
    tax_total: string;
    total: string;
    customer_reference: string | null;
    notes: string | null;
    expected_delivery_date: string | null;
    created_at: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    customer: { id: number; code: string; name: string; email: string | null; phone: string | null; billing_address: string | null };
    quotation: { id: number; document_number: string } | null;
    creator: { id: number; name: string } | null;
    lines: Line[];
    deliveries: {
        id: number;
        document_number: string;
        delivered_at: string | null;
        delivered_by: string | null;
        notes: string | null;
        lines: { id: number; description: string | null; quantity: string; location: string | null; lot_code: string | null }[];
    }[];
    invoices: { id: number; document_number: string; status: string; total_amount: string; currency_code: string; invoice_date: string | null }[];
    has_goods: boolean;
    delivered_percent: number | null;
    invoiced_percent: number;
};
type Props = { order: Order; canManage: boolean; canInvoice: boolean };

const sourceKey = (row: StockRow) => `${row.location_id}|${row.lot_code ?? ''}`;

/** One row per goods line still to go out: how many, and which store location (and lot) they leave from. */
function DeliverForm({ order }: { order: Order }) {
    const open = order.lines.filter((line) => line.needs_delivery && Number(line.to_deliver) > 0);
    const form = useForm({
        notes: '',
        lines: open.map((line) => {
            const best = [...line.stock].sort((a, b) => Number(b.quantity) - Number(a.quantity))[0];
            return {
                sales_order_line_id: line.id,
                quantity: best ? String(Math.min(Number(line.to_deliver), Number(best.quantity))) : '0',
                source: best ? sourceKey(best) : '',
            };
        }),
    });
    const errors = form.errors as Record<string, string | undefined>;

    const setLine = (index: number, patch: Partial<(typeof form.data.lines)[number]>) =>
        form.setData('lines', form.data.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            notes: data.notes || null,
            lines: data.lines.map((line) => {
                const [location, lot] = line.source.split('|');
                return { sales_order_line_id: line.sales_order_line_id, quantity: line.quantity || '0', location_id: location ? Number(location) : null, lot_code: lot || null };
            }),
        }));
        form.post(route('erp.sales.orders.deliver', order.id), { preserveScroll: true });
    };

    if (open.length === 0) return null;

    return (
        <Card title="Deliver goods" className="scroll-mt-20" >
            <form id="deliver" onSubmit={submit} className="space-y-4 scroll-mt-24">
                <p className="text-muted-foreground text-sm">
                    Enter what is going out now. Leave a line at 0 to send it later; the order stays open until everything has gone.
                </p>
                {(errors.lines || errors.quantity || errors.lot_code || errors.operation) && (
                    <p className="text-destructive text-sm">{errors.lines ?? errors.quantity ?? errors.lot_code ?? errors.operation}</p>
                )}
                <ul className="divide-y rounded-xl border">
                    {open.map((line, index) => {
                        const value = form.data.lines[index];
                        const chosen = line.stock.find((row) => sourceKey(row) === value.source);
                        return (
                            <li key={line.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,16rem)] sm:items-start">
                                <div className="min-w-0">
                                    <div className="font-medium">{line.description}</div>
                                    <div className="text-muted-foreground text-xs">
                                        {line.product?.sku} · {qty(line.to_deliver)} {line.product?.unit ?? ''} left to deliver
                                    </div>
                                </div>
                                <label className="grid gap-1 text-sm">
                                    <span className="text-muted-foreground text-xs">Quantity</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max={line.to_deliver}
                                        step="any"
                                        value={value.quantity}
                                        onChange={(e) => setLine(index, { quantity: e.target.value })}
                                        className={`${inputClass} text-right`}
                                    />
                                    {errors[`lines.${index}.quantity`] && <span className="text-destructive text-xs">{errors[`lines.${index}.quantity`]}</span>}
                                </label>
                                <label className="grid min-w-0 gap-1 text-sm">
                                    <span className="text-muted-foreground text-xs">From</span>
                                    {line.stock.length === 0 ? (
                                        <span className="text-destructive py-2 text-sm">No stock on hand in any store.</span>
                                    ) : (
                                        <select value={value.source} onChange={(e) => setLine(index, { source: e.target.value })} className={inputClass}>
                                            {line.stock.map((row) => (
                                                <option key={sourceKey(row)} value={sourceKey(row)}>
                                                    {row.location}
                                                    {row.lot_code ? ` · lot ${row.lot_code}` : ''} ({qty(row.quantity)} on hand)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {chosen && Number(value.quantity) > Number(chosen.quantity) && (
                                        <span className="text-destructive text-xs">Only {qty(chosen.quantity)} here.</span>
                                    )}
                                    {errors[`lines.${index}.location_id`] && <span className="text-destructive text-xs">{errors[`lines.${index}.location_id`]}</span>}
                                </label>
                            </li>
                        );
                    })}
                </ul>
                <label className="grid gap-1.5 text-sm">
                    <span className="text-foreground/85 font-medium">Delivery note (optional)</span>
                    <textarea
                        rows={2}
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        className={inputClass}
                        maxLength={2000}
                        placeholder="Vehicle, driver, who received it…"
                    />
                </label>
                <div className="flex justify-end">
                    <button type="submit" className={`${primaryButton} gap-2`} disabled={form.processing}>
                        <Truck className="size-4" /> {form.processing ? 'Recording…' : 'Record delivery'}
                    </button>
                </div>
            </form>
        </Card>
    );
}

export default function OrderShow({ order, canManage, canInvoice }: Props) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const flowError = errors.approval ?? errors.sales_order;
    const hasDiscount = order.lines.some((line) => Number(line.discount) > 0);
    const hasTax = order.lines.some((line) => Number(line.tax_rate) > 0);

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="space-y-4">
                <p className="text-muted-foreground text-sm">
                    <Link href={route('erp.sales.index')} className="hover:underline">
                        Sales
                    </Link>{' '}
                    ·{' '}
                    <Link href={route('erp.sales.orders.index')} className="hover:underline">
                        Sales orders
                    </Link>
                </p>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-semibold break-all">{order.document_number}</h1>
                            <StatusBadge value={order.status} label={ORDER_STATUS_LABELS[order.status]} />
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {order.customer.name} · {money(order.currency_code, order.total)}
                            {order.customer_reference && ` · their PO ${order.customer_reference}`}
                        </p>
                        {order.status !== 'cancelled' && (
                            <p className="text-muted-foreground mt-1 text-sm">
                                {order.delivered_percent !== null && `${order.delivered_percent}% delivered · `}
                                {order.invoiced_percent}% invoiced
                            </p>
                        )}
                    </div>
                    <OrderActions order={order} canManage={canManage} showDeliver={false} showLabels />
                </div>
                {flowError && <p className="text-destructive bg-destructive/10 rounded-xl px-4 py-3 text-sm">{flowError}</p>}
                {order.status === 'pending_approval' && (
                    <p className="bg-muted/50 rounded-xl px-4 py-3 text-sm">
                        Waiting for approval. Approvers find it under{' '}
                        <Link href={route('erp.approvals.index')} className="text-primary font-medium hover:underline">
                            My approvals
                        </Link>
                        .
                    </p>
                )}
                {order.status === 'draft' && canManage && (
                    <p className="bg-muted/50 rounded-xl px-4 py-3 text-sm">Submit the order for approval before goods can be delivered or invoiced.</p>
                )}
            </header>

            <Card title="Lines">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                        <thead className="text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
                            <tr>
                                <th className="py-2 pr-3 font-medium">Item</th>
                                <th className="px-3 py-2 text-right font-medium">Ordered</th>
                                <th className="px-3 py-2 text-right font-medium">Delivered</th>
                                <th className="px-3 py-2 text-right font-medium">Invoiced</th>
                                <th className="px-3 py-2 text-right font-medium">Unit price</th>
                                {hasDiscount && <th className="px-3 py-2 text-right font-medium">Disc.</th>}
                                {hasTax && <th className="px-3 py-2 text-right font-medium">Tax</th>}
                                <th className="py-2 pl-3 text-right font-medium">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {order.lines.map((line) => (
                                <tr key={line.id} className="align-top">
                                    <td className="py-2.5 pr-3">
                                        <div className="font-medium">{line.description}</div>
                                        <div className="text-muted-foreground text-xs">
                                            {line.product ? line.product.sku : 'Service'}
                                            {!line.needs_delivery && ' · invoiced without delivery'}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">
                                        {qty(line.quantity)} {line.product?.unit ?? ''}
                                    </td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{line.needs_delivery ? qty(line.delivered_quantity) : '—'}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{qty(line.invoiced_quantity)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{money(order.currency_code, line.unit_price)}</td>
                                    {hasDiscount && <td className="px-3 py-2.5 text-right tabular-nums">{Number(line.discount) > 0 ? `${qty(line.discount)}%` : '—'}</td>}
                                    {hasTax && <td className="px-3 py-2.5 text-right tabular-nums">{Number(line.tax_rate) > 0 ? `${qty(line.tax_rate)}%` : '—'}</td>}
                                    <td className="py-2.5 pl-3 text-right font-medium tabular-nums">{money(order.currency_code, line.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <dl className="ml-auto grid w-full max-w-xs gap-1.5 border-t pt-4 text-sm">
                    {Number(order.discount_total) > 0 && (
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Discount</dt>
                            <dd className="tabular-nums">- {money(order.currency_code, order.discount_total)}</dd>
                        </div>
                    )}
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Subtotal</dt>
                        <dd className="tabular-nums">{money(order.currency_code, order.subtotal)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Tax</dt>
                        <dd className="tabular-nums">{money(order.currency_code, order.tax_total)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 text-base font-semibold">
                        <dt>Total</dt>
                        <dd className="tabular-nums">{money(order.currency_code, order.total)}</dd>
                    </div>
                </dl>
            </Card>

            {canManage && order.can_deliver && <DeliverForm order={order} />}

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Deliveries">
                    {order.deliveries.length === 0 ? (
                        <p className="text-muted-foreground text-sm">{order.has_goods ? 'Nothing delivered yet.' : 'This order has no goods to deliver.'}</p>
                    ) : (
                        <ul className="divide-y">
                            {order.deliveries.map((delivery) => (
                                <li key={delivery.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <span className="font-medium break-all">{delivery.document_number}</span>
                                        <span className="text-muted-foreground text-xs">
                                            {formatDate(delivery.delivered_at)}
                                            {delivery.delivered_by && ` · ${delivery.delivered_by}`}
                                        </span>
                                    </div>
                                    <ul className="text-muted-foreground text-sm">
                                        {delivery.lines.map((line) => (
                                            <li key={line.id}>
                                                {qty(line.quantity)} × {line.description}
                                                {line.location && ` from ${line.location}`}
                                                {line.lot_code && ` (lot ${line.lot_code})`}
                                            </li>
                                        ))}
                                    </ul>
                                    {delivery.notes && <p className="text-sm">{delivery.notes}</p>}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title="Invoices">
                    {order.invoices.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            {order.can_invoice && canManage ? 'Nothing invoiced yet. Use Create invoice above to bill what has gone out.' : 'Nothing invoiced yet.'}
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {order.invoices.map((invoice) => (
                                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        {canInvoice ? (
                                            <Link href={route('erp.invoicing.show', invoice.id)} className="font-medium break-all hover:underline">
                                                {invoice.document_number}
                                            </Link>
                                        ) : (
                                            <span className="font-medium break-all">{invoice.document_number}</span>
                                        )}
                                        <div className="text-muted-foreground text-xs">{formatDate(invoice.invoice_date)}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge value={invoice.status} label={humanize(invoice.status)} />
                                        <span className="font-medium tabular-nums">{money(invoice.currency_code, invoice.total_amount)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            <Card title="Details">
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Detail label="Customer" value={`${order.customer.name} (${order.customer.code})`} />
                    <Detail label="Their PO number" value={order.customer_reference ?? '—'} />
                    <Detail
                        label="From quotation"
                        value={
                            order.quotation ? (
                                <Link href={route('erp.sales.quotations.show', order.quotation.id)} className="text-primary hover:underline">
                                    {order.quotation.document_number}
                                </Link>
                            ) : (
                                '—'
                            )
                        }
                    />
                    <Detail label="Expected delivery" value={formatDate(order.expected_delivery_date)} />
                    <Detail label="Created" value={`${formatDate(order.created_at)}${order.creator ? ` by ${order.creator.name}` : ''}`} />
                    <Detail label="Approved" value={formatDate(order.approved_at)} />
                    <Detail label="Currency" value={order.currency_code} />
                    <Detail label="Customer contact" value={[order.customer.email, order.customer.phone].filter(Boolean).join(' · ') || '—'} />
                </dl>
            </Card>
        </main>
    );
}
