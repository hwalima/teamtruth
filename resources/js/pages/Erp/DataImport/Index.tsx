import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Checkbox, Empty, Field, Page, Select, StatusBadge, formatDate, humanize, primaryButton, type Options } from '@/components/hrm/ui';

export type ImportItem = {
    id: number;
    model: string;
    label: string;
    file_name: string;
    status: string;
    total_rows: number;
    actions: Record<string, number>;
    created_by: string | null;
    imported_by: string | null;
    created_at: string | null;
    imported_at: string | null;
};

type Props = {
    models: Options;
    locations: { id: number; label: string }[];
    imports: ImportItem[];
};

export function actionSummary(actions: Record<string, number>): string {
    return Object.entries(actions)
        .map(([action, count]) => `${count} ${humanize(action).toLowerCase()}`)
        .join(', ');
}

export default function DataImportIndex({ models, locations, imports }: Props) {
    const form = useForm<{
        file: File | null;
        model: string;
        import_stock: boolean;
        location_id: string;
        update_existing: boolean;
        reference_as_sku: boolean;
        create_as: string;
    }>({
        file: null,
        model: '',
        import_stock: true,
        location_id: '',
        update_existing: true,
        reference_as_sku: false,
        create_as: 'auto',
    });

    const guessed = guessModel(form.data.file?.name ?? '');
    const model = form.data.model || guessed;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.data-import.store'), { forceFormData: true });
    };

    return (
        <Page title="Data import" subtitle="Bring records across from Odoo. Every file is previewed first; nothing is saved until you confirm.">
            <Card title="Upload an Odoo export">
                <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                    <Field label="File (xlsx or csv)" error={form.errors.file} className="md:col-span-2">
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv,.ods"
                            onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)}
                            className="block w-full text-sm"
                            required
                        />
                    </Field>

                    <Field label="What the file holds" error={form.errors.model}>
                        <Select
                            value={form.data.model}
                            onChange={(value) => form.setData('model', value)}
                            options={models}
                            placeholder={guessed ? `Detected: ${models[guessed] ?? guessed}` : 'Detect from the file'}
                        />
                    </Field>

                    {model === 'product.template' && (
                        <>
                            <Field label="Opening stock goes to" error={form.errors.location_id}>
                                <Select
                                    value={form.data.location_id}
                                    onChange={(value) => form.setData('location_id', value)}
                                    options={locations.map((l) => ({ value: l.id, label: l.label }))}
                                    placeholder="Main Warehouse (created if missing)"
                                />
                            </Field>
                            <div className="space-y-2 md:col-span-2">
                                <Checkbox label="Bring across the quantity on hand as opening stock" checked={form.data.import_stock} onChange={(v) => form.setData('import_stock', v)} />
                                <Checkbox label="Update products imported before (matched by Odoo ID, name or barcode)" checked={form.data.update_existing} onChange={(v) => form.setData('update_existing', v)} />
                                <Checkbox label="Use Odoo's Internal Reference as the SKU when it is unique" checked={form.data.reference_as_sku} onChange={(v) => form.setData('reference_as_sku', v)} />
                            </div>
                        </>
                    )}

                    {model === 'res.partner' && (
                        <Field label="Create contacts as" error={form.errors.create_as}>
                            <Select
                                value={form.data.create_as}
                                onChange={(value) => form.setData('create_as', value)}
                                options={{ auto: 'As in Odoo (vendor / customer rank)', vendor: 'Vendors', customer: 'Customers', both: 'Both vendors and customers' }}
                            />
                        </Field>
                    )}

                    <div className="md:col-span-2">
                        <button type="submit" className={primaryButton} disabled={form.processing || !form.data.file}>
                            {form.processing ? 'Reading the file…' : 'Preview'}
                        </button>
                    </div>
                </form>

                <div className="text-muted-foreground mt-6 space-y-1 border-t pt-4 text-sm">
                    <p className="text-foreground font-medium">Exporting from Odoo</p>
                    <p>
                        In Odoo, select the records, then Action → Export. Tick <strong>“I want to update data (import-compatible export)”</strong> so the file carries
                        Odoo's IDs: importing an updated file later then changes the same records instead of adding new ones.
                    </p>
                    <p>Import contacts (vendors and customers) and products in any order: vendors named on products are matched to the contacts by name.</p>
                    <p>Every column is kept, including ones this system has no field for; you will find them on the record under its Odoo details.</p>
                </div>
            </Card>

            <Card title="Imports">
                {imports.length === 0 ? (
                    <Empty>No files imported yet.</Empty>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-muted-foreground text-left text-xs uppercase">
                                <tr>
                                    <th className="py-2 pr-3">#</th>
                                    <th className="py-2 pr-3">File</th>
                                    <th className="py-2 pr-3">Type</th>
                                    <th className="py-2 pr-3">Rows</th>
                                    <th className="py-2 pr-3">Result</th>
                                    <th className="py-2 pr-3">Status</th>
                                    <th className="py-2">When</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {imports.map((item) => (
                                    <tr key={item.id}>
                                        <td className="py-2 pr-3">{item.id}</td>
                                        <td className="py-2 pr-3">
                                            <a href={route('erp.data-import.show', item.id)} className="text-primary font-medium hover:underline">
                                                {item.file_name}
                                            </a>
                                        </td>
                                        <td className="py-2 pr-3">{item.label}</td>
                                        <td className="py-2 pr-3">{item.total_rows}</td>
                                        <td className="text-muted-foreground py-2 pr-3">{actionSummary(item.actions)}</td>
                                        <td className="py-2 pr-3">
                                            <StatusBadge value={item.status === 'imported' ? 'completed' : 'pending'} label={humanize(item.status)} />
                                        </td>
                                        <td className="py-2">{formatDate(item.imported_at ?? item.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </Page>
    );
}

function guessModel(fileName: string): string {
    const name = fileName.toLowerCase();
    if (name.includes('(product.template)') || name.includes('(product.product)')) return 'product.template';
    if (name.includes('(res.partner)')) return 'res.partner';
    return '';
}
