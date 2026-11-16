import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type PaymentTerm = { id: number; name: string; net_days: number; discount_days: number | null; discount_percent: number | null };
type Currency = { code: string; name: string };
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    paymentTerms: PaymentTerm[];
    currencies: Currency[];
};

export default function CustomerCreate(props: Props) {
    const form = useForm({
        code: '',
        name: '',
        email: '',
        phone: '',
        tax_no: '',
        billing_address: '',
        shipping_address: '',
        currency_code: props.company.default_currency,
        payment_term_id: '',
        credit_limit: '0',
        is_active: true,
    });
    const errors = form.errors as Record<string, string>;

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">Add Customer</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Create a new customer for invoicing.
                </p>
            </header>

            <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                form.post(route('erp.invoicing.customers.store'), {
                    onSuccess: () => router.visit(route('erp.invoicing.customers.index')),
                });
            }} className="space-y-6">
                <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                    <h2 className="text-lg font-medium">Customer Information</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Customer Code</span>
                                <input
                                    type="text"
                                    value={form.data.code}
                                    onChange={(e) => form.setData('code', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    placeholder="Auto-generated if left blank"
                                />
                                {errors.code && <span className="text-destructive text-sm">{errors.code}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Name *</span>
                                <input
                                    type="text"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                {errors.name && <span className="text-destructive text-sm">{errors.name}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Email</span>
                                <input
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                                {errors.email && <span className="text-destructive text-sm">{errors.email}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Phone</span>
                                <input
                                    type="tel"
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                                {errors.phone && <span className="text-destructive text-sm">{errors.phone}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Tax Number</span>
                                <input
                                    type="text"
                                    value={form.data.tax_no}
                                    onChange={(e) => form.setData('tax_no', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                                {errors.tax_no && <span className="text-destructive text-sm">{errors.tax_no}</span>}
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
                                <span className="text-foreground/85 font-medium">Payment Terms</span>
                                <select
                                    value={form.data.payment_term_id}
                                    onChange={(e) => form.setData('payment_term_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">Select payment terms</option>
                                    {props.paymentTerms.map((pt) => (
                                        <option key={pt.id} value={pt.id.toString()}>
                                            {pt.name} (Net {pt.net_days}){pt.discount_percent && pt.discount_days ? ` — ${pt.discount_percent}% disc if paid in ${pt.discount_days} days` : ''}
                                        </option>
                                    ))}
                                </select>
                                {errors.payment_term_id && <span className="text-destructive text-sm">{errors.payment_term_id}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Credit Limit</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.data.credit_limit}
                                    onChange={(e) => form.setData('credit_limit', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                                {errors.credit_limit && <span className="text-destructive text-sm">{errors.credit_limit}</span>}
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Billing Address</span>
                                <textarea
                                    value={form.data.billing_address}
                                    onChange={(e) => form.setData('billing_address', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 resize-none"
                                />
                                {errors.billing_address && <span className="text-destructive text-sm">{errors.billing_address}</span>}
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Shipping Address</span>
                                <textarea
                                    value={form.data.shipping_address}
                                    onChange={(e) => form.setData('shipping_address', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 resize-none"
                                />
                                {errors.shipping_address && <span className="text-destructive text-sm">{errors.shipping_address}</span>}
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-foreground/85 flex items-center gap-2.5 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.data.is_active}
                                    onChange={(e) => form.setData('is_active', e.target.checked)}
                                    className="border-input accent-primary focus:ring-primary h-4 w-4 rounded"
                                />
                                <span>Active</span>
                            </label>
                        </div>
                    </div>
                </section>

                <div className="flex flex-wrap justify-end gap-3">
                    <a
                        href={route('erp.invoicing.customers.index')}
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </a>
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                    >
                        {form.processing ? 'Creating...' : 'Create Customer'}
                    </button>
                </div>
            </form>
        </main>
    );
}