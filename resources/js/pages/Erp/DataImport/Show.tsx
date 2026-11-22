import { router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Checkbox, dangerButton, Detail, Empty, Field, Page, Pagination, Select, StatusBadge, TextInput, formatDate, humanize, primaryButton, secondaryButton, type Paginated } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { actionSummary, CompanyBanner, type ImportItem } from './Index';

type Row = {
    id: number;
    row_number: number;
    action: string | null;
    messages: string[];
    record_id: number | null;
    data: Record<string, string | number | boolean>;
};

type Props = {
    import: ImportItem & {
        options: Record<string, string | number | boolean>;
        columns: { mapped?: Record<string, string>; kept_only?: string[] };
        summary: {
            actions?: Record<string, number>;
            created?: Record<string, string[]>;
            totals?: Record<string, number>;
            warnings?: string[];
            error?: string;
            undone?: { by: string; at: string; removed: Record<string, number> };
        };
    };
    company: { id: number; code: string; name: string };
    rows: Paginated<Row>;
    filters: { action: string; search: string; messages: boolean };
};

const actionColors: Record<string, string> = {
    created: 'completed',
    updated: 'in_progress',
    unchanged: 'closed',
    merged: 'closed',
    skipped: 'pending',
    error: 'rejected',
};

const totalLabels: Record<string, string> = {
    stock_lines: 'Opening stock lines',
    stock_quantity: 'Opening stock quantity',
    vendor_prices: 'Vendor prices',
    pictures: 'Pictures',
    negative_stock: 'Negative quantities left out',
    possible_duplicates: 'Products sharing a name',
};

export default function DataImportShow({ company, import: item, rows, filters }: Props) {
    const imported = item.status === 'imported';
    const undone = item.status === 'undone';
    const [confirming, setConfirming] = useState(false);
    const [dialog, setDialog] = useState<'commit' | 'undo' | null>(null);
    const filter = useForm({ action: filters.action, search: filters.search, messages: filters.messages });
    const summary = item.summary ?? {};
    const errors = summary.actions?.error ?? 0;

    const apply = (event?: FormEvent) => {
        event?.preventDefault();
        router.get(
            route('erp.data-import.show', item.id),
            Object.fromEntries(Object.entries({ ...filter.data, messages: filter.data.messages ? '1' : '' }).filter(([, v]) => v !== '')),
            { preserveState: true, preserveScroll: true },
        );
    };

    const run = (action: 'commit' | 'undo') => {
        router.post(route(action === 'commit' ? 'erp.data-import.commit' : 'erp.data-import.undo', item.id), {}, {
            onStart: () => setConfirming(true),
            onFinish: () => {
                setConfirming(false);
                setDialog(null);
            },
        });
    };

    const status = undone ? 'undone' : imported ? `imported ${formatDate(item.imported_at)} by ${item.imported_by ?? '—'}` : 'preview, nothing saved yet';

    return (
        <Page
            title={item.file_name}
            subtitle={`${item.label} · ${item.total_rows} rows · ${status}`}
            actions={
                <>
                    <a href={route('erp.data-import.index')} className={secondaryButton}>
                        All imports
                    </a>
                    <a href={route('erp.data-import.download', item.id)} className={secondaryButton}>
                        Original file
                    </a>
                    {imported && (
                        <button type="button" className={dangerButton} onClick={() => setDialog('undo')}>
                            Undo import
                        </button>
                    )}
                    {!imported && !undone && (
                        <button type="button" className={secondaryButton} onClick={() => router.post(route('erp.data-import.preview', item.id))}>
                            Preview again
                        </button>
                    )}
                    {!imported && !undone && (
                        <button type="button" className={primaryButton} onClick={() => setDialog('commit')} disabled={confirming}>
                            {confirming ? 'Importing…' : `Confirm import${errors ? ` (${errors} rows with errors left out)` : ''}`}
                        </button>
                    )}
                </>
            }
        >
            {!undone && <CompanyBanner company={company} done={imported} />}
            {undone && summary.undone && (
                <Empty>
                    Undone by {summary.undone.by} on {formatDate(summary.undone.at)}. Removed: {actionSummary(summary.undone.removed) || 'nothing'}. To bring the file into the right
                    company, switch to it and upload the file again (Original file, above, downloads it).
                </Empty>
            )}
            {summary.error && <Empty>The last import attempt failed and nothing was saved: {summary.error}</Empty>}

            <div className="grid gap-4 lg:grid-cols-3">
                <Card title={imported ? 'Result' : 'What the import will do'}>
                    <dl className="grid grid-cols-2 gap-3">
                        {Object.entries(summary.actions ?? {}).map(([action, count]) => (
                            <Detail key={action} label={`Rows ${humanize(action).toLowerCase()}`} value={count} />
                        ))}
                        {Object.entries(summary.totals ?? {}).map(([total, value]) => (
                            <Detail key={total} label={totalLabels[total] ?? humanize(total)} value={value} />
                        ))}
                    </dl>
                </Card>

                <Card title={imported ? 'Created along the way' : 'Will also be created'}>
                    {Object.keys(summary.created ?? {}).length === 0 ? (
                        <p className="text-muted-foreground text-sm">Nothing else: everything the rows need exists already.</p>
                    ) : (
                        <div className="space-y-3 text-sm">
                            {Object.entries(summary.created ?? {}).map(([kind, names]) => (
                                <details key={kind}>
                                    <summary className="cursor-pointer font-medium">
                                        {names.length} {humanize(kind).toLowerCase()}
                                    </summary>
                                    <ul className="text-muted-foreground mt-1 max-h-48 list-disc overflow-y-auto pl-5">
                                        {names.map((name) => (
                                            <li key={name}>{name}</li>
                                        ))}
                                    </ul>
                                </details>
                            ))}
                        </div>
                    )}
                </Card>

                <Card title="Columns">
                    <div className="space-y-2 text-sm">
                        <p>
                            <span className="font-medium">Used: </span>
                            <span className="text-muted-foreground">{Object.values(item.columns.mapped ?? {}).join(', ') || '—'}</span>
                        </p>
                        <p>
                            <span className="font-medium">Kept on the record only: </span>
                            <span className="text-muted-foreground">{(item.columns.kept_only ?? []).join(', ') || '—'}</span>
                        </p>
                    </div>
                </Card>
            </div>

            {(summary.warnings ?? []).length > 0 && (
                <Card title="Check these">
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                        {summary.warnings!.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </Card>
            )}

            <Card title="Rows">
                <form onSubmit={apply} className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                    <Field label="Search">
                        <TextInput value={filter.data.search} onChange={(v) => filter.setData('search', v)} placeholder="Name, reference…" />
                    </Field>
                    <Field label="Result">
                        <Select
                            value={filter.data.action}
                            onChange={(v) => filter.setData('action', v)}
                            options={Object.fromEntries(Object.keys(summary.actions ?? {}).map((a) => [a, humanize(a)]))}
                            placeholder="All rows"
                        />
                    </Field>
                    <div className="pb-2">
                        <Checkbox label="Only rows with notes" checked={filter.data.messages} onChange={(v) => filter.setData('messages', v)} />
                    </div>
                    <button type="submit" className={secondaryButton}>
                        Filter
                    </button>
                </form>

                {rows.data.length === 0 ? (
                    <Empty>No rows match.</Empty>
                ) : (
                    <div className="divide-y">
                        {rows.data.map((row) => (
                            <RowItem key={row.id} row={row} nameColumn={item.columns.mapped?.name} />
                        ))}
                    </div>
                )}
                <div className="mt-4">
                    <Pagination page={rows} />
                </div>
            </Card>
            <Dialog open={dialog !== null} onOpenChange={(open) => !open && !confirming && setDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{dialog === 'undo' ? 'Undo this import?' : `Import into ${company.name}?`}</DialogTitle>
                        <DialogDescription>
                            {dialog === 'undo'
                                ? `This removes what the import created in ${company.name}: its products with their opening stock and vendor prices, and the categories, units, locations and vendors it added that nothing else uses. Records it only updated stay as they are. The import and its file are kept.`
                                : `${item.total_rows} rows from ${item.file_name} will be saved to ${company.name} (${company.code}). You can undo it afterwards if something is wrong.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button type="button" className={secondaryButton} onClick={() => setDialog(null)} disabled={confirming}>
                            Cancel
                        </button>
                        <button type="button" className={dialog === 'undo' ? dangerButton : primaryButton} onClick={() => dialog && run(dialog)} disabled={confirming}>
                            {confirming ? 'Working…' : dialog === 'undo' ? 'Yes, undo it' : 'Yes, import'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}

function RowItem({ row, nameColumn }: { row: Row; nameColumn?: string }) {
    const [open, setOpen] = useState(false);
    const title = (nameColumn && row.data[nameColumn]) || Object.values(row.data)[0] || '(empty)';

    return (
        <div className="py-2">
            <button type="button" onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-3 text-left text-sm">
                <span className="text-muted-foreground w-14 shrink-0">Row {row.row_number}</span>
                <span className="min-w-40 flex-1 font-medium">{String(title)}</span>
                {row.action && <StatusBadge value={actionColors[row.action] ?? 'open'} label={humanize(row.action)} />}
            </button>
            {row.messages.length > 0 && (
                <ul className="text-muted-foreground mt-1 ml-16 list-disc pl-5 text-xs">
                    {row.messages.map((message) => (
                        <li key={message}>{message}</li>
                    ))}
                </ul>
            )}
            {open && (
                <dl className="bg-muted/30 mt-2 ml-16 grid gap-x-6 gap-y-1 rounded-lg p-3 text-xs sm:grid-cols-2">
                    {Object.entries(row.data).map(([column, value]) => (
                        <div key={column} className="flex gap-2">
                            <dt className="text-muted-foreground shrink-0">{column}:</dt>
                            <dd className="break-all">{String(value)}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}
