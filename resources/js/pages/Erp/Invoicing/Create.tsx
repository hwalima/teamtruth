import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Customer = { id: number; code: string; name: string; currency_code: string; payment_term_id: number | null; payment_term: { id: number; name: string; net_days: number; discount_days: number | null; discount_percent: number | null } | null };
type PaymentTerm = { id: number; name: string; net_days: number; discount_days: number | null; discount_percent: number | null };
type Product = { id: number; sku: string; name: string; unit_id: number | null; unit: { abbreviation: string } | null; type: string };
type Account = { id: number; code: string; name: string };
type Journal = { id: number; code: string; name: string };
type Currency = { code: string; name: string };
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    customers: Customer[];
    paymentTerms: PaymentTerm[];
    products: Product[];
    accounts: Account[];
    journals: Journal[];
    currencies: Currency[];
};

type LineInput = {
    product_id: string | null;
    account_id: string | null;
    name: string;
    description: string;
    quantity: string;
    unit: string;
    unit_price: string;
    discount_percent: string;
    tax_rate: string;
    sort_order: number;
};

const blankLine = (index: number): LineInput => ({
    product_id: null,
    account_id: null,
    name: '',
    description: '',
    quantity: '1',
    unit: '',
    unit_price: '0',
    discount_percent: '0',
    tax_rate: '0',
    sort_order: index + 1,
});

export default function InvoicingCreate(props: Props) {
    const form = useForm({
        customer_id: '',
        type: 'invoice',
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: '',
        currency_code: props.company.default_currency,
        journal_id: '',
        notes: '',
        terms: '',
        footer_notes: '',
        lines: [blankLine(0), blankLine(1)],
    });
    const errors = form.errors as Record<string, string>;

    const selectedCustomer = props.customers.find((c) => c.id.toString() === form.data.customer_id);
    const paymentTerm = selectedCustomer?.payment_term;

    // Auto-calculate due date when customer or invoice date changes
    const calculateDueDate = () => {
        if (paymentTerm && form.data.invoice_date) {
            const date = new Date(form.data.invoice_date);
            date.setDate(date.getDate() + paymentTerm.net_days);
            form.setData('due_date', date.toISOString().slice(0, 10));
        }
    };

    // Update line from product selection
    const updateLineFromProduct = (index: number, productId: string) => {
        const product = props.products.find((p) => p.id.toString() === productId);
        if (product) {
            form.setData('lines', form.data.lines.map((line, i) =>
                i === index
                    ? { ...line, name: product.name, unit: product.unit?.abbreviation ?? '', unit_price: '0' }
                    : line
            ));
        }
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">Create Invoice</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Create a new customer invoice or proforma invoice.
                </p>
            </header>

            <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                form.post(route('erp.invoicing.store'), {
                    onSuccess: () => router.visit(route('erp.invoicing.index')),
                });
            }} className="space-y-6">
                {/* Header Section */}
                <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                    <h2 className="text-lg font-medium">Invoice Details</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Type</span>
                                <select
                                    value={form.data.type}
                                    onChange={(e) => form.setData('type', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="invoice">Invoice</option>
                                    <option value="proforma">Proforma</option>
                                </select>
                                {errors.type && <span className="text-destructive text-sm">{errors.type}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Customer</span>
                                <select
                                    value={form.data.customer_id}
                                    onChange={(e) => {
                                        form.setData('customer_id', e.target.value);
                                        calculateDueDate();
                                    }}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">Select customer</option>
                                    {props.customers.map((customer) => (
                                        <option key={customer.id} value={customer.id.toString()}>
                                            {customer.code} — {customer.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.customer_id && <span className="text-destructive text-sm">{errors.customer_id}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Invoice Date</span>
                                <input
                                    type="date"
                                    value={form.data.invoice_date}
                                    onChange={(e) => {
                                        form.setData('invoice_date', e.target.value);
                                        calculateDueDate();
                                    }}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                {errors.invoice_date && <span className="text-destructive text-sm">{errors.invoice_date}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Due Date</span>
                                <input
                                    type="date"
                                    value={form.data.due_date}
                                    onChange={(e) => form.setData('due_date', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                {errors.due_date && <span className="text-destructive text-sm">{errors.due_date}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Currency</span>
                                <select
                                    value={form.data.currency_code}
                                    onChange={(e) => form.setData('currency_code', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    {props.currencies.map((currency) => (
                                        <option key={currency.code} value={currency.code}>
                                            {currency.code} — {currency.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.currency_code && <span className="text-destructive text-sm">{errors.currency_code}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Sales Journal</span>
                                <select
                                    value={form.data.journal_id}
                                    onChange={(e) => form.setData('journal_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">Select journal</option>
                                    {props.journals.map((journal) => (
                                        <option key={journal.id} value={journal.id.toString()}>
                                            {journal.code} — {journal.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.journal_id && <span className="text-destructive text-sm">{errors.journal_id}</span>}
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Notes (internal)</span>
                                <textarea
                                    value={form.data.notes}
                                    onChange={(e) => form.setData('notes', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 resize-none"
                                    placeholder="Internal notes not shown on PDF"
                                />
                                {errors.notes && <span className="text-destructive text-sm">{errors.notes}</span>}
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Terms & Conditions</span>
                                <textarea
                                    value={form.data.terms}
                                    onChange={(e) => form.setData('terms', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 resize-none"
                                    placeholder="Terms shown on PDF"
                                />
                                {errors.terms && <span className="text-destructive text-sm">{errors.terms}</span>}
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Footer Notes</span>
                                <textarea
                                    value={form.data.footer_notes}
                                    onChange={(e) => form.setData('footer_notes', e.target.value)}
                                    rows={2}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 resize-none"
                                    placeholder="Footer notes shown on PDF"
                                />
                                {errors.footer_notes && <span className="text-destructive text-sm">{errors.footer_notes}</span>}
                            </label>
                        </div>
                    </div>
                </section>

                {/* Lines Section */}
                <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                    <div className="flex flex-wrap justify-between gap-3 items-center">
                        <h2 className="text-lg font-medium">Invoice Lines</h2>
                        <button
                            type="button"
                            disabled={form.data.lines.length >= 50}
                            onClick={() => form.setData('lines', [...form.data.lines, blankLine(form.data.lines.length)])}
                            className="text-primary text-sm underline disabled:opacity-50"
                        >
                            Add Line
                        </button>
                    </div>

                    <div className="space-y-3">
                        {form.data.lines.map((line, index) => (
                            <div
                                key={index}
                                className="border-border/70 bg-background/35 grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"
                            >
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground/85">Product / Description</label>
                                    <select
                                        value={line.product_id ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            form.setData('lines', form.data.lines.map((l, i) =>
                                                i === index ? { ...l, product_id: value || null, account_id: null } : l
                                            ));
                                            if (value) updateLineFromProduct(index, value);
                                        }}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                                    >
                                        <option value="">Select product or enter manually</option>
                                        <optgroup label="Products">
                                            {props.products.map((product) => (
                                                <option key={product.id} value={product.id.toString()}>
                                                    {product.sku} — {product.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Accounts">
                                            {props.accounts.map((account) => (
                                                <option key={account.id} value={`account_${account.id}`}>
                                                    [{account.code}] {account.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    </select>
                                    {errors[`lines.${index}.product_id`] && <span className="text-destructive text-xs">{errors[`lines.${index}.product_id`]}</span>}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground/85">Qty</label>
                                    <input
                                        type="number"
                                        min="0.0001"
                                        step="0.0001"
                                        value={line.quantity}
                                        onChange={(e) => form.setData('lines', form.data.lines.map((l, i) => i === index ? { ...l, quantity: e.target.value } : l))}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                                        required
                                    />
                                    {errors[`lines.${index}.quantity`] && <span className="text-destructive text-xs">{errors[`lines.${index}.quantity`]}</span>}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground/85">Unit</label>
                                    <input
                                        type="text"
                                        value={line.unit}
                                        onChange={(e) => form.setData('lines', form.data.lines.map((l, i) => i === index ? { ...l, unit: e.target.value } : l))}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground/85">Unit Price</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        value={line.unit_price}
                                        onChange={(e) => form.setData('lines', form.data.lines.map((l, i) => i === index ? { ...l, unit_price: e.target.value } : l))}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                                        required
                                    />
                                    {errors[`lines.${index}.unit_price`] && <span className="text-destructive text-xs">{errors[`lines.${index}.unit_price`]}</span>}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-foreground/85">Discount %</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={line.discount_percent}
                                        onChange={(e) => form.setData('lines', form.data.lines.map((l, i) => i === index ? { ...l, discount_percent: e.target.value } : l))}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </div>

                                <button
                                    type="button"
                                    disabled={form.data.lines.length <= 1}
                                    onClick={() => form.setData('lines', form.data.lines.filter((_, i) => i !== index))}
                                    className="text-destructive self-end pb-2 text-sm underline disabled:opacity-40"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                        {errors.lines && <span className="text-destructive text-sm">{errors.lines}</span>}
                    </div>
                </section>

                {/* Totals Preview */}
                <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                    <h2 className="text-lg font-medium mb-4">Totals Preview</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="sm:col-span-2" />
                        <div className="space-y-2 text-right">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-medium">
                                    {form.data.currency_code} {Number(form.data.lines.reduce((sum, line) => {
                                        const qty = Number(line.quantity) || 0;
                                        const price = Number(line.unit_price) || 0;
                                        const discount = Number(line.discount_percent) || 0;
                                        return sum + (qty * price * (1 - discount / 100));
                                    }, 0)).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax (estimated)</span>
                                <span className="font-medium">
                                    {form.data.currency_code} {Number(form.data.lines.reduce((sum, line) => {
                                        const qty = Number(line.quantity) || 0;
                                        const price = Number(line.unit_price) || 0;
                                        const discount = Number(line.discount_percent) || 0;
                                        const tax = Number(line.tax_rate) || 0;
                                        const lineNet = qty * price * (1 - discount / 100);
                                        return sum + (lineNet * tax / 100);
                                    }, 0)).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-lg font-semibold border-t pt-2">
                                <span>Total</span>
                                <span>
                                    {form.data.currency_code} {Number(form.data.lines.reduce((sum, line) => {
                                        const qty = Number(line.quantity) || 0;
                                        const price = Number(line.unit_price) || 0;
                                        const discount = Number(line.discount_percent) || 0;
                                        const tax = Number(line.tax_rate) || 0;
                                        const lineNet = qty * price * (1 - discount / 100);
                                        return sum + lineNet + (lineNet * tax / 100);
                                    }, 0)).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Actions */}
                <div className="flex flex-wrap justify-end gap-3">
                    <a
                        href={route('erp.invoicing.index')}
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </a>
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                    >
                        {form.processing ? 'Creating...' : 'Create Invoice'}
                    </button>
                </div>
            </form>
        </main>
    );
}