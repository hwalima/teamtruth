import { balanceClass, money, shortDate } from '@/components/banking/money';
import { Card, Checkbox, Field, Page, Select, StatusBadge, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { router } from '@inertiajs/react';
import { CheckCircle2, Info, TriangleAlert, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { route } from 'ziggy-js';

type Sheet = {
    index: number;
    sheet: string;
    bank: string | null;
    account_name: string;
    account_number: string | null;
    period: string | null;
    opening: { row: number | null; date: string | null; debit: number; credit: number; balance: number };
    line_count: number;
    first_date: string | null;
    last_date: string | null;
    debits: number;
    credits: number;
    closing: number;
    file_closing: number;
    file_totals: { row: number; debit: number; credit: number; matches: boolean } | null;
    differences: { row: number; date: string; description: string; stated_balance: number; balance: number; difference: number }[];
    types: Record<string, number>;
    notes: string[];
};

type Plan = {
    index: number;
    include: boolean;
    company_id: number | null;
    company_name: string;
    company_choice: string;
    new_company_code: string | null;
    account_id: number | null;
    account_number: string | null;
    file_account_number: string | null;
    warnings: string[];
};

type Result = {
    sheets: { index: number; sheet: string; company_name: string; account_id: number; account_number: string; lines: number }[];
    companies_created: number[];
    accounts_created: number[];
};

type Props = {
    import: { id: number; filename: string; status: string; imported_at: string | null; sheets: Sheet[]; result: Result | null };
    plan: Plan[];
    companies: { id: number; code: string; name: string }[];
};

export default function StatementImportShow({ import: item, plan, companies }: Props) {
    const preview = item.status === 'preview';
    const planFor = (index: number) => plan.find((p) => p.index === index);
    const [choices, setChoices] = useState<Record<number, { include: boolean; company: string }>>(() =>
        Object.fromEntries(plan.map((p) => [p.index, { include: p.include, company: p.company_choice }])),
    );
    const [busy, setBusy] = useState(false);
    const included = Object.values(choices).filter((c) => c.include).length;
    const totalLines = item.sheets.reduce((sum, s) => sum + s.line_count, 0);

    const commit = () =>
        router.post(route('erp.banking.imports.commit', item.id), { choices }, { onStart: () => setBusy(true), onFinish: () => setBusy(false) });
    const undo = () => {
        if (window.confirm('Undo this import? Its lines and the accounts it opened are removed. Companies it created are kept.')) {
            router.post(route('erp.banking.imports.undo', item.id));
        }
    };

    return (
        <Page
            title={item.filename}
            subtitle={`${item.sheets.length} sheet(s) · ${totalLines.toLocaleString()} transaction line(s)`}
            actions={
                <>
                    <a href={route('erp.banking.imports.index')} className={secondaryButton}>
                        All imports
                    </a>
                    {preview && (
                        <button type="button" className={primaryButton} onClick={commit} disabled={busy || included === 0}>
                            {busy ? 'Importing…' : `Import ${included} sheet(s)`}
                        </button>
                    )}
                    {item.status === 'imported' && (
                        <button type="button" className={secondaryButton} onClick={undo}>
                            <Undo2 className="mr-1.5 size-4" /> Undo import
                        </button>
                    )}
                </>
            }
        >
            {preview ? (
                <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                    <Info className="mt-0.5 size-5 shrink-0" />
                    <p>
                        Nothing is saved yet. Every amount, type and description is brought in exactly as the sheet has it. Statements show the
                        running balance worked out from the opening balance; any line where the sheet printed a different balance is listed below and
                        on the statement’s reconciliation note.
                    </p>
                </div>
            ) : (
                <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                    <p>
                        {item.status === 'imported'
                            ? `Imported ${item.imported_at ? new Date(item.imported_at).toLocaleString() : ''}.`
                            : 'This import was undone.'}
                        {item.result &&
                            item.result.companies_created.length > 0 &&
                            ` ${item.result.companies_created.length} new company(ies) were created.`}
                    </p>
                </div>
            )}

            {item.sheets.map((sheet) => {
                const p = planFor(sheet.index);
                const choice = choices[sheet.index];
                const done = item.result?.sheets.find((s) => s.index === sheet.index);
                const companyChanged = p && choice && choice.company !== p.company_choice;

                return (
                    <Card
                        key={sheet.index}
                        title={
                            <span className="flex flex-wrap items-center gap-2">
                                {sheet.account_name}
                                <span className="text-muted-foreground text-sm font-normal">sheet “{sheet.sheet.trim()}”</span>
                            </span>
                        }
                        actions={
                            done ? (
                                <a href={route('erp.banking.accounts.show', done.account_id)} className={secondaryButton}>
                                    Statement {done.account_number}
                                </a>
                            ) : preview && choice ? (
                                <Checkbox
                                    label="Import this sheet"
                                    checked={choice.include}
                                    onChange={(value) => setChoices({ ...choices, [sheet.index]: { ...choice, include: value } })}
                                />
                            ) : item.status !== 'preview' ? (
                                <StatusBadge value="skipped" label="Not imported" />
                            ) : null
                        }
                    >
                        <div className="grid gap-3 text-sm sm:grid-cols-4">
                            <Fact label="Bank" value={sheet.bank ?? '—'} />
                            <Fact label="Account no. on sheet" value={sheet.account_number || 'none'} />
                            <Fact
                                label="Account no. here"
                                value={
                                    done?.account_number ??
                                    (p?.account_id
                                        ? `${p.account_number} (existing)`
                                        : companyChanged
                                          ? 'given on import'
                                          : (p?.account_number ?? '—'))
                                }
                            />
                            <Fact label="Heading period" value={sheet.period ?? '—'} />
                        </div>

                        {preview && p && choice && (
                            <Field label="Account holder">
                                <Select
                                    value={choice.company}
                                    onChange={(value) => setChoices({ ...choices, [sheet.index]: { ...choice, company: value } })}
                                    options={[
                                        {
                                            value: 'new',
                                            label: `Create new company: ${sheet.account_name}${p.new_company_code ? ` (${p.new_company_code})` : ''}`,
                                        },
                                        ...companies.map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` })),
                                    ]}
                                />
                            </Field>
                        )}
                        {done && <Fact label="Account holder" value={done.company_name} />}

                        <div className="grid gap-3 sm:grid-cols-6">
                            <Figure label={`Opening · ${shortDate(sheet.opening.date)}`} cents={sheet.opening.balance} />
                            <Figure label="Lines" text={`${sheet.line_count} (${shortDate(sheet.first_date)} – ${shortDate(sheet.last_date)})`} />
                            <Figure label="Credits" cents={sheet.credits} />
                            <Figure label="Debits" cents={sheet.debits} />
                            <Figure label="Closing balance" cents={sheet.closing} />
                            <Figure
                                label="Closing on sheet"
                                cents={sheet.file_closing}
                                badge={sheet.file_closing === sheet.closing ? 'Agrees' : 'Differs'}
                                good={sheet.file_closing === sheet.closing}
                            />
                        </div>

                        <div className="text-muted-foreground text-xs">
                            Types:{' '}
                            {Object.entries(sheet.types)
                                .map(([type, count]) => `${type || '(blank)'} × ${count}`)
                                .join(' · ')}
                            {sheet.file_totals && (
                                <>
                                    {' '}
                                    · Totals row {sheet.file_totals.row}: debits {money(sheet.file_totals.debit)}, credits{' '}
                                    {money(sheet.file_totals.credit)} {sheet.file_totals.matches ? '(agrees)' : '(does not add up)'}
                                </>
                            )}
                        </div>

                        {[...(p?.warnings ?? []), ...sheet.notes].length > 0 && (
                            <ul className="space-y-1.5 text-sm">
                                {(p?.warnings ?? []).map((w, i) => (
                                    <li key={`w${i}`} className="flex gap-2 text-amber-800 dark:text-amber-300">
                                        <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
                                    </li>
                                ))}
                                {sheet.notes.map((n, i) => (
                                    <li key={`n${i}`} className="text-muted-foreground flex gap-2">
                                        <Info className="mt-0.5 size-4 shrink-0" /> {n}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {sheet.differences.length > 0 && (
                            <details className="rounded-lg border">
                                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
                                    Balance differences ({sheet.differences.length} line(s))
                                </summary>
                                <div className="overflow-x-auto border-t">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/40 text-left">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Row</th>
                                                <th className="px-3 py-2 font-medium">Date</th>
                                                <th className="px-3 py-2 font-medium">Description</th>
                                                <th className="px-3 py-2 text-right font-medium">Balance on sheet</th>
                                                <th className="px-3 py-2 text-right font-medium">Correct balance</th>
                                                <th className="px-3 py-2 text-right font-medium">Difference</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sheet.differences.map((d) => (
                                                <tr key={d.row} className="border-t">
                                                    <td className="px-3 py-2">{d.row}</td>
                                                    <td className="px-3 py-2">{shortDate(d.date)}</td>
                                                    <td className="px-3 py-2">{d.description}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{money(d.stated_balance)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{money(d.balance)}</td>
                                                    <td className="px-3 py-2 text-right font-medium tabular-nums">{money(d.difference)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        )}
                    </Card>
                );
            })}
        </Page>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-muted-foreground text-xs tracking-wide uppercase">{label}</div>
            <div className="font-medium">{value}</div>
        </div>
    );
}

function Figure({ label, cents, text, badge, good }: { label: string; cents?: number; text?: string; badge?: string; good?: boolean }) {
    return (
        <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</div>
            <div className={`mt-0.5 font-semibold tabular-nums ${cents !== undefined ? balanceClass(cents) : ''}`}>
                {cents !== undefined ? money(cents) : text}
            </div>
            {badge && (
                <span
                    className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${good ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}
                >
                    {badge}
                </span>
            )}
        </div>
    );
}
