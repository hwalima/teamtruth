import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Currency = {
    code: string;
    name: string;
};

type ExchangeRate = {
    id: number;
    rate: string;
    effective_at: string;
    source: string | null;
    from_currency: Currency;
    to_currency: Currency;
};

type Props = {
    rates: {
        data: ExchangeRate[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
        current_page: number;
        last_page: number;
    };
    currencies: Currency[];
    defaultCurrency: string;
};

export default function ExchangeRates({ rates, currencies, defaultCurrency }: Props) {
    const form = useForm({
        from_currency: defaultCurrency,
        to_currency: currencies.find((currency) => currency.code !== defaultCurrency)?.code ?? '',
        rate: '',
        effective_at: localDateTimeValue(),
        source: '',
    });
    const errors = form.errors as Record<string, string>;

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(route('erp.settings.exchange-rates.store'), {
            onSuccess: () => form.reset('rate', 'source'),
        });
    };

    return (
        <main className="mx-auto max-w-5xl space-y-8 p-6">
            <section>
                <h1 className="text-2xl font-semibold">Exchange rates</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Rates are stored per company and become effective from the selected date and time.
                    Saving the same currency pair and effective time replaces that rate.
                </p>
            </section>

            <section className="space-y-4 rounded-md border p-4">
                <h2 className="text-lg font-medium">Record a rate</h2>
                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <CurrencySelect
                        label="From currency"
                        value={form.data.from_currency}
                        currencies={currencies}
                        onChange={(value) => form.setData('from_currency', value)}
                        error={errors.from_currency}
                    />
                    <CurrencySelect
                        label="To currency"
                        value={form.data.to_currency}
                        currencies={currencies}
                        onChange={(value) => form.setData('to_currency', value)}
                        error={errors.to_currency}
                    />
                    <label className="grid gap-1 text-sm">
                        Rate
                        <input
                            required
                            inputMode="decimal"
                            value={form.data.rate}
                            onChange={(event) => form.setData('rate', event.target.value)}
                            placeholder="e.g. 25.5000000000"
                            className="rounded-md border bg-background px-3 py-2"
                        />
                        {errors.rate && <span className="text-destructive">{errors.rate}</span>}
                    </label>
                    <label className="grid gap-1 text-sm">
                        Effective from
                        <input
                            required
                            type="datetime-local"
                            value={form.data.effective_at}
                            onChange={(event) => form.setData('effective_at', event.target.value)}
                            className="rounded-md border bg-background px-3 py-2"
                        />
                        {errors.effective_at && <span className="text-destructive">{errors.effective_at}</span>}
                    </label>
                    <label className="grid gap-1 text-sm">
                        Source
                        <input
                            maxLength={255}
                            value={form.data.source}
                            onChange={(event) => form.setData('source', event.target.value)}
                            placeholder="e.g. Finance department"
                            className="rounded-md border bg-background px-3 py-2"
                        />
                        {errors.source && <span className="text-destructive">{errors.source}</span>}
                    </label>
                    <div className="flex items-end">
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                        >
                            {form.processing ? 'Saving…' : 'Save rate'}
                        </button>
                    </div>
                </form>
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-medium">Company rates</h2>
                {rates.data.length === 0 ? (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">No exchange rates have been recorded.</p>
                ) : (
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b bg-muted/50">
                                <tr>
                                    <th className="p-3 font-medium">Currency pair</th>
                                    <th className="p-3 font-medium">Rate</th>
                                    <th className="p-3 font-medium">Effective from</th>
                                    <th className="p-3 font-medium">Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rates.data.map((rate) => (
                                    <tr key={rate.id} className="border-b last:border-0">
                                        <td className="p-3">
                                            {rate.from_currency.code} / {rate.to_currency.code}
                                        </td>
                                        <td className="p-3">{rate.rate}</td>
                                        <td className="p-3">{formatDate(rate.effective_at)}</td>
                                        <td className="p-3">{rate.source || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {rates.last_page > 1 && (
                    <nav className="flex flex-wrap gap-2" aria-label="Exchange rate pages">
                        {rates.links.map((link, index) => (
                            <a
                                key={`${link.label}-${index}`}
                                href={link.url ?? undefined}
                                aria-disabled={!link.url}
                                aria-current={link.active ? 'page' : undefined}
                                className={`rounded border px-3 py-1 text-sm ${link.active ? 'bg-primary text-primary-foreground' : ''} ${!link.url ? 'pointer-events-none opacity-50' : ''}`}
                            >
                                {link.label.replace(/<[^>]*>/g, '').replace(/&laquo;/g, '<<').replace(/&raquo;/g, '>>')}
                            </a>
                        ))}
                    </nav>
                )}
            </section>
        </main>
    );
}

function CurrencySelect({
    label,
    value,
    currencies,
    onChange,
    error,
}: {
    label: string;
    value: string;
    currencies: Currency[];
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <select
                required
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-md border bg-background px-3 py-2"
            >
                {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                    </option>
                ))}
            </select>
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}

function formatDate(value: string): string {
    return new Date(value).toLocaleString();
}

function localDateTimeValue(): string {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

    return localDate.toISOString().slice(0, 16);
}
