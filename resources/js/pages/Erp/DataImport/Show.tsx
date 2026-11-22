import { router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Checkbox, Detail, Empty, Field, Page, Pagination, Select, StatusBadge, TextInput, formatDate, humanize, primaryButton, secondaryButton, type Paginated } from '@/components/hrm/ui';
import { actionSummary, type ImportItem } from './Index';

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
        };
    };
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

export default function DataImportShow({ import: item, rows, filters }: Props) {
    const imported = item.status === 'imported';
    const [confirming, setConfirming] = useState(false);
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

    const commit = () => {
        router.post(route('erp.data-import.commit', item.id), {}, { onStart: () => setConfirming(true), onFinish: () => setConfirming(false) });
    };

    return (
        <Page
            title={item.file_name}
            subtitle={`${item.label} · ${item.total_rows} rows · ${imported ? `imported ${formatDate(item.imported_at)} by ${item.imported_by ?? '—'}` : 'preview, nothing saved yet'}`}
            actions={
                <>
                    <a href={route('erp.data-import.index')} className={secondaryButton}>
                        All imports
                    </a>
                    <a href={route('erp.data-import.download', item.id)} className={secondaryButton}>
                        Original file
                    </a>
                    {!imported && (
                        <button type="button" className={secondaryButton} onClick={() => router.post(route('erp.data-import.preview', item.id))}>
                            Preview again
                        </button>
                    )}
                    {!imported && (
                        <button type="button" className={primaryButton} onClick={commit} disabled={confirming}>
                            {confirming ? 'Importing…' : `Confirm import${errors ? ` (${errors} rows with errors left out)` : ''}`}
                        </button>
                    )}
                </>
            }
        >
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
