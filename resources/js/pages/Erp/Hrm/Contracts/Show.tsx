import { router, useForm, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';
import ContractForm, { type ContractRecord } from '@/components/hrm/contract-form';
import { Card, Detail, Field, Page, StatusBadge, TextInput, dangerButton, formatDate, personName, primaryButton, secondaryButton, type Options } from '@/components/hrm/ui';

type Contract = ContractRecord & {
    status: string;
    employee: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string; position: { name: string } | null; department: { name: string } | null } | null;
    template: { name: string } | null;
    creator: { name: string } | null;
    signed_by_employee_at: string | null;
    signed_by_employer_at: string | null;
    created_at: string;
};

type Props = {
    company: { name: string; default_currency?: string };
    contract: Contract;
    document: string | null;
    history: { id: number; contract_type: string; start_date: string; end_date: string | null; status: string }[];
    templates: { id: number; name: string; contract_type: string }[];
    typeOptions: Options;
    statusOptions: Options;
    payFrequencyOptions: Options;
    canManage: boolean;
    canSignAsEmployee: boolean;
    canSignAsEmployer: boolean;
};

export default function ContractShow(props: Props) {
    const { contract } = props;
    const [mode, setMode] = useState<'none' | 'edit' | 'renew' | 'terminate'>('none');
    const errors = usePage().props.errors as Record<string, string>;
    const renewForm = useForm({ start_date: contract.end_date ? contract.end_date.slice(0, 10) : '', end_date: '', basic_salary: '' });
    const terminateForm = useForm({ termination_date: new Date().toISOString().slice(0, 10) });

    const open = ['draft', 'active'].includes(contract.status);
    const sign = (who: 'employee' | 'employer') => {
        if (window.confirm('Sign this contract? Your signature and the time are recorded.')) {
            router.post(route(`erp.hrm.contracts.sign.${who}`, contract.id), {}, { preserveScroll: true });
        }
    };

    return (
        <Page
            title={`${props.typeOptions[contract.contract_type] ?? 'Employment'} contract`}
            subtitle={
                <span className="flex flex-wrap items-center gap-2">
                    {personName(contract.employee)} · {contract.employee?.employee_number} <StatusBadge value={contract.status} label={props.statusOptions[contract.status]} />
                </span>
            }
            actions={
                <>
                    <a href={route('erp.hrm.contracts.index')} className={secondaryButton}>
                        Back
                    </a>
                    {props.canManage && open && (
                        <button type="button" onClick={() => setMode(mode === 'edit' ? 'none' : 'edit')} className={secondaryButton}>
                            Edit terms
                        </button>
                    )}
                    {props.canManage && ['active', 'expired'].includes(contract.status) && (
                        <button type="button" onClick={() => setMode('renew')} className={secondaryButton}>
                            Renew
                        </button>
                    )}
                    {props.canManage && open && (
                        <button type="button" onClick={() => setMode('terminate')} className={dangerButton}>
                            Terminate
                        </button>
                    )}
                </>
            }
        >
            {errors.contract && <p className="text-destructive rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">{errors.contract}</p>}

            {mode === 'edit' && (
                <Card title="Edit terms">
                    {contract.status === 'draft' && (contract.signed_by_employee_at || contract.signed_by_employer_at) && (
                        <p className="text-sm text-amber-800">Changing the terms clears the signatures already given.</p>
                    )}
                    <ContractForm
                        contract={contract}
                        templates={props.templates}
                        typeOptions={props.typeOptions}
                        payFrequencyOptions={props.payFrequencyOptions}
                        defaultCurrency={contract.currency_code}
                        submitUrl={route('erp.hrm.contracts.update', contract.id)}
                        method="put"
                        submitLabel="Save changes"
                        footer={
                            <button type="button" onClick={() => setMode('none')} className={secondaryButton}>
                                Cancel
                            </button>
                        }
                    />
                </Card>
            )}

            {mode === 'renew' && (
                <Card title="Renew contract">
                    <form
                        onSubmit={(e: FormEvent) => {
                            e.preventDefault();
                            renewForm.post(route('erp.hrm.contracts.renew', contract.id));
                        }}
                        className="grid gap-4 sm:grid-cols-3"
                    >
                        <Field label="New start date *" error={renewForm.errors.start_date}>
                            <TextInput type="date" value={renewForm.data.start_date} onChange={(v) => renewForm.setData('start_date', v)} />
                        </Field>
                        <Field label="New end date" error={renewForm.errors.end_date}>
                            <TextInput type="date" value={renewForm.data.end_date} onChange={(v) => renewForm.setData('end_date', v)} />
                        </Field>
                        <Field label="New basic salary (blank keeps it)" error={renewForm.errors.basic_salary}>
                            <TextInput type="number" step="0.01" value={renewForm.data.basic_salary} onChange={(v) => renewForm.setData('basic_salary', v)} />
                        </Field>
                        <div className="flex gap-2 sm:col-span-3">
                            <button type="submit" disabled={renewForm.processing} className={primaryButton}>
                                Draft renewal
                            </button>
                            <button type="button" onClick={() => setMode('none')} className={secondaryButton}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </Card>
            )}

            {mode === 'terminate' && (
                <Card title="Terminate contract">
                    <form
                        onSubmit={(e: FormEvent) => {
                            e.preventDefault();
                            terminateForm.post(route('erp.hrm.contracts.terminate', contract.id), { preserveScroll: true, onSuccess: () => setMode('none') });
                        }}
                        className="flex flex-wrap items-end gap-4"
                    >
                        <Field label="Last day *" error={terminateForm.errors.termination_date}>
                            <TextInput type="date" value={terminateForm.data.termination_date} onChange={(v) => terminateForm.setData('termination_date', v)} />
                        </Field>
                        <button type="submit" disabled={terminateForm.processing} className={dangerButton}>
                            Terminate
                        </button>
                        <button type="button" onClick={() => setMode('none')} className={secondaryButton}>
                            Cancel
                        </button>
                    </form>
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Terms" className="lg:col-span-2">
                    <dl className="grid gap-4 sm:grid-cols-3">
                        <Detail
                            label="Employee"
                            value={
                                contract.employee && (
                                    <a href={route('erp.hrm.employees.show', contract.employee.id)} className="text-primary underline">
                                        {personName(contract.employee)}
                                    </a>
                                )
                            }
                        />
                        <Detail label="Position" value={contract.employee?.position?.name} />
                        <Detail label="Department" value={contract.employee?.department?.name} />
                        <Detail label="Start" value={formatDate(contract.start_date)} />
                        <Detail label="End" value={contract.end_date ? formatDate(contract.end_date) : 'Open-ended'} />
                        <Detail label="Probation ends" value={contract.probation_end_date ? formatDate(contract.probation_end_date) : null} />
                        {contract.basic_salary !== undefined && (
                            <Detail label="Basic salary" value={`${contract.currency_code} ${Number(contract.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                        )}
                        <Detail label="Pay frequency" value={props.payFrequencyOptions[contract.pay_frequency]} />
                        <Detail label="Hours per week" value={Number(contract.working_hours_per_week)} />
                        <Detail label="Template" value={contract.template?.name} />
                        <Detail label="Drafted by" value={contract.creator?.name} />
                        <Detail label="Drafted on" value={formatDate(contract.created_at)} />
                    </dl>
                </Card>

                <Card title="Signatures">
                    <dl className="grid gap-3">
                        <Detail label="Employee" value={contract.signed_by_employee_at ? `Signed ${formatDate(contract.signed_by_employee_at)}` : 'Not signed'} />
                        <Detail label="Employer" value={contract.signed_by_employer_at ? `Signed ${formatDate(contract.signed_by_employer_at)}` : 'Not signed'} />
                    </dl>
                    <div className="flex flex-wrap gap-2">
                        {props.canSignAsEmployee && (
                            <button type="button" onClick={() => sign('employee')} className={primaryButton}>
                                Sign as employee
                            </button>
                        )}
                        {props.canSignAsEmployer && (
                            <button type="button" onClick={() => sign('employer')} className={primaryButton}>
                                Sign for {props.company.name}
                            </button>
                        )}
                    </div>
                    {contract.status === 'draft' && !props.canSignAsEmployee && !contract.signed_by_employee_at && (
                        <p className="text-muted-foreground text-xs">The employee signs from their own login once their user account is linked to their employee record.</p>
                    )}
                </Card>
            </div>

            {props.document && (
                <Card title="Contract document">
                    <div className="max-w-none text-sm leading-relaxed whitespace-pre-wrap">{props.document}</div>
                    <button type="button" onClick={() => window.print()} className={secondaryButton}>
                        Print
                    </button>
                </Card>
            )}

            {props.history.length > 0 && (
                <Card title="Other contracts for this employee">
                    <ul className="divide-y">
                        {props.history.map((h) => (
                            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                                <a href={route('erp.hrm.contracts.show', h.id)} className="text-primary underline">
                                    {props.typeOptions[h.contract_type]} · {formatDate(h.start_date)} – {h.end_date ? formatDate(h.end_date) : 'open-ended'}
                                </a>
                                <StatusBadge value={h.status} label={props.statusOptions[h.status]} />
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </Page>
    );
}
