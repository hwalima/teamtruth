import { OrderActions, type OrderFlags } from '@/components/erp/order-actions';
import { ORDER_STATUS_LABELS, money, type OrderStatus as Status } from '@/components/erp/sales';
import { Empty, Pagination, StatusBadge, formatDate, inputClass, type Paginated } from '@/components/hrm/ui';
import { useLiveSearch } from '@/hooks/use-live-search';
import { Link, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Order = OrderFlags & {
    status: Status;
    currency_code: string;
    total: string;
    expected_delivery_date: string | null;
    created_at: string | null;
    customer: { id: number; name: string; code: string } | null;
    quotation: { id: number; document_number: string } | null;
    customer_reference: string | null;
    has_goods: boolean;
    delivered_percent: number | null;
    invoiced_percent: number;
};
type Props = {
    company: { id: number; code: string; name: string };
    orders: Paginated<Order> & { from: number | null; to: number | null };
    filters: { search: string; status: Status | 'all' };
    counts: Record<Status, number>;
    canManage: boolean;
};

/** A thin labelled bar for delivered / invoiced progress. */
function Progress({ label, percent }: { label: string; percent: number }) {
    return (
        <div className="min-w-24">
            <div className="text-muted-foreground flex justify-between gap-2 text-xs">
                <span>{label}</span>
                <span className="tabular-nums">{percent}%</span>
            </div>
            <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
                <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}

export default function OrdersIndex({ company, orders, filters, counts, canManage }: Props) {
    const [search, setSearch] = useState(filters.search);

    const go = (params: Partial<Props['filters']>) => {
        const next = { ...filters, ...params };
        router.get(
            route('erp.sales.orders.index'),
            { ...(next.search ? { search: next.search } : {}), ...(next.status !== 'all' ? { status: next.status } : {}) },
            { preserveState: true, preserveScroll: true },
        );
    };

    useLiveSearch(search, () => go({ search: search.trim() }));

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        go({ search: search.trim() });
    };

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const tabs: { key: Props['filters']['status']; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: total },
        ...(Object.keys(ORDER_STATUS_LABELS) as Status[]).map((key) => ({ key, label: ORDER_STATUS_LABELS[key], count: counts[key] })),
    ];

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-muted-foreground text-sm">
                        <Link href={route('erp.sales.index')} className="hover:underline">
                            Sales
                        </Link>{' '}
                        · {company.name}
                    </p>
                    <h1 className="text-2xl font-semibold">Sales orders</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Orders from approved quotations: approve, deliver from stock, then invoice what went out.</p>
                </div>
                <Link href={route('erp.sales.quotations.index', { status: 'approved' })} className="text-primary text-sm font-medium hover:underline">
                    Approved quotations ready to order
                </Link>
            </header>

            <section className="flex flex-wrap items-center justify-between gap-3">
                <div className="-mx-4 max-w-[100vw] overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <div className="bg-muted/50 inline-flex rounded-xl p-1 whitespace-nowrap" role="tablist">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                role="tab"
                                aria-selected={filters.status === tab.key}
                                onClick={() => go({ status: tab.key })}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                    filters.status === tab.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.label} <span className="text-muted-foreground tabular-nums">{tab.count}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <form onSubmit={submitSearch} className="flex w-full gap-2 sm:w-auto">
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Order number, customer or their PO"
                        aria-label="Search sales orders"
                        className={`${inputClass} min-w-0 flex-1 sm:w-72`}
                    />
                    <button
                        type="submit"
                        className="border-border/70 hover:bg-primary/10 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border"
                        aria-label="Search"
                        title="Search"
                    >
                        <Search className="size-4" />
                    </button>
                </form>
            </section>

            {orders.data.length === 0 ? (
                <Empty>
                    {filters.search ? `No sales orders match “${filters.search}”.` : 'No sales orders here yet. They are created from approved quotations.'}
                </Empty>
            ) : (
                <section className="bg-card/70 overflow-hidden rounded-xl border">
                    <ul className="divide-y md:hidden">
                        {orders.data.map((order) => (
                            <li key={order.id}>
                                <Link href={route('erp.sales.orders.show', order.id)} className="hover:bg-muted/30 block space-y-2 px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="font-medium break-all">{order.document_number}</span>
                                        <span className="shrink-0 font-medium tabular-nums">{money(order.currency_code, order.total)}</span>
                                    </div>
                                    <div className="text-muted-foreground text-sm">
                                        {order.customer?.name ?? '—'}
                                        {order.customer_reference && ` · PO ${order.customer_reference}`}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <StatusBadge value={order.status} label={ORDER_STATUS_LABELS[order.status]} />
                                        <span className="text-muted-foreground">{formatDate(order.created_at)}</span>
                                    </div>
                                    {order.status !== 'cancelled' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            {order.delivered_percent !== null && <Progress label="Delivered" percent={order.delivered_percent} />}
                                            <Progress label="Invoiced" percent={order.invoiced_percent} />
                                        </div>
                                    )}
                                </Link>
                                <div className="px-4 pb-3">
                                    <OrderActions order={order} canManage={canManage} />
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-muted-foreground text-left text-xs tracking-wide uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Order</th>
                                    <th className="px-4 py-3 font-medium">Customer</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Progress</th>
                                    <th className="px-4 py-3 text-right font-medium">Total</th>
                                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {orders.data.map((order) => (
                                    <tr key={order.id} className="hover:bg-muted/20 align-top">
                                        <td className="px-4 py-3">
                                            <Link href={route('erp.sales.orders.show', order.id)} className="font-medium hover:underline">
                                                {order.document_number}
                                            </Link>
                                            <div className="text-muted-foreground text-xs">
                                                {formatDate(order.created_at)}
                                                {order.quotation && ` · from ${order.quotation.document_number}`}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {order.customer?.name ?? '—'}
                                            {order.customer_reference && <div className="text-muted-foreground text-xs">PO {order.customer_reference}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge value={order.status} label={ORDER_STATUS_LABELS[order.status]} />
                                            {order.expected_delivery_date && order.status !== 'delivered' && order.status !== 'cancelled' && (
                                                <div className="text-muted-foreground mt-1 text-xs">Due {formatDate(order.expected_delivery_date)}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {order.status === 'cancelled' ? (
                                                <span className="text-muted-foreground">—</span>
                                            ) : (
                                                <div className="grid gap-2">
                                                    {order.delivered_percent !== null && <Progress label="Delivered" percent={order.delivered_percent} />}
                                                    <Progress label="Invoiced" percent={order.invoiced_percent} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium tabular-nums">{money(order.currency_code, order.total)}</td>
                                        <td className="px-4 py-3">
                                            <OrderActions order={order} canManage={canManage} showView />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {orders.total > 0 && (
                <p className="text-muted-foreground text-center text-sm">
                    Showing {orders.from}–{orders.to} of {orders.total}
                </p>
            )}
            <Pagination page={orders} />
        </main>
    );
}
