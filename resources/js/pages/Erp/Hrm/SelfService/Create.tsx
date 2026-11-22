import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';
import SelfServiceFields, { type SelfServiceForm } from '@/components/hrm/self-service-fields';
import { Card, Empty, Field, Page, Select, primaryButton, secondaryButton, type Options } from '@/components/hrm/ui';

type Props = {
    company: { name: string };
    employee: (Record<string, string | null> & { id: number }) | null;
    typeOptions: Options;
    profileFields: Record<string, string>;
    requestType: string | null;
};

export default function SelfServiceCreate(props: Props) {
    const form = useForm<SelfServiceForm & { request_type: string; attachments: File[] }>({
        request_type: props.requestType && props.typeOptions[props.requestType] ? props.requestType : 'other',
        subject: '',
        details: '',
        period: '',
        purpose: '',
        changes: {},
        attachments: [],
    });
    const errors = form.errors as Record<string, string>;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, changes: Object.fromEntries(Object.entries(data.changes).filter(([, v]) => v !== '')) }));
        form.post(route('erp.hrm.self-service.store'), { forceFormData: true });
    };

    if (!props.employee) {
        return (
            <Page title="New request">
                <Empty>Your user account is not linked to an employee record yet. Ask HR to link it on your employee profile.</Empty>
            </Page>
        );
    }

    return (
        <Page title="New request to HR" subtitle={props.company.name}>
            <Card>
                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                    <Field label="What do you need? *" error={errors.request_type} className="sm:col-span-2">
                        <Select value={form.data.request_type} onChange={(v) => form.setData('request_type', v)} options={props.typeOptions} />
                    </Field>
                    <SelfServiceFields
                        type={form.data.request_type}
                        data={form.data}
                        set={(key, value) => form.setData(key, value as never)}
                        errors={errors}
                        profileFields={props.profileFields}
                        current={props.employee}
                    />
                    <Field label={form.data.request_type === 'document_upload' ? 'Files *' : 'Files'} error={errors.attachments ?? errors['attachments.0']} className="sm:col-span-2">
                        <input type="file" multiple onChange={(e) => form.setData('attachments', Array.from(e.target.files ?? []))} className="text-sm" />
                    </Field>
                    <div className="flex gap-2 sm:col-span-2">
                        <button type="submit" disabled={form.processing} className={primaryButton}>
                            Send to HR
                        </button>
                        <a href={route('erp.hrm.self-service.index')} className={secondaryButton}>
                            Cancel
                        </a>
                    </div>
                </form>
            </Card>
        </Page>
    );
}
