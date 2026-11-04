import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { route } from 'ziggy-js';

const REQUISITION_MODEL = 'App\\Modules\\Requisitions\\Models\\Requisition';

type Member = { id: number; name: string; email: string; role: string };
type Currency = { code: string; name: string };
type Step = {
    step_order: number;
    approver_type: 'user' | 'role';
    approver_id: string;
    min_amount: string;
    max_amount: string;
    require_all: boolean;
    sla_hours: string;
    condition_key: string;
    condition_value: string;
    condition_json?: Record<string, string>;
};
type Workflow = {
    id: number;
    name: string;
    approvable_type: string;
    currency_code: string | null;
    is_active: boolean;
    has_requests: boolean;
    steps: Array<Omit<Step, 'condition_key' | 'condition_value'> & { condition_json: Record<string, string> | null }>;
};
type Props = {
    workflows: Workflow[];
    members: Member[];
    roles: string[];
    currencies: Currency[];
};

export default function Workflows({ workflows, members, roles, currencies }: Props) {
    const [editingId, setEditingId] = useState<number | null>(null);

    return (
        <main className="mx-auto max-w-6xl space-y-8 p-6">
            <section>
                <h1 className="text-2xl font-semibold">Approval workflows</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Configure ordered approval steps for a document model. Each step can target one active company member or membership role. Only one
                    active workflow per document model is used when a document is submitted.
                </p>
            </section>

            <section className="space-y-4 rounded-md border p-4">
                <h2 className="text-lg font-medium">Create workflow</h2>
                <WorkflowForm members={members} roles={roles} currencies={currencies} />
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-medium">Configured workflows</h2>
                {workflows.length === 0 && (
                    <p className="text-muted-foreground rounded-md border p-4 text-sm">No approval workflows have been configured.</p>
                )}
                {workflows.map((workflow) => (
                    <article key={workflow.id} className="space-y-4 rounded-md border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h3 className="font-medium">{workflow.name}</h3>
                                <p className="text-muted-foreground mt-1 text-sm break-all">{workflow.approvable_type}</p>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    {workflow.steps.length} step{workflow.steps.length === 1 ? '' : 's'}
                                    {workflow.currency_code ? ` · Threshold currency: ${workflow.currency_code}` : ''}
                                    {' · '}
                                    {workflow.is_active ? 'Active' : 'Inactive'}
                                    {workflow.has_requests && ' · Has submitted requests; create another version to change the rules'}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    disabled={workflow.has_requests}
                                    onClick={() => setEditingId(editingId === workflow.id ? null : workflow.id)}
                                    className="text-primary text-sm font-medium underline disabled:opacity-50"
                                >
                                    {editingId === workflow.id ? 'Close editor' : 'Edit'}
                                </button>
                                <button
                                    type="button"
                                    disabled={workflow.has_requests}
                                    onClick={() => {
                                        if (window.confirm(`Delete workflow “${workflow.name}”?`)) {
                                            router.delete(route('erp.approvals.workflows.destroy', workflow.id));
                                        }
                                    }}
                                    className="text-destructive text-sm underline disabled:opacity-50"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                        {editingId === workflow.id && (
                            <WorkflowForm
                                key={`${workflow.id}-${editingId}`}
                                initial={workflow}
                                members={members}
                                roles={roles}
                                currencies={currencies}
                                onSaved={() => setEditingId(null)}
                            />
                        )}
                        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {workflow.steps.map((step) => (
                                <li key={step.step_order} className="rounded border p-3 text-sm">
                                    <strong>Step {step.step_order}</strong>:{' '}
                                    {step.approver_type === 'role'
                                        ? `Role: ${step.approver_id}`
                                        : (members.find((member) => member.id.toString() === step.approver_id)?.name ?? `User ${step.approver_id}`)}
                                    {(step.min_amount || step.max_amount) && (
                                        <p className="text-muted-foreground mt-1">
                                            Amount: {step.min_amount || '0'} – {step.max_amount || 'no maximum'}
                                        </p>
                                    )}
                                    <p className="text-muted-foreground mt-1">
                                        {step.require_all ? 'All approvers must approve' : 'Any matching approver may approve'}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    </article>
                ))}
            </section>
        </main>
    );
}

function WorkflowForm({
    initial,
    members,
    roles,
    currencies,
    onSaved,
}: {
    initial?: Workflow;
    members: Member[];
    roles: string[];
    currencies: Currency[];
    onSaved?: () => void;
}) {
    const form = useForm({
        name: initial?.name ?? '',
        approvable_type: initial?.approvable_type ?? REQUISITION_MODEL,
        currency_code: initial?.currency_code ?? '',
        is_active: initial?.is_active ?? true,
        steps: initial?.steps.map((step) => {
            const [condition_key = '', condition_value = ''] = Object.entries(step.condition_json ?? {})[0] ?? [];
            return {
                step_order: step.step_order,
                approver_type: step.approver_type as 'user' | 'role',
                approver_id: step.approver_id ?? '',
                min_amount: step.min_amount ?? '',
                max_amount: step.max_amount ?? '',
                require_all: step.require_all,
                sla_hours: step.sla_hours?.toString() ?? '',
                condition_key,
                condition_value,
            };
        }) ?? [newStep(members, roles)],
    });
    const errors = form.errors as Record<string, string>;

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            currency_code: data.currency_code || null,
            steps: data.steps.map(({ condition_key, condition_value, ...step }) => ({
                ...step,
                min_amount: step.min_amount || null,
                max_amount: step.max_amount || null,
                sla_hours: step.sla_hours || null,
                condition_json: condition_key.trim() && condition_value.trim() ? { [condition_key.trim()]: condition_value.trim() } : {},
            })),
        }));
        const options = {
            onSuccess: () => {
                if (initial) {
                    onSaved?.();
                } else {
                    form.reset();
                }
            },
        };
        if (initial) {
            form.patch(route('erp.approvals.workflows.update', initial.id), options);
        } else {
            form.post(route('erp.approvals.workflows.store'), options);
        }
    };

    const updateStep = (index: number, patch: Partial<Step>) => {
        form.setData(
            'steps',
            form.data.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)),
        );
    };

    return (
        <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    label="Workflow name"
                    value={form.data.name}
                    onChange={(value) => form.setData('name', value)}
                    error={errors.name}
                    required
                />
                <TextField
                    label="Approvable model class"
                    value={form.data.approvable_type}
                    onChange={(value) => form.setData('approvable_type', value)}
                    error={errors.approvable_type}
                    placeholder={REQUISITION_MODEL}
                    required
                />
                {!initial && (
                    <p className="text-muted-foreground text-sm sm:col-span-2">
                        A requisition workflow is selected by default. Keep the model class as shown to route Phase 2 requisitions through this
                        workflow.
                    </p>
                )}
                <label className="grid gap-1 text-sm">
                    Threshold currency
                    <select
                        value={form.data.currency_code}
                        onChange={(event) => form.setData('currency_code', event.target.value)}
                        className="bg-background rounded-md border px-3 py-2"
                    >
                        <option value="">No amount thresholds</option>
                        {currencies.map((currency) => (
                            <option key={currency.code} value={currency.code}>
                                {currency.code} — {currency.name}
                            </option>
                        ))}
                    </select>
                    {errors.currency_code && <span className="text-destructive">{errors.currency_code}</span>}
                </label>
                <label className="flex items-center gap-2 self-end text-sm">
                    <input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} />
                    Active workflow
                </label>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium">Approval steps</h3>
                    <button
                        type="button"
                        disabled={form.data.steps.length >= 20}
                        onClick={() => form.setData('steps', [...form.data.steps, newStep(members, roles)])}
                        className="text-primary text-sm font-medium underline disabled:opacity-50"
                    >
                        Add step
                    </button>
                </div>
                {errors.steps && <p className="text-destructive text-sm">{errors.steps}</p>}
                {form.data.steps.map((step, index) => (
                    <fieldset key={index} className="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-3">
                        <legend className="px-1 text-sm font-medium">Step {index + 1}</legend>
                        <label className="grid gap-1 text-sm">
                            Approver type
                            <select
                                value={step.approver_type}
                                onChange={(event) => {
                                    const approver_type = event.target.value as 'user' | 'role';
                                    updateStep(index, {
                                        approver_type,
                                        approver_id: approver_type === 'user' ? (members[0]?.id.toString() ?? '') : (roles[0] ?? ''),
                                    });
                                }}
                                className="bg-background rounded-md border px-3 py-2"
                            >
                                <option value="user">Specific company member</option>
                                <option value="role">Company membership role</option>
                            </select>
                        </label>
                        <label className="grid gap-1 text-sm">
                            {step.approver_type === 'user' ? 'Approver' : 'Company role'}
                            <select
                                required
                                value={step.approver_id}
                                onChange={(event) => updateStep(index, { approver_id: event.target.value })}
                                className="bg-background rounded-md border px-3 py-2"
                            >
                                {step.approver_type === 'user'
                                    ? members.map((member) => (
                                          <option key={member.id} value={member.id}>
                                              {member.name} — {member.email}
                                          </option>
                                      ))
                                    : roles.map((role) => (
                                          <option key={role} value={role}>
                                              {role}
                                          </option>
                                      ))}
                            </select>
                            {errors[`steps.${index}.approver_id`] && <span className="text-destructive">{errors[`steps.${index}.approver_id`]}</span>}
                        </label>
                        <label className="flex items-center gap-2 self-end text-sm">
                            <input
                                type="checkbox"
                                checked={step.require_all}
                                onChange={(event) => updateStep(index, { require_all: event.target.checked })}
                            />
                            Require all eligible approvers
                        </label>
                        <TextField
                            label="Minimum amount (optional)"
                            value={step.min_amount}
                            onChange={(value) => updateStep(index, { min_amount: value })}
                            error={errors[`steps.${index}.min_amount`]}
                            inputMode="decimal"
                        />
                        <TextField
                            label="Maximum amount (optional)"
                            value={step.max_amount}
                            onChange={(value) => updateStep(index, { max_amount: value })}
                            error={errors[`steps.${index}.max_amount`]}
                            inputMode="decimal"
                        />
                        <TextField
                            label="SLA hours (optional)"
                            value={step.sla_hours}
                            onChange={(value) => updateStep(index, { sla_hours: value })}
                            error={errors[`steps.${index}.sla_hours`]}
                            inputMode="numeric"
                        />
                        <TextField
                            label="Context condition key (optional)"
                            value={step.condition_key}
                            onChange={(value) => updateStep(index, { condition_key: value })}
                            error={errors[`steps.${index}.condition_json`]}
                            placeholder="department"
                        />
                        <TextField
                            label="Context condition value"
                            value={step.condition_value}
                            onChange={(value) => updateStep(index, { condition_value: value })}
                            placeholder="finance"
                        />
                        {form.data.steps.length > 1 && (
                            <button
                                type="button"
                                onClick={() =>
                                    form.setData(
                                        'steps',
                                        form.data.steps.filter((_, stepIndex) => stepIndex !== index),
                                    )
                                }
                                className="text-destructive self-end text-left text-sm underline"
                            >
                                Remove step
                            </button>
                        )}
                    </fieldset>
                ))}
            </div>
            <button
                type="submit"
                disabled={form.processing || members.length === 0}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
                {form.processing ? 'Saving…' : initial ? 'Save workflow' : 'Create workflow'}
            </button>
            {members.length === 0 && <p className="text-destructive text-sm">Add an active company member before configuring approvers.</p>}
        </form>
    );
}

function newStep(members: Member[], roles: string[]): Step {
    const member = members[0];
    return {
        step_order: 1,
        approver_type: 'user',
        approver_id: member?.id.toString() ?? roles[0] ?? '',
        min_amount: '',
        max_amount: '',
        require_all: false,
        sla_hours: '',
        condition_key: '',
        condition_value: '',
    };
}

function TextField({
    label,
    value,
    onChange,
    error,
    placeholder,
    required = false,
    inputMode,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    placeholder?: string;
    required?: boolean;
    inputMode?: 'decimal' | 'numeric';
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <input
                required={required}
                value={value}
                inputMode={inputMode}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                className="bg-background rounded-md border px-3 py-2"
            />
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}
