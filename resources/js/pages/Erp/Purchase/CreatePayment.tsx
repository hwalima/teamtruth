import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Vendor = { id: number; code: string; name: string; email: string | null };
type Bill = {
    id: number;
    document_number: string;
    currency_code: string;
    total_amount: string;
    amount_paid: string;
    amount_residual: string;
    due_date: string | null;
    vendor: { id: number; code: string; name: string };
};
type Currency = { code: string; name: string };
type Journal = { id: number; code: string; name: string };
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    vendors: Vendor[];
    bills: Bill[];
    currencies: Currency[];
    journals: Journal[];
};

export default function CreatePayment({ company, vendors, bills, currencies, journals }: Props) {
    const form = useForm({
        vendor_id: vendors[0]?.id.toString() ?? '',
        journal_id: journals[0]?.id.toString() ?? '',
        payment_method: 'bank_transfer',
        currency_code: company.default_currency,
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        reference: '',
        allocations: [] as Array<{
            purchase_bill_id: string;
            amount: string;
            exchange_rate_gain_loss: string;
        }>,
    });

    const errors = form.errors as Record<string, string>;
    const selectedVendorBills = bills.filter((b) => b.vendor_id === Number(form.data.vendor_id));

    const handleVendorChange = (value: string) => {
        form.setData('vendor_id', value);
        // Reset allocations when vendor changes
        form.setData('allocations', selectedVendorBills.slice(0, 1).map((bill) => ({
            purchase_bill_id: bill.id.toString(),
            amount: bill.amount_residual,
            exchange_rate_gain_loss: '0.0000',
        })));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(route('erp.purchase.payments.store'));
    };

    const addAllocation = () => {
        const unallocatedBills = selectedVendorBills.filter(
            (bill) => !form.data.allocations.some((a) => a.purchase_bill_id === bill.id.toString())
        );
        if (unallocatedBills.length > 0) {
            form.setData('allocations', [
                ...form.data.allocations,
                { purchase_bill_id: unallocatedBills[0].id.toString(), amount: unallocatedBills[0].amount_residual, exchange_rate_gain_loss: '0.0000' },
            ]);
        }
    };

    const removeAllocation = (index: number) => {
        form.setData('allocations', form.data.allocations.filter((_, i) => i !== index));
    };

    const updateAllocation = (index: number, key: string, value: string) => {
        form.setData('allocations', form.data.allocations.map((a, i) => (i === index ? { ...a, [key]: value } : a)));
    };

    const totalAllocated = form.data.allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    const paymentAmount = parseFloat(form.data.amount) || 0;
    const allocationMatch = Math.abs(totalAllocated - paymentAmount) < 0.0001;

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{company.code}</p>
                <h1 className="text-2xl font-semibold">Create vendor payment</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Record a payment to a vendor and allocate it to outstanding bills.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                <section className="space-y-3 rounded-md border p-4">
                    <h2 className="text-lg font-medium">Payment details</h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <SelectField
                            label="Vendor"
                            value={form.data.vendor_id}
                            options={vendors.map((v) => ({ value: v.id.toString(), label: `${v.code} — ${v.name}` }))}
                            onChange={handleVendorChange}
                            error={errors.vendor_id}
                            required
                        />
                        <SelectField
                            label="Journal"
                            value={form.data.journal_id}
                            options={journals.map((j) => ({ value: j.id.toString(), label: `${j.code} — ${j.name}` }))}
                            onChange={(value) => form.setData('journal_id', value)}
                            error={errors.journal_id}
                            required
                        />
                        <TextField
                            label="Payment method"
                            value={form.data.payment_method}
                            onChange={(value) => form.setData('payment_method', value)}
                            error={errors.payment_method}
                            required
                        />
                        <SelectField
                            label="Currency"
                            value={form.data.currency_code}
                            options={currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
                            onChange={(value) => form.setData('currency_code', value)}
                            error={errors.currency_code}
                            required
                        />
                        <TextField
                            label="Amount"
                            type="number"
                            step="0.0001"
                            min="0"
                            value={form.data.amount}
                            onChange={(value) => form.setData('amount', value)}
                            error={errors.amount}
                            required
                        />
                        <TextField
                            label="Payment date"
                            type="date"
                            value={form.data.payment_date}
                            onChange={(value) => form.setData('payment_date', value)}
                            error={errors.payment_date}
                            required
                        />
                        <TextField
                            label="Reference"
                            value={form.data.reference}
                            onChange={(value) => form.setData('reference', value)}
                            error={errors.reference}
                        />
                    </div>
                </section>

                <section className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium">Bill allocations</h2>
                        <button
                            type="button"
                            onClick={addAllocation}
                            disabled={selectedVendorBills.length === 0 || form.data.allocations.length >= selectedVendorBills.length}
                            className="text-primary text-sm underline disabled:opacity-50"
                        >
                            Add bill
                        </button>
                    </div>

                    {selectedVendorBills.length === 0 && (
                        <p className="text-muted-foreground text-sm">Select a vendor to see their outstanding bills.</p>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b">
                                    <th className="py-2">Bill</th>
                                    <th className="py-2">Currency</th>
                                    <th className="py-2">Total</th>
                                    <th className="py-2">Residual</th>
                                    <th className="py-2">Allocate</th>
                                    <th className="py-2">FX Gain/Loss</th>
                                    <th className="py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.data.allocations.map((allocation, index) => {
                                    const bill = selectedVendorBills.find((b) => b.id.toString() === allocation.purchase_bill_id);
                                    return (
                                        <tr key={index} className="border-b">
                                            <td className="py-2">
                                                <input type="hidden" name={`allocations.${index}.purchase_bill_id`} value={allocation.purchase_bill_id} />
                                                {bill?.document_number}
                                            </td>
                                            <td className="py-2 text-muted-foreground">{bill?.currency_code}</td>
                                            <td className="py-2 text-muted-foreground">{bill?.total_amount}</td>
                                            <td className="py-2 text-muted-foreground">{bill?.amount_residual}</td>
                                            <td className="py-2">
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    min="0"
                                                    max={parseFloat(bill?.amount_residual ?? '0')}
                                                    name={`allocations.${index}.amount`}
                                                    value={allocation.amount}
                                                    onChange={(e) => updateAllocation(index, 'amount', e.target.value)}
                                                    className="w-28 bg-background rounded-md border px-2 py-1"
                                                />
                                                {errors[`allocations.${index}.amount`] && <ErrorText>{errors[`allocations.${index}.amount`]}</ErrorText>}
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    name={`allocations.${index}.exchange_rate_gain_loss`}
                                                    value={allocation.exchange_rate_gain_loss}
                                                    onChange={(e) => updateAllocation(index, 'exchange_rate_gain_loss', e.target.value)}
                                                    className="w-28 bg-background rounded-md border px-2 py-1"
                                                    placeholder="0.0000"
                                                />
                                            </td>
                                            <td className="py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => removeAllocation(index)}
                                                    disabled={form.data.allocations.length <= 1}
                                                    className="text-destructive underline disabled:opacity-40"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className={`mt-3 text-sm ${allocationMatch ? 'text-muted-foreground' : 'text-destructive'}`}>
                        Total allocated: <strong>{totalAllocated.toFixed(4)}</strong> {form.data.currency_code} · Payment amount: <strong>{paymentAmount.toFixed(4)}</strong> {form.data.currency_code}
                        {!allocationMatch && ' — Amounts must match!'}
                    </div>
                    {errors.allocations && <ErrorText>{errors.allocations}</ErrorText>}
                </section>

                <div className="flex justify-end gap-3">
                    <a href={route('erp.purchase.index')} className="text-primary underline">
                        Cancel
                    </a>
                    <button
                        type="submit"
                        disabled={form.processing || !allocationMatch}
                        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                        {form.processing ? 'Creating…' : 'Create payment'}
                    </button>
                </div>
            </form>
        </main>
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
            {label} {required && <span className="text-destructive">*</span>}
            <input
                required={required}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
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
    required = false,
}: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
    error?: string;
    required?: boolean;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label} {required && <span className="text-destructive">*</span>}
            <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-background rounded-md border px-3 py-2">
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <ErrorText>{error}</ErrorText>}
        </label>
    );
}

function ErrorText({ children }: { children: React.ReactNode }) {
    return <span className="text-destructive text-sm">{children}</span>;
}