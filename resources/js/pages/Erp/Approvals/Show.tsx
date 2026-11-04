import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Member = { id: number; name: string; email: string };
type Props = {
    approval: {
        id: number;
        status: string;
        current_step: number;
        amount: string;
        currency_code: string | null;
        context: Record<string, unknown>;
        submitted_at: string;
        completed_at: string | null;
        workflow: {
            name: string;
            steps: Array<{
                step_order: number;
                approver_type: string;
                approver_id: string;
                min_amount: string | null;
                max_amount: string | null;
                condition_json: Record<string, string>;
                require_all: boolean;
                sla_hours: number | null;
            }>;
        };
        requester: Member;
        document: { type: string; id: number; reference: string | null } | null;
        actions: Array<{
            id: number;
            action: string;
            comment: string | null;
            acted_at: string;
            actor: { id: number; name: string };
            step_order: number;
            signature: { name?: string; title?: string | null } | null;
        }>;
    };
    canAct: boolean;
    members: Member[];
};

export default function Show({ approval, canAct, members }: Props) {
    const actionForm = useForm({ action: 'approve', comment: '' });
    const delegationForm = useForm({
        to_user_id: members[0]?.id.toString() ?? '',
        starts_at: localDateTimeValue(),
        ends_at: '',
    });
    const actionErrors = actionForm.errors as Record<string, string>;
    const delegationErrors = delegationForm.errors as Record<string, string>;

    const act = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        actionForm.post(route('erp.approvals.act', approval.id));
    };
    const submitAction = (action: string) => {
        actionForm.transform((data) => ({ ...data, action }));
        actionForm.post(route('erp.approvals.act', approval.id), { preserveScroll: true });
    };
    const delegate = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        delegationForm.post(route('erp.approvals.delegate', approval.id));
    };

    return (
        <main className="mx-auto max-w-5xl space-y-8 p-6">
            <section>
                <a href={route('erp.approvals.index')} className="text-sm text-primary underline">Back to approvals</a>
                <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold">Approval #{approval.id}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{approval.workflow.name} · {approval.status}</p>
                    </div>
                    <p className="text-lg font-medium">{approval.amount} {approval.currency_code ?? ''}</p>
                </div>
            </section>

            <section className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
                <Detail label="Requester" value={`${approval.requester.name} (${approval.requester.email})`} />
                <Detail label="Submitted" value={new Date(approval.submitted_at).toLocaleString()} />
                <Detail
                    label="Document"
                    value={approval.document
                        ? `${approval.document.reference ? `${approval.document.reference} · ` : ''}${approval.document.type} #${approval.document.id}`
                        : 'Document record unavailable'}
                />
                <Detail label="Current step" value={`${approval.current_step} of ${approval.workflow.steps.length}`} />
                {approval.completed_at && <Detail label="Completed" value={new Date(approval.completed_at).toLocaleString()} />}
                {Object.keys(approval.context).length > 0 && (
                    <div className="sm:col-span-2">
                        <h2 className="text-sm font-medium">Submitted context</h2>
                        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                            {Object.entries(approval.context).map(([key, value]) => (
                                <Detail key={key} label={key} value={String(value)} />
                            ))}
                        </dl>
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-medium">Workflow progress</h2>
                <ol className="grid gap-3 sm:grid-cols-2">
                    {approval.workflow.steps.map((step) => (
                        <li key={step.step_order} className={`rounded-md border p-4 ${step.step_order === approval.current_step && approval.status === 'pending' ? 'border-primary' : ''}`}>
                            <h3 className="font-medium">
                                Step {step.step_order}{step.step_order === approval.current_step && approval.status === 'pending' ? ' · Current' : ''}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {step.approver_type === 'role' ? `Role: ${step.approver_id}` : `User ID: ${step.approver_id}`}
                                {step.require_all ? ' · All must approve' : ' · Any may approve'}
                            </p>
                            {(step.min_amount || step.max_amount) && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Amount range: {step.min_amount ?? '0'} to {step.max_amount ?? 'no maximum'}
                                </p>
                            )}
                            {Object.keys(step.condition_json).length > 0 && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Conditions: {Object.entries(step.condition_json).map(([key, value]) => `${key} = ${value}`).join(', ')}
                                </p>
                            )}
                            {step.sla_hours && <p className="mt-1 text-sm text-muted-foreground">SLA: {step.sla_hours} hours</p>}
                        </li>
                    ))}
                </ol>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-medium">Activity</h2>
                {approval.actions.length === 0 ? (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">No actions have been recorded.</p>
                ) : (
                    <ol className="space-y-3">
                        {approval.actions.map((action) => (
                            <li key={action.id} className="rounded-md border p-4">
                                <div className="flex flex-wrap justify-between gap-2">
                                    <strong>{action.actor.name} · {action.action} · Step {action.step_order}</strong>
                                    <time className="text-sm text-muted-foreground">{new Date(action.acted_at).toLocaleString()}</time>
                                </div>
                                {action.signature?.name && (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Signed as {action.signature.name}{action.signature.title ? `, ${action.signature.title}` : ''}
                                    </p>
                                )}
                                {action.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{action.comment}</p>}
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            {canAct && (
                <section className="grid gap-6 rounded-md border p-4 lg:grid-cols-2">
                    <form onSubmit={act} className="space-y-3">
                        <h2 className="text-lg font-medium">Record a decision</h2>
                        <label className="grid gap-1 text-sm">
                            Comment
                            <textarea
                                value={actionForm.data.comment}
                                onChange={(event) => actionForm.setData('comment', event.target.value)}
                                className="min-h-24 rounded-md border bg-background px-3 py-2"
                            />
                            {actionErrors.comment && <span className="text-destructive">{actionErrors.comment}</span>}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <ActionButton form={actionForm} action="approve" onClick={submitAction} />
                            <ActionButton form={actionForm} action="return" onClick={submitAction} secondary />
                            <ActionButton form={actionForm} action="reject" onClick={submitAction} destructive />
                            <ActionButton form={actionForm} action="comment" onClick={submitAction} secondary />
                        </div>
                    </form>

                    {members.length > 0 && (
                        <form onSubmit={delegate} className="space-y-3">
                            <h2 className="text-lg font-medium">Delegate this approval</h2>
                            <label className="grid gap-1 text-sm">
                                Company member
                                <select
                                    value={delegationForm.data.to_user_id}
                                    onChange={(event) => delegationForm.setData('to_user_id', event.target.value)}
                                    className="rounded-md border bg-background px-3 py-2"
                                >
                                    {members.map((member) => (
                                        <option key={member.id} value={member.id}>{member.name} — {member.email}</option>
                                    ))}
                                </select>
                            </label>
                            <DateField label="Starts at" value={delegationForm.data.starts_at} onChange={(value) => delegationForm.setData('starts_at', value)} error={delegationErrors.starts_at} />
                            <DateField label="Ends at" value={delegationForm.data.ends_at} onChange={(value) => delegationForm.setData('ends_at', value)} error={delegationErrors.ends_at} />
                            <button
                                type="submit"
                                disabled={delegationForm.processing}
                                className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
                            >
                                {delegationForm.processing ? 'Delegating…' : 'Delegate'}
                            </button>
                        </form>
                    )}
                </section>
            )}
        </main>
    );
}

function ActionButton({
    form,
    action,
    onClick,
    secondary = false,
    destructive = false,
}: {
    form: ReturnType<typeof useForm<{ action: string; comment: string }>>;
    action: string;
    onClick: (action: string) => void;
    secondary?: boolean;
    destructive?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={form.processing}
            onClick={() => onClick(action)}
            className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${destructive ? 'bg-destructive text-destructive-foreground' : secondary ? 'border' : 'bg-primary text-primary-foreground'}`}
        >
            {action[0].toUpperCase() + action.slice(1)}
        </button>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
        </div>
    );
}

function DateField({
    label,
    value,
    onChange,
    error,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <input
                type="datetime-local"
                required
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-md border bg-background px-3 py-2"
            />
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}

function localDateTimeValue(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
