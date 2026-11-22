import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Empty, Field, Page, Select, TextArea, TextInput, idOptions, personName, primaryButton, secondaryButton } from '@/components/hrm/ui';

type Person = { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string };
type LeaveType = { id: number; name: string; code: string; color: string | null; description: string | null; requires_document: boolean; requires_approval: boolean };
type Balance = { id: number; leave_type: { name: string } | null; available: number; total_entitlement: number };

type Props = {
    company: { name: string };
    employee: Person | null;
    employees: Person[];
    leaveTypes: LeaveType[];
    balances: Balance[];
    canRequestForOthers: boolean;
};

/** Monday–Friday count; the server also skips public holidays. */
function weekdays(start: string, end: string): number {
    if (!start || !end) return 0;
    const from = new Date(`${start}T00:00:00`);
    const to = new Date(`${end}T00:00:00`);
    let count = 0;
    for (const day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
        if (day.getDay() !== 0 && day.getDay() !== 6) count++;
    }
    return count;
}

export default function LeaveRequestCreate(props: Props) {
    const form = useForm<{ employee_id: string; leave_type_id: string; start_date: string; end_date: string; reason: string; attachment: File | null }>({
        employee_id: '',
        leave_type_id: props.leaveTypes[0] ? String(props.leaveTypes[0].id) : '',
        start_date: '',
        end_date: '',
        reason: '',
        attachment: null,
    });
    const errors = form.errors as Record<string, string>;
    const selectedType = props.leaveTypes.find((t) => String(t.id) === form.data.leave_type_id);
    const canSubmit = props.employee !== null || props.canRequestForOthers;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.hrm.leave.requests.store'), { forceFormData: true });
    };

    return (
        <Page title="Request leave" subtitle={props.employee ? `${personName(props.employee)} · ${props.employee.employee_number}` : props.company.name}>
            {!canSubmit ? (
                <Empty>Your user account is not linked to an employee record, so you cannot request leave yet. Ask HR to link your account on your employee profile.</Empty>
            ) : props.leaveTypes.length === 0 ? (
                <Empty>
                    No leave types are set up yet.{' '}
                    <a href={route('erp.hrm.leave.types.index')} className="text-primary underline">
                        Create leave types
                    </a>{' '}
                    first.
                </Empty>
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    <Card title="Leave details" className="lg:col-span-2">
                        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                            {props.canRequestForOthers && (
                                <Field label={props.employee ? 'Employee (leave empty for yourself)' : 'Employee *'} error={errors.employee_id} className="sm:col-span-2">
                                    <Select
                                        value={form.data.employee_id}
                                        onChange={(v) => form.setData('employee_id', v)}
                                        options={idOptions(props.employees, (e) => `${e.employee_number} — ${personName(e)}`)}
                                        placeholder={props.employee ? '— Myself —' : '— Select —'}
                                    />
                                </Field>
                            )}
                            <Field label="Leave type *" error={errors.leave_type_id} className="sm:col-span-2">
                                <Select value={form.data.leave_type_id} onChange={(v) => form.setData('leave_type_id', v)} options={idOptions(props.leaveTypes, (t) => t.name)} />
                            </Field>
                            {selectedType?.description && <p className="text-muted-foreground text-sm sm:col-span-2">{selectedType.description}</p>}
                            <Field label="First day *" error={errors.start_date}>
                                <TextInput type="date" value={form.data.start_date} onChange={(v) => form.setData((d) => ({ ...d, start_date: v, end_date: d.end_date && d.end_date >= v ? d.end_date : v }))} />
                            </Field>
                            <Field label="Last day *" error={errors.end_date}>
                                <TextInput type="date" min={form.data.start_date} value={form.data.end_date} onChange={(v) => form.setData('end_date', v)} />
                            </Field>
                            {form.data.start_date && form.data.end_date && (
                                <p className="text-sm sm:col-span-2">
                                    About <strong>{weekdays(form.data.start_date, form.data.end_date)}</strong> working day(s), before public holidays.
                                </p>
                            )}
                            <Field label="Reason *" error={errors.reason} className="sm:col-span-2">
                                <TextArea value={form.data.reason} onChange={(v) => form.setData('reason', v)} />
                            </Field>
                            <Field label={selectedType?.requires_document ? 'Supporting document *' : 'Supporting document'} error={errors.attachment} className="sm:col-span-2">
                                <input type="file" onChange={(e) => form.setData('attachment', e.target.files?.[0] ?? null)} className="text-sm" />
                            </Field>
                            <div className="flex gap-2 sm:col-span-2">
                                <button type="submit" disabled={form.processing} className={primaryButton}>
                                    Submit request
                                </button>
                                <a href={route('erp.hrm.leave.requests.index')} className={secondaryButton}>
                                    Cancel
                                </a>
                            </div>
                        </form>
                    </Card>
                    <Card title="Your balances">
                        {props.balances.length === 0 ? (
                            <p className="text-muted-foreground text-sm">Balances are set up the first time you request each leave type.</p>
                        ) : (
                            <ul className="divide-y">
                                {props.balances.map((b) => (
                                    <li key={b.id} className="flex justify-between py-2 text-sm">
                                        <span>{b.leave_type?.name}</span>
                                        <span className="font-medium">
                                            {b.available} / {b.total_entitlement}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            )}
        </Page>
    );
}
