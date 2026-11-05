import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Product = {
    id: number;
    sku: string;
    name: string;
    type: string;
    tracking: string;
    unit: { abbreviation: string };
};
type Location = {
    id: number;
    warehouse_id: number;
    warehouse_code: string;
    warehouse_name: string;
    code: string;
    name: string;
    usage: string;
};
type Balance = {
    product_id: number;
    sku: string;
    product_name: string;
    unit: string;
    location_id: number;
    warehouse: string;
    location: string;
    lot_code: string | null;
    quantity: string;
};
type Movement = {
    id: number;
    document_number: string;
    operation: string;
    reference: string | null;
    moved_at: string;
    creator: { name: string } | null;
    lines: Array<{
        quantity: string;
        lot_code: string | null;
        product: { sku: string; name: string; unit: { abbreviation: string } };
        source_location: { code: string; name: string } | null;
        destination_location: { code: string; name: string } | null;
    }>;
};
type Props = {
    company: { id: number; code: string; name: string };
    products: Product[];
    locations: Location[];
    balances: Balance[];
    movements: Movement[];
};

const operationLabels: Record<string, string> = {
    receipt: 'Receipt',
    issue: 'Store issue',
    transfer: 'Internal transfer',
    adjustment: 'Stock adjustment',
    scrap: 'Scrap',
};

export default function Stock({ company, products, locations, balances, movements }: Props) {
    const form = useForm({
        operation: 'receipt',
        product_id: products.find((product) => product.type !== 'service')?.id.toString() ?? '',
        from_location_id: '',
        to_location_id: '',
        quantity: '',
        lot_code: '',
        reference: '',
    });
    const errors = form.errors as Record<string, string>;
    const selectedProduct = products.find((product) => product.id.toString() === form.data.product_id);
    const sourceUsages = form.data.operation === 'receipt'
        ? ['supplier']
        : form.data.operation === 'adjustment'
            ? ['internal', 'adjustment']
            : ['internal'];
    const destinationUsages = form.data.operation === 'receipt'
        ? ['internal']
        : form.data.operation === 'issue'
            ? ['customer', 'department']
            : form.data.operation === 'transfer'
                ? ['internal']
                : form.data.operation === 'adjustment'
                    ? ['internal', 'adjustment']
                    : ['scrap'];
    const sourceLocations = locations.filter((location) => sourceUsages.includes(location.usage));
    const destinationLocations = locations.filter((location) => destinationUsages.includes(location.usage));
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(route('erp.inventory.stock.movements.store'), {
            onSuccess: () => form.reset('quantity', 'lot_code', 'reference'),
        });
    };

    return (
        <main className="mx-auto max-w-6xl space-y-8 p-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-muted-foreground text-sm">{company.code}</p>
                    <h1 className="text-2xl font-semibold">{company.name} stock</h1>
                    <p className="text-muted-foreground mt-2 text-sm">Posted stock moves are the source of truth; on-hand quantities are calculated from the movement history.</p>
                </div>
                <a href={route('erp.inventory.setup')} className="text-primary text-sm underline">Inventory setup</a>
            </header>

            {products.length === 0 || locations.length === 0 ? (
                <section className="rounded-md border p-4 text-sm">
                    Add at least one product and warehouse location before posting stock movements.
                    {' '}<a href={route('erp.inventory.setup')} className="text-primary underline">Open inventory setup</a>
                </section>
            ) : (
                <section className="space-y-4 rounded-md border p-4">
                    <div>
                        <h2 className="text-lg font-medium">Post a stock movement</h2>
                        <p className="text-muted-foreground text-xs">Receipts add stock; issues, transfers, and scrap require sufficient stock at the source.</p>
                    </div>
                    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <SelectField
                            label="Movement type"
                            value={form.data.operation}
                            options={Object.entries(operationLabels).map(([value, label]) => ({ value, label }))}
                            onChange={(value) => {
                                form.setData('operation', value);
                                form.setData('from_location_id', '');
                                form.setData('to_location_id', '');
                            }}
                            error={errors.operation}
                        />
                        <SelectField
                            label="Product"
                            value={form.data.product_id}
                            options={products.filter((product) => product.type !== 'service').map((product) => ({
                                value: product.id.toString(),
                                label: `${product.sku} — ${product.name} (${product.unit.abbreviation})`,
                            }))}
                            onChange={(value) => form.setData('product_id', value)}
                            error={errors.product_id}
                            required
                        />
                        <SelectField
                            label="From location"
                            value={form.data.from_location_id}
                            options={[{ value: '', label: 'Select source' }, ...sourceLocations.map(locationOption)]}
                            onChange={(value) => form.setData('from_location_id', value)}
                            error={errors.from_location_id}
                            required
                        />
                        <SelectField
                            label="To location"
                            value={form.data.to_location_id}
                            options={[{ value: '', label: 'Select destination' }, ...destinationLocations.map(locationOption)]}
                            onChange={(value) => form.setData('to_location_id', value)}
                            error={errors.to_location_id}
                            required
                        />
                        <TextField
                            label={`Quantity${selectedProduct ? ` (${selectedProduct.unit.abbreviation})` : ''}`}
                            type="number"
                            value={form.data.quantity}
                            onChange={(value) => form.setData('quantity', value)}
                            error={errors.quantity}
                            required
                        />
                        {selectedProduct?.tracking !== 'none' && (
                            <TextField
                                label={selectedProduct?.tracking === 'serial' ? 'Serial number' : 'Lot number'}
                                value={form.data.lot_code}
                                onChange={(value) => form.setData('lot_code', value)}
                                error={errors.lot_code}
                                required
                            />
                        )}
                        <TextField label="Reference (optional)" value={form.data.reference} onChange={(value) => form.setData('reference', value)} error={errors.reference} />
                        <button type="submit" disabled={form.processing || products.every((product) => product.type === 'service')} className="bg-primary text-primary-foreground self-end rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
                            Post movement
                        </button>
                    </form>
                </section>
            )}

            <section className="space-y-3">
                <h2 className="text-lg font-medium">On hand</h2>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                        <thead><tr className="bg-muted/40 border-b"><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Warehouse / location</th><th className="px-3 py-2">Lot / serial</th><th className="px-3 py-2 text-right">Quantity</th></tr></thead>
                        <tbody>
                            {balances.map((balance, index) => (
                                <tr key={`${balance.product_id}-${balance.location_id}-${balance.lot_code ?? 'none'}-${index}`} className="border-b">
                                    <td className="px-3 py-2">{balance.sku}</td>
                                    <td className="px-3 py-2">{balance.product_name}</td>
                                    <td className="px-3 py-2">{balance.warehouse} / {balance.location}</td>
                                    <td className="px-3 py-2">{balance.lot_code ?? '—'}</td>
                                    <td className="px-3 py-2 text-right">{balance.quantity} {balance.unit}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {balances.length === 0 && <p className="text-muted-foreground p-3 text-sm">No stock is currently on hand.</p>}
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-medium">Recent movements</h2>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                        <thead><tr className="bg-muted/40 border-b"><th className="px-3 py-2">Document</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Movement</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Date</th></tr></thead>
                        <tbody>
                            {movements.map((movement) => {
                                const line = movement.lines[0];
                                return (
                                    <tr key={movement.id} className="border-b">
                                        <td className="px-3 py-2 font-medium">{movement.document_number}</td>
                                        <td className="px-3 py-2">{operationLabels[movement.operation] ?? movement.operation}</td>
                                        <td className="px-3 py-2">{line?.product.sku} — {line?.product.name}</td>
                                        <td className="px-3 py-2">
                                            {line?.source_location?.code ?? 'External'} → {line?.destination_location?.code ?? 'External'}
                                            {' '}({line?.quantity} {line?.product.unit.abbreviation})
                                        </td>
                                        <td className="px-3 py-2">{movement.reference ?? '—'}</td>
                                        <td className="px-3 py-2">{new Date(movement.moved_at).toLocaleDateString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {movements.length === 0 && <p className="text-muted-foreground p-3 text-sm">There are no stock movements yet.</p>}
                    {movements.length === 100 && <p className="text-muted-foreground p-3 text-xs">Showing the most recent 100 movements.</p>}
                </div>
            </section>
            <a href={route('erp.dashboard')} className="text-primary inline-block text-sm underline">Back to ERP dashboard</a>
        </main>
    );
}

function locationOption(location: Location) {
    return {
        value: location.id.toString(),
        label: `${location.warehouse_code} / ${location.code} — ${location.name}`,
    };
}

function SelectField({
    label,
    value,
    options,
    onChange,
    error,
    required = false,
}: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    error?: string;
    required?: boolean;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="bg-background rounded-md border px-3 py-2">
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}

function TextField({
    label,
    value,
    onChange,
    error,
    type = 'text',
    required = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    required?: boolean;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <input required={required} type={type} min={type === 'number' ? '0.0001' : undefined} step={type === 'number' ? '0.0001' : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="bg-background rounded-md border px-3 py-2" />
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}
