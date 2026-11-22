import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Detail, Field, Page, StatusBadge, TextArea, dangerButton, formatDate, humanize, personName, primaryButton, secondaryButton } from '@/components/hrm/ui';

type LeaveRequest = {
    id: number;
    employee: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string } | null;
    leave_type: { name: string; color: string | null; requires_approval: boolean } | null;
    start_date: string;
    end_date: string;
    total_days: string;
    reason: string;
    status: string;
    approved_by: { name: string } | null;
    approved_at: string | null;
    rejection_reason: string | null;
    attachment_path: string | null;
    created_at: string;
    ledger_entries: { id: number; transaction_type: string; days: string; balance_after: string; description: string | null; created_at: string }[];
};

type Props = {
    company: { name: string };
    leaveRequest: LeaveRequest;
    balance: { available: number; total_entitlement: number; taken: string } | null;
    canApprove: boolean;
    canCancel: boolean;
};

export default function LeaveRequestShow({ leaveRequest, balance, canApprove, canCancel }: Props) {
    const approveForm = useForm({});
    const rejectForm = useForm({ reason: '' });
    const cancelForm = useForm({ reason: '' });

    const decidedLabel = leaveRequest.status === 'rejected' ? 'Rejected by' : leaveRequest.status === 'approved' ? 'Approved by' : 'Decided by';

    return (
        <Page
            title={`${leaveRequest.leave_type?.name ?? 'Leave'} request`}
            subtitle={
                <span className="flex items-center gap-2">
                    {personName(leaveRequest.employee)} · submitted {formatDate(leaveRequest.created_at)} <StatusBadge value={leaveRequest.status} />
                </span>
            }
            actions={
                <a href={route('erp.hrm.leave.requests.index')} className={secondaryButton}>
                    Back
                </a>
            }
        >
            <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Details" className="lg:col-span-2">
                    <dl className="grid gap-4 sm:grid-cols-3">
                        <Detail
                            label="Employee"
                            value={
                                leaveRequest.employee && (
                                    <a href={route('erp.hrm.employees.show', leaveRequest.employee.id)} className="text-primary underline">
                                        {personName(leaveRequest.employee)}
                                    </a>
                                )
                            }
                        />
                        <Detail label="From" value={formatDate(leaveRequest.start_date)} />
                        <Detail label="To" value={formatDate(leaveRequest.end_date)} />
                        <Detail label="Working days" value={Number(leaveRequest.total_days)} />
                        <Detail label={decidedLabel} value={leaveRequest.approved_by?.name} />
                        <Detail label="Decided on" value={leaveRequest.approved_at ? formatDate(leaveRequest.approved_at) : null} />
                    </dl>
                    <Detail label="Reason" value={leaveRequest.reason} />
                    {leaveRequest.rejection_reason && <Detail label={leaveRequest.status === 'cancelled' ? 'Cancellation note' : 'Rejection reason'} value={leaveRequest.rejection_reason} />}
                    {leaveRequest.attachment_path && <Detail label="Attachment" value="A supporting document was uploaded." />}
                </Card>

                <Card title="Balance">
                    {balance ? (
                        <dl className="grid gap-3">
                            <Detail label="Available now" value={`${balance.available} day(s)`} />
                            <Detail label="Entitlement this period" value={`${balance.total_entitlement} day(s)`} />
                            <Detail label="Taken" value={`${Number(balance.taken)} day(s)`} />
                        </dl>
                    ) : (
                        <p className="text-muted-foreground text-sm">No balance found.</p>
                    )}
                </Card>
            </div>

            {(canApprove || canCancel) && (
                <div className="grid gap-6 lg:grid-cols-3">
                    {canApprove && (
                        <Card title="Approve">
                            <p className="text-muted-foreground text-sm">Approving deducts {Number(leaveRequest.total_days)} day(s) from the balance.</p>
                            <button type="button" disabled={approveForm.processing} onClick={() => approveForm.post(route('erp.hrm.leave.requests.approve', leaveRequest.id), { preserveScroll: true })} className={primaryButton}>
                                Approve
                            </button>
                            {(approveForm.errors as Record<string, string>).status && <p className="text-destructive text-sm">{(approveForm.errors as Record<string, string>).status}</p>}
                        </Card>
                    )}
                    {canApprove && (
                        <Card title="Reject">
                            <form
                                onSubmit={(e: FormEvent) => {
                                    e.preventDefault();
                                    rejectForm.post(route('erp.hrm.leave.requests.reject', leaveRequest.id), { preserveScroll: true });
                                }}
                                className="space-y-3"
                            >
                                <Field label="Reason *" error={rejectForm.errors.reason}>
                                    <TextArea value={rejectForm.data.reason} onChange={(v) => rejectForm.setData('reason', v)} rows={2} />
                                </Field>
                                <button type="submit" disabled={rejectForm.processing} className={dangerButton}>
                                    Reject
                                </button>
                            </form>
                        </Card>
                    )}
                    {canCancel && (
                        <Card title="Cancel request">
                            <form
                                onSubmit={(e: FormEvent) => {
                                    e.preventDefault();
                                    if (window.confirm('Cancel this leave request?')) {
                                        cancelForm.post(route('erp.hrm.leave.requests.cancel', leaveRequest.id), { preserveScroll: true });
                                    }
                                }}
                                className="space-y-3"
                            >
                                <Field label="Note" error={cancelForm.errors.reason}>
                                    <TextArea value={cancelForm.data.reason} onChange={(v) => cancelForm.setData('reason', v)} rows={2} />
                                </Field>
                                <button type="submit" disabled={cancelForm.processing} className={secondaryButton}>
                                    Cancel request
                                </button>
                            </form>
                        </Card>
                    )}
                </div>
            )}

            {leaveRequest.ledger_entries.length > 0 && (
                <Card title="Balance movements">
                    <ul className="divide-y">
                        {leaveRequest.ledger_entries.map((entry) => (
                            <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                                <span>
                                    {humanize(entry.transaction_type)} · {formatDate(entry.created_at)}
                                    {entry.description && <span className="text-muted-foreground"> — {entry.description}</span>}
                                </span>
                                <span>
                                    {Number(entry.days) > 0 ? '+' : ''}
                                    {Number(entry.days)} → {Number(entry.balance_after)} left
                                </span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </Page>
    );
}
