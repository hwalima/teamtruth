import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Line = {
    item: string;
    description: string;
    quantity: string;
    unit: string;
    estimated_unit_price: string;
    gl_account: string;
    budget_line: string;
};

type Requisition = {
    id: number;
    document_number: string;
    requisition_type: string;
    department: string | null;
    cost_center: string | null;
    required_by: string | null;
    priority: string;
    justification: string;
    currency_code: string;
    lines: Line[];
};

type Props = {
    requisition: Requisition | null;
    types: Record<string, string>;
    currencies: Array<{ code: string; name: string }>;
};

const blankLine = (): Line => ({
    item: '',
    description: '',
    quantity: '1',
    unit: 'each',
    estimated_unit_price: '0',
    gl_account: '',
    budget_line: '',
});

export default function Form({ requisition, types, currencies }: Props) {
    const form = useForm({
        requisition_type: requisition?.requisition_type ?? 'purchase',
        department: requisition?.department ?? '',
        cost_center: requisition?.cost_center ?? '',
        required_by: requisition?.required_by ?? '',
        priority: requisition?.priority ?? 'normal',
        justification: requisition?.justification ?? '',
        currency_code: requisition?.currency_code ?? currencies[0]?.code ?? 'USD',
        lines: requisition?.lines.length ? requisition.lines : [blankLine()],
    });
    const errors = form.errors as Record<string, string>;

    const updateLine = (index: number, key: keyof Line, value: string) => {
        form.setData(
            'lines',
            form.data.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line)),
        );
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (requisition) {
            form.put(route('erp.requisitions.update', requisition.id));
        } else {
            form.post(route('erp.requisitions.store'));
        }
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header>
                <h1 className="text-2xl font-semibold">{requisition ? `Edit ${requisition.document_number}` : 'New requisition'}</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Save a draft, add supporting documents, then submit it to your configured approval workflow.
                </p>
            </header>

            <form onSubmit={submit} className="space-y-6">
                <section className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                        Requisition type
                        <select
                            required
                            value={form.data.requisition_type}
                            onChange={(event) => form.setData('requisition_type', event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        >
                            {Object.entries(types).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        {errors.requisition_type && <span className="text-destructive">{errors.requisition_type}</span>}
                    </label>
                    <label className="grid gap-1 text-sm">
                        Priority
                        <select
                            value={form.data.priority}
                            onChange={(event) => form.setData('priority', event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        >
                            {['low', 'normal', 'high', 'urgent'].map((value) => (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                        Department
                        <input
                            maxLength={120}
                            value={form.data.department}
                            onChange={(event) => form.setData('department', event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                    </label>
                    <label className="grid gap-1 text-sm">
                        Cost center
                        <input
                            maxLength={120}
                            value={form.data.cost_center}
                            onChange={(event) => form.setData('cost_center', event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                    </label>
                    <label className="grid gap-1 text-sm">
                        Required by
                        <input
                            type="date"
                            value={form.data.required_by}
                            onChange={(event) => form.setData('required_by', event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                        {errors.required_by && <span className="text-destructive">{errors.required_by}</span>}
                    </label>
                    <label className="grid gap-1 text-sm">
                        Currency
                        <select
                            required
                            value={form.data.currency_code}
                            onChange={(event) => form.setData('currency_code', event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        >
                            {currencies.map((currency) => (
                                <option key={currency.code} value={currency.code}>
                                    {currency.code} — {currency.name}
                                </option>
                            ))}
                        </select>
                        {errors.currency_code && <span className="text-destructive">{errors.currency_code}</span>}
                    </label>
                    <label className="grid gap-1 text-sm sm:col-span-2">
                        Justification
                        <textarea
                            required
                            maxLength={10000}
                            rows={3}
                            value={form.data.justification}
                            onChange={(event) => form.setData('justification', event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                        {errors.justification && <span className="text-destructive">{errors.justification}</span>}
                    </label>
                </section>

                <section className="space-y-4 rounded-md border p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-medium">Request lines</h2>
                            <p className="text-muted-foreground text-sm">Estimated costs are calculated and rounded to four decimal places.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => form.setData('lines', [...form.data.lines, blankLine()])}
                            disabled={form.data.lines.length >= 50}
                            className="text-primary text-sm font-medium underline disabled:opacity-50"
                        >
                            Add line
                        </button>
                    </div>
                    {form.data.lines.map((line, index) => (
                        <fieldset key={index} className="grid gap-3 rounded border p-3 sm:grid-cols-2 lg:grid-cols-4">
                            <legend className="px-1 text-sm font-medium">Line {index + 1}</legend>
                            <label className="grid gap-1 text-sm lg:col-span-2">
                                Item / service
                                <input
                                    required
                                    maxLength={255}
                                    value={line.item}
                                    onChange={(event) => updateLine(index, 'item', event.target.value)}
                                    className="bg-background rounded-md border px-3 py-2"
                                />
                                {errors[`lines.${index}.item`] && <span className="text-destructive">{errors[`lines.${index}.item`]}</span>}
                            </label>
                            <label className="grid gap-1 text-sm">
                                Quantity
                                <input
                                    required
                                    type="number"
                                    min="0.0001"
                                    max="999999.9999"
                                    step="0.0001"
                                    value={line.quantity}
                                    onChange={(event) => updateLine(index, 'quantity', event.target.value)}
                                    className="bg-background rounded-md border px-3 py-2"
                                />
                            </label>
                            <label className="grid gap-1 text-sm">
                                Unit
                                <input
                                    required
                                    maxLength={40}
                                    value={line.unit}
                                    onChange={(event) => updateLine(index, 'unit', event.target.value)}
                                    className="bg-background rounded-md border px-3 py-2"
                                />
                            </label>
                            <label className="grid gap-1 text-sm">
                                Estimated unit price
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    max="999999.9999"
                                    step="0.0001"
                                    value={line.estimated_unit_price}
                                    onChange={(event) => updateLine(index, 'estimated_unit_price', event.target.value)}
                                    className="bg-background rounded-md border px-3 py-2"
                                />
                            </label>
                            <label className="grid gap-1 text-sm">
                                GL account
                                <input
                                    maxLength={120}
                                    value={line.gl_account}
                                    onChange={(event) => updateLine(index, 'gl_account', event.target.value)}
                                    className="bg-background rounded-md border px-3 py-2"
                                />
                            </label>
                            <label className="grid gap-1 text-sm">
                                Budget line
                                <input
                                    maxLength={120}
                                    value={line.budget_line}
                                    onChange={(event) => updateLine(index, 'budget_line', event.target.value)}
                                    className="bg-background rounded-md border px-3 py-2"
                                />
                            </label>
                            <label className="grid gap-1 text-sm sm:col-span-2 lg:col-span-3">
                                Description
                                <input
                                    maxLength={2000}
                                    value={line.description}
                                    onChange={(event) => updateLine(index, 'description', event.target.value)}
                                    className="bg-background rounded-md border px-3 py-2"
                                />
                            </label>
                            {form.data.lines.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        form.setData(
                                            'lines',
                                            form.data.lines.filter((_, lineIndex) => lineIndex !== index),
                                        )
                                    }
                                    className="text-destructive self-end text-left text-sm underline"
                                >
                                    Remove line
                                </button>
                            )}
                        </fieldset>
                    ))}
                    {errors.lines && <p className="text-destructive text-sm">{errors.lines}</p>}
                    {errors.requisition && <p className="text-destructive text-sm">{errors.requisition}</p>}
                </section>

                <div className="flex flex-wrap gap-3">
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                        {form.processing ? 'Saving…' : 'Save draft'}
                    </button>
                    <a href={route('erp.requisitions.index')} className="rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </a>
                </div>
            </form>
        </main>
    );
}
