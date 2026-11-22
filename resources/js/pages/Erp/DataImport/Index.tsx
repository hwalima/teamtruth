import { Card, Checkbox, Empty, Field, Page, Select, StatusBadge, formatDate, humanize, primaryButton, type Options } from '@/components/hrm/ui';
import { useForm } from '@inertiajs/react';
import { FileUp } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

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
    company: { id: number; code: string; name: string };
    models: Options;
    locations: { id: number; label: string }[];
    accounts: { id: number; label: string; type: string }[];
    imports: ImportItem[];
};

export function actionSummary(actions: Record<string, number>): string {
    return Object.entries(actions)
        .map(([action, count]) => `${count} ${humanize(action).toLowerCase()}`)
        .join(', ');
}

export default function DataImportIndex({ company, models, locations, accounts, imports }: Props) {
    const form = useForm<{
        file: File | null;
        model: string;
        import_stock: boolean;
        location_id: string;
        update_existing: boolean;
        reference_as_sku: boolean;
        create_as: string;
        name_order: string;
        deduction_account_id: string;
    }>({
        file: null,
        model: '',
        import_stock: true,
        location_id: '',
        update_existing: true,
        reference_as_sku: false,
        create_as: 'auto',
        name_order: 'last_first',
        deduction_account_id: '',
    });

    const [dragging, setDragging] = useState(false);
    const guessed = guessModel(form.data.file?.name ?? '');
    const model = form.data.model || guessed;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.data-import.store'), { forceFormData: true });
    };

    return (
        <Page title="Data import" subtitle="Bring records across from Odoo. Every file is previewed first; nothing is saved until you confirm.">
            <CompanyBanner company={company} />

            <Card title="Upload an Odoo export">
                <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-1.5 text-sm md:col-span-2">
                        <span className="text-foreground/85 font-medium">File (xlsx or csv)</span>
                        <label
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) form.setData('file', file);
                            }}
                            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                                dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60 hover:bg-primary/5'
                            }`}
                        >
                            <FileUp className="text-primary size-8" />
                            {form.data.file ? (
                                <>
                                    <span className="font-medium">{form.data.file.name}</span>
                                    <span className="text-muted-foreground text-xs">
                                        {(form.data.file.size / 1024).toFixed(0)} KB · click to choose a different file
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="font-medium">Click to choose the Odoo file, or drop it here</span>
                                    <span className="text-muted-foreground text-xs">.xlsx, .xls or .csv, up to 50 MB</span>
                                </>
                            )}
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv,.ods"
                                onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)}
                                className="sr-only"
                            />
                        </label>
                        {form.errors.file && <span className="text-destructive text-xs">{form.errors.file}</span>}
                    </div>

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
                                <Checkbox
                                    label="Bring across the quantity on hand as opening stock"
                                    checked={form.data.import_stock}
                                    onChange={(v) => form.setData('import_stock', v)}
                                />
                                <Checkbox
                                    label="Update products imported before (matched by Odoo ID, name or barcode)"
                                    checked={form.data.update_existing}
                                    onChange={(v) => form.setData('update_existing', v)}
                                />
                                <Checkbox
                                    label="Use Odoo's Internal Reference as the SKU when it is unique"
                                    checked={form.data.reference_as_sku}
                                    onChange={(v) => form.setData('reference_as_sku', v)}
                                />
                            </div>
                        </>
                    )}

                    {model === 'res.partner' && (
                        <Field label="Create contacts as" error={form.errors.create_as}>
                            <Select
                                value={form.data.create_as}
                                onChange={(value) => form.setData('create_as', value)}
                                options={{
                                    auto: 'As in Odoo (vendor / customer rank)',
                                    vendor: 'Vendors',
                                    customer: 'Customers',
                                    both: 'Both vendors and customers',
                                }}
                            />
                        </Field>
                    )}

                    {model === 'account.move' && (
                        <>
                            <Field label="Deductions taken off by the customer go to" error={form.errors.deduction_account_id}>
                                <Select
                                    value={form.data.deduction_account_id}
                                    onChange={(value) => form.setData('deduction_account_id', value)}
                                    options={accounts.map((a) => ({ value: a.id, label: a.label }))}
                                    placeholder="An account named royalty, levy or withholding"
                                />
                            </Field>
                            <p className="text-muted-foreground text-xs md:col-span-2">
                                Each invoice keeps its Odoo number, dates and status. Confirmed invoices are posted to the ledger, what was paid
                                (total less amount due) is recorded as a payment dated on the due date, and invoices fiscalised in Odoo are never sent
                                to the fiscal device again. A negative tax in Odoo is a deduction the customer took off, and goes to the account
                                above. Importing an updated file later records only the new payments.
                            </p>
                        </>
                    )}

                    {model === 'hr.employee' && (
                        <>
                            <Field label="Names in the file are written" error={form.errors.name_order}>
                                <Select
                                    value={form.data.name_order}
                                    onChange={(value) => form.setData('name_order', value)}
                                    options={{ last_first: 'Surname first (Doe Jane)', first_last: 'First name first (Jane Doe)' }}
                                />
                            </Field>
                            <div className="space-y-2 md:col-span-2">
                                <Checkbox
                                    label="Update employees imported before (matched by Odoo ID or name)"
                                    checked={form.data.update_existing}
                                    onChange={(v) => form.setData('update_existing', v)}
                                />
                                <p className="text-muted-foreground text-xs">
                                    Job titles become positions and missing departments are created. Check the preview: it shows how each name was
                                    split.
                                </p>
                            </div>
                        </>
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
                        In Odoo, select the records, then Action → Export. Tick <strong>“I want to update data (import-compatible export)”</strong> so
                        the file carries Odoo's IDs: importing an updated file later then changes the same records instead of adding new ones.
                    </p>
                    <p>
                        Employees come from Employees → Action → Export. Import contacts (vendors and customers) and products in any order: vendors
                        named on products are matched to the contacts by name.
                    </p>
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
    if (name.includes('(hr.employee)')) return 'hr.employee';
    if (name.includes('(account.move)')) return 'account.move';
    return '';
}

export function CompanyBanner({ company, done = false }: { company: { code: string; name: string }; done?: boolean }) {
    return (
        <div className="border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm">
            <span>
                {done ? 'Imported into' : 'Importing into'} <strong className="text-base">{company.name}</strong>{' '}
                <span className="text-muted-foreground">({company.code})</span>
            </span>
            {!done && (
                <span className="text-muted-foreground text-xs">Wrong company? Switch company first, from the company switcher in the sidebar.</span>
            )}
        </div>
    );
}
