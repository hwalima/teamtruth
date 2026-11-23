import { ORDER_STATUS_LABELS, QUOTATION_STATUS_LABELS, money, type OrderStatus, type QuotationStatus } from '@/components/erp/sales';
import { StatusBadge, formatDate, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { Link } from '@inertiajs/react';
import { ArrowRight, FileText, Handshake, Package, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { route } from 'ziggy-js';

type Doc<S extends string> = {
    id: number;
    document_number: string;
    status: S;
    currency_code: string;
    total: string;
    created_at: string | null;
    customer: { id: number; name: string } | null;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    stats: {
        leads_open: number;
        opportunities_open: number;
        pipeline_value: string;
        quotations_pending: number;
        quotations_approved: number;
        orders_to_deliver: number;
        orders_pending: number;
    };
    quotations: Doc<QuotationStatus>[];
    orders: Doc<OrderStatus>[];
    canManage: boolean;
};

/** Sales overview: one card per step, from lead to order, then the latest documents. */
export default function SalesIndex({ company, stats, quotations, orders, canManage }: Props) {
    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-muted-foreground text-sm">ERP · {company.name}</p>
                    <h1 className="text-2xl font-semibold">Sales</h1>
                    <p className="text-muted-foreground mt-1 text-sm">From first contact to delivered and invoiced: leads, opportunities, quotations and orders.</p>
                </div>
                {canManage && (
                    <Link href={route('erp.sales.quotations.create')} className={primaryButton}>
                        New quotation
                    </Link>
                )}
            </header>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StepCard
                    icon={<UserPlus className="size-5" />}
                    title="Leads"
                    href={route('erp.sales.leads.index')}
                    value={stats.leads_open}
                    note="new or qualified, not yet an opportunity"
                />
                <StepCard
                    icon={<Handshake className="size-5" />}
                    title="Opportunities"
                    href={route('erp.sales.opportunities.index')}
                    value={stats.opportunities_open}
                    note={`open, worth ${money(company.default_currency, stats.pipeline_value)}`}
                />
                <StepCard
                    icon={<FileText className="size-5" />}
                    title="Quotations"
                    href={route('erp.sales.quotations.index', stats.quotations_approved > 0 ? { status: 'approved' } : {})}
                    value={stats.quotations_approved}
                    note={`approved and ready to order · ${stats.quotations_pending} awaiting approval`}
                />
                <StepCard
                    icon={<Package className="size-5" />}
                    title="Sales orders"
                    href={route('erp.sales.orders.index', stats.orders_to_deliver > 0 ? { status: 'approved' } : {})}
                    value={stats.orders_to_deliver}
                    note={`to deliver or invoice · ${stats.orders_pending} not yet approved`}
                />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                <Recent
                    title="Latest quotations"
                    href={route('erp.sales.quotations.index')}
                    empty="No quotations yet."
                    rows={quotations.map((doc) => ({
                        ...doc,
                        href: route('erp.sales.quotations.show', doc.id),
                        badge: <StatusBadge value={doc.status} label={QUOTATION_STATUS_LABELS[doc.status]} />,
                    }))}
                />
                <Recent
                    title="Latest sales orders"
                    href={route('erp.sales.orders.index')}
                    empty="No sales orders yet. They are made from approved quotations."
                    rows={orders.map((doc) => ({
                        ...doc,
                        href: route('erp.sales.orders.show', doc.id),
                        badge: <StatusBadge value={doc.status} label={ORDER_STATUS_LABELS[doc.status]} />,
                    }))}
                />
            </div>
        </main>
    );
}

function StepCard({ icon, title, href, value, note }: { icon: ReactNode; title: string; href: string; value: number; note: string }) {
    return (
        <Link href={href} className="bg-card/70 hover:border-primary/40 group rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <span className="text-primary">{icon}</span>
                <ArrowRight className="text-muted-foreground size-4 transition group-hover:translate-x-0.5" />
            </div>
            <p className="mt-3 text-sm font-medium">{title}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-muted-foreground mt-1 text-xs">{note}</p>
        </Link>
    );
}

function Recent({
    title,
    href,
    empty,
    rows,
}: {
    title: string;
    href: string;
    empty: string;
    rows: (Doc<string> & { href: string; badge: ReactNode })[];
}) {
    return (
        <section className="bg-card/70 rounded-xl border">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <h2 className="font-semibold">{title}</h2>
                <Link href={href} className={`${secondaryButton} min-h-8 px-3 py-1 text-xs`}>
                    View all
                </Link>
            </div>
            {rows.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">{empty}</p>
            ) : (
                <ul className="divide-y">
                    {rows.map((row) => (
                        <li key={row.id}>
                            <Link href={row.href} className="hover:bg-muted/30 flex items-center justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{row.document_number}</div>
                                    <div className="text-muted-foreground truncate text-xs">
                                        {row.customer?.name ?? '—'} · {formatDate(row.created_at)}
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="text-sm font-medium tabular-nums">{money(row.currency_code, row.total)}</span>
                                    {row.badge}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
