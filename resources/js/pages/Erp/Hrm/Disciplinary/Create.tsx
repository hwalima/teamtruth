import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Empty, Field, Page, Select, TextArea, TextInput, idOptions, personName, primaryButton, secondaryButton } from '@/components/hrm/ui';

type Props = {
    company: { name: string };
    employees: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string }[];
    employeeId: number | null;
};

export default function DisciplinaryCreate(props: Props) {
    const today = new Date().toISOString().slice(0, 10);
    const form = useForm({
        employee_id: props.employeeId ? String(props.employeeId) : '',
        incident_date: today,
        reported_date: today,
        incident_location: '',
        incident_description: '',
        witnesses: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.hrm.disciplinary.store'));
    };

    return (
        <Page title="Open disciplinary case" subtitle="Record what happened. The investigation, notice, hearing and outcome follow from the case page.">
            {props.employees.length === 0 ? (
                <Empty>There are no employees to open a case against.</Empty>
            ) : (
                <Card title="Incident">
                    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
                        <Field label="Employee *" error={form.errors.employee_id} className="sm:col-span-3">
                            <Select value={form.data.employee_id} onChange={(v) => form.setData('employee_id', v)} options={idOptions(props.employees, (e) => `${e.employee_number} — ${personName(e)}`)} placeholder="— Select —" />
                        </Field>
                        <Field label="Incident date *" error={form.errors.incident_date}>
                            <TextInput type="date" max={today} value={form.data.incident_date} onChange={(v) => form.setData('incident_date', v)} />
                        </Field>
                        <Field label="Reported on" error={form.errors.reported_date}>
                            <TextInput type="date" value={form.data.reported_date} onChange={(v) => form.setData('reported_date', v)} />
                        </Field>
                        <Field label="Location" error={form.errors.incident_location}>
                            <TextInput value={form.data.incident_location} onChange={(v) => form.setData('incident_location', v)} />
                        </Field>
                        <Field label="What happened *" error={form.errors.incident_description} className="sm:col-span-3">
                            <TextArea rows={6} value={form.data.incident_description} onChange={(v) => form.setData('incident_description', v)} />
                        </Field>
                        <Field label="Witnesses (one per line)" error={form.errors.witnesses} className="sm:col-span-3">
                            <TextArea value={form.data.witnesses} onChange={(v) => form.setData('witnesses', v)} />
                        </Field>
                        <div className="flex gap-2 sm:col-span-3">
                            <button type="submit" disabled={form.processing} className={primaryButton}>
                                Open case
                            </button>
                            <a href={route('erp.hrm.disciplinary.index')} className={secondaryButton}>
                                Cancel
                            </a>
                        </div>
                    </form>
                </Card>
            )}
        </Page>
    );
}
