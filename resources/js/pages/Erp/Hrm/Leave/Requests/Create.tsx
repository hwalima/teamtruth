import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type LeaveType = {
    id: number;
    code: string;
    name: string;
    requires_attachment: boolean;
    requires_approval: boolean;
    max_consecutive_days: number | null;
    max_duration_days: number | null;
    min_duration_days: number | null;
};
type Employee = { id: number; employee_number: string; first_name: string; last_name: string; user: { name: string; email: string } | null };
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    employee: Employee;
    leaveTypes: LeaveType[];
};

export default function LeaveRequestCreate(props: Props) {
    const form = useForm({
        employee_id: '',
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        attachment_path: '',
        contact_during_leave: '',
        handover_notes: '',
    });

    const errors = form.errors as Record<string, string>;

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.hrm.leave.requests.store'), form.data);
    };

    const workingDays = form.data.start_date && form.data.end_date && form.data.leave_type_id
        ? calculateWorkingDays(props.leaveTypes.find(lt => lt.id === Number(form.data.leave_type_id))!)
        : 0;

    const calculateWorkingDays = (leaveType: LeaveType | undefined): number => {
        if (!leaveType || !form.data.start_date || !form.data.end_date) return 0;
        const start = new Date(form.data.start_date);
        const end = new Date(form.data.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        // This is a simplified calculation - actual working days would be calculated server-side
        return diffDays;
    };

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">Request Leave</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Submit a new leave request for {props.employee.first_name} {props.employee.last_name}.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Leave Details</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Leave Type *</span>
                                <select
                                    value={form.data.leave_type_id}
                                    onChange={(e) => form.setData('leave_type_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                >
                                    <option value="">Select leave type</option>
                                    {props.leaveTypes.map((lt) => (
                                        <option key={lt.id} value={lt.id.toString()}>
                                            {lt.code} — {lt.name} {lt.requires_attachment && '(attachment required)'}
                                        </option>
                                    ))}
                                </select>
                                {errors.leave_type_id && <p className="text-destructive text-sm mt-1">{errors.leave_type_id}</p>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Start Date *</span>
                                <input
                                    type="date"
                                    value={form.data.start_date}
                                    onChange={(e) => form.setData('start_date', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                {errors.start_date && <p className="text-destructive text-sm mt-1">{errors.start_date}</p>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">End Date *</span>
                                <input
                                    type="date"
                                    value={form.data.end_date}
                                    onChange={(e) => form.setData('end_date', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                {errors.end_date && <p className="text-destructive text-sm mt-1">{errors.end_date}</p>}
                            </label>
                        </div>
                        {form.data.leave_type_id && (
                            <div className="sm:col-span-2 p-4 bg-muted/50 rounded-lg">
                                <p className="font-medium">Estimated Working Days: {workingDays}</p>
                                <p className="text-sm text-muted-foreground">Actual working days will be calculated based on work schedule and public holidays.</p>
                            </div>
                        )}
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Reason</span>
                                <textarea
                                    value={form.data.reason}
                                    onChange={(e) => form.setData('reason', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Contact During Leave</span>
                                <input
                                    type="text"
                                    value={form.data.contact_during_leave}
                                    onChange={(e) => form.setData('contact_during_leave', e.target.value)}
                                    placeholder="Phone/email for emergencies"
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Handover Notes</span>
                                <textarea
                                    value={form.data.handover_notes}
                                    onChange={(e) => form.setData('handover_notes', e.target.value)}
                                    rows={3}
                                    placeholder="Key tasks, contacts, and information for colleagues covering your work"
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                    </div>
                </section>

                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Supporting Document</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Attachment Path</span>
                                <input
                                    type="text"
                                    value={form.data.attachment_path}
                                    onChange={(e) => form.setData('attachment_path', e.target.value)}
                                    placeholder="/path/to/document.pdf"
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                                {errors.attachment_path && <p className="text-destructive text-sm mt-1">{errors.attachment_path}</p>}
                                <p className="text-xs text-muted-foreground">
                                    Enter the file path or URL of the supporting document (medical certificate, etc.)
                                </p>
                            </label>
                        </div>
                    </div>
                </section>

                <div className="flex flex-wrap justify-end gap-3 border-t pt-6">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {form.processing ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </form>
        </main>
    );
}