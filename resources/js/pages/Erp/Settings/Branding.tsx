import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Props = {
    company: {
        name: string;
        legal_name: string | null;
        registration_no: string | null;
        tax_no: string | null;
        vat_no: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        default_currency: string;
    };
    branding: {
        logo_url: string | null;
        letterhead_url: string | null;
        letterhead_name: string | null;
        primary_color: string | null;
        secondary_color: string | null;
        accent_color: string | null;
        letterhead_footer_text: string | null;
    };
    currencies: Array<{ code: string; name: string }>;
};

export default function Branding({ company, branding, currencies }: Props) {
    const form = useForm({
        ...company,
        primary_color: branding.primary_color ?? '#1e293b',
        secondary_color: branding.secondary_color ?? '#475569',
        accent_color: branding.accent_color ?? '#2563eb',
        letterhead_footer_text: branding.letterhead_footer_text ?? '',
        logo: null as File | null,
        letterhead: null as File | null,
        remove_letterhead: false,
        _method: 'PATCH',
    });
    const errors = form.errors as Record<string, string>;

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(route('erp.settings.branding.update'), { forceFormData: true });
    };

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6">
            <section>
                <h1 className="text-2xl font-semibold">Company details and branding</h1>
                <p className="text-muted-foreground mt-2 text-sm">These details and colors appear on documents produced for this company.</p>
            </section>

            <form onSubmit={submit} className="space-y-6">
                <section className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
                    <h2 className="text-lg font-medium sm:col-span-2">Company details</h2>
                    <Field
                        label="Trading name"
                        name="name"
                        value={form.data.name}
                        onChange={(value) => form.setData('name', value)}
                        error={errors.name}
                        required
                    />
                    <Field
                        label="Legal name"
                        name="legal_name"
                        value={form.data.legal_name ?? ''}
                        onChange={(value) => form.setData('legal_name', value)}
                        error={errors.legal_name}
                    />
                    <Field
                        label="Registration number"
                        name="registration_no"
                        value={form.data.registration_no ?? ''}
                        onChange={(value) => form.setData('registration_no', value)}
                        error={errors.registration_no}
                    />
                    <Field
                        label="Tax number"
                        name="tax_no"
                        value={form.data.tax_no ?? ''}
                        onChange={(value) => form.setData('tax_no', value)}
                        error={errors.tax_no}
                    />
                    <Field
                        label="VAT number"
                        name="vat_no"
                        value={form.data.vat_no ?? ''}
                        onChange={(value) => form.setData('vat_no', value)}
                        error={errors.vat_no}
                    />
                    <Field
                        label="Phone"
                        name="phone"
                        value={form.data.phone ?? ''}
                        onChange={(value) => form.setData('phone', value)}
                        error={errors.phone}
                    />
                    <Field
                        label="Email"
                        name="email"
                        type="email"
                        value={form.data.email ?? ''}
                        onChange={(value) => form.setData('email', value)}
                        error={errors.email}
                    />
                    <Field
                        label="Website"
                        name="website"
                        type="url"
                        value={form.data.website ?? ''}
                        onChange={(value) => form.setData('website', value)}
                        error={errors.website}
                    />
                    <label className="grid gap-1 text-sm">
                        Default currency
                        <select
                            value={form.data.default_currency}
                            onChange={(event) => form.setData('default_currency', event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        >
                            {currencies.map((currency) => (
                                <option key={currency.code} value={currency.code}>
                                    {currency.code} - {currency.name}
                                </option>
                            ))}
                        </select>
                        {errors.default_currency && <span className="text-destructive">{errors.default_currency}</span>}
                    </label>
                    <label className="grid gap-1 text-sm sm:col-span-2">
                        Address
                        <textarea
                            value={form.data.address ?? ''}
                            onChange={(event) => form.setData('address', event.target.value)}
                            className="bg-background min-h-20 rounded-md border px-3 py-2"
                        />
                        {errors.address && <span className="text-destructive">{errors.address}</span>}
                    </label>
                </section>

                <section className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
                    <h2 className="text-lg font-medium sm:col-span-2">Document branding</h2>
                    {branding.logo_url && (
                        <div className="sm:col-span-2">
                            <img src={branding.logo_url} alt={`${company.name} logo`} className="max-h-20 max-w-48 object-contain" />
                        </div>
                    )}
                    <label className="grid gap-1 text-sm sm:col-span-2">
                        Logo (PNG, JPEG, or GIF; up to 2 MB)
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/gif"
                            onChange={(event) => form.setData('logo', event.target.files?.[0] ?? null)}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                        {errors.logo && <span className="text-destructive">{errors.logo}</span>}
                    </label>
                    <div className="grid gap-2 text-sm sm:col-span-2">
                        <span className="font-medium">PDF letterhead (for this company's documents)</span>
                        {branding.letterhead_url && !form.data.remove_letterhead && (
                            <div className="flex flex-wrap items-center gap-3">
                                <a
                                    href={branding.letterhead_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline"
                                >
                                    View saved letterhead{branding.letterhead_name ? `: ${branding.letterhead_name}` : ''}
                                </a>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.data.remove_letterhead}
                                        onChange={(event) => form.setData('remove_letterhead', event.target.checked)}
                                    />
                                    Remove saved letterhead
                                </label>
                            </div>
                        )}
                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(event) => {
                                form.setData('letterhead', event.target.files?.[0] ?? null);
                                form.setData('remove_letterhead', false);
                            }}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                        {form.data.letterhead && (
                            <span className="text-muted-foreground">Selected: {form.data.letterhead.name}</span>
                        )}
                        <span className="text-muted-foreground text-xs">
                            Upload a one-page PDF. It is applied only to documents for the currently selected company. Up to 10 MB.
                        </span>
                        {errors.letterhead && <span className="text-destructive">{errors.letterhead}</span>}
                    </div>
                    <ColorField
                        label="Primary color"
                        value={form.data.primary_color}
                        onChange={(value) => form.setData('primary_color', value)}
                        error={errors.primary_color}
                    />
                    <ColorField
                        label="Secondary color"
                        value={form.data.secondary_color}
                        onChange={(value) => form.setData('secondary_color', value)}
                        error={errors.secondary_color}
                    />
                    <ColorField
                        label="Accent color"
                        value={form.data.accent_color}
                        onChange={(value) => form.setData('accent_color', value)}
                        error={errors.accent_color}
                    />
                    <label className="grid gap-1 text-sm sm:col-span-2">
                        Letterhead footer
                        <textarea
                            value={form.data.letterhead_footer_text}
                            onChange={(event) => form.setData('letterhead_footer_text', event.target.value)}
                            className="bg-background min-h-20 rounded-md border px-3 py-2"
                        />
                        {errors.letterhead_footer_text && <span className="text-destructive">{errors.letterhead_footer_text}</span>}
                    </label>
                </section>

                <button
                    type="submit"
                    disabled={form.processing}
                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                    {form.processing ? 'Saving…' : 'Save company settings'}
                </button>
            </form>
        </main>
    );
}

function Field({
    label,
    name,
    value,
    onChange,
    error,
    type = 'text',
    required = false,
}: {
    label: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    required?: boolean;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <input
                name={name}
                type={type}
                required={required}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="bg-background rounded-md border px-3 py-2"
            />
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}

function ColorField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <div className="flex gap-2">
                <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-14 rounded border" />
                <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="bg-background min-w-0 flex-1 rounded-md border px-3 py-2"
                />
            </div>
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}
