import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Customer = { id: number; code: string; name: string; currency_code: string; payment_term_id: number | null; payment_term: { id: number; name: string; net_days: number; discount_days: number | null; discount_percent: number | null } | null };
type PaymentTerm = { id: number; name: string; net_days: number; discount_days: number | null; discount_percent: number | null };
type Product = { id: number; sku: string; name: string; unit_id: number | null; unit: { abbreviation: string } | null; type: string };
type Account = { id: number; code: string; name: string };
type Journal = { id: number; code: string; name: string };
type Currency = { code: string; name: string };
type Line = {
    id: number;
    product_id: number | null;
    account_id: number | null;
    name: string;
    description: string | null;
    quantity: string;
    unit: string;
    unit_price: string;
    discount_percent: string;
    tax_rate: string;
    sort_order: number;
};
type Invoice = {
    id: number;
    document_number: string;
    type: string;
    invoice_date: string;
    due_date: string;
    currency_code: string;
    journal_id: number | null;
    notes: string | null;
    terms: string | null;
    footer_notes: string | null;
    status: string;
    customer: Customer;
    lines: Line[];
};
type Company = { id: number; code: string; name: string; default_currency: string };
type Props = {
    company: Company;
    invoice: Invoice;
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

export default function InvoicingEdit(props: Props) {
    const { invoice } = props;
    const form = useForm({
        customer_id: invoice.customer_id.toString(),
        type: invoice.type,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        currency_code: invoice.currency_code,
        journal_id: invoice.journal_id?.toString() ?? '',
        notes: invoice.notes ?? '',
        terms: invoice.terms ?? '',
        footer_notes: invoice.footer_notes ?? '',
        lines: invoice.lines.map((line) => ({
            product_id: line.product_id?.toString() ?? null,
            account_id: line.account_id?.toString() ?? null,
            name: line.name,
            description: line.description ?? '',
            quantity: line.quantity,
            unit: line.unit,
            unit_price: line.unit_price,
            discount_percent: line.discount_percent,
            tax_rate: line.tax_rate,
            sort_order: line.sort_order,
        })),
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

    // Initialize due date if empty
    if (!form.data.due_date && paymentTerm) {
        calculateDueDate();
    }

    // Disable editing if invoice is not in draft status
    const isEditable = invoice.status === 'draft';

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">Edit Invoice</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Editing {invoice.document_number} ({invoice.type})
                </p>
            </header>

            {!isEditable && (
                <div className="border-yellow-200 bg-yellow-50 text-yellow-800 rounded-xl border p-4 dark:bg-yellow-900/20 dark:text-yellow-200">
                    <p className="font-medium">This invoice is not in draft status and cannot be edited.</p>
                    <p className="text-sm mt-1">Only draft invoices can be modified. Current status: {invoice.status.replaceAll('_', ' ')}</p>
                </div>
            )}

            <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                form.put(route('erp.invoicing.update', invoice.id), {
                    onSuccess: () => router.visit(route('erp.invoicing.show', invoice.id)),
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
                                    disabled={!isEditable}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                    disabled={!isEditable}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                    disabled={!isEditable}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                    disabled={!isEditable}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                    disabled={!isEditable}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                    disabled={!isEditable}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                    disabled={!isEditable}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 resize-none disabled:opacity-50 disabled:pointer-events-none"
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
                                    disabled={!isEditable}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 resize-none disabled:opacity-50 disabled:pointer-events-none"
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
                                    disabled={!isEditable}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 resize-none disabled:opacity-50 disabled:pointer-events-none"
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
                        {isEditable && (
                            <button
                                type="button"
                                disabled={form.data.lines.length >= 50}
                                onClick={() => form.setData('lines', [...form.data.lines, blankLine(form.data.lines.length)])}
                                className="text-primary text-sm underline disabled:opacity-50"
                            >
                                Add Line
                            </button>
                        )}
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
                                        value={line.product_id ?? (line.account_id ? `account_${line.account_id}` : '')}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value.startsWith('account_')) {
                                                form.setData('lines', form.data.lines.map((l, i) =>
                                                    i === index ? { ...l, product_id: null, account_id: value.replace('account_', '') } : l
                                                ));
                                            } else {
                                                form.setData('lines', form.data.lines.map((l, i) =>
                                                    i === index ? { ...l, product_id: value || null, account_id: null } : l
                                                ));
                                                if (value) updateLineFromProduct(index, value);
                                            }
                                        }}
                                        disabled={!isEditable}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                        disabled={!isEditable}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                        disabled={!isEditable}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                        disabled={!isEditable}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
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
                                        disabled={!isEditable}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4 disabled:opacity-50 disabled:pointer-events-none"
                                    />
                                </div>

                                {isEditable && (
                                    <button
                                        type="button"
                                        disabled={form.data.lines.length <= 1}
                                        onClick={() => form.setData('lines', form.data.lines.filter((_, i) => i !== index))}
                                        className="text-destructive self-end pb-2 text-sm underline disabled:opacity-40"
                                    >
                                        Remove
                                    </button>
                                )}
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
                        href={route('erp.invoicing.show', invoice.id)}
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </a>
                    {isEditable && (
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                        >
                            {form.processing ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                </div>
            </form>
        </main>
    );
}