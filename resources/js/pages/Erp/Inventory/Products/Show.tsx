import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { route } from 'ziggy-js';
import { ActionButton, useConfirmDelete } from '@/components/erp/record-actions';
import { Card, Detail, Empty, Page, formatDate, humanize, secondaryButton } from '@/components/hrm/ui';
import { ActiveBadge, money, ProductThumb, quantity, type ProductItem } from './Index';

type Props = {
    product: ProductItem & {
        description: string | null;
        costing_method: string;
        tracking: string;
        metadata: Record<string, unknown>;
        created_at: string | null;
        updated_at: string | null;
    };
    stock: { location: string; lot_code: string | null; quantity: string | number }[];
    movements: {
        id: number;
        document_number: string | null;
        operation: string | null;
        reference: string | null;
        moved_at: string | null;
        from: string | null;
        to: string | null;
        quantity: string;
        lot_code: string | null;
    }[];
    vendorPrices: { id: number; vendor: string | null; min_quantity: string; price: string; currency_code: string | null; valid_from: string | null }[];
    canManage: boolean;
};

function display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

export default function ProductShow({ product, stock, movements, vendorPrices, canManage }: Props) {
    const { askDelete, deleteDialog } = useConfirmDelete();
    const total = stock.reduce((sum, line) => sum + Number(line.quantity), 0);
    const unit = product.unit?.abbreviation ?? '';
    const odoo = product.metadata?.odoo && typeof product.metadata.odoo === 'object' ? (product.metadata.odoo as Record<string, unknown>) : null;
    const margin =
        product.sale_price && product.cost_price && Number(product.sale_price) > 0
            ? Math.round(((Number(product.sale_price) - Number(product.cost_price)) / Number(product.sale_price)) * 100)
            : null;

    return (
        <Page
            title={product.name}
            subtitle={
                <span className="inline-flex flex-wrap items-center gap-2">
                    <span>{product.sku}</span>
                    <span>·</span>
                    <span>{product.type_label}</span>
                    <ActiveBadge active={product.is_active} />
                </span>
            }
            actions={
                <>
                    <a href={route('erp.inventory.products.index')} className={secondaryButton}>
                        <ArrowLeft className="mr-2 size-4" /> All products
                    </a>
                    {canManage && <ActionButton icon={Pencil} label="Edit" tone="edit" href={route('erp.inventory.products.edit', product.id)} showLabel />}
                    {canManage && (
                        <ActionButton
                            icon={Trash2}
                            label="Delete"
                            tone="delete"
                            showLabel
                            onClick={() =>
                                askDelete({
                                    url: route('erp.inventory.products.destroy', product.id),
                                    title: `Delete ${product.name}?`,
                                    description:
                                        'The product and its vendor prices are removed. If it has stock movements, orders or invoices it cannot be deleted; mark it inactive instead.',
                                })
                            }
                        />
                    )}
                </>
            }
        >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_2fr]">
                <Card>
                    <div className="flex flex-col items-center gap-4 text-center">
                        {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="max-h-64 w-full rounded-xl object-contain" />
                        ) : (
                            <ProductThumb product={product} size="size-32 text-5xl" />
                        )}
                        <div className="grid w-full grid-cols-3 gap-2">
                            <Stat label="On hand" value={product.type === 'service' ? '—' : `${quantity(String(total))} ${unit}`} />
                            <Stat label="Sales price" value={money(product.sale_price)} />
                            <Stat label="Margin" value={margin === null ? '—' : `${margin}%`} />
                        </div>
                    </div>
                </Card>

                <Card title="Details">
                    <dl className="grid gap-4 sm:grid-cols-3">
                        <Detail label="SKU" value={product.sku} />
                        <Detail label="Internal reference" value={product.internal_reference} />
                        <Detail label="Barcode" value={product.barcode} />
                        <Detail label="Category" value={product.category?.name} />
                        <Detail label="Unit" value={product.unit ? `${product.unit.name} (${product.unit.abbreviation})` : null} />
                        <Detail label="Type" value={product.type_label} />
                        <Detail label="Cost price" value={money(product.cost_price)} />
                        <Detail label="Costing method" value={product.costing_method === 'fifo' ? 'FIFO' : humanize(product.costing_method)} />
                        <Detail label="Tracking" value={product.tracking === 'none' ? 'No tracking' : `By ${product.tracking}`} />
                        <Detail label="Created" value={formatDate(product.created_at)} />
                        <Detail label="Last changed" value={formatDate(product.updated_at)} />
                    </dl>
                    {product.description && <p className="text-muted-foreground mt-5 border-t pt-4 text-sm whitespace-pre-line">{product.description}</p>}
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Stock by location">
                    {stock.length === 0 ? (
                        <Empty>No stock held.</Empty>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                                    <th className="py-2">Location</th>
                                    <th className="py-2">Lot</th>
                                    <th className="py-2 text-right">Quantity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stock.map((line) => (
                                    <tr key={`${line.location}-${line.lot_code}`}>
                                        <td className="py-2">{line.location}</td>
                                        <td className="text-muted-foreground py-2">{line.lot_code ?? '—'}</td>
                                        <td className="py-2 text-right tabular-nums">
                                            {quantity(String(line.quantity))} {unit}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>

                <Card title="Vendor prices">
                    {vendorPrices.length === 0 ? (
                        <Empty>No vendor prices.</Empty>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                                    <th className="py-2">Vendor</th>
                                    <th className="py-2 text-right">From qty</th>
                                    <th className="py-2 text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {vendorPrices.map((price) => (
                                    <tr key={price.id}>
                                        <td className="py-2">{price.vendor ?? '—'}</td>
                                        <td className="py-2 text-right tabular-nums">{quantity(price.min_quantity)}</td>
                                        <td className="py-2 text-right tabular-nums">
                                            {price.currency_code} {money(price.price)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            </div>

            <Card title="Recent movements">
                {movements.length === 0 ? (
                    <Empty>No movements yet.</Empty>
                ) : (
                    <div className="-mx-4 overflow-x-auto sm:-mx-6">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                                    <th className="px-4 py-2 sm:px-6">Date</th>
                                    <th className="px-3 py-2">Document</th>
                                    <th className="px-3 py-2">Operation</th>
                                    <th className="px-3 py-2">From → To</th>
                                    <th className="px-4 py-2 text-right sm:px-6">Quantity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {movements.map((line) => (
                                    <tr key={line.id}>
                                        <td className="px-4 py-2 sm:px-6">{formatDate(line.moved_at)}</td>
                                        <td className="px-3 py-2">
                                            <div>{line.document_number ?? '—'}</div>
                                            {line.reference && <div className="text-muted-foreground text-xs">{line.reference}</div>}
                                        </td>
                                        <td className="px-3 py-2">{humanize(line.operation)}</td>
                                        <td className="text-muted-foreground px-3 py-2">
                                            {line.from ?? '—'} → {line.to ?? '—'}
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums sm:px-6">
                                            {quantity(line.quantity)} {unit}
                                            {line.lot_code && <div className="text-muted-foreground text-xs">Lot {line.lot_code}</div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {odoo && Object.keys(odoo).length > 0 && (
                <Card title="Brought across from Odoo">
                    <dl className="grid gap-4 sm:grid-cols-3">
                        {Object.entries(odoo).map(([key, value]) => (
                            <Detail key={key} label={key} value={display(value)} />
                        ))}
                    </dl>
                </Card>
            )}
            {deleteDialog}
        </Page>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-muted/40 rounded-xl px-2 py-3">
            <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
        </div>
    );
}
