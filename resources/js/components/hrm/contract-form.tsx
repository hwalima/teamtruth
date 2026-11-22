import { useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { Field, Select, TextInput, idOptions, personName, primaryButton, toDateInput, type Options } from './ui';

export type ContractRecord = {
    id: number;
    employee_id: number;
    template_id: number | null;
    contract_type: string;
    start_date: string;
    end_date: string | null;
    probation_end_date: string | null;
    basic_salary?: string;
    currency_code: string;
    pay_frequency: string;
    working_hours_per_week: string;
};

type Person = { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string };

type Props = {
    contract?: ContractRecord;
    employees?: Person[];
    employeeId?: number | null;
    templates: { id: number; name: string; contract_type: string; is_default?: boolean }[];
    typeOptions: Options;
    payFrequencyOptions: Options;
    defaultCurrency: string;
    submitUrl: string;
    method: 'post' | 'put';
    submitLabel: string;
    footer?: ReactNode;
};

/** Contract terms, used to draft a contract and to edit one. */
export default function ContractForm(props: Props) {
    const c = props.contract;
    const form = useForm({
        ...(c ? {} : { employee_id: props.employeeId ? String(props.employeeId) : '' }),
        template_id: c?.template_id ? String(c.template_id) : '',
        contract_type: c?.contract_type ?? 'permanent',
        start_date: toDateInput(c?.start_date),
        end_date: toDateInput(c?.end_date),
        probation_end_date: toDateInput(c?.probation_end_date),
        basic_salary: c?.basic_salary ?? '',
        currency_code: c?.currency_code ?? props.defaultCurrency,
        pay_frequency: c?.pay_frequency ?? 'monthly',
        working_hours_per_week: c?.working_hours_per_week ?? '40',
    });
    const errors = form.errors as Record<string, string>;
    const templates = props.templates.filter((t) => t.contract_type === form.data.contract_type);

    const changeType = (type: string) => {
        const fallback = props.templates.find((t) => t.contract_type === type && t.is_default);
        form.setData((data) => ({ ...data, contract_type: type, template_id: fallback ? String(fallback.id) : '' }));
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])));
        form.submit(props.method, props.submitUrl, { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
            {errors.contract && <p className="text-destructive text-sm sm:col-span-3">{errors.contract}</p>}
            {props.employees && (
                <Field label="Employee *" error={errors.employee_id} className="sm:col-span-2">
                    <Select
                        value={(form.data as { employee_id?: string }).employee_id}
                        onChange={(v) => form.setData('employee_id' as never, v as never)}
                        options={idOptions(props.employees, (e) => `${e.employee_number} — ${personName(e)}`)}
                        placeholder="— Select —"
                    />
                </Field>
            )}
            <Field label="Contract type *" error={errors.contract_type}>
                <Select value={form.data.contract_type} onChange={changeType} options={props.typeOptions} />
            </Field>
            <Field label="Template" error={errors.template_id}>
                <Select value={form.data.template_id} onChange={(v) => form.setData('template_id', v)} options={idOptions(templates, (t) => t.name)} placeholder="— None —" />
            </Field>
            <Field label="Start date *" error={errors.start_date}>
                <TextInput type="date" value={form.data.start_date} onChange={(v) => form.setData('start_date', v)} />
            </Field>
            <Field label={form.data.contract_type === 'fixed_term' ? 'End date *' : 'End date'} error={errors.end_date}>
                <TextInput type="date" value={form.data.end_date} onChange={(v) => form.setData('end_date', v)} />
            </Field>
            <Field label="Probation ends" error={errors.probation_end_date}>
                <TextInput type="date" value={form.data.probation_end_date} onChange={(v) => form.setData('probation_end_date', v)} />
            </Field>
            <Field label="Basic salary" error={errors.basic_salary}>
                <TextInput type="number" step="0.01" min={0} value={form.data.basic_salary} onChange={(v) => form.setData('basic_salary', v)} />
            </Field>
            <Field label="Currency *" error={errors.currency_code}>
                <TextInput value={form.data.currency_code} onChange={(v) => form.setData('currency_code', v.toUpperCase())} />
            </Field>
            <Field label="Pay frequency *" error={errors.pay_frequency}>
                <Select value={form.data.pay_frequency} onChange={(v) => form.setData('pay_frequency', v)} options={props.payFrequencyOptions} />
            </Field>
            <Field label="Hours per week" error={errors.working_hours_per_week}>
                <TextInput type="number" step="0.5" value={form.data.working_hours_per_week} onChange={(v) => form.setData('working_hours_per_week', v)} />
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-3">
                <button type="submit" disabled={form.processing} className={primaryButton}>
                    {props.submitLabel}
                </button>
                {props.footer}
            </div>
        </form>
    );
}
