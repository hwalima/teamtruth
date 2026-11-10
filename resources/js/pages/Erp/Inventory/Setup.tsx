import { useForm, useState } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { route } from 'ziggy-js';

type Unit = { id: number; name: string; abbreviation: string; category: string; factor_to_base: string; is_base: boolean };
type Category = { id: number; name: string; description: string | null };
type Product = {
    id: number;
    sku: string;
    barcode: string | null;
    name: string;
    type: string;
    costing_method: string;
    tracking: string;
    category: { id: number; name: string } | null;
    unit: { id: number; name: string; abbreviation: string };
};
type Location = { id: number; code: string; name: string; usage: string; parent_id: number | null };
type Warehouse = { id: number; code: string; name: string; address: string | null; locations: Location[] };
type Props = {
    company: { id: number; code: string; name: string };
    units: Unit[];
    categories: Category[];
    products: Product[];
    warehouses: Warehouse[];
};

const unitCategories = ['quantity', 'weight', 'length', 'volume', 'time', 'other'];
const productTypes = ['storable', 'consumable', 'service'];
const trackingOptions = ['none', 'lot', 'serial'];
const locationUsages = ['internal', 'supplier', 'customer', 'department', 'production', 'scrap', 'adjustment'];

const odooHeaders = [
    'Currency',
    'Activity State',
    'Product Category',
    'Favorite',
    'Name',
    'Internal Reference',
    '# Product Variants',
    'Sales Price',
    'Quantity On Hand',
    'Unit',
    'Image 128',
    'Last Updated on',
    'Show On Hand Qty Status Button',
    'Type',
    'Costing Method',
    'Tracking',
    'Barcode',
    'Description',
];

export default function Setup({ company, units, categories, products, warehouses }: Props) {
    const categoryForm = useForm({ name: '', description: '' });
    const unitForm = useForm({ name: '', abbreviation: '', category: 'quantity', factor_to_base: '1', is_base: true });
    const productForm = useForm({
        sku: '',
        barcode: '',
        name: '',
        description: '',
        category_id: '',
        unit_id: units[0]?.id.toString() ?? '',
        type: 'storable',
        costing_method: 'average',
        tracking: 'none',
    });
    const importForm = useForm({
        file: null as File | null,
        mapping: {} as Record<string, number>,
        update_existing: false,
        skip_errors: false,
    });
    const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][]; total_rows: number } | null>(null);
    const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'confirm'>('upload');
    const [importResults, setImportResults] = useState<{ imported: number; updated: number; skipped: number; errors: string[] } | null>(null);
    const warehouseForm = useForm({ code: '', name: '', address: '' });
    const locationForm = useForm({
        warehouse_id: warehouses[0]?.id.toString() ?? '',
        parent_id: '',
        code: '',
        name: '',
        usage: 'internal',
    });

    const post = (event: FormEvent<HTMLFormElement>, submit: () => void) => {
        event.preventDefault();
        submit();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        importForm.setData('file', file);
        importForm.post(route('erp.inventory.products.import.preview'), {
            onSuccess: (data) => {
                setPreviewData(data.props as { headers: string[]; rows: string[][]; total_rows: number });
                setImportStep('mapping');
                // Auto-map common columns
                const headers = data.props.headers;
                const autoMapping: Record<string, number> = {};
                headers.forEach((header, index) => {
                    const h = header.toLowerCase();
                    if (h.includes('internal reference') || h === 'sku') autoMapping.sku = index;
                    else if (h === 'name') autoMapping.name = index;
                    else if (h.includes('category')) autoMapping.category = index;
                    else if (h === 'unit') autoMapping.unit = index;
                    else if (h === 'type') autoMapping.type = index;
                    else if (h.includes('costing')) autoMapping.costing_method = index;
                    else if (h === 'tracking') autoMapping.tracking = index;
                    else if (h === 'barcode') autoMapping.barcode = index;
                    else if (h === 'description') autoMapping.description = index;
                });
                importForm.setData('mapping', autoMapping);
            },
            onError: (errors) => {
                alert(errors.file || 'Failed to read file');
            },
        });
    };

    const handleImport = () => {
        importForm.post(route('erp.inventory.products.import'), {
            onSuccess: (data) => {
                setImportResults(data.props.results);
                setImportStep('confirm');
                // Refresh page to show new products
                window.location.reload();
            },
            onError: (errors) => {
                alert(Object.values(errors).flat().join('\n'));
            },
        });
    };

    const downloadTemplate = () => {
        window.open(route('erp.inventory.products.template'), '_blank');
    };

    const exportProducts = () => {
        window.open(route('erp.inventory.products.export'), '_blank');
    };

    return (
        <main className="mx-auto max-w-6xl space-y-8 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{company.code}</p>
                <h1 className="text-2xl font-semibold">{company.name} inventory setup</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Set up this company's catalog, units, warehouses, and stock locations before recording stock movements.
                </p>
            </header>

            <Panel title="Product Import / Export (Odoo format)">
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={downloadTemplate} className="bg-secondary text-secondary-foreground rounded-md px-4 py-2 text-sm font-medium">
                            Download Template (Odoo format)
                        </button>
                        <button type="button" onClick={exportProducts} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">
                            Export Products
                        </button>
                    </div>

                    {importStep === 'upload' && (
                        <div className="rounded border p-4 space-y-3">
                            <h4 className="font-medium">Import Products from Excel/CSV</h4>
                            <p className="text-muted-foreground text-sm">
                                Upload an Odoo-format product.template export file. The template uses these columns:
                            </p>
                            <div className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                                {odooHeaders.join(' | ')}
                            </div>
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileUpload}
                                className="bg-background rounded-md border px-3 py-2"
                            />
                            <p className="text-muted-foreground text-xs">Max file size: 10MB</p>
                        </div>
                    )}

                    {importStep === 'mapping' && previewData && (
                        <div className="rounded border p-4 space-y-4">
                            <h4 className="font-medium">Map Columns</h4>
                            <p className="text-muted-foreground text-sm">
                                File has {previewData.total_rows} rows. Map each required field to a column from your file.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {[
                                    { key: 'sku', label: 'SKU / Internal Reference *', required: true },
                                    { key: 'name', label: 'Name *', required: true },
                                    { key: 'category', label: 'Product Category', required: false },
                                    { key: 'unit', label: 'Unit *', required: true },
                                    { key: 'type', label: 'Type (storable/consumable/service)', required: false },
                                    { key: 'costing_method', label: 'Costing Method (average/fifo)', required: false },
                                    { key: 'tracking', label: 'Tracking (none/lot/serial)', required: false },
                                    { key: 'barcode', label: 'Barcode', required: false },
                                    { key: 'description', label: 'Description', required: false },
                                ].map(({ key, label, required }) => (
                                    <label key={key} className="grid gap-1 text-sm">
                                        <span>{label} {required && <span className="text-destructive">*</span>}</span>
                                        <select
                                            value={importForm.data.mapping[key] ?? ''}
                                            onChange={(e) => importForm.setData('mapping', { ...importForm.data.mapping, [key]: parseInt(e.target.value) })}
                                            className="bg-background rounded-md border px-3 py-2"
                                        >
                                            <option value="">— Select column —</option>
                                            {previewData.headers.map((header, index) => (
                                                <option key={index} value={index}>{header}</option>
                                            ))}
                                        </select>
                                        {importForm.errors.mapping?.[key] && <ErrorText>{importForm.errors.mapping[key]}</ErrorText>}
                                    </label>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={importForm.data.update_existing}
                                        onChange={(e) => importForm.setData('update_existing', e.target.checked)}
                                    />
                                    Update existing products (match by SKU)
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={importForm.data.skip_errors}
                                        onChange={(e) => importForm.setData('skip_errors', e.target.checked)}
                                    />
                                    Skip rows with errors (continue importing)
                                </label>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setImportStep('upload'); setPreviewData(null); }}
                                    className="text-primary text-sm underline"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={handleImport}
                                    disabled={importForm.processing}
                                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                                >
                                    {importForm.processing ? 'Importing...' : 'Import Products'}
                                </button>
                            </div>
                        </div>
                    )}

                    {importStep === 'confirm' && importResults && (
                        <div className="rounded border p-4 space-y-3 bg-green-50 border-green-200">
                            <h4 className="font-medium text-green-800">Import Complete</h4>
                            <ul className="text-sm space-y-1">
                                <li>Imported: <strong>{importResults.imported}</strong></li>
                                <li>Updated: <strong>{importResults.updated}</strong></li>
                                <li>Skipped: <strong>{importResults.skipped}</strong></li>
                                {importResults.errors.length > 0 && (
                                    <li className="text-destructive">Errors: <strong>{importResults.errors.length}</strong></li>
                                )}
                            </ul>
                            {importResults.errors.length > 0 && (
                                <details className="text-xs">
                                    <summary className="cursor-pointer text-destructive">Show errors</summary>
                                    <ul className="mt-2 space-y-1">
                                        {importResults.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                            <button
                                type="button"
                                onClick={() => { setImportStep('upload'); setPreviewData(null); setImportResults(null); importForm.reset(); }}
                                className="text-primary text-sm underline"
                            >
                                Import another file
                            </button>
                        </div>
                    )}
                </div>
            </Panel>

            <section className="grid gap-6 lg:grid-cols-2">
                <Panel title="Units of measure">
                    <form onSubmit={(event) => post(event, () => unitForm.post(route('erp.inventory.units.store')))} className="grid gap-3 sm:grid-cols-2">
                        <TextField label="Name" value={unitForm.data.name} onChange={(value) => unitForm.setData('name', value)} error={unitForm.errors.name} required />
                        <TextField label="Abbreviation" value={unitForm.data.abbreviation} onChange={(value) => unitForm.setData('abbreviation', value)} error={unitForm.errors.abbreviation} required />
                        <SelectField label="Category" value={unitForm.data.category} options={unitCategories} onChange={(value) => unitForm.setData('category', value)} />
                        <TextField
                            label="Conversion factor to base"
                            type="number"
                            value={unitForm.data.factor_to_base}
                            onChange={(value) => unitForm.setData('factor_to_base', value)}
                            error={unitForm.errors.factor_to_base}
                            required
                        />
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                            <input type="checkbox" checked={unitForm.data.is_base} onChange={(event) => unitForm.setData('is_base', event.target.checked)} />
                            This is the base unit for its category
                        </label>
                        {unitForm.errors.is_base && <ErrorText>{unitForm.errors.is_base}</ErrorText>}
                        <SubmitButton processing={unitForm.processing}>Add unit</SubmitButton>
                    </form>
                    <ul className="mt-4 divide-y">
                        {units.map((unit) => (
                            <li key={unit.id} className="py-2 text-sm">
                                <strong>{unit.name}</strong> ({unit.abbreviation}) · {unit.category}
                                {unit.is_base ? ' · base' : ' · ×'}
                            </li>
                        ))}
                        {units.length === 0 && <Empty>No units have been set up.</Empty>}
                    </ul>
                </Panel>

                <Panel title="Product categories">
                    <form onSubmit={(event) => post(event, () => categoryForm.post(route('erp.inventory.categories.store')))} className="grid gap-3">
                        <TextField label="Category name" value={categoryForm.data.name} onChange={(value) => categoryForm.setData('name', value)} error={categoryForm.errors.name} required />
                        <TextField label="Description" value={categoryForm.data.description} onChange={(value) => categoryForm.setData('description', value)} error={categoryForm.errors.description} />
                        <SubmitButton processing={categoryForm.processing}>Add category</SubmitButton>
                    </form>
                    <ul className="mt-4 divide-y">
                        {categories.map((category) => <li key={category.id} className="py-2 text-sm">{category.name}</li>)}
                        {categories.length === 0 && <Empty>No categories have been set up.</Empty>}
                    </ul>
                </Panel>
            </section>

            <Panel title="Product catalog">
                {units.length === 0 ? (
                    <Empty>Add at least one unit of measure before creating products.</Empty>
                ) : (
                    <form onSubmit={(event) => post(event, () => productForm.post(route('erp.inventory.products.store')))} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <TextField label="SKU" value={productForm.data.sku} onChange={(value) => productForm.setData('sku', value)} error={productForm.errors.sku} required />
                        <TextField label="Product name" value={productForm.data.name} onChange={(value) => productForm.setData('name', value)} error={productForm.errors.name} required />
                        <TextField label="Barcode (optional)" value={productForm.data.barcode} onChange={(value) => productForm.setData('barcode', value)} error={productForm.errors.barcode} />
                        <SelectField
                            label="Unit of measure"
                            value={productForm.data.unit_id}
                            options={units.map((unit) => ({ value: unit.id.toString(), label: ${unit.name} () }))}
                            onChange={(value) => productForm.setData('unit_id', value)}
                            error={productForm.errors.unit_id}
                        />
                        <SelectField
                            label="Category"
                            value={productForm.data.category_id}
                            options={[{ value: '', label: 'No category' }, ...categories.map((category) => ({ value: category.id.toString(), label: category.name }))]}
                            onChange={(value) => productForm.setData('category_id', value)}
                            error={productForm.errors.category_id}
                        />
                        <SelectField label="Product type" value={productForm.data.type} options={productTypes} onChange={(value) => productForm.setData('type', value)} />
                        <SelectField
                            label="Costing method"
                            value={productForm.data.costing_method}
                            options={['average', 'fifo']}
                            onChange={(value) => productForm.setData('costing_method', value)}
                        />
                        <SelectField
                            label="Tracking"
                            value={productForm.data.tracking}
                            options={trackingOptions}
                            onChange={(value) => productForm.setData('tracking', value)}
                            error={productForm.errors.tracking}
                        />
                        <TextField label="Description (optional)" value={productForm.data.description} onChange={(value) => productForm.setData('description', value)} error={productForm.errors.description} />
                        <SubmitButton processing={productForm.processing}>Add product</SubmitButton>
                    </form>
                )}
                <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead><tr className="border-b text-muted-foreground"><th className="py-2 pr-3">SKU</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Category</th><th className="py-2">Unit</th></tr></thead>
                        <tbody>
                            {products.map((product) => (
                                <tr key={product.id} className="border-b">
                                    <td className="py-2 pr-3 font-medium">{product.sku}</td>
                                    <td className="py-2 pr-3">{product.name}</td>
                                    <td className="py-2 pr-3 capitalize">{product.type}</td>
                                    <td className="py-2 pr-3">{product.category?.name ?? '—'}</td>
                                    <td className="py-2">{product.unit.abbreviation}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {products.length === 0 && <Empty>No products have been added yet.</Empty>}
                    {products.length === 300 && <p className="text-muted-foreground mt-2 text-xs">Showing the first 300 products.</p>}
                </div>
            </Panel>

            <section className="grid gap-6 lg:grid-cols-2">
                <Panel title="Warehouses">
                    <form onSubmit={(event) => post(event, () => warehouseForm.post(route('erp.inventory.warehouses.store')))} className="grid gap-3">
                        <TextField label="Code" value={warehouseForm.data.code} onChange={(value) => warehouseForm.setData('code', value)} error={warehouseForm.errors.code} required />
                        <TextField label="Name" value={warehouseForm.data.name} onChange={(value) => warehouseForm.setData('name', value)} error={warehouseForm.errors.name} required />
                        <TextField label="Address (optional)" value={warehouseForm.data.address} onChange={(value) => warehouseForm.setData('address', value)} error={warehouseForm.errors.address} />
                        <p className="text-muted-foreground text-xs">A new warehouse automatically gets an internal STOCK location.</p>
                        <SubmitButton processing={warehouseForm.processing}>Add warehouse</SubmitButton>
                    </form>
                    <ul className="mt-4 space-y-3">
                        {warehouses.map((warehouse) => (
                            <li key={warehouse.id} className="rounded border p-3 text-sm">
                                <strong>{warehouse.code} — {warehouse.name}</strong>
                                {warehouse.address && <p className="text-muted-foreground mt-1">{warehouse.address}</p>}
                                <ul className="mt-2 space-y-1 pl-3">
                                    {warehouse.locations.map((location) => (
                                        <li key={location.id} className="text-muted-foreground">
                                            {location.code} — {location.name} <span className="capitalize">({location.usage})</span>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                        {warehouses.length === 0 && <Empty>No warehouses have been created.</Empty>}
                    </ul>
                </Panel>

                <Panel title="Add a stock location">
                    {warehouses.length === 0 ? (
                        <Empty>Create a warehouse before adding locations.</Empty>
                    ) : (
                        <form onSubmit={(event) => post(event, () => locationForm.post(route('erp.inventory.locations.store')))} className="grid gap-3">
                            <SelectField
                                label="Warehouse"
                                value={locationForm.data.warehouse_id}
                                options={warehouses.map((warehouse) => ({ value: warehouse.id.toString(), label: ${warehouse.code} —  }))}
                                onChange={(value) => {
                                    locationForm.setData('warehouse_id', value);
                                    locationForm.setData('parent_id', '');
                                }}
                                error={locationForm.errors.warehouse_id}
                            />
                            <SelectField
                                label="Parent location (optional)"
                                value={locationForm.data.parent_id}
                                options={[
                                    { value: '', label: 'Top level' },
                                    ...(warehouses.find((warehouse) => warehouse.id.toString() === locationForm.data.warehouse_id)?.locations ?? [])
                                        .filter((location) => location.usage === 'internal')
                                        .map((location) => ({ value: location.id.toString(), label: ${location.code} —  })),
                                ]}
                                onChange={(value) => locationForm.setData('parent_id', value)}
                                error={locationForm.errors.parent_id}
                            />
                            <TextField label="Code" value={locationForm.data.code} onChange={(value) => locationForm.setData('code', value)} error={locationForm.errors.code} required />
                            <TextField label="Name" value={locationForm.data.name} onChange={(value) => locationForm.setData('name', value)} error={locationForm.errors.name} required />
                            <SelectField label="Location usage" value={locationForm.data.usage} options={locationUsages} onChange={(value) => locationForm.setData('usage', value)} error={locationForm.errors.usage} />
                            <SubmitButton processing={locationForm.processing}>Add location</SubmitButton>
                        </form>
                    )}
                </Panel>
            </section>

            <div className="flex flex-wrap gap-4">
                <a href={route('erp.inventory.stock.index')} className="text-primary text-sm underline">Stock on hand and movements</a>
                <a href={route('erp.dashboard')} className="text-primary text-sm underline">Back to ERP dashboard</a>
            </div>
        </main>
    );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
    return <section className="space-y-3 rounded-md border p-4"><h2 className="text-lg font-medium">{title}</h2>{children}</section>;
}

function TextField({
    label,
    value,
    onChange,
    error,
    required = false,
    type = 'text',
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    required?: boolean;
    type?: string;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="bg-background rounded-md border px-3 py-2" />
            {error && <ErrorText>{error}</ErrorText>}
        </label>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
    error,
}: {
    label: string;
    value: string;
    options: string[] | Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    error?: string;
}) {
    const normalized = options.map((option) => typeof option === 'string'
        ? { value: option, label: option.replaceAll('_', ' ') }
        : option);

    return (
        <label className="grid gap-1 text-sm">
            {label}
            <select value={value} onChange={(event) => onChange(event.target.value)} className="bg-background rounded-md border px-3 py-2">
                {normalized.map((option) => <option key={option.value} value={option.value} className="capitalize">{option.label}</option>)}
            </select>
            {error && <ErrorText>{error}</ErrorText>}
        </label>
    );
}

function SubmitButton({ processing, children }: { processing: boolean; children: ReactNode }) {
    return <button type="submit" disabled={processing} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">{children}</button>;
}

function ErrorText({ children }: { children: ReactNode }) {
    return <span className="text-destructive text-sm">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
    return <p className="text-muted-foreground py-2 text-sm">{children}</p>;
}
