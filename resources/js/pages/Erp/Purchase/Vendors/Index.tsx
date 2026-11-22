import { ActionButton } from '@/components/erp/record-actions';
import { formatAmounts, VendorFormDialog, type VendorFields } from '@/components/erp/vendor-form-dialog';
import { Link, router } from '@inertiajs/react';
import { Eye, Pencil, Plus, Power, RotateCcw, Search, Upload } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Vendor = VendorFields & {
    id: number;
    is_active: boolean;
    orders_count: number;
    owed: Record<string, string>;
};

type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    vendors: {
        data: Vendor[];
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
        total: number;
    };
    filters: { search: string; status: 'active' | 'inactive' | 'all' };
    counts: { active: number; inactive: number };
    currencies: { code: string; name: string }[];
    nextCode: string;
};

const inputClass =
    'border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 rounded-xl border px-3 py-2.5 text-sm shadow-sm transition outline-none focus:ring-4';

export default function VendorsIndex({ company, vendors, filters, counts, currencies, nextCode }: Props) {
    const [search, setSearch] = useState(filters.search);
    const [editing, setEditing] = useState<VendorFields | null>(null);
    const [adding, setAdding] = useState(false);

    const go = (params: Partial<Props['filters']> & { page?: number }) => {
        const next = { search: filters.search, status: filters.status, ...params };
        router.get(
            route('erp.purchase.vendors.index'),
            {
                ...(next.search ? { search: next.search } : {}),
                ...(next.status !== 'active' ? { status: next.status } : {}),
                ...(params.page && params.page > 1 ? { page: params.page } : {}),
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        go({ search: search.trim() });
    };

    const toggle = (vendor: Vendor) => {
        const message = vendor.is_active
            ? `Deactivate ${vendor.name}? It stays in your records but is no longer offered on new orders.`
            : `Reactivate ${vendor.name}?`;
        if (window.confirm(message)) {
            router.post(route('erp.purchase.vendors.toggle', vendor.id), {}, { preserveScroll: true });
        }
    };

    const tabs: { key: Props['filters']['status']; label: string; count?: number }[] = [
        { key: 'active', label: 'Active', count: counts.active },
        { key: 'inactive', label: 'Inactive', count: counts.inactive },
        { key: 'all', label: 'All', count: counts.active + counts.inactive },
    ];

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-muted-foreground text-sm">
                        <Link href={route('erp.purchase.index')} className="hover:underline">
                            Procurement
                        </Link>{' '}
                        · {company.name}
                    </p>
                    <h1 className="text-2xl font-semibold">Vendors</h1>
                    <p className="text-muted-foreground mt-1 text-sm">The suppliers you order from, and what you owe each of them.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href={route('erp.data-import.index')}
                        className="border-border/70 bg-background/40 hover:bg-primary/10 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors"
                    >
                        <Upload className="size-4" /> Import
                    </a>
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
                    >
                        <Plus className="size-4" /> Add vendor
                    </button>
                </div>
            </header>

            <section className="flex flex-wrap items-center justify-between gap-3">
                <div className="bg-muted/50 inline-flex rounded-xl p-1" role="tablist">
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
                <form onSubmit={submitSearch} className="flex w-full gap-2 sm:w-auto">
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Name, code, tax number, email or phone"
                        aria-label="Search vendors"
                        className={`${inputClass} min-w-0 flex-1 sm:w-80`}
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

            <section className="bg-card/70 overflow-hidden rounded-xl border shadow-[0_8px_32px_rgba(0,26,77,0.06)]">
                {vendors.data.length === 0 ? (
                    <div className="text-muted-foreground px-4 py-12 text-center text-sm">
                        {filters.search ? `No vendors match “${filters.search}”.` : 'No vendors here yet.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-muted/40 text-muted-foreground text-left text-xs tracking-wide uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Vendor</th>
                                    <th className="px-4 py-3 font-medium">Contact</th>
                                    <th className="px-4 py-3 font-medium">Terms</th>
                                    <th className="px-4 py-3 text-right font-medium">Orders</th>
                                    <th className="px-4 py-3 text-right font-medium">Owed</th>
                                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {vendors.data.map((vendor) => (
                                    <tr key={vendor.id} className={vendor.is_active ? '' : 'opacity-70'}>
                                        <td className="px-4 py-3">
                                            <Link href={route('erp.purchase.vendors.show', vendor.id)} className="font-medium hover:underline">
                                                {vendor.name}
                                            </Link>
                                            <div className="text-muted-foreground text-xs">
                                                {vendor.code}
                                                {vendor.tax_no && <> · TIN {vendor.tax_no}</>}
                                                {!vendor.is_active && <span className="bg-muted ml-2 rounded px-1.5 py-0.5">Inactive</span>}
                                            </div>
                                        </td>
                                        <td className="text-muted-foreground px-4 py-3">
                                            <div className="max-w-[16rem] truncate">{vendor.email ?? '—'}</div>
                                            {vendor.phone && <div className="text-xs">{vendor.phone}</div>}
                                        </td>
                                        <td className="text-muted-foreground px-4 py-3">
                                            {vendor.payment_terms_days} days{vendor.currency_code && <> · {vendor.currency_code}</>}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">{vendor.orders_count}</td>
                                        <td className="px-4 py-3 text-right font-medium tabular-nums">{formatAmounts(vendor.owed)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1.5">
                                                <ActionButton
                                                    icon={Eye}
                                                    label="View"
                                                    tone="view"
                                                    href={route('erp.purchase.vendors.show', vendor.id)}
                                                />
                                                <ActionButton icon={Pencil} label="Edit" tone="edit" onClick={() => setEditing(vendor)} />
                                                <ActionButton
                                                    icon={vendor.is_active ? Power : RotateCcw}
                                                    label={vendor.is_active ? 'Deactivate' : 'Reactivate'}
                                                    tone={vendor.is_active ? 'delete' : 'neutral'}
                                                    onClick={() => toggle(vendor)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {vendors.last_page > 1 && (
                <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
                    <span className="text-muted-foreground">
                        {vendors.from}–{vendors.to} of {vendors.total}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={vendors.current_page <= 1}
                            onClick={() => go({ page: vendors.current_page - 1 })}
                            className="hover:bg-primary/10 inline-flex min-h-9 items-center rounded-xl border px-3 font-medium disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span className="text-muted-foreground">
                            Page {vendors.current_page} of {vendors.last_page}
                        </span>
                        <button
                            type="button"
                            disabled={vendors.current_page >= vendors.last_page}
                            onClick={() => go({ page: vendors.current_page + 1 })}
                            className="hover:bg-primary/10 inline-flex min-h-9 items-center rounded-xl border px-3 font-medium disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </nav>
            )}

            <VendorFormDialog
                open={adding || editing !== null}
                onClose={() => {
                    setAdding(false);
                    setEditing(null);
                }}
                vendor={editing}
                nextCode={nextCode}
                currencies={currencies}
                defaultCurrency={company.default_currency}
            />
        </main>
    );
}
