import { useLiveSearch } from '@/hooks/use-live-search';
import { router } from '@inertiajs/react';
import { FileDown, FileSpreadsheet, Package, Plus, Search, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';
import { RecordActions, useConfirmDelete } from '@/components/erp/record-actions';
import { Card, Empty, Page, Pagination, inputClass, primaryButton, secondaryButton, type Options, type Paginated } from '@/components/hrm/ui';

export type ProductItem = {
    id: number;
    sku: string;
    barcode: string | null;
    name: string;
    internal_reference: string | null;
    type: string;
    type_label: string;
    is_active: boolean;
    sale_price: string | null;
    cost_price: string | null;
    category: { id: number; name: string } | null;
    unit: { id: number; name: string; abbreviation: string } | null;
    image_url: string | null;
    on_hand?: string;
};

type Filters = { search: string; category_id: number | null; type: string; status: string };

type Props = {
    company: { code: string; name: string };
    products: Paginated<ProductItem>;
    filters: Filters;
    categories: { value: number; label: string }[];
    types: Options;
    counts: { all: number; active: number };
    canManage: boolean;
};

export function money(value: string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function quantity(value: string | null | undefined): string {
    return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function ProductThumb({ product, size = 'size-10' }: { product: Pick<ProductItem, 'name' | 'image_url'>; size?: string }) {
    return product.image_url ? (
        <img src={product.image_url} alt="" className={`${size} shrink-0 rounded-lg object-cover ring-1 ring-black/5`} />
    ) : (
        <div className={`${size} bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-lg text-sm font-semibold`}>
            {product.name.slice(0, 1).toUpperCase()}
        </div>
    );
}

export function ActiveBadge({ active }: { active: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
            }`}
        >
            <span className={`size-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {active ? 'Active' : 'Inactive'}
        </span>
    );
}

export default function ProductsIndex({ company, products, filters, categories, types, counts, canManage }: Props) {
    const [form, setForm] = useState({
        search: filters.search,
        category_id: filters.category_id ? String(filters.category_id) : '',
        type: filters.type,
        status: filters.status,
    });
    const { askDelete, deleteDialog } = useConfirmDelete();
    const params = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
    const filtered = Object.keys(params).length > 0;

    useLiveSearch(form.search, () => apply());
    const apply = (event?: FormEvent, next = form) => {
        event?.preventDefault();
        router.get(route('erp.inventory.products.index'), Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '')), { preserveState: true, preserveScroll: true });
    };
    const set = (key: keyof typeof form, value: string) => {
        const next = { ...form, [key]: value };
        setForm(next);
        if (key !== 'search') apply(undefined, next);
    };

    return (
        <Page
            title="Products"
            subtitle={`${counts.all.toLocaleString()} products in ${company.name} · ${counts.active.toLocaleString()} active`}
            actions={
                <>
                    <a href={route('erp.inventory.products.pdf', params)} target="_blank" rel="noreferrer" className={secondaryButton}>
                        <FileDown className="mr-2 size-4" /> PDF
                    </a>
                    <a href={route('erp.inventory.products.export')} className={secondaryButton}>
                        <FileSpreadsheet className="mr-2 size-4" /> Excel
                    </a>
                    {canManage && (
                        <a href={route('erp.inventory.products.create')} className={primaryButton}>
                            <Plus className="mr-2 size-4" /> New product
                        </a>
                    )}
                </>
            }
        >
            <Card>
                <form onSubmit={apply} className="grid gap-3 md:grid-cols-[2fr_1.4fr_1fr_1fr_auto]">
                    <div className="relative">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <input
                            value={form.search}
                            onChange={(e) => setForm({ ...form, search: e.target.value })}
                            placeholder="Search name, SKU, reference or barcode"
                            className={`${inputClass} pl-9`}
                        />
                    </div>
                    <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className={inputClass} aria-label="Category">
                        <option value="">All categories</option>
                        {categories.map((c) => (
                            <option key={c.value} value={c.value}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                    <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputClass} aria-label="Type">
                        <option value="">All types</option>
                        {Object.entries(types).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass} aria-label="Status">
                        <option value="">Active and inactive</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <div className="flex gap-2">
                        <button type="submit" className={primaryButton}>
                            Search
                        </button>
                        {filtered && (
                            <button
                                type="button"
                                className={secondaryButton}
                                title="Clear filters"
                                onClick={() => {
                                    const cleared = { search: '', category_id: '', type: '', status: '' };
                                    setForm(cleared);
                                    apply(undefined, cleared);
                                }}
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>
                </form>
            </Card>

            <Card>
                {products.data.length === 0 ? (
                    <Empty>
                        <Package className="mx-auto mb-2 size-8 opacity-50" />
                        {filtered ? 'No products match these filters.' : 'No products yet. Add one, or bring them across from Odoo under Data Import.'}
                    </Empty>
                ) : (
                    <div className="-mx-4 overflow-x-auto sm:-mx-6">
                        <table className="w-full min-w-[860px] text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs font-medium tracking-wide uppercase">
                                    <th className="px-4 py-3 sm:px-6">Product</th>
                                    <th className="px-3 py-3">Category</th>
                                    <th className="px-3 py-3">Type</th>
                                    <th className="px-3 py-3 text-right">On hand</th>
                                    <th className="px-3 py-3 text-right">Sales price</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-4 py-3 text-right sm:px-6">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {products.data.map((product) => (
                                    <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 sm:px-6">
                                            <a href={route('erp.inventory.products.show', product.id)} className="group flex items-center gap-3">
                                                <ProductThumb product={product} />
                                                <div className="min-w-0">
                                                    <div className="group-hover:text-primary truncate font-medium">{product.name}</div>
                                                    <div className="text-muted-foreground truncate text-xs">
                                                        {product.sku}
                                                        {product.internal_reference && ` · ${product.internal_reference}`}
                                                    </div>
                                                </div>
                                            </a>
                                        </td>
                                        <td className="text-muted-foreground px-3 py-3">{product.category?.name ?? '—'}</td>
                                        <td className="px-3 py-3">{product.type_label}</td>
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            {product.type === 'service' ? (
                                                <span className="text-muted-foreground">—</span>
                                            ) : (
                                                <>
                                                    <span className={Number(product.on_hand) > 0 ? 'font-medium' : 'text-muted-foreground'}>{quantity(product.on_hand)}</span>{' '}
                                                    <span className="text-muted-foreground text-xs">{product.unit?.abbreviation}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums">{money(product.sale_price)}</td>
                                        <td className="px-3 py-3">
                                            <ActiveBadge active={product.is_active} />
                                        </td>
                                        <td className="px-4 py-3 sm:px-6">
                                            <RecordActions
                                                viewHref={route('erp.inventory.products.show', product.id)}
                                                editHref={canManage ? route('erp.inventory.products.edit', product.id) : undefined}
                                                onDelete={
                                                    canManage
                                                        ? () =>
                                                              askDelete({
                                                                  url: route('erp.inventory.products.destroy', product.id),
                                                                  title: `Delete ${product.name}?`,
                                                                  description:
                                                                      'The product and its vendor prices are removed. A product with stock movements, orders or invoices cannot be deleted; mark it inactive instead.',
                                                              })
                                                        : undefined
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">
                        {products.total.toLocaleString()} {filtered ? 'matching ' : ''}products
                    </span>
                    <Pagination page={products} />
                </div>
            </Card>
            {deleteDialog}
        </Page>
    );
}
