import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Product = { id: number; sku: string; name: string; type: string; tracking: string; unit: { abbreviation: string } };
type OrderLine = {
    id: number;
    product_id: number;
    quantity: string;
    received_quantity: string;
    unit_price: string;
    line_total: string;
    product: { sku: string; name: string; tracking: string; unit: { abbreviation: string } };
};
type ReceiptLine = {
    id: number;
    purchase_order_line_id: number;
    quantity: string;
    stock_move_id: number;
    purchaseOrderLine: OrderLine;
};
type Vendor = { id: number; code: string; name: string; email: string | null };
type Journal = { id: number; code: string; name: string };
type Account = { id: number; code: string; name: string; currency_code: string | null };
type Currency = { code: string; name: string };
type Order = {
    id: number;
    document_number: string;
    vendor: Vendor;
    currency_code: string;
    total: string;
    lines: OrderLine[];
};
type Receipt = {
    id: number;
    document_number: string;
    received_at: string;
    lines: ReceiptLine[];
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    order: Order;
    receipt: Receipt;
    currencies: Currency[];
    journals: Journal[];
    accounts: Account[];
};

export default function CreateBill({ company, order, receipt, currencies, journals, accounts }: Props) {
    const form = useForm({
        currency_code: order.currency_code,
        vendor_reference: '',
        bill_date: new Date().toISOString().split('T')[0],
        due_date: '',
        journal_id: journals[0]?.id.toString() ?? '',
        account_id: '',
        lines: receipt.lines.map((rl) => ({
            purchase_order_line_id: rl.purchase_order_line_id.toString(),
            product_id: rl.purchaseOrderLine.product_id.toString(),
            name: rl.purchaseOrderLine.product.name,
            account_code: '',
            quantity: rl.quantity,
            unit_price: rl.purchaseOrderLine.unit_price,
            tax_rate: '0',
        })),
    });

    const errors = form.errors as Record<string, string>;

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(route('erp.purchase.orders.bills.store', [order.id, receipt.id]));
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{company.code}</p>
                <h1 className="text-2xl font-semibold">Create vendor bill</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Create a bill from PO <strong>{order.document_number}</strong> and receipt <strong>{receipt.document_number}</strong> for {order.vendor.name}.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                <section className="space-y-3 rounded-md border p-4">
                    <h2 className="text-lg font-medium">Bill details</h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <SelectField
                            label="Currency"
                            value={form.data.currency_code}
                            options={currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
                            onChange={(value) => form.setData('currency_code', value)}
                            error={errors.currency_code}
                        />
                        <TextField
                            label="Vendor reference"
                            value={form.data.vendor_reference}
                            onChange={(value) => form.setData('vendor_reference', value)}
                            error={errors.vendor_reference}
                        />
                        <TextField
                            label="Bill date"
                            type="date"
                            value={form.data.bill_date}
                            onChange={(value) => form.setData('bill_date', value)}
                            error={errors.bill_date}
                            required
                        />
                        <TextField
                            label="Due date"
                            type="date"
                            value={form.data.due_date}
                            onChange={(value) => form.setData('due_date', value)}
                            error={errors.due_date}
                        />
                        <SelectField
                            label="Purchase journal"
                            value={form.data.journal_id}
                            options={journals.map((j) => ({ value: j.id.toString(), label: `${j.code} — ${j.name}` }))}
                            onChange={(value) => form.setData('journal_id', value)}
                            error={errors.journal_id}
                        />
                        <SelectField
                            label="Payable account (optional)"
                            value={form.data.account_id}
                            options={[
                                { value: '', label: 'Auto-select from vendor/journal' },
                                ...accounts.map((a) => ({ value: a.id.toString(), label: `${a.code} — ${a.name}` })),
                            ]}
                            onChange={(value) => form.setData('account_id', value)}
                            error={errors.account_id}
                        />
                    </div>
                </section>

                <section className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium">Bill lines (three-way matched)</h2>
                        <span className="text-muted-foreground text-sm">
                            Quantities default to received qty; prices default to PO prices.
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b">
                                    <th className="py-2">Product</th>
                                    <th className="py-2">PO Qty</th>
                                    <th className="py-2">Received</th>
                                    <th className="py-2">Bill Qty</th>
                                    <th className="py-2">PO Price</th>
                                    <th className="py-2">Bill Price</th>
                                    <th className="py-2">Tax %</th>
                                    <th className="py-2">Account</th>
                                    <th className="py-2">Line total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.data.lines.map((line, index) => {
                                    const poLine = order.lines.find((ol) => ol.id === Number(line.purchase_order_line_id));
                                    const receiptLine = receipt.lines.find((rl) => rl.purchase_order_line_id === Number(line.purchase_order_line_id));
                                    return (
                                        <tr key={index} className="border-b">
                                            <td className="py-2">
                                                <input type="hidden" name={`lines.${index}.purchase_order_line_id`} value={line.purchase_order_line_id} />
                                                <input type="hidden" name={`lines.${index}.product_id`} value={line.product_id} />
                                                <p className="font-medium">{line.name}</p>
                                            </td>
                                            <td className="py-2 text-muted-foreground">{poLine?.quantity}</td>
                                            <td className="py-2 text-muted-foreground">{receiptLine?.quantity}</td>
                                            <td className="py-2">
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    min="0"
                                                    name={`lines.${index}.quantity`}
                                                    value={line.quantity}
                                                    onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                                    className="w-24 bg-background rounded-md border px-2 py-1"
                                                />
                                                {errors[`lines.${index}.quantity`] && <ErrorText>{errors[`lines.${index}.quantity`]}</ErrorText>}
                                            </td>
                                            <td className="py-2 text-muted-foreground">{poLine?.unit_price}</td>
                                            <td className="py-2">
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    min="0"
                                                    name={`lines.${index}.unit_price`}
                                                    value={line.unit_price}
                                                    onChange={(e) => updateLine(index, 'unit_price', e.target.value)}
                                                    className="w-28 bg-background rounded-md border px-2 py-1"
                                                />
                                                {errors[`lines.${index}.unit_price`] && <ErrorText>{errors[`lines.${index}.unit_price`]}</ErrorText>}
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    name={`lines.${index}.tax_rate`}
                                                    value={line.tax_rate}
                                                    onChange={(e) => updateLine(index, 'tax_rate', e.target.value)}
                                                    className="w-20 bg-background rounded-md border px-2 py-1"
                                                />
                                                {errors[`lines.${index}.tax_rate`] && <ErrorText>{errors[`lines.${index}.tax_rate`]}</ErrorText>}
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    name={`lines.${index}.account_code`}
                                                    value={line.account_code}
                                                    onChange={(e) => updateLine(index, 'account_code', e.target.value)}
                                                    className="w-32 bg-background rounded-md border px-2 py-1"
                                                    placeholder="Account code"
                                                />
                                                {errors[`lines.${index}.account_code`] && <ErrorText>{errors[`lines.${index}.account_code`]}</ErrorText>}
                                            </td>
                                            <td className="py-2 font-medium">
                                                {calculateLineTotal(line.quantity, line.unit_price, line.tax_rate)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="font-semibold border-t">
                                    <td colSpan={8} className="py-2 text-right">Total</td>
                                    <td className="py-2">{calculateGrandTotal()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {errors.lines && <ErrorText>{errors.lines}</ErrorText>}
                </section>

                <div className="flex justify-end gap-3">
                    <a href={route('erp.purchase.index')} className="text-primary underline">
                        Cancel
                    </a>
                    <button type="submit" disabled={form.processing} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
                        {form.processing ? 'Creating…' : 'Create vendor bill'}
                    </button>
                </div>
            </form>
        </main>
    );

    function updateLine(index: number, key: string, value: string) {
        form.setData('lines', form.data.lines.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
    }

    function calculateLineTotal(qty: string, price: string, taxRate: string): string {
        const q = parseFloat(qty) || 0;
        const p = parseFloat(price) || 0;
        const t = parseFloat(taxRate) || 0;
        const subtotal = q * p;
        const tax = subtotal * (t / 100);
        return (subtotal + tax).toFixed(4);
    }

    function calculateGrandTotal(): string {
        return form.data.lines.reduce((sum, line) => {
            const q = parseFloat(line.quantity) || 0;
            const p = parseFloat(line.unit_price) || 0;
            const t = parseFloat(line.tax_rate) || 0;
            return sum + q * p * (1 + t / 100);
        }, 0).toFixed(4);
    }
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