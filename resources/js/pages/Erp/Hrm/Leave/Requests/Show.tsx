import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Employee = { id: number; employee_number: string; first_name: string; last_name: string; user: { name: string; email: string } | null };
type LeaveType = { id: number; code: string; name: string; category: string };
type LeaveRequest = {
    id: number;
    employee: Employee;
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    working_days: number;
    status: string;
    reason: string | null;
    attachment_path: string | null;
    contact_during_leave: string | null;
    handover_notes: string | null;
    approved_by: Employee | null;
    approved_at: string | null;
    rejection_reason: string | null;
    cancelled_at: string | null;
    cancelled_by: Employee | null;
    cancellation_reason: string | null;
    created_at: string;
    ledger_entries: Array<{
        id: number;
        transaction_type: string;
        days: number;
        balance_before: number;
        balance_after: number;
        description: string | null;
        created_at: string;
    }>;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    leaveRequest: LeaveRequest;
    canApprove: boolean;
    canReject: boolean;
    canCancel: boolean;
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default function LeaveRequestShow(props: Props) {
    const { leaveRequest, canApprove, canReject, canCancel } = props;

    const actionForm = useForm({
        notes: '',
        reason: '',
    });

    const handleApprove = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.hrm.leave.requests.approve', leaveRequest.id), actionForm.data, {
            onSuccess: () => actionForm.reset('notes'),
        });
    };

    const handleReject = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.hrm.leave.requests.reject', leaveRequest.id), actionForm.data, {
            onSuccess: () => actionForm.reset('reason'),
        });
    };

    const handleCancel = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.hrm.leave.requests.cancel', leaveRequest.id), actionForm.data, {
            onSuccess: () => actionForm.reset('reason'),
        });
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString();
    };

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString();
    };

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-6">
            <header className="flex flex-wrap justify-between gap-4 items-start">
                <div>
                    <p className="text-muted-foreground text-sm">{props.company.code}</p>
                    <h1 className="text-2xl font-semibold">Leave Request</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {leaveRequest.employee.employee_number} — {leaveRequest.employee.first_name} {leaveRequest.employee.last_name}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-lg text-xs ${statusColors[leaveRequest.status] ?? 'bg-gray-100 text-gray-800'}`}>
                        {leaveRequest.status}
                    </span>
                    {canApprove && leaveRequest.status === 'pending' && (
                        <>
                            <button
                                onClick={() => document.getElementById('approve-modal')?.classList.remove('hidden')}
                                className="bg-green-600 text-white inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-green-700"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => document.getElementById('reject-modal')?.classList.remove('hidden')}
                                className="border-destructive/50 bg-destructive/10 hover:bg-destructive/20 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium text-destructive transition-colors"
                            >
                                Reject
                            </button>
                        </>
                    )}
                    {canCancel && (leaveRequest.status === 'pending' || leaveRequest.status === 'approved') && (
                        <button
                            onClick={() => document.getElementById('cancel-modal')?.classList.remove('hidden')}
                            className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="rounded-xl border bg-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Leave Details</h2>
                        <dl className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm text-muted-foreground">Leave Type</dt>
                                <dd className="font-medium">{leaveRequest.leave_type.code} — {leaveRequest.leave_type.name}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Category</dt>
                                <dd className="font-medium capitalize">{leaveRequest.leave_type.category}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Start Date</dt>
                                <dd className="font-medium">{formatDate(leaveRequest.start_date)}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">End Date</dt>
                                <dd className="font-medium">{formatDate(leaveRequest.end_date)}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Working Days</dt>
                                <dd className="font-medium">{leaveRequest.working_days} days</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Status</dt>
                                <dd className="font-medium">
                                    <span className={`px-2 py-1 rounded text-xs ${statusColors[leaveRequest.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                        {leaveRequest.status}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Submitted</dt>
                                <dd className="font-medium">{formatDateTime(leaveRequest.created_at)}</dd>
                            </div>
                            {leaveRequest.approved_at && (
                                <>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">Approved By</dt>
                                        <dd className="font-medium">
                                            {leaveRequest.approved_by ? `${leaveRequest.approved_by.employee_number} — ${leaveRequest.approved_by.first_name} ${leaveRequest.approved_by.last_name}` : '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">Approved At</dt>
                                        <dd className="font-medium">{formatDateTime(leaveRequest.approved_at)}</dd>
                                    </div>
                                </>
                            )}
                            {leaveRequest.rejection_reason && (
                                <div className="sm:col-span-2">
                                    <dt className="text-sm text-muted-foreground">Rejection Reason</dt>
                                    <dd className="font-medium text-destructive">{leaveRequest.rejection_reason}</dd>
                                </div>
                            )}
                            {leaveRequest.cancelled_at && (
                                <>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">Cancelled By</dt>
                                        <dd className="font-medium">
                                            {leaveRequest.cancelled_by ? `${leaveRequest.cancelled_by.employee_number} — ${leaveRequest.cancelled_by.first_name} ${leaveRequest.cancelled_by.last_name}` : '—'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">Cancelled At</dt>
                                        <dd className="font-medium">{formatDateTime(leaveRequest.cancelled_at)}</dd>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <dt className="text-sm text-muted-foreground">Cancellation Reason</dt>
                                        <dd className="font-medium">{leaveRequest.cancellation_reason ?? '—'}</dd>
                                    </div>
                                </>
                            )}
                        </dl>
                    </section>

                    {leaveRequest.reason && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Reason</h2>
                            <p className="whitespace-pre-wrap">{leaveRequest.reason}</p>
                        </section>
                    )}

                    {leaveRequest.contact_during_leave && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Contact During Leave</h2>
                            <p>{leaveRequest.contact_during_leave}</p>
                        </section>
                    )}

                    {leaveRequest.handover_notes && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Handover Notes</h2>
                            <p className="whitespace-pre-wrap">{leaveRequest.handover_notes}</p>
                        </section>
                    )}

                    {leaveRequest.attachment_path && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Attachment</h2>
                            <a href={leaveRequest.attachment_path} target="_blank" className="text-primary underline">
                                View Attachment
                            </a>
                        </section>
                    )}

                    {leaveRequest.ledger_entries.length > 0 && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Leave Balance Transactions</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground border-b">
                                            <th className="pb-2 font-medium">Type</th>
                                            <th className="pb-2 font-medium text-right">Days</th>
                                            <th className="pb-2 font-medium text-right">Balance Before</th>
                                            <th className="pb-2 font-medium text-right">Balance After</th>
                                            <th className="pb-2 font-medium">Description</th>
                                            <th className="pb-2 font-medium">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaveRequest.ledger_entries.map((entry) => (
                                            <tr key={entry.id} className="border-b border-border/50">
                                                <td className="py-2 capitalize">{entry.transaction_type.replaceAll('_', ' ')}</td>
                                                <td className="py-2 text-right">
                                                    {entry.days > 0 ? '+' : ''}{entry.days}
                                                </td>
                                                <td className="py-2 text-right">{entry.balance_before}</td>
                                                <td className="py-2 text-right font-semibold">{entry.balance_after}</td>
                                                <td className="py-2">{entry.description ?? '—'}</td>
                                                <td className="py-2 text-muted-foreground">{formatDateTime(entry.created_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </div>

                {/* Employee Info Sidebar */}
                <div className="space-y-6">
                    <section className="rounded-xl border bg-card p-6 space-y-3">
                        <h2 className="text-lg font-semibold">Employee</h2>
                        <p className="font-medium">{leaveRequest.employee.employee_number}</p>
                        <p>{leaveRequest.employee.first_name} {leaveRequest.employee.last_name}</p>
                        <p className="text-sm text-muted-foreground">{leaveRequest.employee.user?.email ?? 'No email'}</p>
                    </section>
                </div>
            </div>

            {/* Approve Modal */}
            <div id="approve-modal" className="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-md bg-card rounded-xl p-6 shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">Approve Leave Request</h3>
                    <form onSubmit={handleApprove} className="space-y-4">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Notes</span>
                                <textarea
                                    value={actionForm.data.notes}
                                    onChange={(e) => actionForm.setData('notes', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <button
                                type="button"
                                onClick={() => document.getElementById('approve-modal')?.classList.add('hidden')}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={actionForm.processing}
                                className="bg-green-600 text-white inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                            >
                                {actionForm.processing ? 'Approving...' : 'Approve'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Reject Modal */}
            <div id="reject-modal" className="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-md bg-card rounded-xl p-6 shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">Reject Leave Request</h3>
                    <form onSubmit={handleReject} className="space-y-4">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Reason *</span>
                                <textarea
                                    value={actionForm.data.reason}
                                    onChange={(e) => actionForm.setData('reason', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <button
                                type="button"
                                onClick={() => document.getElementById('reject-modal')?.classList.add('hidden')}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={actionForm.processing}
                                className="bg-destructive text-white inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-destructive/90 disabled:opacity-50"
                            >
                                {actionForm.processing ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Cancel Modal */}
            <div id="cancel-modal" className="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-md bg-card rounded-xl p-6 shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">Cancel Leave Request</h3>
                    <form onSubmit={handleCancel} className="space-y-4">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Reason *</span>
                                <textarea
                                    value={actionForm.data.reason}
                                    onChange={(e) => actionForm.setData('reason', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <button
                                type="button"
                                onClick={() => document.getElementById('cancel-modal')?.classList.add('hidden')}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={actionForm.processing}
                                className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                            >
                                {actionForm.processing ? 'Cancelling...' : 'Cancel Request'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}