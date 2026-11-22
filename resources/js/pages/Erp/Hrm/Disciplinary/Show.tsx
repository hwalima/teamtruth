import { router, useForm, usePage } from '@inertiajs/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { route } from 'ziggy-js';
import { Card, Detail, Field, Page, Select, StatusBadge, TextArea, TextInput, dangerButton, formatDate, personName, primaryButton, secondaryButton, toDateInput, type Options } from '@/components/hrm/ui';

type TimelineEntry = { at: string; by: string; title: string; notes: string | null };
type Document = { id: number; document_type: string; title: string; file_size: number | null; created_at: string };

type DisciplinaryCase = {
    id: number;
    case_number: string;
    employee: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string; department: { name: string } | null; position: { name: string } | null } | null;
    reported_by: { name: string } | null;
    incident_date: string;
    reported_date: string;
    incident_description: string;
    incident_location: string | null;
    witnesses: string[] | null;
    status: string;
    outcome: string | null;
    outcome_details: string | null;
    outcome_date: string | null;
    expiry_date: string | null;
    hearing_at: string | null;
    hearing_location: string | null;
    appeal_details: string | null;
    appeal_decision: string | null;
    appeal_date: string | null;
    timeline: TimelineEntry[] | null;
    documents: Document[];
};

type Props = {
    company: { name: string };
    disciplinaryCase: DisciplinaryCase;
    statusOptions: Options;
    outcomeOptions: Options;
    documentTypeOptions: Options;
    appealDecisionOptions: Options;
    warningMonths: Record<string, number>;
    appealDeadline: string | null;
    canManage: boolean;
    canAppeal: boolean;
};

function StepForm({ title, url, fields, submitLabel, danger = false }: { title: string; url: string; fields: (form: ReturnType<typeof useForm<Record<string, string | boolean>>>) => ReactNode; submitLabel: string; danger?: boolean }) {
    const form = useForm<Record<string, string | boolean>>({});
    return (
        <Card title={title}>
            <form
                onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    form.post(url, { preserveScroll: true, onSuccess: () => form.reset() });
                }}
                className="grid gap-4 sm:grid-cols-2"
            >
                {fields(form)}
                <div className="sm:col-span-2">
                    <button type="submit" disabled={form.processing} className={danger ? dangerButton : primaryButton}>
                        {submitLabel}
                    </button>
                </div>
            </form>
        </Card>
    );
}

const text = (v: string | boolean | undefined) => (typeof v === 'string' ? v : '');

export default function DisciplinaryShow(props: Props) {
    const c = props.disciplinaryCase;
    const errors = usePage().props.errors as Record<string, string>;
    const [editing, setEditing] = useState(false);
    const edit = useForm({
        incident_date: toDateInput(c.incident_date),
        incident_location: c.incident_location ?? '',
        incident_description: c.incident_description,
        witnesses: (c.witnesses ?? []).join('\n'),
    });
    const upload = useForm<{ document_type: string; title: string; file: File | null }>({ document_type: 'evidence', title: '', file: null });
    const url = (name: string) => route(`erp.hrm.disciplinary.${name}`, c.id);
    const editable = props.canManage && ['open', 'under_investigation'].includes(c.status);

    return (
        <Page
            title={`Case ${c.case_number}`}
            subtitle={
                <span className="flex flex-wrap items-center gap-2">
                    {personName(c.employee)} · incident on {formatDate(c.incident_date)} <StatusBadge value={c.status} label={props.statusOptions[c.status]} />
                </span>
            }
            actions={
                <>
                    <a href={route('erp.hrm.disciplinary.index')} className={secondaryButton}>
                        Back
                    </a>
                    {editable && (
                        <button type="button" onClick={() => setEditing(!editing)} className={secondaryButton}>
                            Edit incident
                        </button>
                    )}
                </>
            }
        >
            {(errors.case || errors.new_outcome) && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errors.case ?? errors.new_outcome}</p>}

            {editing && (
                <Card title="Edit incident">
                    <form
                        onSubmit={(e: FormEvent) => {
                            e.preventDefault();
                            edit.put(url('update'), { preserveScroll: true, onSuccess: () => setEditing(false) });
                        }}
                        className="grid gap-4 sm:grid-cols-2"
                    >
                        <Field label="Incident date *" error={edit.errors.incident_date}>
                            <TextInput type="date" value={edit.data.incident_date} onChange={(v) => edit.setData('incident_date', v)} />
                        </Field>
                        <Field label="Location" error={edit.errors.incident_location}>
                            <TextInput value={edit.data.incident_location} onChange={(v) => edit.setData('incident_location', v)} />
                        </Field>
                        <Field label="What happened *" error={edit.errors.incident_description} className="sm:col-span-2">
                            <TextArea rows={5} value={edit.data.incident_description} onChange={(v) => edit.setData('incident_description', v)} />
                        </Field>
                        <Field label="Witnesses (one per line)" error={edit.errors.witnesses} className="sm:col-span-2">
                            <TextArea value={edit.data.witnesses} onChange={(v) => edit.setData('witnesses', v)} />
                        </Field>
                        <div className="flex gap-2 sm:col-span-2">
                            <button type="submit" disabled={edit.processing} className={primaryButton}>
                                Save
                            </button>
                            <button type="button" onClick={() => setEditing(false)} className={secondaryButton}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Incident" className="lg:col-span-2">
                    <dl className="grid gap-4 sm:grid-cols-3">
                        <Detail label="Employee" value={c.employee ? `${personName(c.employee)} (${c.employee.employee_number})` : null} />
                        <Detail label="Department" value={c.employee?.department?.name} />
                        <Detail label="Position" value={c.employee?.position?.name} />
                        <Detail label="Reported by" value={c.reported_by?.name} />
                        <Detail label="Reported on" value={formatDate(c.reported_date)} />
                        <Detail label="Location" value={c.incident_location} />
                    </dl>
                    <Detail label="What happened" value={<span className="whitespace-pre-wrap">{c.incident_description}</span>} />
                    {c.witnesses && c.witnesses.length > 0 && <Detail label="Witnesses" value={c.witnesses.join(', ')} />}
                </Card>

                <Card title="Outcome">
                    {c.hearing_at && <Detail label="Hearing" value={`${new Date(c.hearing_at).toLocaleString()}${c.hearing_location ? ` · ${c.hearing_location}` : ''}`} />}
                    {c.outcome ? (
                        <>
                            <Detail label="Decision" value={props.outcomeOptions[c.outcome]} />
                            <Detail label="Decided on" value={formatDate(c.outcome_date)} />
                            {c.expiry_date && <Detail label="On record until" value={formatDate(c.expiry_date)} />}
                            {c.outcome_details && <Detail label="Details" value={<span className="whitespace-pre-wrap">{c.outcome_details}</span>} />}
                            {c.appeal_date && <Detail label="Appeal lodged" value={formatDate(c.appeal_date)} />}
                            {c.appeal_decision && <Detail label="Appeal decision" value={props.appealDecisionOptions[c.appeal_decision]} />}
                        </>
                    ) : (
                        <p className="text-muted-foreground text-sm">No outcome yet.</p>
                    )}
                    {c.outcome === 'dismissal' && c.employee && props.canManage && (
                        <a href={route('erp.hrm.employees.show', c.employee.id)} className="text-primary text-sm underline">
                            Terminate the employee record →
                        </a>
                    )}
                </Card>
            </div>

            {props.canAppeal && (
                <StepForm
                    title={`Appeal this outcome${props.appealDeadline ? ` (by ${formatDate(props.appealDeadline)})` : ''}`}
                    url={url('appeal.submit')}
                    submitLabel="Lodge appeal"
                    fields={(f) => (
                        <Field label="Grounds for appeal *" error={f.errors.appeal_details} className="sm:col-span-2">
                            <TextArea rows={5} value={text(f.data.appeal_details)} onChange={(v) => f.setData('appeal_details', v)} />
                        </Field>
                    )}
                />
            )}

            {props.canManage && (
                <div className="grid gap-6 lg:grid-cols-2">
                    {c.status === 'open' && (
                        <StepForm
                            title="1. Start the investigation"
                            url={url('investigate')}
                            submitLabel="Start investigation"
                            fields={(f) => (
                                <Field label="Notes (who is investigating, scope)" error={f.errors.notes} className="sm:col-span-2">
                                    <TextArea value={text(f.data.notes)} onChange={(v) => f.setData('notes', v)} />
                                </Field>
                            )}
                        />
                    )}
                    {c.status === 'under_investigation' && (
                        <StepForm
                            title="2. Complete the investigation"
                            url={url('investigation.complete')}
                            submitLabel="Save findings"
                            fields={(f) => (
                                <>
                                    <Field label="Findings *" error={f.errors.findings} className="sm:col-span-2">
                                        <TextArea rows={5} value={text(f.data.findings)} onChange={(v) => f.setData('findings', v)} />
                                    </Field>
                                    <Field label="Next step *" error={f.errors.proceed} className="sm:col-span-2">
                                        <Select
                                            value={text(f.data.proceed)}
                                            onChange={(v) => f.setData('proceed', v)}
                                            options={{ '1': 'Issue a notice to attend a hearing', '0': 'No case to answer – close with no action' }}
                                            placeholder="— Choose —"
                                        />
                                    </Field>
                                </>
                            )}
                        />
                    )}
                    {['notice_issued', 'hearing_scheduled'].includes(c.status) && (
                        <StepForm
                            title={c.status === 'notice_issued' ? '3. Schedule the hearing' : 'Reschedule the hearing'}
                            url={url('hearing.schedule')}
                            submitLabel={c.status === 'notice_issued' ? 'Schedule hearing' : 'Reschedule'}
                            fields={(f) => (
                                <>
                                    <Field label="Date and time *" error={f.errors.hearing_at}>
                                        <TextInput type="datetime-local" value={text(f.data.hearing_at)} onChange={(v) => f.setData('hearing_at', v)} />
                                    </Field>
                                    <Field label="Location" error={f.errors.hearing_location}>
                                        <TextInput value={text(f.data.hearing_location)} onChange={(v) => f.setData('hearing_location', v)} />
                                    </Field>
                                    <Field label="Notes (chairperson, panel)" error={f.errors.notes} className="sm:col-span-2">
                                        <TextArea value={text(f.data.notes)} onChange={(v) => f.setData('notes', v)} />
                                    </Field>
                                </>
                            )}
                        />
                    )}
                    {c.status === 'hearing_scheduled' && (
                        <StepForm
                            title="4. Record the hearing"
                            url={url('hearing.complete')}
                            submitLabel="Hearing held"
                            fields={(f) => (
                                <Field label="Hearing minutes *" error={f.errors.notes} className="sm:col-span-2">
                                    <TextArea rows={5} value={text(f.data.notes)} onChange={(v) => f.setData('notes', v)} />
                                </Field>
                            )}
                        />
                    )}
                    {c.status === 'hearing_completed' && (
                        <StepForm
                            title="5. Record the outcome"
                            url={url('outcome.record')}
                            submitLabel="Record outcome"
                            fields={(f) => (
                                <>
                                    <Field label="Outcome *" error={f.errors.outcome}>
                                        <Select value={text(f.data.outcome)} onChange={(v) => f.setData('outcome', v)} options={props.outcomeOptions} placeholder="— Choose —" />
                                    </Field>
                                    <Field label="Decided on" error={f.errors.outcome_date}>
                                        <TextInput type="date" value={text(f.data.outcome_date)} onChange={(v) => f.setData('outcome_date', v)} />
                                    </Field>
                                    {props.warningMonths[text(f.data.outcome)] && (
                                        <Field label={`On record until (default ${props.warningMonths[text(f.data.outcome)]} months)`} error={f.errors.expiry_date}>
                                            <TextInput type="date" value={text(f.data.expiry_date)} onChange={(v) => f.setData('expiry_date', v)} />
                                        </Field>
                                    )}
                                    <Field label="Reasons and details *" error={f.errors.outcome_details} className="sm:col-span-2">
                                        <TextArea rows={5} value={text(f.data.outcome_details)} onChange={(v) => f.setData('outcome_details', v)} />
                                    </Field>
                                </>
                            )}
                        />
                    )}
                    {c.status === 'appealed' && (
                        <StepForm
                            title="Decide the appeal"
                            url={url('appeal.decide')}
                            submitLabel="Decide and close"
                            fields={(f) => (
                                <>
                                    <div className="text-sm sm:col-span-2">
                                        <div className="font-medium">Grounds</div>
                                        <p className="whitespace-pre-wrap">{c.appeal_details}</p>
                                    </div>
                                    <Field label="Decision *" error={f.errors.appeal_decision}>
                                        <Select value={text(f.data.appeal_decision)} onChange={(v) => f.setData('appeal_decision', v)} options={props.appealDecisionOptions} placeholder="— Choose —" />
                                    </Field>
                                    {['reduced', 'increased'].includes(text(f.data.appeal_decision)) && (
                                        <Field label="New outcome *" error={f.errors.new_outcome}>
                                            <Select value={text(f.data.new_outcome)} onChange={(v) => f.setData('new_outcome', v)} options={props.outcomeOptions} placeholder="— Choose —" />
                                        </Field>
                                    )}
                                    <Field label="Notes" error={f.errors.notes} className="sm:col-span-2">
                                        <TextArea value={text(f.data.notes)} onChange={(v) => f.setData('notes', v)} />
                                    </Field>
                                </>
                            )}
                        />
                    )}
                    {!['closed', 'appealed'].includes(c.status) && (
                        <StepForm
                            title={c.status === 'outcome_decided' ? 'Close the case' : 'Close the case early'}
                            url={url('close')}
                            submitLabel="Close case"
                            danger={c.status !== 'outcome_decided'}
                            fields={(f) => (
                                <Field label="Notes" error={f.errors.notes} className="sm:col-span-2">
                                    <TextArea value={text(f.data.notes)} onChange={(v) => f.setData('notes', v)} />
                                </Field>
                            )}
                        />
                    )}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Timeline">
                    {(c.timeline ?? []).length === 0 ? (
                        <p className="text-muted-foreground text-sm">Nothing recorded yet.</p>
                    ) : (
                        <ol className="space-y-4 border-l pl-4">
                            {[...(c.timeline ?? [])].reverse().map((entry, i) => (
                                <li key={i} className="text-sm">
                                    <div className="font-medium">{entry.title}</div>
                                    <div className="text-muted-foreground text-xs">
                                        {new Date(entry.at).toLocaleString()} · {entry.by}
                                    </div>
                                    {entry.notes && <p className="mt-1 whitespace-pre-wrap">{entry.notes}</p>}
                                </li>
                            ))}
                        </ol>
                    )}
                </Card>

                <Card title="Documents">
                    {c.documents.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No documents.</p>
                    ) : (
                        <ul className="divide-y">
                            {c.documents.map((d) => (
                                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                                    <a href={route('erp.hrm.disciplinary.documents.download', [c.id, d.id])} className="text-primary underline">
                                        {d.title}
                                    </a>
                                    <span className="text-muted-foreground text-xs">
                                        {props.documentTypeOptions[d.document_type]} · {formatDate(d.created_at)}
                                        {props.canManage && (
                                            <button
                                                type="button"
                                                onClick={() => window.confirm('Remove this document?') && router.delete(route('erp.hrm.disciplinary.documents.destroy', [c.id, d.id]), { preserveScroll: true })}
                                                className="ml-3 text-red-600 underline"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {props.canManage && (
                        <form
                            onSubmit={(e: FormEvent) => {
                                e.preventDefault();
                                upload.post(route('erp.hrm.disciplinary.documents.store', c.id), { forceFormData: true, preserveScroll: true, onSuccess: () => upload.reset() });
                            }}
                            className="grid gap-3 border-t pt-4 sm:grid-cols-2"
                        >
                            <Field label="Type" error={upload.errors.document_type}>
                                <Select value={upload.data.document_type} onChange={(v) => upload.setData('document_type', v)} options={props.documentTypeOptions} />
                            </Field>
                            <Field label="Title" error={upload.errors.title}>
                                <TextInput value={upload.data.title} onChange={(v) => upload.setData('title', v)} placeholder="Defaults to the file name" />
                            </Field>
                            <Field label="File *" error={upload.errors.file} className="sm:col-span-2">
                                <input type="file" onChange={(e) => upload.setData('file', e.target.files?.[0] ?? null)} className="text-sm" />
                            </Field>
                            <div className="sm:col-span-2">
                                <button type="submit" disabled={upload.processing || !upload.data.file} className={secondaryButton}>
                                    Upload
                                </button>
                            </div>
                        </form>
                    )}
                </Card>
            </div>
        </Page>
    );
}
