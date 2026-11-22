import { balanceClass, money, shortDate } from '@/components/banking/money';
import { TransferDialog } from '@/components/banking/transfer-dialog';
import { ActionButton, RecordActions, useConfirmDelete } from '@/components/erp/record-actions';
import { Card, Empty, Field, Page, Select, StatusBadge, TextArea, TextInput, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from '@inertiajs/react';
import { ArrowLeftRight, FileUp, Landmark, LayoutDashboard, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Account = {
    id: number;
    account_number: string;
    source_account_number: string | null;
    account_name: string;
    currency: string;
    status: string;
    notes: string | null;
    bank: string;
    company: { id: number; code: string; name: string };
    opening_balance: number;
    opening_date: string | null;
    lines: number;
    balance: number;
    last_date: string | null;
    can_manage: boolean;
};

type Transfer = {
    id: number;
    date: string;
    amount: number;
    description: string | null;
    reference: string | null;
    from: string;
    to: string;
    by: string | null;
    can_delete: boolean;
};

type Props = {
    accounts: Account[];
    transfers: Transfer[];
    companies: { id: number; code: string; name: string; default_currency: string | null }[];
    banks: string[];
    nextAccountNumber: string;
    canManage: boolean;
    savedSignatureUrl: string | null;
};

export default function BankingIndex(props: Props) {
    const { askDelete, deleteDialog } = useConfirmDelete();
    const [accountDialog, setAccountDialog] = useState<Account | 'new' | null>(null);
    const [transferOpen, setTransferOpen] = useState(false);

    const groups = useMemo(() => {
        const map = new Map<number, { company: Account['company']; accounts: Account[] }>();
        props.accounts.forEach((account) => {
            const group = map.get(account.company.id) ?? { company: account.company, accounts: [] };
            group.accounts.push(account);
            map.set(account.company.id, group);
        });
        return [...map.values()].sort((a, b) => a.company.name.localeCompare(b.company.name));
    }, [props.accounts]);

    const totals = useMemo(() => {
        const byCurrency = new Map<string, number>();
        props.accounts.forEach((a) => byCurrency.set(a.currency, (byCurrency.get(a.currency) ?? 0) + a.balance));
        return [...byCurrency.entries()];
    }, [props.accounts]);

    return (
        <Page
            title="Banking"
            subtitle={`${props.accounts.length} account(s) across ${groups.length} compan${groups.length === 1 ? 'y' : 'ies'}`}
            actions={
                <>
                    <a href={route('erp.banking.dashboard')} className={secondaryButton}>
                        <LayoutDashboard className="mr-1.5 size-4" /> Dashboard
                    </a>
                    <a href={route('erp.banking.fund-requests.index')} className={secondaryButton}>
                        <ShieldCheck className="mr-1.5 size-4" /> Fund requests
                    </a>
                    {props.canManage && (
                        <>
                            <a href={route('erp.banking.imports.index')} className={secondaryButton}>
                                <FileUp className="mr-1.5 size-4" /> Import statements
                            </a>
                            <button
                                type="button"
                                className={secondaryButton}
                                onClick={() => setTransferOpen(true)}
                                disabled={props.accounts.length < 2}
                            >
                                <ArrowLeftRight className="mr-1.5 size-4" /> Move funds
                            </button>
                            <button type="button" className={primaryButton} onClick={() => setAccountDialog('new')}>
                                <Plus className="mr-1.5 size-4" /> Open account
                            </button>
                        </>
                    )}
                </>
            }
        >
            <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Accounts" value={String(props.accounts.length)} />
                <Stat label="Statement lines" value={props.accounts.reduce((sum, a) => sum + a.lines, 0).toLocaleString()} />
                <Stat
                    label="Combined balance"
                    value={totals.length === 0 ? '0.00' : totals.map(([currency, cents]) => `${currency} ${money(cents)}`).join(' · ')}
                />
            </div>

            {groups.length === 0 ? (
                <Empty>No bank accounts yet. {props.canManage && 'Import a statement workbook or open an account to start.'}</Empty>
            ) : (
                groups.map((group) => (
                    <Card
                        key={group.company.id}
                        title={
                            <span className="flex items-center gap-2">
                                <Landmark className="text-primary size-5" /> {group.company.name}
                                <span className="text-muted-foreground text-xs font-normal">{group.company.code}</span>
                            </span>
                        }
                    >
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-left">
                                    <tr>
                                        <th className="px-4 py-2.5 font-medium">Account</th>
                                        <th className="px-4 py-2.5 font-medium">Bank</th>
                                        <th className="px-4 py-2.5 text-right font-medium">Lines</th>
                                        <th className="px-4 py-2.5 font-medium">Last activity</th>
                                        <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                                        <th className="px-4 py-2.5 font-medium">Status</th>
                                        <th className="px-4 py-2.5" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.accounts.map((account) => (
                                        <tr key={account.id} className="hover:bg-muted/30 border-t">
                                            <td className="px-4 py-2.5">
                                                <a href={route('erp.banking.accounts.show', account.id)} className="font-medium hover:underline">
                                                    {account.account_number} · {account.account_name}
                                                </a>
                                                {account.source_account_number && account.source_account_number !== account.account_number && (
                                                    <div className="text-muted-foreground text-xs">
                                                        No. on source statement: {account.source_account_number}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">{account.bank}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums">{account.lines.toLocaleString()}</td>
                                            <td className="px-4 py-2.5">{shortDate(account.last_date ?? account.opening_date)}</td>
                                            <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${balanceClass(account.balance)}`}>
                                                {account.currency} {money(account.balance)}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <StatusBadge value={account.status} label={account.status === 'active' ? 'Active' : 'Closed'} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <RecordActions
                                                    viewHref={route('erp.banking.accounts.show', account.id)}
                                                    onDelete={
                                                        account.can_manage && account.lines === 0
                                                            ? () =>
                                                                  askDelete({
                                                                      url: route('erp.banking.accounts.destroy', account.id),
                                                                      title: `Delete account ${account.account_number}?`,
                                                                      description: 'Only an account with no lines can be deleted.',
                                                                  })
                                                            : undefined
                                                    }
                                                />
                                                {account.can_manage && (
                                                    <span className="ml-1 inline-block">
                                                        <ActionButton
                                                            icon={Pencil}
                                                            label="Edit"
                                                            tone="edit"
                                                            onClick={() => setAccountDialog(account)}
                                                        />
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ))
            )}

            {props.transfers.length > 0 && (
                <Card title="Recent transfers">
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left">
                                <tr>
                                    <th className="px-4 py-2.5 font-medium">Date</th>
                                    <th className="px-4 py-2.5 font-medium">From</th>
                                    <th className="px-4 py-2.5 font-medium">To</th>
                                    <th className="px-4 py-2.5 font-medium">Description</th>
                                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                                    <th className="px-4 py-2.5" />
                                </tr>
                            </thead>
                            <tbody>
                                {props.transfers.map((transfer) => (
                                    <tr key={transfer.id} className="border-t">
                                        <td className="px-4 py-2.5">{shortDate(transfer.date)}</td>
                                        <td className="px-4 py-2.5">{transfer.from}</td>
                                        <td className="px-4 py-2.5">{transfer.to}</td>
                                        <td className="px-4 py-2.5">
                                            {transfer.description ?? '—'}
                                            {transfer.reference && <span className="text-muted-foreground"> · {transfer.reference}</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(transfer.amount)}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            {transfer.can_delete && (
                                                <ActionButton
                                                    icon={Trash2}
                                                    label="Delete"
                                                    tone="delete"
                                                    onClick={() =>
                                                        askDelete({
                                                            url: route('erp.banking.transfers.destroy', transfer.id),
                                                            title: 'Delete this transfer?',
                                                            description:
                                                                'Both sides are removed: the debit on the sending account and the credit on the receiving one.',
                                                        })
                                                    }
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {accountDialog && (
                <AccountDialog
                    account={accountDialog === 'new' ? null : accountDialog}
                    companies={props.companies}
                    banks={props.banks}
                    nextAccountNumber={props.nextAccountNumber}
                    onClose={() => setAccountDialog(null)}
                />
            )}
            <TransferDialog
                open={transferOpen}
                onClose={() => setTransferOpen(false)}
                accounts={props.accounts
                    .filter((a) => a.can_manage && a.status === 'active')
                    .map((a) => ({
                        id: a.id,
                        label: `${a.account_number} · ${a.account_name}`,
                        company: a.company.name,
                        company_id: a.company.id,
                        currency: a.currency,
                    }))}
                savedSignatureUrl={props.savedSignatureUrl}
            />
            {deleteDialog}
        </Page>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-card/70 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
        </div>
    );
}

function AccountDialog({
    account,
    companies,
    banks,
    nextAccountNumber,
    onClose,
}: {
    account: Account | null;
    companies: Props['companies'];
    banks: string[];
    nextAccountNumber: string;
    onClose: () => void;
}) {
    const form = useForm({
        company_id: account ? String(account.company.id) : String(companies[0]?.id ?? ''),
        bank_name: account?.bank ?? banks[0] ?? '',
        account_name: account?.account_name ?? '',
        account_number: account?.account_number ?? '',
        currency: account?.currency ?? companies[0]?.default_currency ?? 'USD',
        opening_balance: account ? (account.opening_balance / 100).toFixed(2) : '0.00',
        opening_date: account?.opening_date ?? new Date().toISOString().slice(0, 10),
        status: account?.status ?? 'active',
        notes: account?.notes ?? '',
    });
    const locked = account !== null && account.lines > 0;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        if (account) {
            form.put(route('erp.banking.accounts.update', account.id), options);
        } else {
            form.post(route('erp.banking.accounts.store'), options);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && !form.processing && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{account ? `Edit account ${account.account_number}` : 'Open a bank account'}</DialogTitle>
                        <DialogDescription>
                            {locked
                                ? 'This account has statement lines, so its opening balance stays as it is.'
                                : 'The opening balance is where the statement starts.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {!account && (
                            <>
                                <Field label="Company" error={form.errors.company_id} className="sm:col-span-2">
                                    <Select
                                        value={form.data.company_id}
                                        onChange={(v) => form.setData('company_id', v)}
                                        options={companies.map((c) => ({ value: String(c.id), label: c.name }))}
                                    />
                                </Field>
                                <Field label="Bank" error={form.errors.bank_name}>
                                    <TextInput value={form.data.bank_name} onChange={(v) => form.setData('bank_name', v)} required />
                                </Field>
                                <Field label="Account number" error={form.errors.account_number}>
                                    <TextInput
                                        value={form.data.account_number}
                                        onChange={(v) => form.setData('account_number', v)}
                                        placeholder={`Next free: ${nextAccountNumber}`}
                                    />
                                </Field>
                            </>
                        )}
                        <Field label="Account name" error={form.errors.account_name} className="sm:col-span-2">
                            <TextInput value={form.data.account_name} onChange={(v) => form.setData('account_name', v)} required />
                        </Field>
                        <Field label="Currency" error={form.errors.currency}>
                            <TextInput value={form.data.currency} onChange={(v) => form.setData('currency', v.toUpperCase())} required />
                        </Field>
                        {account && (
                            <Field label="Status" error={form.errors.status}>
                                <Select
                                    value={form.data.status}
                                    onChange={(v) => form.setData('status', v)}
                                    options={{ active: 'Active', closed: 'Closed' }}
                                />
                            </Field>
                        )}
                        {!locked && (
                            <>
                                <Field label="Opening balance" error={form.errors.opening_balance}>
                                    <TextInput
                                        type="number"
                                        step="0.01"
                                        value={form.data.opening_balance}
                                        onChange={(v) => form.setData('opening_balance', v)}
                                    />
                                </Field>
                                <Field label="Opening date" error={form.errors.opening_date}>
                                    <TextInput type="date" value={form.data.opening_date} onChange={(v) => form.setData('opening_date', v)} />
                                </Field>
                            </>
                        )}
                        <Field label="Notes" error={form.errors.notes} className="sm:col-span-2">
                            <TextArea value={form.data.notes} onChange={(v) => form.setData('notes', v)} rows={2} />
                        </Field>
                    </div>
                    <DialogFooter className="gap-2">
                        <button type="button" className={secondaryButton} onClick={onClose} disabled={form.processing}>
                            Cancel
                        </button>
                        <button type="submit" className={primaryButton} disabled={form.processing}>
                            {account ? 'Save' : 'Open account'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
