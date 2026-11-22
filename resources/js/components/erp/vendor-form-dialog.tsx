import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from '@inertiajs/react';
import { useEffect, type FormEvent, type ReactNode } from 'react';
import { route } from 'ziggy-js';

export type VendorFields = {
    id?: number;
    code: string;
    name: string;
    tax_no: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    payment_terms_days: number;
    currency_code: string | null;
};

type Currency = { code: string; name: string };

const inputClass =
    'border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm transition outline-none focus:ring-4';

function Field({ label, error, children, wide }: { label: string; error?: string; children: ReactNode; wide?: boolean }) {
    return (
        <label className={`grid gap-1.5 text-sm ${wide ? 'sm:col-span-2' : ''}`}>
            <span className="text-foreground/85 font-medium">{label}</span>
            {children}
            {error && <span className="text-destructive text-xs">{error}</span>}
        </label>
    );
}

/** Add a vendor (no `vendor`) or edit one. */
export function VendorFormDialog({
    open,
    onClose,
    vendor,
    nextCode,
    currencies,
    defaultCurrency,
}: {
    open: boolean;
    onClose: () => void;
    vendor?: VendorFields | null;
    nextCode?: string;
    currencies: Currency[];
    defaultCurrency?: string;
}) {
    const blank = {
        code: nextCode ?? '',
        name: '',
        tax_no: '',
        email: '',
        phone: '',
        address: '',
        payment_terms_days: 30,
        currency_code: defaultCurrency ?? '',
    };
    const form = useForm(blank);

    useEffect(() => {
        if (!open) return;
        form.clearErrors();
        form.setData(
            vendor
                ? {
                      code: vendor.code,
                      name: vendor.name,
                      tax_no: vendor.tax_no ?? '',
                      email: vendor.email ?? '',
                      phone: vendor.phone ?? '',
                      address: vendor.address ?? '',
                      payment_terms_days: vendor.payment_terms_days,
                      currency_code: vendor.currency_code ?? '',
                  }
                : blank,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, vendor?.id, nextCode]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => onClose() };
        form.transform((data) => ({ ...data, currency_code: data.currency_code || null }));
        if (vendor?.id) {
            form.put(route('erp.purchase.vendors.update', vendor.id), options);
        } else {
            form.post(route('erp.purchase.vendors.store'), options);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && !form.processing && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{vendor?.id ? `Edit ${vendor.name}` : 'Add a vendor'}</DialogTitle>
                    <DialogDescription>Vendors are the suppliers you send orders to and receive bills from.</DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                    <Field label="Code" error={form.errors.code}>
                        <input value={form.data.code} onChange={(e) => form.setData('code', e.target.value)} className={inputClass} required />
                    </Field>
                    <Field label="Name" error={form.errors.name}>
                        <input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className={inputClass} required />
                    </Field>
                    <Field label="Tax number (TIN / VAT)" error={form.errors.tax_no}>
                        <input value={form.data.tax_no} onChange={(e) => form.setData('tax_no', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Phone" error={form.errors.phone}>
                        <input value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Email" error={form.errors.email} wide>
                        <input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Address" error={form.errors.address} wide>
                        <textarea
                            rows={3}
                            value={form.data.address}
                            onChange={(e) => form.setData('address', e.target.value)}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="Payment terms (days)" error={form.errors.payment_terms_days}>
                        <input
                            type="number"
                            min={0}
                            max={3650}
                            value={form.data.payment_terms_days}
                            onChange={(e) => form.setData('payment_terms_days', Number(e.target.value))}
                            className={inputClass}
                            required
                        />
                    </Field>
                    <Field label="Currency" error={form.errors.currency_code}>
                        <select
                            value={form.data.currency_code}
                            onChange={(e) => form.setData('currency_code', e.target.value)}
                            className={inputClass}
                        >
                            <option value="">Any currency</option>
                            {currencies.map((currency) => (
                                <option key={currency.code} value={currency.code}>
                                    {currency.code} · {currency.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={form.processing}
                            className="border-border hover:bg-muted inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-sm disabled:opacity-60"
                        >
                            {form.processing ? 'Saving…' : vendor?.id ? 'Save changes' : 'Add vendor'}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export const formatMoney = (currency: string, amount: string | number) =>
    `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "USD 1,200.00 · ZAR 300.00", or a dash. */
export const formatAmounts = (amounts: Record<string, string | number> | null | undefined) => {
    const entries = Object.entries(amounts ?? {}).filter(([, amount]) => Number(amount) !== 0);
    return entries.length ? entries.map(([currency, amount]) => formatMoney(currency, amount)).join(' · ') : '—';
};
