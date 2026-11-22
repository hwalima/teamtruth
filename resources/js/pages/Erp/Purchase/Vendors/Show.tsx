import { ActionButton, useConfirmDelete } from '@/components/erp/record-actions';
import { formatAmounts, formatMoney, VendorFormDialog, type VendorFields } from '@/components/erp/vendor-form-dialog';
import { formatDay } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { ArrowLeft, Pencil, Power, RotateCcw, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { route } from 'ziggy-js';

type Vendor = VendorFields & { id: number; is_active: boolean; created_at: string };
type Order = {
    id: number;
    document_number: string;
    status: string;
    currency_code: string;
    total: string;
    expected_delivery_date: string | null;
    created_at: string;
};
type Bill = {
    id: number;
    document_number: string;
    vendor_reference: string | null;
    status: string;
    currency_code: string;
    total_amount: string;
    amount_residual: string;
    bill_date: string | null;
    due_date: string | null;
};
type PriceList = {
    id: number;
    min_quantity: string;
    price: string;
    currency_code: string;
    valid_from: string | null;
    valid_to: string | null;
    product: { id: number; sku: string; name: string } | null;
};
type Amounts = Record<string, string>;

type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    vendor: Vendor;
    stats: { orders: number; ordered: Amounts; bills: number; owed: Amounts; paid: Amounts };
    orders: Order[];
    bills: Bill[];
    priceLists: PriceList[];
    currencies: { code: string; name: string }[];
    canDelete: boolean;
};

const label = (status: string) => status.replace(/_/g, ' ');

function Stat({ title, value, note }: { title: string; value: ReactNode; note?: string }) {
    return (
        <div className="bg-card/70 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
            {note && <p className="text-muted-foreground text-xs">{note}</p>}
        </div>
    );
}

function Panel({ title, children, empty }: { title: string; children: ReactNode; empty?: string | false }) {
    return (
        <section className="bg-card/70 overflow-hidden rounded-xl border">
            <h2 className="border-b px-4 py-3 font-medium">{title}</h2>
            {empty ? (
                <p className="text-muted-foreground px-4 py-8 text-center text-sm">{empty}</p>
            ) : (
                <div className="overflow-x-auto">{children}</div>
            )}
        </section>
    );
}

const th = 'px-4 py-2.5 font-medium';
const td = 'px-4 py-2.5';

export default function VendorShow({ company, vendor, stats, orders, bills, priceLists, currencies, canDelete }: Props) {
    const [editing, setEditing] = useState(false);
    const { askDelete, deleteDialog } = useConfirmDelete();

    const toggle = () => {
        const message = vendor.is_active
            ? `Deactivate ${vendor.name}? Its orders and bills are kept, but it is no longer offered on new documents.`
            : `Reactivate ${vendor.name}?`;
        if (window.confirm(message)) {
            router.post(route('erp.purchase.vendors.toggle', vendor.id), {}, { preserveScroll: true });
        }
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <Link
                href={route('erp.purchase.vendors.index')}
                className="text-muted-foreground inline-flex items-center gap-1.5 text-sm hover:underline"
            >
                <ArrowLeft className="size-4" /> Vendors
            </Link>

            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-muted-foreground text-sm">
                        {vendor.code} · {company.name}
                    </p>
                    <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
                        {vendor.name}
                        <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                vendor.is_active
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {vendor.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </h1>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <ActionButton icon={Pencil} label="Edit" tone="edit" onClick={() => setEditing(true)} showLabel />
                    <ActionButton
                        icon={vendor.is_active ? Power : RotateCcw}
                        label={vendor.is_active ? 'Deactivate' : 'Reactivate'}
                        tone="neutral"
                        onClick={toggle}
                        showLabel
                    />
                    {canDelete && (
                        <ActionButton
                            icon={Trash2}
                            label="Delete"
                            tone="delete"
                            showLabel
                            onClick={() =>
                                askDelete({
                                    url: route('erp.purchase.vendors.destroy', vendor.id),
                                    title: `Delete ${vendor.name}?`,
                                    description: 'It has no orders or bills. Its price list is removed with it. This cannot be undone.',
                                })
                            }
                        />
                    )}
                </div>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat title="Owed now" value={formatAmounts(stats.owed)} note="On approved bills not yet paid" />
                <Stat title="Paid" value={formatAmounts(stats.paid)} note="Posted payments" />
                <Stat title="Ordered" value={formatAmounts(stats.ordered)} note={`${stats.orders} purchase order${stats.orders === 1 ? '' : 's'}`} />
                <Stat title="Bills" value={stats.bills} />
            </section>

            <section className="bg-card/70 grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                    ['Tax number', vendor.tax_no],
                    ['Email', vendor.email],
                    ['Phone', vendor.phone],
                    ['Payment terms', `${vendor.payment_terms_days} days${vendor.currency_code ? ` · ${vendor.currency_code}` : ''}`],
                ].map(([title, value]) => (
                    <div key={title}>
                        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</p>
                        <p className="mt-0.5 break-words">{value || '—'}</p>
                    </div>
                ))}
                <div className="sm:col-span-2 lg:col-span-4">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Address</p>
                    <p className="mt-0.5 whitespace-pre-line">{vendor.address || '—'}</p>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Recent bills" empty={bills.length === 0 && 'No bills from this vendor yet.'}>
                    <table className="w-full min-w-[480px] text-sm">
                        <thead className="bg-muted/40 text-muted-foreground text-left text-xs uppercase">
                            <tr>
                                <th className={th}>Bill</th>
                                <th className={th}>Date / due</th>
                                <th className={th}>Status</th>
                                <th className={`${th} text-right`}>Total</th>
                                <th className={`${th} text-right`}>Unpaid</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {bills.map((bill) => (
                                <tr key={bill.id}>
                                    <td className={td}>
                                        <div className="font-medium">{bill.document_number}</div>
                                        {bill.vendor_reference && <div className="text-muted-foreground text-xs">{bill.vendor_reference}</div>}
                                    </td>
                                    <td className={`${td} text-muted-foreground`}>
                                        {formatDay(bill.bill_date) || '—'}
                                        <div className="text-xs">due {formatDay(bill.due_date) || '—'}</div>
                                    </td>
                                    <td className={`${td} capitalize`}>{label(bill.status)}</td>
                                    <td className={`${td} text-right tabular-nums`}>{formatMoney(bill.currency_code, bill.total_amount)}</td>
                                    <td className={`${td} text-right font-medium tabular-nums`}>
                                        {Number(bill.amount_residual) > 0 ? formatMoney(bill.currency_code, bill.amount_residual) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>

                <Panel title="Recent purchase orders" empty={orders.length === 0 && 'No purchase orders to this vendor yet.'}>
                    <table className="w-full min-w-[420px] text-sm">
                        <thead className="bg-muted/40 text-muted-foreground text-left text-xs uppercase">
                            <tr>
                                <th className={th}>Order</th>
                                <th className={th}>Delivery</th>
                                <th className={th}>Status</th>
                                <th className={`${th} text-right`}>Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {orders.map((order) => (
                                <tr key={order.id}>
                                    <td className={td}>
                                        <div className="font-medium">{order.document_number}</div>
                                        <div className="text-muted-foreground text-xs">{formatDay(order.created_at)}</div>
                                    </td>
                                    <td className={`${td} text-muted-foreground`}>{formatDay(order.expected_delivery_date) || '—'}</td>
                                    <td className={`${td} capitalize`}>{label(order.status)}</td>
                                    <td className={`${td} text-right tabular-nums`}>{formatMoney(order.currency_code, order.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>
            </div>

            <Panel title="Price list" empty={priceLists.length === 0 && 'No agreed prices. Add them from the Procurement page.'}>
                <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-muted/40 text-muted-foreground text-left text-xs uppercase">
                        <tr>
                            <th className={th}>Product</th>
                            <th className={`${th} text-right`}>From qty</th>
                            <th className={`${th} text-right`}>Price</th>
                            <th className={th}>Valid</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {priceLists.map((price) => (
                            <tr key={price.id}>
                                <td className={td}>
                                    {price.product ? (
                                        <>
                                            <span className="font-medium">{price.product.name}</span>{' '}
                                            <span className="text-muted-foreground text-xs">{price.product.sku}</span>
                                        </>
                                    ) : (
                                        '—'
                                    )}
                                </td>
                                <td className={`${td} text-right tabular-nums`}>{Number(price.min_quantity).toLocaleString()}</td>
                                <td className={`${td} text-right tabular-nums`}>{formatMoney(price.currency_code, price.price)}</td>
                                <td className={`${td} text-muted-foreground`}>
                                    {price.valid_from || price.valid_to
                                        ? `${price.valid_from ? formatDay(price.valid_from) : 'any time'} – ${price.valid_to ? formatDay(price.valid_to) : 'open'}`
                                        : 'Always'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Panel>

            <VendorFormDialog open={editing} onClose={() => setEditing(false)} vendor={vendor} currencies={currencies} />
            {deleteDialog}
        </main>
    );
}
