import { router, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { route } from 'ziggy-js';

type Account = {
    id: number;
    code: string;
    name: string;
    account_type: string;
    is_group: boolean;
    is_active: boolean;
    allow_reconciliation: boolean;
    parent: { id: number; code: string; name: string } | null;
};
type Period = {
    id: number;
    name: string;
    starts_on: string;
    ends_on: string;
    status: string;
};
type FiscalYear = {
    id: number;
    name: string;
    starts_on: string;
    ends_on: string;
    status: string;
    periods: Period[];
};
type Journal = { id: number; code: string; name: string; journal_type: string; is_active: boolean };
type Entry = {
    id: number;
    reversal_of_id: number | null;
    document_number: string;
    entry_date: string;
    currency_code: string;
    exchange_rate: string;
    description: string;
    reference: string | null;
    debit_total: string;
    credit_total: string;
    posted_at: string;
    journal: { id: number; code: string; name: string };
    reversal: { id: number; reversal_of_id: number; document_number: string } | null;
    creator: { name: string } | null;
    lines: Array<{
        id: number;
        description: string | null;
        currency_debit: string;
        currency_credit: string;
        debit: string;
        credit: string;
        account: { id: number; code: string; name: string };
    }>;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    currencies: Array<{ code: string; name: string }>;
    accounts: Account[];
    journals: Journal[];
    fiscalYears: FiscalYear[];
    entries: Entry[];
};
type AccountInput = {
    code: string;
    name: string;
    account_type: string;
    parent_id: string;
    is_group: boolean;
    allow_reconciliation: boolean;
};
type JournalInput = { code: string; name: string; journal_type: string };
type EntryLineInput = { account_id: string; description: string; debit: string; credit: string };
const accountTypes = ['asset', 'liability', 'equity', 'income', 'expense'];
const journalTypes = ['general', 'sales', 'purchase', 'bank', 'cash', 'stock', 'payroll'];
const emptyLine = (): EntryLineInput => ({ account_id: '', description: '', debit: '0', credit: '0' });

export default function AccountingIndex({ company, currencies, accounts, journals, fiscalYears, entries }: Props) {
    const accountForm = useForm<AccountInput>({
        code: '',
        name: '',
        account_type: 'asset',
        parent_id: '',
        is_group: false,
        allow_reconciliation: false,
    });
    const journalForm = useForm<JournalInput>({ code: '', name: '', journal_type: 'general' });
    const fiscalForm = useForm({
        name: '',
        starts_on: `${new Date().getFullYear()}-01-01`,
        ends_on: `${new Date().getFullYear()}-12-31`,
    });
    const accountErrors = accountForm.errors as Record<string, string>;
    const journalErrors = journalForm.errors as Record<string, string>;
    const fiscalErrors = fiscalForm.errors as Record<string, string>;
    const postingAccounts = accounts.filter((account) => account.is_active && !account.is_group);
    const groupAccounts = accounts.filter((account) => account.is_active && account.is_group);
    const entryForm = useForm({
        journal_id: journals.find((journal) => journal.is_active)?.id.toString() ?? '',
        entry_date: new Date().toISOString().slice(0, 10),
        currency_code: company.default_currency,
        description: '',
        reference: '',
        lines: [emptyLine(), emptyLine()],
    });
    const entryErrors = entryForm.errors as Record<string, string>;

    return (
        <main className="mx-auto max-w-7xl space-y-8 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{company.code}</p>
                <h1 className="text-2xl font-semibold">{company.name} accounting</h1>
                <p className="text-muted-foreground mt-2 max-w-4xl text-sm">
                    Set up this company’s chart of accounts, journals, and monthly fiscal periods. Manual entries are posted only when balanced in the
                    company currency; posted entries are immutable.
                </p>
                <p className="mt-2 text-sm">
                    Company currency: <strong>{company.default_currency}</strong>
                </p>
            </header>

            <section className="grid gap-6 lg:grid-cols-3">
                <Panel title="Add account">
                    <form
                        onSubmit={(event: FormEvent<HTMLFormElement>) => {
                            event.preventDefault();
                            accountForm.post(route('erp.accounting.accounts.store'), {
                                onSuccess: () => accountForm.reset('code', 'name', 'parent_id'),
                            });
                        }}
                        className="space-y-3"
                    >
                        <TextField
                            label="Account code"
                            value={accountForm.data.code}
                            onChange={(value) => accountForm.setData('code', value)}
                            error={accountErrors.code}
                            required
                        />
                        <TextField
                            label="Account name"
                            value={accountForm.data.name}
                            onChange={(value) => accountForm.setData('name', value)}
                            error={accountErrors.name}
                            required
                        />
                        <SelectField
                            label="Account type"
                            value={accountForm.data.account_type}
                            options={accountTypes.map((type) => ({ value: type, label: titleCase(type) }))}
                            onChange={(value) => accountForm.setData('account_type', value)}
                            error={accountErrors.account_type}
                        />
                        <SelectField
                            label="Parent group (optional)"
                            value={accountForm.data.parent_id}
                            options={[
                                { value: '', label: 'No parent' },
                                ...groupAccounts.map((account) => ({ value: account.id.toString(), label: `${account.code} — ${account.name}` })),
                            ]}
                            onChange={(value) => accountForm.setData('parent_id', value)}
                            error={accountErrors.parent_id}
                        />
                        <CheckboxField
                            label="Group account (not directly postable)"
                            checked={accountForm.data.is_group}
                            onChange={(value) => accountForm.setData('is_group', value)}
                        />
                        <CheckboxField
                            label="Allow reconciliation"
                            checked={accountForm.data.allow_reconciliation}
                            onChange={(value) => accountForm.setData('allow_reconciliation', value)}
                        />
                        {accountErrors.allow_reconciliation && <ErrorText>{accountErrors.allow_reconciliation}</ErrorText>}
                        <SubmitButton processing={accountForm.processing}>Add account</SubmitButton>
                    </form>
                </Panel>

                <Panel title="Add journal">
                    <form
                        onSubmit={(event: FormEvent<HTMLFormElement>) => {
                            event.preventDefault();
                            journalForm.post(route('erp.accounting.journals.store'), { onSuccess: () => journalForm.reset() });
                        }}
                        className="space-y-3"
                    >
                        <TextField
                            label="Journal code"
                            value={journalForm.data.code}
                            onChange={(value) => journalForm.setData('code', value)}
                            error={journalErrors.code}
                            required
                        />
                        <TextField
                            label="Journal name"
                            value={journalForm.data.name}
                            onChange={(value) => journalForm.setData('name', value)}
                            error={journalErrors.name}
                            required
                        />
                        <SelectField
                            label="Journal type"
                            value={journalForm.data.journal_type}
                            options={journalTypes.map((type) => ({ value: type, label: titleCase(type) }))}
                            onChange={(value) => journalForm.setData('journal_type', value)}
                            error={journalErrors.journal_type}
                        />
                        <SubmitButton processing={journalForm.processing}>Add journal</SubmitButton>
                    </form>
                    <ul className="divide-y">
                        {journals.map((journal) => (
                            <li key={journal.id} className="py-2 text-sm">
                                <strong>{journal.code}</strong> — {journal.name}{' '}
                                <span className="text-muted-foreground">({titleCase(journal.journal_type)})</span>
                            </li>
                        ))}
                        {journals.length === 0 && <Empty>Create a journal before posting entries.</Empty>}
                    </ul>
                </Panel>

                <Panel title="Fiscal year">
                    <p className="text-muted-foreground text-sm">
                        Creating a fiscal year creates consecutive monthly periods for its full date range.
                    </p>
                    <form
                        onSubmit={(event: FormEvent<HTMLFormElement>) => {
                            event.preventDefault();
                            fiscalForm.post(route('erp.accounting.fiscal-years.store'), { onSuccess: () => fiscalForm.reset() });
                        }}
                        className="space-y-3"
                    >
                        <TextField
                            label="Fiscal year name"
                            value={fiscalForm.data.name}
                            onChange={(value) => fiscalForm.setData('name', value)}
                            error={fiscalErrors.name}
                            required
                        />
                        <TextField
                            label="Starts on"
                            type="date"
                            value={fiscalForm.data.starts_on}
                            onChange={(value) => fiscalForm.setData('starts_on', value)}
                            error={fiscalErrors.starts_on}
                            required
                        />
                        <TextField
                            label="Ends on"
                            type="date"
                            value={fiscalForm.data.ends_on}
                            onChange={(value) => fiscalForm.setData('ends_on', value)}
                            error={fiscalErrors.ends_on}
                            required
                        />
                        <SubmitButton processing={fiscalForm.processing}>Create periods</SubmitButton>
                    </form>
                </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <Panel title="Post manual journal entry">
                    {journals.length === 0 || postingAccounts.length === 0 || fiscalYears.length === 0 ? (
                        <Empty>Set up at least one posting account, journal, and open fiscal year before posting an entry.</Empty>
                    ) : (
                        <form
                            onSubmit={(event: FormEvent<HTMLFormElement>) => {
                                event.preventDefault();
                                entryForm.post(route('erp.accounting.entries.store'), {
                                    onSuccess: () => entryForm.reset('description', 'reference', 'lines'),
                                });
                            }}
                            className="space-y-4"
                        >
                            <div className="grid gap-3 sm:grid-cols-2">
                                <SelectField
                                    label="Journal"
                                    value={entryForm.data.journal_id}
                                    options={journals
                                        .filter((journal) => journal.is_active)
                                        .map((journal) => ({ value: journal.id.toString(), label: `${journal.code} — ${journal.name}` }))}
                                    onChange={(value) => entryForm.setData('journal_id', value)}
                                    error={entryErrors.journal_id}
                                />
                                <TextField
                                    label="Entry date"
                                    type="date"
                                    value={entryForm.data.entry_date}
                                    onChange={(value) => entryForm.setData('entry_date', value)}
                                    error={entryErrors.entry_date}
                                    required
                                />
                                <SelectField
                                    label="Transaction currency"
                                    value={entryForm.data.currency_code}
                                    options={currencies.map((currency) => ({ value: currency.code, label: `${currency.code} — ${currency.name}` }))}
                                    onChange={(value) => entryForm.setData('currency_code', value)}
                                    error={entryErrors.currency_code}
                                />
                                <TextField
                                    label="Reference (optional)"
                                    value={entryForm.data.reference}
                                    onChange={(value) => entryForm.setData('reference', value)}
                                    error={entryErrors.reference}
                                />
                            </div>
                            <TextField
                                label="Description"
                                value={entryForm.data.description}
                                onChange={(value) => entryForm.setData('description', value)}
                                error={entryErrors.description}
                                required
                            />
                            <div className="space-y-3">
                                {entryForm.data.lines.map((line, index) => (
                                    <div
                                        key={index}
                                        className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"
                                    >
                                        <SelectField
                                            label="Account"
                                            value={line.account_id}
                                            options={[
                                                { value: '', label: 'Select account' },
                                                ...postingAccounts.map((account) => ({
                                                    value: account.id.toString(),
                                                    label: `${account.code} — ${account.name}`,
                                                })),
                                            ]}
                                            onChange={(value) =>
                                                updateLine(entryForm.data.lines, index, 'account_id', value, (lines) =>
                                                    entryForm.setData('lines', lines),
                                                )
                                            }
                                            error={entryErrors[`lines.${index}.account_id`]}
                                        />
                                        <TextField
                                            label={`Debit (${entryForm.data.currency_code})`}
                                            type="number"
                                            value={line.debit}
                                            onChange={(value) =>
                                                updateLine(entryForm.data.lines, index, 'debit', value, (lines) => entryForm.setData('lines', lines))
                                            }
                                            error={entryErrors[`lines.${index}.debit`]}
                                            required
                                        />
                                        <TextField
                                            label={`Credit (${entryForm.data.currency_code})`}
                                            type="number"
                                            value={line.credit}
                                            onChange={(value) =>
                                                updateLine(entryForm.data.lines, index, 'credit', value, (lines) => entryForm.setData('lines', lines))
                                            }
                                            error={entryErrors[`lines.${index}.credit`]}
                                            required
                                        />
                                        <TextField
                                            label="Line memo (optional)"
                                            value={line.description}
                                            onChange={(value) =>
                                                updateLine(entryForm.data.lines, index, 'description', value, (lines) =>
                                                    entryForm.setData('lines', lines),
                                                )
                                            }
                                            error={entryErrors[`lines.${index}.description`]}
                                        />
                                        <button
                                            type="button"
                                            disabled={entryForm.data.lines.length <= 2}
                                            onClick={() =>
                                                entryForm.setData(
                                                    'lines',
                                                    entryForm.data.lines.filter((_, lineIndex) => index !== lineIndex),
                                                )
                                            }
                                            className="text-destructive self-end pb-2 text-sm underline disabled:opacity-40"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                {entryErrors.lines && <ErrorText>{entryErrors.lines}</ErrorText>}
                                <button
                                    type="button"
                                    disabled={entryForm.data.lines.length >= 100}
                                    onClick={() => entryForm.setData('lines', [...entryForm.data.lines, emptyLine()])}
                                    className="text-primary text-sm underline disabled:opacity-40"
                                >
                                    Add journal line
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                <SubmitButton processing={entryForm.processing}>Validate and post</SubmitButton>
                                <span className="text-muted-foreground text-xs">Posting is permanent. Corrections require a reversing entry.</span>
                            </div>
                        </form>
                    )}
                </Panel>

                <Panel title="Chart of accounts">
                    <div className="max-h-[36rem] divide-y overflow-y-auto">
                        {accounts.map((account) => (
                            <div key={account.id} className={`py-2 text-sm ${account.parent ? 'pl-5' : ''}`}>
                                <strong>{account.code}</strong> — {account.name}
                                <span className="text-muted-foreground">
                                    {' '}
                                    · {titleCase(account.account_type)}
                                    {account.is_group ? ' · Group' : ''}
                                    {!account.is_active ? ' · Inactive' : ''}
                                </span>
                            </div>
                        ))}
                        {accounts.length === 0 && <Empty>No accounts yet. Add the company-approved chart of accounts to get started.</Empty>}
                    </div>
                </Panel>
            </section>

            <Panel title="Fiscal periods">
                {fiscalYears.map((year) => (
                    <div key={year.id} className="space-y-2 border-b py-3 last:border-0">
                        <h3 className="font-medium">
                            {year.name} · {year.starts_on} to {year.ends_on}
                        </h3>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {year.periods.map((period) => (
                                <div key={period.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                                    <span>
                                        {period.name}
                                        <span className="text-muted-foreground block">
                                            {period.starts_on} — {period.ends_on}
                                        </span>
                                    </span>
                                    {period.status === 'open' ? (
                                        <form
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                if (
                                                    window.confirm(`Lock ${period.name}? New journal entries will not be accepted for this period.`)
                                                ) {
                                                    router.post(route('erp.accounting.periods.lock', period.id));
                                                }
                                            }}
                                        >
                                            <button type="submit" className="text-destructive text-xs underline">
                                                Lock period
                                            </button>
                                        </form>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">Locked</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {fiscalYears.length === 0 && <Empty>No fiscal years set up.</Empty>}
            </Panel>

            <Panel title="Posted journal entries">
                <div className="space-y-3">
                    {entries.map((entry) => (
                        <article key={entry.id} className="rounded border p-3">
                            <header className="flex flex-wrap justify-between gap-2">
                                <div>
                                    <h3 className="font-medium">
                                        {entry.document_number} · {entry.journal.code}
                                    </h3>
                                    <p className="text-muted-foreground text-sm">
                                        {entry.entry_date} · {entry.description}
                                        {entry.reference ? ` · Ref ${entry.reference}` : ''}
                                        {entry.reversal_of_id !== null && ' · Reversal entry'}
                                        {entry.reversal && ` · Reversed by ${entry.reversal.document_number}`}
                                    </p>
                                </div>
                                <div className="text-right text-sm">
                                    <p>
                                        {entry.currency_code} at {entry.exchange_rate}
                                    </p>
                                    <p className="font-medium">
                                        {company.default_currency} {entry.debit_total}
                                    </p>
                                </div>
                            </header>
                            {entry.reversal_of_id === null && entry.reversal === null && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm(`Post a reversing entry for ${entry.document_number} dated today?`)) {
                                            router.post(route('erp.accounting.entries.reverse', entry.id), {
                                                reversal_date: localDate(new Date()),
                                            });
                                        }
                                    }}
                                    className="text-destructive mt-2 text-xs underline"
                                >
                                    Reverse this entry
                                </button>
                            )}
                            <div className="mt-3 overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="text-muted-foreground border-b">
                                            <th className="py-1">Account</th>
                                            <th className="py-1">Memo</th>
                                            <th className="py-1 text-right">Debit</th>
                                            <th className="py-1 text-right">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entry.lines.map((line) => (
                                            <tr key={line.id} className="border-b last:border-0">
                                                <td className="py-1">
                                                    {line.account.code} — {line.account.name}
                                                </td>
                                                <td className="py-1">{line.description}</td>
                                                <td className="py-1 text-right">{line.debit}</td>
                                                <td className="py-1 text-right">{line.credit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </article>
                    ))}
                    {entries.length === 0 && <Empty>No journal entries posted yet.</Empty>}
                </div>
            </Panel>
        </main>
    );
}

function updateLine<T extends object>(lines: T[], index: number, key: keyof T, value: string, update: (lines: T[]) => void) {
    update(lines.map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line)));
}

function titleCase(value: string) {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function localDate(date: Date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3 rounded-md border p-4">
            <h2 className="text-lg font-medium">{title}</h2>
            {children}
        </section>
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
            <input
                required={required}
                min={type === 'number' ? '0' : undefined}
                step={type === 'number' ? '0.0001' : undefined}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="bg-background rounded-md border px-3 py-2"
            />
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
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <select value={value} onChange={(event) => onChange(event.target.value)} className="bg-background rounded-md border px-3 py-2">
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {error && <ErrorText>{error}</ErrorText>}
        </label>
    );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
            {label}
        </label>
    );
}

function SubmitButton({ processing, children }: { processing: boolean; children: ReactNode }) {
    return (
        <button
            type="submit"
            disabled={processing}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
            {children}
        </button>
    );
}

function ErrorText({ children }: { children: ReactNode }) {
    return <span className="text-destructive text-sm">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
    return <p className="text-muted-foreground py-2 text-sm">{children}</p>;
}
