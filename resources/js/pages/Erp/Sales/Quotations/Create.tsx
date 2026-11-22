import { money } from '@/components/erp/sales';
import { Card, Field, inputClass, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { Link, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { route } from 'ziggy-js';

type Customer = { id: number; code: string; name: string; currency_code: string | null };
type Opportunity = { id: number; title: string; customer_id: number | null };
type Product = { id: number; sku: string; name: string; description: string | null; sale_price: string | null; unit: { abbreviation: string } | null };
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    customers: Customer[];
    opportunities: Opportunity[];
    products: Product[];
    currencies: { code: string; name: string }[];
    defaults: { opportunity_id: number | null; valid_until: string };
    /** Set when editing a draft; the form then saves over it. */
    quotation: {
        id: number;
        document_number: string;
        customer_id: number;
        opportunity_id: number | null;
        currency_code: string;
        valid_until: string | null;
        notes: string | null;
        terms: string | null;
        lines: { product_id: number | null; description: string; quantity: string; unit_price: string; discount: string; tax_rate: string; notes: string | null }[];
    } | null;
};

type Line = { product_id: string; description: string; quantity: string; unit_price: string; discount: string; tax_rate: string; notes: string };

const blankLine = (): Line => ({ product_id: '', description: '', quantity: '1', unit_price: '0', discount: '0', tax_rate: '0', notes: '' });

const num = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** Same sums as the server: discount is a percentage of qty × price, tax is charged on the discounted amount. */
function lineAmounts(line: Line) {
    const gross = num(line.quantity) * num(line.unit_price);
    const discount = (gross * num(line.discount)) / 100;
    const net = gross - discount;
    const tax = (net * num(line.tax_rate)) / 100;
    return { gross, discount, net, tax, total: net + tax };
}

/** Small caption above a line field on phones; the column headings take over on wide screens. */
function LineField({ label, error, className = '', children }: { label: string; error?: string; className?: string; children: ReactNode }) {
    return (
        <label className={`grid min-w-0 content-start gap-1 text-sm ${className}`}>
            <span className="text-muted-foreground text-xs md:sr-only">{label}</span>
            {children}
            {error && <span className="text-destructive text-xs">{error}</span>}
        </label>
    );
}

export default function QuotationCreate({ company, customers, opportunities, products, currencies, defaults, quotation }: Props) {
    const preset = opportunities.find((opportunity) => opportunity.id === defaults.opportunity_id);
    const presetCustomer = customers.find((customer) => customer.id === preset?.customer_id);
    const form = useForm(
        quotation
            ? {
                  customer_id: String(quotation.customer_id),
                  opportunity_id: quotation.opportunity_id ? String(quotation.opportunity_id) : '',
                  currency_code: quotation.currency_code,
                  valid_until: quotation.valid_until ?? '',
                  notes: quotation.notes ?? '',
                  terms: quotation.terms ?? '',
                  lines: quotation.lines.length
                      ? quotation.lines.map((line) => ({
                            ...line,
                            product_id: line.product_id ? String(line.product_id) : '',
                            notes: line.notes ?? '',
                        }))
                      : [blankLine()],
              }
            : {
                  customer_id: presetCustomer ? String(presetCustomer.id) : '',
                  opportunity_id: preset ? String(preset.id) : '',
                  currency_code: presetCustomer?.currency_code || company.default_currency,
                  valid_until: defaults.valid_until,
                  notes: '',
                  terms: '',
                  lines: [blankLine()],
              },
    );
    const backHref = quotation ? route('erp.sales.quotations.show', quotation.id) : route('erp.sales.quotations.index');
    const errors = form.errors as Record<string, string | undefined>;

    const customerOpportunities = opportunities.filter(
        (opportunity) => !form.data.customer_id || opportunity.customer_id === null || String(opportunity.customer_id) === form.data.customer_id,
    );

    const chooseCustomer = (id: string) => {
        const customer = customers.find((candidate) => String(candidate.id) === id);
        const keepOpportunity = opportunities.some(
            (opportunity) => String(opportunity.id) === form.data.opportunity_id && (opportunity.customer_id === null || String(opportunity.customer_id) === id),
        );
        form.setData((data) => ({
            ...data,
            customer_id: id,
            currency_code: customer?.currency_code || data.currency_code,
            opportunity_id: keepOpportunity ? data.opportunity_id : '',
        }));
    };

    const setLine = (index: number, patch: Partial<Line>) =>
        form.setData('lines', form.data.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

    const chooseProduct = (index: number, id: string) => {
        const product = products.find((candidate) => String(candidate.id) === id);
        const current = form.data.lines[index];
        const previous = products.find((candidate) => String(candidate.id) === current.product_id);
        // Fill the description and price from the product, unless the user has already typed their own.
        const ownDescription = current.description !== '' && current.description !== previous?.name;
        const ownPrice = num(current.unit_price) !== 0 && num(current.unit_price) !== num(previous?.sale_price ?? '0');
        setLine(index, {
            product_id: id,
            description: product && !ownDescription ? product.name : current.description,
            unit_price: product && !ownPrice ? String(num(product.sale_price ?? '0')) : current.unit_price,
        });
    };

    const removeLine = (index: number) => form.setData('lines', form.data.lines.filter((_, i) => i !== index));

    const totals = form.data.lines.reduce(
        (sum, line) => {
            const amounts = lineAmounts(line);
            return { discount: sum.discount + amounts.discount, net: sum.net + amounts.net, tax: sum.tax + amounts.tax, total: sum.total + amounts.total };
        },
        { discount: 0, net: 0, tax: 0, total: 0 },
    );

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            opportunity_id: data.opportunity_id || null,
            valid_until: data.valid_until || null,
            lines: data.lines.map((line, index) => ({ ...line, product_id: line.product_id || null, notes: line.notes || null, sort_order: index + 1 })),
        }));
        if (quotation) {
            form.put(route('erp.sales.quotations.update', quotation.id));
        } else {
            form.post(route('erp.sales.quotations.store'));
        }
    };

    const lineGrid =
        'grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.7fr)_5.5rem_7rem_5rem_5rem_7.5rem_2.5rem] md:items-start';

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header>
                <p className="text-muted-foreground text-sm">
                    <Link href={route('erp.sales.index')} className="hover:underline">
                        Sales
                    </Link>{' '}
                    ·{' '}
                    <Link href={route('erp.sales.quotations.index')} className="hover:underline">
                        Quotations
                    </Link>
                    {quotation && (
                        <>
                            {' '}
                            ·{' '}
                            <Link href={backHref} className="hover:underline">
                                {quotation.document_number}
                            </Link>
                        </>
                    )}
                </p>
                <h1 className="text-2xl font-semibold">{quotation ? `Edit ${quotation.document_number}` : 'New quotation'}</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    {quotation
                        ? 'Change anything while it is a draft. Once submitted it is locked; duplicate it to make a new version.'
                        : 'It is saved as a draft. Submit it for approval before you send it to the customer.'}
                </p>
            </header>

            <form onSubmit={submit} className="space-y-6">
                <Card title="Customer">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="Customer" error={errors.customer_id} className="sm:col-span-2">
                            <select value={form.data.customer_id} onChange={(e) => chooseCustomer(e.target.value)} className={inputClass} required>
                                <option value="">Select a customer</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.name} ({customer.code})
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Currency" error={errors.currency_code}>
                            <select value={form.data.currency_code} onChange={(e) => form.setData('currency_code', e.target.value)} className={inputClass} required>
                                {currencies.map((currency) => (
                                    <option key={currency.code} value={currency.code}>
                                        {currency.code} · {currency.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Valid until" error={errors.valid_until}>
                            <input type="date" value={form.data.valid_until} onChange={(e) => form.setData('valid_until', e.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Opportunity (optional)" error={errors.opportunity_id} className="sm:col-span-2">
                            <select value={form.data.opportunity_id} onChange={(e) => form.setData('opportunity_id', e.target.value)} className={inputClass}>
                                <option value="">None</option>
                                {customerOpportunities.map((opportunity) => (
                                    <option key={opportunity.id} value={opportunity.id}>
                                        {opportunity.title}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                </Card>

                <Card
                    title="Lines"
                    actions={
                        <button type="button" onClick={() => form.setData('lines', [...form.data.lines, blankLine()])} className={`${secondaryButton} gap-2`}>
                            <Plus className="size-4" /> Add line
                        </button>
                    }
                >
                    {errors.lines && <p className="text-destructive text-sm">{errors.lines}</p>}
                    <div className={`${lineGrid} text-muted-foreground hidden text-xs font-medium tracking-wide uppercase md:grid`} aria-hidden>
                        <span>Product</span>
                        <span>Description</span>
                        <span className="text-right">Qty</span>
                        <span className="text-right">Unit price</span>
                        <span className="text-right">Disc. %</span>
                        <span className="text-right">Tax %</span>
                        <span className="text-right">Amount</span>
                        <span />
                    </div>
                    <ol className="space-y-3">
                        {form.data.lines.map((line, index) => {
                            const amounts = lineAmounts(line);
                            const error = (field: string) => errors[`lines.${index}.${field}`];
                            const unit = products.find((product) => String(product.id) === line.product_id)?.unit?.abbreviation;
                            return (
                                <li key={index} className="border-border/60 rounded-xl border p-3 md:border-0 md:p-0">
                                    <div className={lineGrid}>
                                        <LineField label="Product" error={error('product_id')} className="col-span-2 sm:col-span-2 md:col-span-1">
                                            <select value={line.product_id} onChange={(e) => chooseProduct(index, e.target.value)} className={inputClass}>
                                                <option value="">No product (service or other)</option>
                                                {products.map((product) => (
                                                    <option key={product.id} value={product.id}>
                                                        {product.name} · {product.sku}
                                                    </option>
                                                ))}
                                            </select>
                                        </LineField>
                                        <LineField label="Description" error={error('description')} className="col-span-2 sm:col-span-2 md:col-span-1">
                                            <input
                                                value={line.description}
                                                onChange={(e) => setLine(index, { description: e.target.value })}
                                                className={inputClass}
                                                placeholder="What you are quoting for"
                                                maxLength={255}
                                                required
                                            />
                                        </LineField>
                                        <LineField label={unit ? `Qty (${unit})` : 'Qty'} error={error('quantity')}>
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={line.quantity}
                                                onChange={(e) => setLine(index, { quantity: e.target.value })}
                                                className={`${inputClass} text-right`}
                                                required
                                            />
                                        </LineField>
                                        <LineField label="Unit price" error={error('unit_price')}>
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={line.unit_price}
                                                onChange={(e) => setLine(index, { unit_price: e.target.value })}
                                                className={`${inputClass} text-right`}
                                                required
                                            />
                                        </LineField>
                                        <LineField label="Disc. %" error={error('discount')}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="any"
                                                value={line.discount}
                                                onChange={(e) => setLine(index, { discount: e.target.value })}
                                                className={`${inputClass} text-right`}
                                            />
                                        </LineField>
                                        <LineField label="Tax %" error={error('tax_rate')}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="any"
                                                value={line.tax_rate}
                                                onChange={(e) => setLine(index, { tax_rate: e.target.value })}
                                                className={`${inputClass} text-right`}
                                            />
                                        </LineField>
                                        <div className="col-span-1 grid content-start gap-1 text-sm sm:col-span-3 md:col-span-1">
                                            <span className="text-muted-foreground text-xs md:sr-only">Amount</span>
                                            <span className="py-2.5 font-medium tabular-nums md:text-right">{money(form.data.currency_code, amounts.total)}</span>
                                        </div>
                                        <div className="flex items-end justify-end md:items-start">
                                            <button
                                                type="button"
                                                onClick={() => removeLine(index)}
                                                disabled={form.data.lines.length === 1}
                                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex size-10 items-center justify-center rounded-xl disabled:opacity-30"
                                                aria-label={`Remove line ${index + 1}`}
                                                title="Remove line"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>

                    <dl className="ml-auto grid w-full max-w-xs gap-1.5 border-t pt-4 text-sm">
                        {totals.discount > 0 && (
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">Discount</dt>
                                <dd className="tabular-nums">- {money(form.data.currency_code, totals.discount)}</dd>
                            </div>
                        )}
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Subtotal</dt>
                            <dd className="tabular-nums">{money(form.data.currency_code, totals.net)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Tax</dt>
                            <dd className="tabular-nums">{money(form.data.currency_code, totals.tax)}</dd>
                        </div>
                        <div className="flex justify-between gap-4 text-base font-semibold">
                            <dt>Total</dt>
                            <dd className="tabular-nums">{money(form.data.currency_code, totals.total)}</dd>
                        </div>
                    </dl>
                </Card>

                <Card title="Notes and terms">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Notes for the customer (optional)" error={errors.notes}>
                            <textarea rows={4} value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} className={inputClass} maxLength={5000} />
                        </Field>
                        <Field label="Terms (optional)" error={errors.terms}>
                            <textarea
                                rows={4}
                                value={form.data.terms}
                                onChange={(e) => form.setData('terms', e.target.value)}
                                className={inputClass}
                                maxLength={5000}
                                placeholder="For example: 50% deposit with order, balance on delivery."
                            />
                        </Field>
                    </div>
                </Card>

                <div className="flex flex-wrap justify-end gap-2">
                    <Link href={backHref} className={secondaryButton}>
                        {quotation ? 'Discard changes' : 'Cancel'}
                    </Link>
                    <button type="submit" className={primaryButton} disabled={form.processing}>
                        {form.processing ? 'Saving…' : quotation ? 'Save changes' : 'Save draft quotation'}
                    </button>
                </div>
            </form>
        </main>
    );
}
