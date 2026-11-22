import { Card, Empty, Page, StatusBadge, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { useForm } from '@inertiajs/react';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Item = {
    id: number;
    filename: string;
    status: string;
    sheets: number;
    lines: number;
    created_at: string | null;
    imported_at: string | null;
    by: string | null;
};

const statusLabels: Record<string, string> = { preview: 'Preview', imported: 'Imported', undone: 'Undone' };

export default function StatementImports({ imports }: { imports: Item[] }) {
    const form = useForm<{ file: File | null }>({ file: null });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.banking.imports.store'), { forceFormData: true });
    };

    return (
        <Page
            title="Import bank statements"
            subtitle="One account per sheet. You see a preview first; nothing is saved until you confirm."
            actions={
                <a href={route('erp.banking.index')} className={secondaryButton}>
                    Back to banking
                </a>
            }
        >
            <Card>
                <form onSubmit={submit} className="space-y-4">
                    <label className="hover:bg-muted/40 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition">
                        <UploadCloud className="text-primary size-8" />
                        <span className="font-medium">{form.data.file ? form.data.file.name : 'Choose a statement workbook (.xlsx)'}</span>
                        <span className="text-muted-foreground max-w-xl text-sm">
                            Each sheet needs the bank name, an “Account Name:” line, an optional “Account No:”, and a table with Date, Txn Type,
                            Description, Ref No., Debit, Credit and Balance, starting with the opening balance.
                        </span>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.ods"
                            className="sr-only"
                            onChange={(event) => form.setData('file', event.target.files?.[0] ?? null)}
                        />
                    </label>
                    {form.errors.file && <p className="text-sm text-rose-600">{form.errors.file}</p>}
                    <button type="submit" className={primaryButton} disabled={!form.data.file || form.processing}>
                        {form.processing ? 'Reading…' : 'Preview import'}
                    </button>
                </form>
            </Card>

            <Card title="Earlier imports">
                {imports.length === 0 ? (
                    <Empty>No statements imported yet.</Empty>
                ) : (
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left">
                                <tr>
                                    <th className="px-4 py-2.5 font-medium">File</th>
                                    <th className="px-4 py-2.5 text-right font-medium">Sheets</th>
                                    <th className="px-4 py-2.5 text-right font-medium">Lines</th>
                                    <th className="px-4 py-2.5 font-medium">When</th>
                                    <th className="px-4 py-2.5 font-medium">By</th>
                                    <th className="px-4 py-2.5 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {imports.map((item) => (
                                    <tr key={item.id} className="hover:bg-muted/30 border-t">
                                        <td className="px-4 py-2.5">
                                            <a
                                                href={route('erp.banking.imports.show', item.id)}
                                                className="inline-flex items-center gap-2 font-medium hover:underline"
                                            >
                                                <FileSpreadsheet className="text-primary size-4" /> {item.filename}
                                            </a>
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{item.sheets}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{item.lines.toLocaleString()}</td>
                                        <td className="px-4 py-2.5">{new Date(item.imported_at ?? item.created_at ?? '').toLocaleString()}</td>
                                        <td className="px-4 py-2.5">{item.by ?? '—'}</td>
                                        <td className="px-4 py-2.5">
                                            <StatusBadge value={item.status} label={statusLabels[item.status] ?? item.status} />
                                        </td>
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
