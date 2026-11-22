import { Field, Select, TextInput, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

/** Moves money between two accounts: a debit on one statement, a credit on the other. */
export function TransferDialog({
    open,
    onClose,
    accounts,
    fromAccountId,
}: {
    open: boolean;
    onClose: () => void;
    accounts: { id: number; label: string; company: string }[];
    fromAccountId?: number;
}) {
    const form = useForm({
        from_account_id: fromAccountId ? String(fromAccountId) : '',
        to_account_id: '',
        transfer_date: new Date().toISOString().slice(0, 10),
        amount: '',
        description: '',
        reference: '',
    });
    const options = accounts.map((a) => ({ value: String(a.id), label: `${a.label} (${a.company})` }));

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.banking.transfers.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onClose();
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && !form.processing && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Transfer between accounts</DialogTitle>
                        <DialogDescription>The amount is debited from one statement and credited to the other on the same date.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {fromAccountId === undefined && (
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
                        <Field label="Date" error={form.errors.transfer_date}>
                            <TextInput type="date" value={form.data.transfer_date} onChange={(v) => form.setData('transfer_date', v)} required />
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
                            Transfer
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
