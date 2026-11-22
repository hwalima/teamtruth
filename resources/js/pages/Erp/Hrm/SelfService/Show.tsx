import { router, useForm, usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';
import SelfServiceFields, { type SelfServiceForm } from '@/components/hrm/self-service-fields';
import { Card, Detail, Field, Page, StatusBadge, TextArea, dangerButton, formatDate, personName, primaryButton, secondaryButton, type Options } from '@/components/hrm/ui';

type Attachment = { name: string; size: number | null; by: string; at: string };
type SelfServiceRequest = {
    id: number;
    employee: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string } | null;
    request_type: string;
    request_data: { subject?: string; details?: string; period?: string; purpose?: string; changes?: Record<string, string>; attachments?: Attachment[] } | null;
    status: string;
    processed_by: { name: string } | null;
    processed_at: string | null;
    notes: string | null;
    created_at: string;
};

type Props = {
    company: { name: string };
    selfServiceRequest: SelfServiceRequest;
    changes: { field: string; label: string; current: string | null; requested: string }[];
    statusOptions: Options;
    typeOptions: Options;
    profileFields: Record<string, string>;
    canEdit: boolean;
    canAttach: boolean;
    canProcess: boolean;
};

export default function SelfServiceShow(props: Props) {
    const r = props.selfServiceRequest;
    const data = r.request_data ?? {};
    const errors = usePage().props.errors as Record<string, string>;
    const [editing, setEditing] = useState(false);
    const edit = useForm<SelfServiceForm>({
        subject: data.subject ?? '',
        details: data.details ?? '',
        period: data.period ?? '',
        purpose: data.purpose ?? '',
        changes: data.changes ?? {},
    });
    const review = useForm({ decision: '', notes: '' });
    const upload = useForm<{ file: File | null }>({ file: null });
    const open = ['pending', 'in_progress'].includes(r.status);

    const decide = (decision: 'complete' | 'reject') => {
        review.transform((d) => ({ ...d, decision }));
        review.post(route('erp.hrm.self-service.review', r.id), { preserveScroll: true });
    };

    return (
        <Page
            title={props.typeOptions[r.request_type] ?? 'Request'}
            subtitle={
                <span className="flex flex-wrap items-center gap-2">
                    {personName(r.employee)} · sent {formatDate(r.created_at)} <StatusBadge value={r.status} label={props.statusOptions[r.status]} />
                </span>
            }
            actions={
                <>
                    <a href={route('erp.hrm.self-service.index')} className={secondaryButton}>
                        Back
                    </a>
                    {props.canEdit && (
                        <button type="button" onClick={() => setEditing(!editing)} className={secondaryButton}>
                            Edit
                        </button>
                    )}
                    {props.canEdit && (
                        <button
                            type="button"
                            onClick={() => window.confirm('Withdraw this request?') && router.post(route('erp.hrm.self-service.cancel', r.id))}
                            className={dangerButton}
                        >
                            Withdraw
                        </button>
                    )}
                </>
            }
        >
            {errors.request && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errors.request}</p>}

            {editing ? (
                <Card title="Edit request">
                    <form
                        onSubmit={(e: FormEvent) => {
                            e.preventDefault();
                            edit.transform((d) => ({ ...d, changes: Object.fromEntries(Object.entries(d.changes).filter(([, v]) => v !== '')) }));
                            edit.put(route('erp.hrm.self-service.update', r.id), { preserveScroll: true, onSuccess: () => setEditing(false) });
                        }}
                        className="grid gap-4 sm:grid-cols-2"
                    >
                        <SelfServiceFields
                            type={r.request_type}
                            data={edit.data}
                            set={(key, value) => edit.setData(key, value as never)}
                            errors={edit.errors as Record<string, string>}
                            profileFields={props.profileFields}
                            current={Object.fromEntries(props.changes.map((c) => [c.field, c.current]))}
                        />
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
            ) : (
                <Card title="Request">
                    <dl className="grid gap-4 sm:grid-cols-3">
                        <Detail label="Employee" value={r.employee ? `${personName(r.employee)} (${r.employee.employee_number})` : null} />
                        {data.subject && <Detail label="Subject" value={data.subject} />}
                        {data.period && <Detail label="Period" value={data.period} />}
                        {data.purpose && <Detail label="Purpose" value={data.purpose} />}
                    </dl>
                    {data.details && <Detail label="Details" value={<span className="whitespace-pre-wrap">{data.details}</span>} />}
                    {props.changes.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-left">
                                    <tr>
                                        <th className="px-3 py-2 font-medium">Detail</th>
                                        <th className="px-3 py-2 font-medium">Now</th>
                                        <th className="px-3 py-2 font-medium">Change to</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {props.changes.map((c) => (
                                        <tr key={c.field} className="border-t">
                                            <td className="px-3 py-2">{c.label}</td>
                                            <td className="text-muted-foreground px-3 py-2">{c.current || '—'}</td>
                                            <td className="px-3 py-2 font-medium">{c.requested || '(clear)'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {(r.processed_by || r.notes) && (
                <Card title="HR response">
                    <dl className="grid gap-4 sm:grid-cols-3">
                        <Detail label="Handled by" value={r.processed_by?.name} />
                        <Detail label="Finished on" value={r.processed_at ? formatDate(r.processed_at) : null} />
                    </dl>
                    {r.notes && <Detail label="Notes" value={<span className="whitespace-pre-wrap">{r.notes}</span>} />}
                </Card>
            )}

            {props.canProcess && open && (
                <Card title="Handle this request">
                    {r.status === 'pending' && (
                        <button type="button" onClick={() => router.post(route('erp.hrm.self-service.assign', r.id), {}, { preserveScroll: true })} className={secondaryButton}>
                            I'm handling this
                        </button>
                    )}
                    <Field label="Notes to the employee (required to reject)" error={review.errors.notes}>
                        <TextArea value={review.data.notes} onChange={(v) => review.setData('notes', v)} />
                    </Field>
                    {r.request_type === 'profile_update' && <p className="text-muted-foreground text-sm">Completing saves the changes above to the employee record.</p>}
                    <div className="flex gap-2">
                        <button type="button" disabled={review.processing} onClick={() => decide('complete')} className={primaryButton}>
                            Complete
                        </button>
                        <button type="button" disabled={review.processing} onClick={() => decide('reject')} className={dangerButton}>
                            Reject
                        </button>
                    </div>
                </Card>
            )}

            <Card title="Files">
                {(data.attachments ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No files.</p>
                ) : (
                    <ul className="divide-y">
                        {(data.attachments ?? []).map((a, i) => (
                            <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                                <a href={route('erp.hrm.self-service.documents.download', [r.id, i])} className="text-primary underline">
                                    {a.name}
                                </a>
                                <span className="text-muted-foreground text-xs">
                                    {a.by} · {formatDate(a.at)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                {props.canAttach && (
                    <form
                        onSubmit={(e: FormEvent) => {
                            e.preventDefault();
                            upload.post(route('erp.hrm.self-service.documents.store', r.id), { forceFormData: true, preserveScroll: true, onSuccess: () => upload.reset() });
                        }}
                        className="flex flex-wrap items-center gap-3 border-t pt-4"
                    >
                        <input type="file" onChange={(e) => upload.setData('file', e.target.files?.[0] ?? null)} className="text-sm" />
                        <button type="submit" disabled={upload.processing || !upload.data.file} className={secondaryButton}>
                            Attach
                        </button>
                        {upload.errors.file && <span className="text-destructive text-sm">{upload.errors.file}</span>}
                    </form>
                )}
            </Card>
        </Page>
    );
}
