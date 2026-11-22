import { SignaturePad } from '@/components/banking/signature-pad';
import { Field, Select, TextArea, TextInput, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

export type TransferAccount = { id: number; label: string; company: string; company_id: number; currency?: string };

/**
 * Moves money between accounts. Within one company the transfer is made at
 * once. To another company it becomes a fund request that the paying
 * company's manager must approve and sign first.
 */
export function TransferDialog({
    open,
    onClose,
    accounts,
    fromAccount,
    savedSignatureUrl,
}: {
    open: boolean;
    onClose: () => void;
    accounts: TransferAccount[];
    fromAccount?: TransferAccount;
    savedSignatureUrl?: string | null;
}) {
    const form = useForm({
        from_account_id: fromAccount ? String(fromAccount.id) : '',
        to_account_id: '',
        transfer_date: new Date().toISOString().slice(0, 10),
        amount: '',
        description: '',
        reference: '',
        purpose: '',
        signature: null as string | null,
    });
    const all = fromAccount ? [fromAccount, ...accounts.filter((a) => a.id !== fromAccount.id)] : accounts;
    const from = all.find((a) => String(a.id) === form.data.from_account_id);
    const to = all.find((a) => String(a.id) === form.data.to_account_id);
    const needsApproval = Boolean(from && to && from.company_id !== to.company_id);
    const options = all.map((a) => ({ value: String(a.id), label: `${a.label} (${a.company})` }));

    const close = () => {
        form.reset();
        form.clearErrors();
        onClose();
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (needsApproval) {
            form.transform((data) => ({
                from_account_id: data.from_account_id,
                to_account_id: data.to_account_id,
                amount: data.amount,
                purpose: data.purpose,
                signature: data.signature,
            }));
            form.post(route('erp.banking.fund-requests.store'), { onSuccess: close });
            return;
        }
        form.transform((data) => data);
        form.post(route('erp.banking.transfers.store'), { preserveScroll: true, onSuccess: close });
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && !form.processing && close()}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{needsApproval ? 'Request funds from another company' : 'Move funds'}</DialogTitle>
                        <DialogDescription>
                            {needsApproval
                                ? `${from?.company} must approve and sign before the money can move.`
                                : 'Within one company the transfer is made at once: a debit on one statement and a credit on the other.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {!fromAccount && (
                            <Field label="From account" error={form.errors.from_account_id} className="sm:col-span-2">
                                <Select
                                    value={form.data.from_account_id}
                                    onChange={(v) => form.setData('from_account_id', v)}
                                    options={options}
                                    placeholder="Choose…"
                                />
                            </Field>
                        )}
                        <Field label="To account" error={form.errors.to_account_id} className="sm:col-span-2">
                            <Select
                                value={form.data.to_account_id}
                                onChange={(v) => form.setData('to_account_id', v)}
                                options={options.filter((o) => o.value !== form.data.from_account_id)}
                                placeholder="Choose…"
                            />
                        </Field>
                        {fromAccount && form.errors.from_account_id && (
                            <p className="text-destructive text-xs sm:col-span-2">{form.errors.from_account_id}</p>
                        )}

                        {needsApproval && (
                            <div className="flex gap-3 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                                <span>
                                    {from?.company}'s manager gets an email and approves it under <strong>Fund requests</strong>. You are told when it
                                    is approved, and then you make the transfer to {to?.company}.
                                </span>
                            </div>
                        )}

                        <Field label={needsApproval ? `Amount${from?.currency ? ` (${from.currency})` : ''}` : 'Amount'} error={form.errors.amount}>
                            <TextInput
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={form.data.amount}
                                onChange={(v) => form.setData('amount', v)}
                                required
                            />
                        </Field>
                        {!needsApproval && (
                            <Field label="Date" error={form.errors.transfer_date}>
                                <TextInput type="date" value={form.data.transfer_date} onChange={(v) => form.setData('transfer_date', v)} required />
                            </Field>
                        )}

                        {needsApproval ? (
                            <>
                                <Field label="What is it for?" error={form.errors.purpose} className="sm:col-span-2">
                                    <TextArea value={form.data.purpose} onChange={(v) => form.setData('purpose', v)} rows={3} />
                                </Field>
                                <div className="grid gap-1.5 text-sm sm:col-span-2">
                                    <span className="text-foreground/85 font-medium">Your signature</span>
                                    <SignaturePad
                                        savedSignatureUrl={savedSignatureUrl}
                                        onChange={(value) => form.setData('signature', value)}
                                        error={form.errors.signature}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <Field label="Description" error={form.errors.description}>
                                    <TextInput value={form.data.description} onChange={(v) => form.setData('description', v)} />
                                </Field>
                                <Field label="Reference" error={form.errors.reference}>
                                    <TextInput value={form.data.reference} onChange={(v) => form.setData('reference', v)} />
                                </Field>
                            </>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <button type="button" className={secondaryButton} onClick={close} disabled={form.processing}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={primaryButton}
                            disabled={
                                form.processing ||
                                (needsApproval && !form.data.purpose.trim()) ||
                                (needsApproval && !form.data.signature && !savedSignatureUrl)
                            }
                        >
                            {needsApproval ? 'Sign and send for approval' : 'Transfer'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
