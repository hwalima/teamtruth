import { Field, Select, TextArea, TextInput } from './ui';

export type SelfServiceForm = {
    subject: string;
    details: string;
    period: string;
    purpose: string;
    changes: Record<string, string>;
};

const maritalOptions = { single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widowed' };

/** The fields that depend on the request type, shared by the create and edit forms. */
export default function SelfServiceFields({
    type,
    data,
    set,
    errors,
    profileFields,
    current,
}: {
    type: string;
    data: SelfServiceForm;
    set: <K extends keyof SelfServiceForm>(key: K, value: SelfServiceForm[K]) => void;
    errors: Record<string, string>;
    profileFields: Record<string, string>;
    current: Record<string, string | null> | null;
}) {
    return (
        <>
            {type === 'profile_update' && (
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                    <p className="text-muted-foreground text-sm sm:col-span-2">Change only what is wrong or out of date. HR checks the change before it is saved.</p>
                    {errors.changes && <p className="text-destructive text-sm sm:col-span-2">{errors.changes}</p>}
                    {Object.entries(profileFields).map(([field, label]) => (
                        <Field key={field} label={label} error={errors[`changes.${field}`]}>
                            {field === 'marital_status' ? (
                                <Select value={data.changes[field] ?? ''} onChange={(v) => set('changes', { ...data.changes, [field]: v })} options={maritalOptions} placeholder="—" />
                            ) : (
                                <TextInput value={data.changes[field] ?? ''} onChange={(v) => set('changes', { ...data.changes, [field]: v })} placeholder={current?.[field] ?? ''} />
                            )}
                        </Field>
                    ))}
                </div>
            )}
            {type === 'payslip_request' && (
                <Field label="Which month(s)? *" error={errors.period}>
                    <TextInput value={data.period} onChange={(v) => set('period', v)} placeholder="e.g. October 2026" />
                </Field>
            )}
            {type === 'certificate_request' && (
                <Field label="What is it for? *" error={errors.purpose}>
                    <TextInput value={data.purpose} onChange={(v) => set('purpose', v)} placeholder="e.g. Proof of employment for a bank loan" />
                </Field>
            )}
            {type !== 'profile_update' && (
                <Field label="Subject" error={errors.subject}>
                    <TextInput value={data.subject} onChange={(v) => set('subject', v)} />
                </Field>
            )}
            <Field label={['other', 'leave_balance_enquiry'].includes(type) ? 'Details *' : 'Details'} error={errors.details} className="sm:col-span-2">
                <TextArea rows={4} value={data.details} onChange={(v) => set('details', v)} />
            </Field>
        </>
    );
}
