import { router, useForm } from '@inertiajs/react';
import { BookOpenCheck, Building2, CalendarDays, ChartNoAxesCombined, CircleDollarSign, FilePlus2, Landmark } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
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
type TrialBalance = {
    asOf: string;
    rows: Array<{
        accountId: number;
        code: string;
        name: string;
        accountType: string;
        debit: string;
        credit: string;
    }>;
    totalDebit: string;
    totalCredit: string;
};
type GeneralLedger = {
    from: string;
    to: string;
    accountId: number | null;
    accounts: Array<{
        accountId: number;
        code: string;
        name: string;
        openingBalance: string;
        debitTotal: string;
        creditTotal: string;
        closingBalance: string;
        lines: Array<{
            date: string;
            documentNumber: string;
            journalCode: string;
            description: string;
            reference: string | null;
            debit: string;
            credit: string;
            balance: string;
        }>;
    }>;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    trialBalance: TrialBalance;
    generalLedger: GeneralLedger;
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

export default function AccountingIndex({ company, trialBalance, generalLedger, currencies, accounts, journals, fiscalYears, entries }: Props) {
    const [asOf, setAsOf] = useState(trialBalance.asOf);
    const [ledgerFrom, setLedgerFrom] = useState(generalLedger.from);
    const [ledgerTo, setLedgerTo] = useState(generalLedger.to);
    const [ledgerAccountId, setLedgerAccountId] = useState(generalLedger.accountId?.toString() ?? '');
    useEffect(() => setAsOf(trialBalance.asOf), [trialBalance.asOf]);
    useEffect(() => {
        setLedgerFrom(generalLedger.from);
        setLedgerTo(generalLedger.to);
        setLedgerAccountId(generalLedger.accountId?.toString() ?? '');
    }, [generalLedger]);
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
    const activeJournalCount = journals.filter((journal) => journal.is_active).length;
    const openPeriodCount = fiscalYears.flatMap((year) => year.periods).filter((period) => period.status === 'open').length;

    return (
        <main className="relative isolate mx-auto w-full max-w-[1500px] space-y-6 overflow-hidden p-4 sm:p-6 xl:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] overflow-hidden">
                <div className="bg-primary/15 absolute -top-32 left-1/4 h-80 w-80 rounded-full blur-3xl" />
                <div className="absolute top-20 -right-32 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
            </div>

            <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#001a4d] via-[#08275c] to-[#174079] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8">
                <div aria-hidden="true" className="bg-primary/20 absolute -top-24 right-10 h-64 w-64 rounded-full blur-3xl" />
                <div aria-hidden="true" className="absolute -right-20 -bottom-40 h-80 w-80 rounded-full bg-sky-300/10 blur-3xl" />
                <div className="relative">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-3xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
                                <Building2 className="text-primary h-3.5 w-3.5" />
                                {company.code} <span className="text-white/40">/</span> Finance workspace
                            </div>
                            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{company.name}</h1>
                            <p className="mt-2 text-lg font-medium text-white/90">Accounting</p>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                                Manage the chart of accounts, journals, fiscal periods, and company ledger from one place.
                            </p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm shadow-inner shadow-white/5 backdrop-blur-xl">
                            <CircleDollarSign className="text-primary h-5 w-5" />
                            <span className="text-white/65">Base currency</span>
                            <strong className="font-semibold">{company.default_currency}</strong>
                        </div>
                    </div>
                    <div className="mt-7 grid gap-3 sm:grid-cols-3">
                        <OverviewStat icon={<Landmark className="h-4 w-4" />} label="Ledger accounts" value={accounts.length} />
                        <OverviewStat icon={<BookOpenCheck className="h-4 w-4" />} label="Active journals" value={activeJournalCount} />
                        <OverviewStat icon={<CalendarDays className="h-4 w-4" />} label="Open periods" value={openPeriodCount} />
                    </div>
                </div>
            </header>

            <section className="grid gap-6 lg:grid-cols-3">
                <Panel title="Add account" icon={<Landmark className="h-4 w-4" />}>
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

                <Panel title="Add journal" icon={<BookOpenCheck className="h-4 w-4" />}>
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
                    <ul className="divide-border/70 divide-y">
                        {journals.map((journal) => (
                            <li key={journal.id} className="py-2.5 text-sm">
                                <strong>{journal.code}</strong> — {journal.name}{' '}
                                <span className="text-muted-foreground">({titleCase(journal.journal_type)})</span>
                            </li>
                        ))}
                        {journals.length === 0 && <Empty>Create a journal before posting entries.</Empty>}
                    </ul>
                </Panel>

                <Panel title="Fiscal year" icon={<CalendarDays className="h-4 w-4" />}>
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

            <section className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
                <Panel title="Post manual journal entry" icon={<FilePlus2 className="h-4 w-4" />}>
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
                                        className="border-border/70 bg-background/35 grid gap-2.5 rounded-xl border p-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]"
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

                <Panel title="Chart of accounts" icon={<Landmark className="h-4 w-4" />}>
                    <div className="divide-border/70 max-h-[36rem] divide-y overflow-y-auto">
                        {accounts.map((account) => (
                            <div key={account.id} className={`py-2.5 text-sm ${account.parent ? 'pl-5' : ''}`}>
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

            <Panel title="Trial balance" icon={<ChartNoAxesCombined className="h-4 w-4" />}>
                <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.get(
                            route('erp.accounting.index'),
                            {
                                as_of: asOf,
                                ledger_from: ledgerFrom,
                                ledger_to: ledgerTo,
                                ledger_account_id: ledgerAccountId || undefined,
                            },
                            { preserveState: true, preserveScroll: true },
                        );
                    }}
                >
                    <TextField label="As of" type="date" value={asOf} onChange={setAsOf} required />
                    <SubmitButton processing={false}>Run report</SubmitButton>
                </form>
                <div className="border-border/70 bg-background/25 overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-muted-foreground bg-muted/40 border-b">
                                <th className="px-3 py-3 font-medium">Account</th>
                                <th className="px-3 py-3 font-medium">Type</th>
                                <th className="px-3 py-3 text-right font-medium">Debit</th>
                                <th className="px-3 py-3 text-right font-medium">Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trialBalance.rows.map((row) => (
                                <tr key={row.accountId} className="border-border/60 hover:bg-muted/30 border-b transition-colors last:border-0">
                                    <td className="px-3 py-2.5">
                                        <strong>{row.code}</strong> — {row.name}
                                    </td>
                                    <td className="px-3 py-2.5">{titleCase(row.accountType)}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{row.debit}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums">{row.credit}</td>
                                </tr>
                            ))}
                            {trialBalance.rows.length > 0 && (
                                <tr className="bg-muted/30 border-t font-semibold">
                                    <td className="px-3 py-3" colSpan={2}>
                                        Total
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">{trialBalance.totalDebit}</td>
                                    <td className="px-3 py-3 text-right tabular-nums">{trialBalance.totalCredit}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {trialBalance.rows.length === 0 && <Empty>No account balances on or before {trialBalance.asOf}.</Empty>}
                {trialBalance.totalDebit !== trialBalance.totalCredit && (
                    <ErrorText>The trial balance is out of balance. Review posted journal entries before proceeding.</ErrorText>
                )}
            </Panel>

            <Panel title="General ledger" icon={<BookOpenCheck className="h-4 w-4" />}>
                <form
                    className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (ledgerTo < ledgerFrom) {
                            return;
                        }
                        router.get(
                            route('erp.accounting.index'),
                            {
                                as_of: asOf,
                                ledger_from: ledgerFrom,
                                ledger_to: ledgerTo,
                                ledger_account_id: ledgerAccountId || undefined,
                            },
                            { preserveState: true, preserveScroll: true },
                        );
                    }}
                >
                    <TextField label="From" type="date" value={ledgerFrom} onChange={setLedgerFrom} required />
                    <TextField
                        label="To"
                        type="date"
                        value={ledgerTo}
                        onChange={setLedgerTo}
                        error={ledgerTo < ledgerFrom ? 'End date must be on or after the start date.' : undefined}
                        required
                    />
                    <SelectField
                        label="Account"
                        value={ledgerAccountId}
                        options={[
                            { value: '', label: 'All accounts' },
                            ...accounts
                                .filter((account) => !account.is_group)
                                .map((account) => ({ value: account.id.toString(), label: `${account.code} — ${account.name}` })),
                        ]}
                        onChange={setLedgerAccountId}
                    />
                    <SubmitButton processing={false}>Run report</SubmitButton>
                </form>
                {generalLedger.accounts.map((account) => (
                    <section key={account.accountId} className="border-border/70 bg-background/25 space-y-3 rounded-xl border p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="font-medium">
                                {account.code} — {account.name}
                            </h3>
                            <p className="text-muted-foreground text-xs">
                                Opening {company.default_currency} {account.openingBalance} · Debits {account.debitTotal} · Credits{' '}
                                {account.creditTotal} · Closing {company.default_currency} {account.closingBalance}
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-xs">
                                <thead>
                                    <tr className="text-muted-foreground bg-muted/40 border-b">
                                        <th className="px-3 py-2.5 font-medium">Date</th>
                                        <th className="px-3 py-2.5 font-medium">Entry</th>
                                        <th className="px-3 py-2.5 font-medium">Description</th>
                                        <th className="px-3 py-2.5 text-right font-medium">Debit</th>
                                        <th className="px-3 py-2.5 text-right font-medium">Credit</th>
                                        <th className="px-3 py-2.5 text-right font-medium">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-border/60 bg-primary/5 border-b font-medium">
                                        <td className="px-3 py-2.5">{generalLedger.from}</td>
                                        <td className="px-3 py-2.5" colSpan={2}>
                                            Opening balance
                                        </td>
                                        <td className="px-3 py-2.5 text-right">—</td>
                                        <td className="px-3 py-2.5 text-right">—</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">{account.openingBalance}</td>
                                    </tr>
                                    {account.lines.map((line, index) => (
                                        <tr
                                            key={`${line.documentNumber}-${index}`}
                                            className="border-border/60 hover:bg-muted/30 border-b transition-colors last:border-0"
                                        >
                                            <td className="px-3 py-2.5">{line.date}</td>
                                            <td className="px-3 py-2.5 font-medium">
                                                {line.documentNumber} · {line.journalCode}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {line.description}
                                                {line.reference ? ` · Ref ${line.reference}` : ''}
                                            </td>
                                            <td className="px-3 py-2.5 text-right tabular-nums">{line.debit}</td>
                                            <td className="px-3 py-2.5 text-right tabular-nums">{line.credit}</td>
                                            <td className="px-3 py-2.5 text-right font-medium tabular-nums">{line.balance}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-muted/30 border-t font-semibold">
                                        <td className="px-3 py-2.5">{generalLedger.to}</td>
                                        <td className="px-3 py-2.5" colSpan={2}>
                                            Closing balance
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">{account.debitTotal}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">{account.creditTotal}</td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">{account.closingBalance}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))}
                {generalLedger.accounts.length === 0 && <Empty>No posted account activity in this date range.</Empty>}
            </Panel>

            <Panel title="Fiscal periods" icon={<CalendarDays className="h-4 w-4" />}>
                {fiscalYears.map((year) => (
                    <div key={year.id} className="border-border/70 space-y-3 border-b py-4 last:border-0">
                        <h3 className="font-semibold">
                            {year.name} · {year.starts_on} to {year.ends_on}
                        </h3>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {year.periods.map((period) => (
                                <div
                                    key={period.id}
                                    className="border-border/70 bg-background/35 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                                >
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

            <Panel title="Posted journal entries" icon={<BookOpenCheck className="h-4 w-4" />}>
                <div className="space-y-3">
                    {entries.map((entry) => (
                        <article
                            key={entry.id}
                            className="border-border/70 bg-background/30 hover:bg-background/50 rounded-2xl border p-4 transition-colors"
                        >
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
                                <table className="w-full min-w-[520px] text-left text-xs">
                                    <thead>
                                        <tr className="text-muted-foreground bg-muted/40 border-b">
                                            <th className="px-3 py-2.5 font-medium">Account</th>
                                            <th className="px-3 py-2.5 font-medium">Memo</th>
                                            <th className="px-3 py-2.5 text-right font-medium">Debit</th>
                                            <th className="px-3 py-2.5 text-right font-medium">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entry.lines.map((line) => (
                                            <tr key={line.id} className="border-border/60 border-b last:border-0">
                                                <td className="px-3 py-2.5">
                                                    {line.account.code} — {line.account.name}
                                                </td>
                                                <td className="px-3 py-2.5">{line.description}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums">{line.debit}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums">{line.credit}</td>
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

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
    return (
        <section className="bg-card/70 space-y-4 rounded-2xl border border-white/60 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl transition-shadow hover:shadow-[0_12px_40px_rgba(0,26,77,0.09)] sm:p-6 dark:border-white/10">
            <div className="flex items-center gap-3">
                <span className="bg-primary/15 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">{icon}</span>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            </div>
            {children}
        </section>
    );
}

function OverviewStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur-xl">
            <span className="text-primary flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">{icon}</span>
            <div>
                <p className="text-xs text-white/60">{label}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
            </div>
        </div>
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
        <label className="grid gap-1.5 text-sm">
            <span className="text-foreground/85 font-medium">{label}</span>
            <input
                required={required}
                min={type === 'number' ? '0' : undefined}
                step={type === 'number' ? '0.0001' : undefined}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
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
        <label className="grid gap-1.5 text-sm">
            <span className="text-foreground/85 font-medium">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
            >
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
        <label className="text-foreground/85 flex items-center gap-2.5 text-sm">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="border-input accent-primary focus:ring-primary h-4 w-4 rounded"
            />
            <span>{label}</span>
        </label>
    );
}

function SubmitButton({ processing, children }: { processing: boolean; children: ReactNode }) {
    return (
        <button
            type="submit"
            disabled={processing}
            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
        >
            {children}
        </button>
    );
}

function ErrorText({ children }: { children: ReactNode }) {
    return <span className="text-destructive text-sm">{children}</span>;
}

function Empty({ children }: { children: ReactNode }) {
    return (
        <p className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-5 text-sm leading-6">{children}</p>
    );
}
