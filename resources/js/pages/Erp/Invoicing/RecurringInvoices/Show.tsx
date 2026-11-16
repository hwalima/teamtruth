import { router } from '@inertiajs/react';
import { route } from 'ziggy-js';

type Customer = { id: number; code: string; name: string; currency_code: string };
type PaymentTerm = { id: number; name: string; net_days: number };
type Line = {
    id: number;
    name: string;
    description: string | null;
    quantity: string;
    unit: string;
    unit_price: string;
    discount_percent: string;
    tax_rate: string;
    line_total: string;
    sort_order: number;
};
type TemplateData = {
    type: string;
    invoice_date_offset: number;
    journal_id: number | null;
    notes: string | null;
    terms: string | null;
    footer_notes: string | null;
};
type RecurringInvoice = {
    id: number;
    name: string;
    status: string;
    frequency: string;
    interval: number;
    start_date: string;
    end_date: string | null;
    max_occurrences: number | null;
    next_run_date: string;
    occurrences_count: number;
    currency_code: string;
    template_data: TemplateData;
    notes: string | null;
    terms: string | null;
    customer: Customer;
    payment_term: PaymentTerm | null;
    lines: Line[];
    created_at: string;
    updated_at: string;
};
type Company = { id: number; code: string; name: string; default_currency: string };
type Props = {
    company: Company;
    recurring: RecurringInvoice;
    canPause: boolean;
    canResume: boolean;
    canDelete: boolean;
};

const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const frequencyLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
};

const formatCurrency = (currency: string, amount: string) => {
    return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

export default function RecurringInvoiceShow(props: Props) {
    const { recurring } = props;

    const pauseRecurring = () => {
        if (window.confirm('Pause this recurring invoice template?')) {
            router.post(route('erp.invoicing.recurring.pause', recurring.id), {
                onSuccess: () => router.visit(route('erp.invoicing.recurring.show', recurring.id)),
            });
        }
    };

    const resumeRecurring = () => {
        if (window.confirm('Resume this recurring invoice template?')) {
            router.post(route('erp.invoicing.recurring.resume', recurring.id), {
                onSuccess: () => router.visit(route('erp.invoicing.recurring.show', recurring.id)),
            });
        }
    };

    const generateNow = () => {
        if (window.confirm('Generate an invoice now from this template?')) {
            router.post(route('erp.invoicing.recurring.generate', recurring.id), {
                onSuccess: () => router.visit(route('erp.invoicing.recurring.show', recurring.id)),
            });
        }
    };

    const deleteRecurring = () => {
        if (window.confirm('Delete this recurring invoice template? This action cannot be undone.')) {
            router.delete(route('erp.invoicing.recurring.destroy', recurring.id), {
                onSuccess: () => router.visit(route('erp.invoicing.recurring.index')),
            });
        }
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header className="flex flex-wrap justify-between gap-4 items-start">
                <div>
                    <p className="text-muted-foreground text-sm">{props.company.code}</p>
                    <div className="flex flex-wrap items-baseline gap-3 mt-1">
                        <h1 className="text-2xl font-semibold">{recurring.name}</h1>
                        <span className={`px-2 py-1 rounded text-xs ${statusColors[recurring.status] ?? 'bg-gray-100 text-gray-800'}`}>
                            {recurring.status.replaceAll('_', ' ')}
                        </span>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                        For {recurring.customer.code} — {recurring.customer.name}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {props.canPause && recurring.status === 'active' && (
                        <button
                            onClick={pauseRecurring}
                            className="text-yellow-600 inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-yellow-100"
                        >
                            Pause
                        </button>
                    )}
                    {props.canResume && recurring.status === 'paused' && (
                        <button
                            onClick={resumeRecurring}
                            className="text-green-600 inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-green-100"
                        >
                            Resume
                        </button>
                    )}
                    {['active', 'paused'].includes(recurring.status) && (
                        <button
                            onClick={generateNow}
                            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            Generate Now
                        </button>
                    )}
                    {props.canDelete && ['active', 'paused', 'completed'].includes(recurring.status) && (
                        <button
                            onClick={deleteRecurring}
                            className="text-destructive inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:bg-destructive/10"
                        >
                            Delete
                        </button>
                    )}
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                {/* Main Content */}
                <div className="space-y-6">
                    {/* Schedule Details */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Schedule</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <p className="text-muted-foreground text-sm">Frequency</p>
                                <p className="font-medium">{recurring.interval} {frequencyLabels[recurring.frequency] ?? recurring.frequency}(s)</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Start Date</p>
                                <p className="font-medium">{recurring.start_date}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Next Run</p>
                                <p className="font-medium">{recurring.next_run_date}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">End Date</p>
                                <p className="font-medium">{recurring.end_date ?? 'No end date'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Max Occurrences</p>
                                <p className="font-medium">{recurring.max_occurrences ?? 'Unlimited'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Completed</p>
                                <p className="font-medium">{recurring.occurrences_count} of {recurring.max_occurrences ?? '∞'}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-muted-foreground text-sm">Payment Terms</p>
                                <p className="font-medium">{recurring.payment_term?.name ?? '—'}</p>
                            </div>
                        </div>
                    </section>

                    {/* Invoice Template Details */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Invoice Template</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <p className="text-muted-foreground text-sm">Type</p>
                                <p className="font-medium capitalize">{recurring.template_data.type}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Invoice Date Offset</p>
                                <p className="font-medium">{recurring.template_data.invoice_date_offset} day(s) after run date</p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-muted-foreground text-sm">Sales Journal</p>
                                <p className="font-medium">{recurring.template_data.journal_id ? `ID: ${recurring.template_data.journal_id}` : '—'}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-muted-foreground text-sm">Notes (internal)</p>
                                <p className="font-medium">{recurring.template_data.notes ?? '—'}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-muted-foreground text-sm">Terms & Conditions</p>
                                <p className="font-medium">{recurring.template_data.terms ?? '—'}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-muted-foreground text-sm">Footer Notes</p>
                                <p className="font-medium">{recurring.template_data.footer_notes ?? '—'}</p>
                            </div>
                        </div>
                    </section>

                    {/* Template Lines */}
                    <section className="space-y-4 rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium">Template Lines</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-left text-sm">
                                <thead>
                                    <tr className="text-muted-foreground bg-muted/40 border-b">
                                        <th className="px-3 py-3 font-medium">Description</th>
                                        <th className="px-3 py-3 text-right font-medium">Qty</th>
                                        <th className="px-3 py-3 text-right font-medium">Unit</th>
                                        <th className="px-3 py-3 text-right font-medium">Unit Price</th>
                                        <th className="px-3 py-3 text-right font-medium">Disc %</th>
                                        <th className="px-3 py-3 text-right font-medium">Tax %</th>
                                        <th className="px-3 py-3 text-right font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recurring.lines.map((line) => (
                                        <tr key={line.id} className="border-border/60 hover:bg-muted/30 border-b transition-colors last:border-0">
                                            <td className="px-3 py-3">
                                                <p className="font-medium">{line.name}</p>
                                                {line.description && <p className="text-muted-foreground text-xs">{line.description}</p>}
                                            </td>
                                            <td className="px-3 py-3 text-right tabular-nums">{Number(line.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-3 py-3 text-right">{line.unit}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(recurring.currency_code, line.unit_price)}</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{line.discount_percent}%</td>
                                            <td className="px-3 py-3 text-right tabular-nums">{line.tax_rate}%</td>
                                            <td className="px-3 py-3 text-right font-medium tabular-nums">{formatCurrency(recurring.currency_code, line.line_total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/30 font-semibold">
                                        <td className="px-3 py-3 text-right" colSpan={6}>Subtotal</td>
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            {formatCurrency(recurring.currency_code, recurring.lines.reduce((sum, line) => {
                                                const qty = Number(line.quantity) || 0;
                                                const price = Number(line.unit_price) || 0;
                                                const discount = Number(line.discount_percent) || 0;
                                                return sum + (qty * price * (1 - discount / 100));
                                            }, 0).toFixed(2))}
                                        </td>
                                    </tr>
                                    <tr className="bg-muted/30">
                                        <td className="px-3 py-3 text-right" colSpan={6}>Tax</td>
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            {formatCurrency(recurring.currency_code, recurring.lines.reduce((sum, line) => {
                                                const qty = Number(line.quantity) || 0;
                                                const price = Number(line.unit_price) || 0;
                                                const discount = Number(line.discount_percent) || 0;
                                                const tax = Number(line.tax_rate) || 0;
                                                const lineNet = qty * price * (1 - discount / 100);
                                                return sum + (lineNet * tax / 100);
                                            }, 0).toFixed(2))}
                                        </td>
                                    </tr>
                                    <tr className="bg-primary/10 font-bold">
                                        <td className="px-3 py-3 text-right" colSpan={6}>Total</td>
                                        <td className="px-3 py-3 text-right tabular-nums">
                                            {formatCurrency(recurring.currency_code, recurring.lines.reduce((sum, line) => {
                                                const qty = Number(line.quantity) || 0;
                                                const price = Number(line.unit_price) || 0;
                                                const discount = Number(line.discount_percent) || 0;
                                                const tax = Number(line.tax_rate) || 0;
                                                const lineNet = qty * price * (1 - discount / 100);
                                                return sum + lineNet + (lineNet * tax / 100);
                                            }, 0).toFixed(2))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>

                    {/* Notes */}
                    {(recurring.notes || recurring.terms) && (
                        <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                            <h2 className="text-lg font-medium mb-4">Additional Notes</h2>
                            <div className="space-y-4">
                                {recurring.notes && (
                                    <div>
                                        <p className="text-muted-foreground text-sm">Internal Notes</p>
                                        <p className="font-medium">{recurring.notes}</p>
                                    </div>
                                )}
                                {recurring.terms && (
                                    <div>
                                        <p className="text-muted-foreground text-sm">Terms & Conditions</p>
                                        <p className="font-medium">{recurring.terms}</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Timestamps */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-muted-foreground text-sm">Created</p>
                                <p className="font-medium">{new Date(recurring.created_at).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-sm">Updated</p>
                                <p className="font-medium">{new Date(recurring.updated_at).toLocaleString()}</p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium mb-4">Customer</h2>
                        <div className="space-y-2">
                            <p className="font-medium">{recurring.customer.name}</p>
                            <p className="text-muted-foreground text-sm">{recurring.customer.code}</p>
                            <p className="text-muted-foreground text-sm">Currency: {recurring.currency_code}</p>
                        </div>
                    </section>

                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium mb-4">Template Totals</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-medium">
                                    {formatCurrency(recurring.currency_code, recurring.lines.reduce((sum, line) => {
                                        const qty = Number(line.quantity) || 0;
                                        const price = Number(line.unit_price) || 0;
                                        const discount = Number(line.discount_percent) || 0;
                                        return sum + (qty * price * (1 - discount / 100));
                                    }, 0).toFixed(2))}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax</span>
                                <span className="font-medium">
                                    {formatCurrency(recurring.currency_code, recurring.lines.reduce((sum, line) => {
                                        const qty = Number(line.quantity) || 0;
                                        const price = Number(line.unit_price) || 0;
                                        const discount = Number(line.discount_percent) || 0;
                                        const tax = Number(line.tax_rate) || 0;
                                        const lineNet = qty * price * (1 - discount / 100);
                                        return sum + (lineNet * tax / 100);
                                    }, 0).toFixed(2))}
                                </span>
                            </div>
                            <div className="flex justify-between text-lg font-semibold border-t pt-2">
                                <span>Total per Invoice</span>
                                <span>
                                    {formatCurrency(recurring.currency_code, recurring.lines.reduce((sum, line) => {
                                        const qty = Number(line.quantity) || 0;
                                        const price = Number(line.unit_price) || 0;
                                        const discount = Number(line.discount_percent) || 0;
                                        const tax = Number(line.tax_rate) || 0;
                                        const lineNet = qty * price * (1 - discount / 100);
                                        return sum + lineNet + (lineNet * tax / 100);
                                    }, 0).toFixed(2))}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground border-t pt-2">
                                <span>Est. Annual Value</span>
                                <span>
                                    {formatCurrency(recurring.currency_code, (
                                        recurring.lines.reduce((sum, line) => {
                                            const qty = Number(line.quantity) || 0;
                                            const price = Number(line.unit_price) || 0;
                                            const discount = Number(line.discount_percent) || 0;
                                            const tax = Number(line.tax_rate) || 0;
                                            const lineNet = qty * price * (1 - discount / 100);
                                            return sum + lineNet + (lineNet * tax / 100);
                                        }, 0) *
                                        (recurring.frequency === 'daily' ? 365 : recurring.frequency === 'weekly' ? 52 : recurring.frequency === 'monthly' ? 12 : recurring.frequency === 'quarterly' ? 4 : 1)
                                    ).toFixed(2))}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Quick Actions */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
                        <div className="space-y-2">
                            {['active', 'paused'].includes(recurring.status) && (
                                <button
                                    onClick={generateNow}
                                    className="w-full text-left bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    Generate Invoice Now
                                </button>
                            )}
                            {props.canPause && recurring.status === 'active' && (
                                <button
                                    onClick={pauseRecurring}
                                    className="w-full text-left text-yellow-600 underline text-sm"
                                >
                                    Pause Template
                                </button>
                            )}
                            {props.canResume && recurring.status === 'paused' && (
                                <button
                                    onClick={resumeRecurring}
                                    className="w-full text-left text-green-600 underline text-sm"
                                >
                                    Resume Template
                                </button>
                            )}
                            {props.canDelete && ['active', 'paused', 'completed'].includes(recurring.status) && (
                                <button
                                    onClick={deleteRecurring}
                                    className="w-full text-left text-destructive underline text-sm"
                                >
                                    Delete Template
                                </button>
                            )}
                        </div>
                    </section>

                    {/* Navigation */}
                    <section className="rounded-xl border bg-card/70 p-5 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl">
                        <div className="flex flex-wrap gap-2">
                            <a
                                href={route('erp.invoicing.recurring.index')}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Back to List
                            </a>
                            <a
                                href={route('erp.invoicing.recurring.create')}
                                className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                New Template
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}