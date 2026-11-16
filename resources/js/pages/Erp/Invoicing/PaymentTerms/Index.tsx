import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type PaymentTerm = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    net_days: number;
    discount_days: number | null;
    discount_percent: number | null;
    is_default: boolean;
    is_active: boolean;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    paymentTerms: PaymentTerm[];
};

export default function PaymentTermsIndex(props: Props) {
    const form = useForm({
        code: '',
        name: '',
        description: '',
        net_days: '0',
        discount_days: '',
        discount_percent: '',
        is_default: false,
        is_active: true,
    });
    const errors = form.errors as Record<string, string>;

    const submitForm = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(route('erp.invoicing.payment-terms.store'), {
            onSuccess: () => {
                form.reset('code', 'name', 'description', 'discount_days', 'discount_percent', 'is_default');
                router.visit(route('erp.invoicing.payment-terms.index'));
            },
        });
    };

    const updateTerm = (term: PaymentTerm) => {
        const updateForm = useForm({
            code: term.code,
            name: term.name,
            description: term.description ?? '',
            net_days: term.net_days.toString(),
            discount_days: term.discount_days?.toString() ?? '',
            discount_percent: term.discount_percent?.toString() ?? '',
            is_default: term.is_default,
            is_active: term.is_active,
        });
        const updateErrors = updateForm.errors as Record<string, string>;

        const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            updateForm.put(route('erp.invoicing.payment-terms.update', term.id), {
                onSuccess: () => router.visit(route('erp.invoicing.payment-terms.index')),
            });
        };

        return (
            <form onSubmit={handleUpdate} className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Code</span>
                            <input
                                type="text"
                                value={updateForm.data.code}
                                onChange={(e) => updateForm.setData('code', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                                required
                            />
                            {updateErrors.code && <span className="text-destructive text-sm">{updateErrors.code}</span>}
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Name</span>
                            <input
                                type="text"
                                value={updateForm.data.name}
                                onChange={(e) => updateForm.setData('name', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                                required
                            />
                            {updateErrors.name && <span className="text-destructive text-sm">{updateErrors.name}</span>}
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Net Days</span>
                            <input
                                type="number"
                                min="0"
                                value={updateForm.data.net_days}
                                onChange={(e) => updateForm.setData('net_days', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                                required
                            />
                            {updateErrors.net_days && <span className="text-destructive text-sm">{updateErrors.net_days}</span>}
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Discount Days</span>
                            <input
                                type="number"
                                min="0"
                                value={updateForm.data.discount_days}
                                onChange={(e) => updateForm.setData('discount_days', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                            />
                            {updateErrors.discount_days && <span className="text-destructive text-sm">{updateErrors.discount_days}</span>}
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Discount %</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={updateForm.data.discount_percent}
                                onChange={(e) => updateForm.setData('discount_percent', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                            />
                            {updateErrors.discount_percent && <span className="text-destructive text-sm">{updateErrors.discount_percent}</span>}
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Description</span>
                            <input
                                type="text"
                                value={updateForm.data.description}
                                onChange={(e) => updateForm.setData('description', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-foreground/85 flex items-center gap-2.5 text-sm">
                            <input
                                type="checkbox"
                                checked={updateForm.data.is_default}
                                onChange={(e) => updateForm.setData('is_default', e.target.checked)}
                                className="border-input accent-primary focus:ring-primary h-4 w-4 rounded"
                            />
                            <span>Default</span>
                        </label>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-foreground/85 flex items-center gap-2.5 text-sm">
                            <input
                                type="checkbox"
                                checked={updateForm.data.is_active}
                                onChange={(e) => updateForm.setData('is_active', e.target.checked)}
                                className="border-input accent-primary focus:ring-primary h-4 w-4 rounded"
                            />
                            <span>Active</span>
                        </label>
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={updateForm.processing}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
                    >
                        {updateForm.processing ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </form>
        );
    };

    const deleteTerm = (id: number) => {
        if (window.confirm('Delete this payment term? This action cannot be undone.')) {
            router.delete(route('erp.invoicing.payment-terms.destroy', id), {
                onSuccess: () => router.visit(route('erp.invoicing.payment-terms.index')),
            });
        }
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} Payment Terms</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage payment terms for invoices and customers.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                <h2 className="text-lg font-medium">Add Payment Term</h2>
                <form onSubmit={submitForm} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Code</span>
                                <input
                                    type="text"
                                    value={form.data.code}
                                    onChange={(e) => form.setData('code', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                {errors.code && <span className="text-destructive text-sm">{errors.code}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Name</span>
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
                                <span className="text-foreground/85 font-medium">Net Days</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.data.net_days}
                                    onChange={(e) => form.setData('net_days', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                {errors.net_days && <span className="text-destructive text-sm">{errors.net_days}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Discount Days</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.data.discount_days}
                                    onChange={(e) => form.setData('discount_days', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                                {errors.discount_days && <span className="text-destructive text-sm">{errors.discount_days}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Discount %</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={form.data.discount_percent}
                                    onChange={(e) => form.setData('discount_percent', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                                {errors.discount_percent && <span className="text-destructive text-sm">{errors.discount_percent}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Description</span>
                                <input
                                    type="text"
                                    value={form.data.description}
                                    onChange={(e) => form.setData('description', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-foreground/85 flex items-center gap-2.5 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.data.is_default}
                                    onChange={(e) => form.setData('is_default', e.target.checked)}
                                    className="border-input accent-primary focus:ring-primary h-4 w-4 rounded"
                                />
                                <span>Set as default</span>
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
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
                        >
                            {form.processing ? 'Creating...' : 'Add Payment Term'}
                        </button>
                    </div>
                </form>
            </section>

            <section className="space-y-4">
                {props.paymentTerms.map((term) => (
                    <article
                        key={term.id}
                        className="space-y-3 rounded-xl border bg-card/70 p-4 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl transition-shadow hover:shadow-[0_12px_40px_rgba(0,26,77,0.09)]"
                    >
                        <div className="flex flex-wrap justify-between gap-3 items-center">
                            <div>
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    {term.code} — {term.name}
                                    {term.is_default && <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">Default</span>}
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1">
                                    Net {term.net_days} days{term.discount_percent && term.discount_days ? ` · ${term.discount_percent}% discount if paid in ${term.discount_days} days` : ''}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <span className={`px-2 py-1 rounded text-xs ${term.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {term.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <button
                                    onClick={() => deleteTerm(term.id)}
                                    className="text-destructive underline text-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                        {term.description && <p className="text-muted-foreground text-sm">{term.description}</p>}
                        {updateTerm(term)}
                    </article>
                ))}
                {props.paymentTerms.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No payment terms yet. Add your first payment term above.
                    </div>
                )}
            </section>
        </main>
    );
}