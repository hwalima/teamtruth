import { balanceClass, money, shortDate } from '@/components/banking/money';
import { TransferDialog, type TransferAccount } from '@/components/banking/transfer-dialog';
import { ActionButton, useConfirmDelete } from '@/components/erp/record-actions';
import { Card, Field, Page, Select, TextInput, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { router, useForm } from '@inertiajs/react';
import { ArrowLeftRight, CheckCheck, FileDown, FileSpreadsheet, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Line = {
    id: number;
    date: string;
    type: string | null;
    description: string | null;
    reference: string | null;
    debit: number;
    credit: number;
    balance: number;
    stated_balance: number | null;
    source: string | null;
    kind: 'imported' | 'manual' | 'transfer';
};

type Difference = { date: string; description: string | null; source: string; stated_balance: number; balance: number; difference: number };

type Props = {
    account: {
        id: number;
        account_number: string;
        source_account_number: string | null;
        account_name: string;
        currency: string;
        status: string;
        bank: string;
        company: { id: number; code: string; name: string };
        opening_balance: number;
        opening_date: string | null;
    };
    statement: {
        from: string;
        to: string;
        opening: number;
        lines: Line[];
        debits: number;
        credits: number;
        closing: number;
        count: number;
        differences: Difference[];
    };
    filters: { from?: string; to?: string };
    canManage: boolean;
    transferAccounts: TransferAccount[];
    savedSignatureUrl: string | null;
};

export default function BankStatement({ account, statement, filters, canManage, transferAccounts, savedSignatureUrl }: Props) {
    const { askDelete, deleteDialog } = useConfirmDelete();
    const [lineOpen, setLineOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [period, setPeriod] = useState({ from: filters.from ?? statement.from, to: filters.to ?? statement.to });
    const query = filters.from || filters.to ? { from: statement.from, to: statement.to } : {};

    const apply = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('erp.banking.accounts.show', account.id), period, { preserveScroll: true });
    };

    return (
        <Page
            title={`${account.account_name} · ${account.account_number}`}
            subtitle={
                <>
                    {account.bank} · held by {account.company.name} · {account.currency}
                    {account.source_account_number && account.source_account_number !== account.account_number && (
                        <> · number on source statement {account.source_account_number}</>
                    )}
                    {account.status !== 'active' && <> · closed</>}
                </>
            }
            actions={
                <>
                    <a href={route('erp.banking.index')} className={secondaryButton}>
                        All accounts
                    </a>
                    <a href={route('erp.banking.reconcile.show', account.id)} className={secondaryButton}>
                        <CheckCheck className="mr-1.5 size-4" /> Reconcile
                    </a>
                    <div className="inline-flex overflow-hidden rounded-xl border shadow-sm" role="group" aria-label="Download statement">
                        <a
                            href={route('erp.banking.accounts.statement', { account: account.id, format: 'pdf', ...query })}
                            className="bg-background hover:bg-muted inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium"
                            title="Branded statement to print or send"
                        >
                            <FileDown className="text-primary size-4" /> PDF
                        </a>
                        <a
                            href={route('erp.banking.accounts.statement', { account: account.id, format: 'xlsx', ...query })}
                            className="bg-background hover:bg-muted inline-flex h-10 items-center gap-1.5 border-l px-3 text-sm font-medium"
                            title="Statement with numbers you can add up"
                        >
                            <FileSpreadsheet className="text-primary size-4" /> Excel
                        </a>
                    </div>
                    {canManage && account.status === 'active' && (
                        <>
                            <button
                                type="button"
                                className={secondaryButton}
                                onClick={() => setTransferOpen(true)}
                                disabled={transferAccounts.length === 0}
                            >
                                <ArrowLeftRight className="mr-1.5 size-4" /> Move funds
                            </button>
                            <button type="button" className={primaryButton} onClick={() => setLineOpen(true)}>
                                <Plus className="mr-1.5 size-4" /> Record transaction
                            </button>
                        </>
                    )}
                </>
            }
        >
            <Card>
                <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
                    <Field label="From">
                        <TextInput type="date" value={period.from} onChange={(v) => setPeriod({ ...period, from: v })} />
                    </Field>
                    <Field label="To">
                        <TextInput type="date" value={period.to} onChange={(v) => setPeriod({ ...period, to: v })} />
                    </Field>
                    <button type="submit" className={primaryButton}>
                        Show period
                    </button>
                    <a href={route('erp.banking.accounts.show', account.id)} className={secondaryButton}>
                        Full history
                    </a>
                </form>
            </Card>

            <div className="grid gap-3 sm:grid-cols-4">
                <Stat label={`Opening · ${shortDate(statement.from)}`} value={money(statement.opening)} negative={statement.opening < 0} />
                <Stat label="Total credits" value={money(statement.credits)} />
                <Stat label="Total debits" value={money(statement.debits)} />
                <Stat label={`Closing · ${shortDate(statement.to)}`} value={money(statement.closing)} negative={statement.closing < 0} />
            </div>

            <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left">
                        <tr>
                            <th className="px-3 py-2.5 font-medium">Date</th>
                            <th className="px-3 py-2.5 font-medium">Txn type</th>
                            <th className="px-3 py-2.5 font-medium">Description</th>
                            <th className="px-3 py-2.5 font-medium">Ref no.</th>
                            <th className="px-3 py-2.5 text-right font-medium">Debit</th>
                            <th className="px-3 py-2.5 text-right font-medium">Credit</th>
                            <th className="px-3 py-2.5 text-right font-medium">Balance</th>
                            {canManage && <th className="px-3 py-2.5" />}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-muted/30 border-t font-medium">
                            <td className="px-3 py-2">{shortDate(statement.from)}</td>
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2">Balance brought forward</td>
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2" />
                            <td className={`px-3 py-2 text-right tabular-nums ${balanceClass(statement.opening)}`}>{money(statement.opening)}</td>
                            {canManage && <td />}
                        </tr>
                        {statement.lines.length === 0 && (
                            <tr className="border-t">
                                <td colSpan={canManage ? 8 : 7} className="text-muted-foreground px-3 py-8 text-center">
                                    No transactions in this period.
                                </td>
                            </tr>
                        )}
                        {statement.lines.map((line) => {
                            const differs = line.stated_balance !== null && line.stated_balance !== line.balance;
                            return (
                                <tr key={line.id} className="hover:bg-muted/20 border-t">
                                    <td className="px-3 py-2 whitespace-nowrap">{shortDate(line.date)}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{line.type}</td>
                                    <td className="px-3 py-2">
                                        {line.description}
                                        {line.kind === 'transfer' && (
                                            <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium">
                                                Transfer
                                            </span>
                                        )}
                                        {line.kind === 'manual' && (
                                            <span className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium">
                                                Entered here
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">{line.reference}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{line.debit !== 0 ? money(line.debit) : ''}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{line.credit !== 0 ? money(line.credit) : ''}</td>
                                    <td className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${balanceClass(line.balance)}`}>
                                        {differs && (
                                            <span title={`The source statement shows ${money(line.stated_balance)} here (${line.source})`}>
                                                <TriangleAlert
                                                    className="mr-1 inline size-3.5 text-amber-500"
                                                    aria-label="Balance differs from the source"
                                                />
                                            </span>
                                        )}
                                        {money(line.balance)}
                                    </td>
                                    {canManage && (
                                        <td className="px-3 py-2 text-right">
                                            {line.kind === 'manual' && (
                                                <ActionButton
                                                    icon={Trash2}
                                                    label="Delete"
                                                    tone="delete"
                                                    onClick={() =>
                                                        askDelete({
                                                            url: route('erp.banking.transactions.destroy', line.id),
                                                            title: 'Delete this line?',
                                                            description: `${line.description ?? line.type ?? 'Line'} on ${shortDate(line.date)} for ${money(line.debit || line.credit)}.`,
                                                        })
                                                    }
                                                />
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        <tr className="bg-muted/30 border-t font-semibold">
                            <td className="px-3 py-2">{shortDate(statement.to)}</td>
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2">Totals and closing balance · {statement.count.toLocaleString()} transaction(s)</td>
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 text-right tabular-nums">{money(statement.debits)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{money(statement.credits)}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${balanceClass(statement.closing)}`}>{money(statement.closing)}</td>
                            {canManage && <td />}
                        </tr>
                    </tbody>
                </table>
            </div>

            {statement.differences.length > 0 && (
                <Card
                    title={
                        <span className="flex items-center gap-2">
                            <TriangleAlert className="size-5 text-amber-500" /> Reconciliation note
                        </span>
                    }
                >
                    <p className="text-muted-foreground text-sm">
                        On {statement.differences.length} line(s) the source statement printed a balance that does not follow from the amounts. The
                        statement above works each balance out from the opening balance, credits and debits; no amount was changed.
                    </p>
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Date</th>
                                    <th className="px-3 py-2 font-medium">Description</th>
                                    <th className="px-3 py-2 font-medium">Source</th>
                                    <th className="px-3 py-2 text-right font-medium">Balance on source</th>
                                    <th className="px-3 py-2 text-right font-medium">Correct balance</th>
                                    <th className="px-3 py-2 text-right font-medium">Difference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statement.differences.map((d, i) => (
                                    <tr key={i} className="border-t">
                                        <td className="px-3 py-2">{shortDate(d.date)}</td>
                                        <td className="px-3 py-2">{d.description}</td>
                                        <td className="text-muted-foreground px-3 py-2">{d.source}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{money(d.stated_balance)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{money(d.balance)}</td>
                                        <td className="px-3 py-2 text-right font-medium tabular-nums">{money(d.difference)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {lineOpen && <LineDialog accountId={account.id} onClose={() => setLineOpen(false)} />}
            <TransferDialog
                open={transferOpen}
                onClose={() => setTransferOpen(false)}
                accounts={transferAccounts}
                fromAccount={{
                    id: account.id,
                    label: `${account.account_number} · ${account.account_name}`,
                    company: account.company.name,
                    company_id: account.company.id,
                    currency: account.currency,
                }}
                savedSignatureUrl={savedSignatureUrl}
            />
            {deleteDialog}
        </Page>
    );
}

function Stat({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
    return (
        <div className="bg-card/70 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">{label}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${negative ? 'text-rose-600 dark:text-rose-400' : ''}`}>{value}</div>
        </div>
    );
}

function LineDialog({ accountId, onClose }: { accountId: number; onClose: () => void }) {
    const form = useForm({
        direction: 'credit',
        transaction_date: new Date().toISOString().slice(0, 10),
        amount: '',
        type: '',
        description: '',
        reference: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.banking.transactions.store', accountId), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && !form.processing && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Record a transaction</DialogTitle>
                        <DialogDescription>A deposit is a credit on the statement; a withdrawal is a debit.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Kind" error={form.errors.direction}>
                            <Select
                                value={form.data.direction}
                                onChange={(v) => form.setData('direction', v)}
                                options={{ credit: 'Deposit (credit)', debit: 'Withdrawal (debit)' }}
                            />
                        </Field>
                        <Field label="Date" error={form.errors.transaction_date}>
                            <TextInput
                                type="date"
                                value={form.data.transaction_date}
                                onChange={(v) => form.setData('transaction_date', v)}
                                required
                            />
                        </Field>
                        <Field label="Amount" error={form.errors.amount}>
                            <TextInput
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={form.data.amount}
                                onChange={(v) => form.setData('amount', v)}
                                required
                            />
                        </Field>
                        <Field label="Txn type" error={form.errors.type}>
                            <TextInput
                                value={form.data.type}
                                onChange={(v) => form.setData('type', v)}
                                placeholder={form.data.direction === 'credit' ? 'Cash Dep' : 'Cash Wdl'}
                            />
                        </Field>
                        <Field label="Description" error={form.errors.description}>
                            <TextInput value={form.data.description} onChange={(v) => form.setData('description', v)} />
                        </Field>
                        <Field label="Reference" error={form.errors.reference}>
                            <TextInput value={form.data.reference} onChange={(v) => form.setData('reference', v)} />
                        </Field>
                    </div>
                    <DialogFooter className="gap-2">
                        <button type="button" className={secondaryButton} onClick={onClose} disabled={form.processing}>
                            Cancel
                        </button>
                        <button type="submit" className={primaryButton} disabled={form.processing}>
                            Record
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
