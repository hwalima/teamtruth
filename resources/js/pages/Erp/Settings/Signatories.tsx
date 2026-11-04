import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Member = { id: number; name: string; email: string };
type DocumentType = { value: string; label: string };
type Signatory = {
    id: number;
    user_id: number | null;
    name: string;
    title: string;
    applies_to_document_type: string | null;
    approval_level: string | null;
    is_active: boolean;
    sort_order: number;
    signature_url: string | null;
    stamp_url: string | null;
    user: Member | null;
};

type Props = {
    signatories: Signatory[];
    members: Member[];
    documentTypes: DocumentType[];
};

export default function Signatories({ signatories, members, documentTypes }: Props) {
    return (
        <main className="mx-auto max-w-5xl space-y-8 p-6">
            <section>
                <h1 className="text-2xl font-semibold">Company signatories</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Manage printed signatories and stored signatures used to snapshot approval decisions.
                </p>
            </section>

            <section className="space-y-4 rounded-md border p-4">
                <h2 className="text-lg font-medium">Add signatory</h2>
                <SignatoryForm members={members} documentTypes={documentTypes} />
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-medium">Current signatories</h2>
                {signatories.length === 0 && (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">No signatories have been configured.</p>
                )}
                {signatories.map((signatory) => (
                    <article key={signatory.id} className="space-y-4 rounded-md border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="font-medium">{signatory.name} — {signatory.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {signatory.user ? `${signatory.user.name} (${signatory.user.email})` : 'Not linked to a user'}
                                    {' · '}
                                    {signatory.applies_to_document_type || 'All document types'}
                                    {' · '}
                                    {signatory.is_active ? 'Active' : 'Inactive'}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="text-sm text-destructive underline"
                                onClick={() => {
                                    if (window.confirm(`Delete signatory “${signatory.name}”?`)) {
                                        router.delete(route('erp.settings.signatories.destroy', signatory.id));
                                    }
                                }}
                            >
                                Delete
                            </button>
                        </div>
                        <SignatoryForm
                            key={signatory.id}
                            signatory={signatory}
                            members={members}
                            documentTypes={documentTypes}
                        />
                    </article>
                ))}
            </section>
        </main>
    );
}

function SignatoryForm({
    signatory,
    members,
    documentTypes,
}: {
    signatory?: Signatory;
    members: Member[];
    documentTypes: DocumentType[];
}) {
    const form = useForm({
        user_id: signatory?.user_id?.toString() ?? '',
        name: signatory?.name ?? '',
        title: signatory?.title ?? '',
        applies_to_document_type: signatory?.applies_to_document_type ?? '',
        approval_level: signatory?.approval_level ?? '',
        is_active: signatory?.is_active ?? true,
        sort_order: signatory?.sort_order ?? 0,
        signature: null as File | null,
        stamp: null as File | null,
    });
    const errors = form.errors as Record<string, string>;

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const options = { forceFormData: true };
        if (signatory) {
            form.patch(route('erp.settings.signatories.update', signatory.id), options);
        } else {
            form.post(route('erp.settings.signatories.store'), {
                ...options,
                onSuccess: () => form.reset(),
            });
        }
    };

    return (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-sm">
                Linked company member
                <select
                    value={form.data.user_id}
                    onChange={(event) => form.setData('user_id', event.target.value)}
                    className="rounded-md border bg-background px-3 py-2"
                >
                    <option value="">Not linked</option>
                    {members.map((member) => (
                        <option key={member.id} value={member.id}>{member.name} — {member.email}</option>
                    ))}
                </select>
                {errors.user_id && <span className="text-destructive">{errors.user_id}</span>}
            </label>
            <TextField label="Name on document" value={form.data.name} onChange={(value) => form.setData('name', value)} error={errors.name} required />
            <TextField label="Title" value={form.data.title} onChange={(value) => form.setData('title', value)} error={errors.title} required />
            <label className="grid gap-1 text-sm">
                Applies to
                <select
                    value={form.data.applies_to_document_type}
                    onChange={(event) => form.setData('applies_to_document_type', event.target.value)}
                    className="rounded-md border bg-background px-3 py-2"
                >
                    {documentTypes.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                </select>
                {errors.applies_to_document_type && <span className="text-destructive">{errors.applies_to_document_type}</span>}
            </label>
            <TextField label="Approval level" value={form.data.approval_level} onChange={(value) => form.setData('approval_level', value)} error={errors.approval_level} />
            <label className="grid gap-1 text-sm">
                Display order
                <input
                    type="number"
                    min={0}
                    value={form.data.sort_order}
                    onChange={(event) => form.setData('sort_order', Number(event.target.value))}
                    className="rounded-md border bg-background px-3 py-2"
                />
                {errors.sort_order && <span className="text-destructive">{errors.sort_order}</span>}
            </label>
            <ImageField label="Signature image" currentUrl={signatory?.signature_url} error={errors.signature} onChange={(file) => form.setData('signature', file)} />
            <ImageField label="Company stamp" currentUrl={signatory?.stamp_url} error={errors.stamp} onChange={(file) => form.setData('stamp', file)} />
            <label className="flex items-center gap-2 self-end text-sm">
                <input
                    type="checkbox"
                    checked={form.data.is_active}
                    onChange={(event) => form.setData('is_active', event.target.checked)}
                />
                Active
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
                <button
                    type="submit"
                    disabled={form.processing}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                    {form.processing ? 'Saving…' : signatory ? 'Save signatory' : 'Add signatory'}
                </button>
            </div>
        </form>
    );
}

function TextField({
    label,
    value,
    onChange,
    error,
    required = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    required?: boolean;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <input
                required={required}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-md border bg-background px-3 py-2"
            />
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}

function ImageField({
    label,
    currentUrl,
    error,
    onChange,
}: {
    label: string;
    currentUrl?: string | null;
    error?: string;
    onChange: (file: File | null) => void;
}) {
    return (
        <label className="grid gap-1 text-sm">
            {label} (PNG, JPEG, or GIF; up to 2 MB)
            {currentUrl && <img src={currentUrl} alt="" className="max-h-14 max-w-36 object-contain" />}
            <input
                type="file"
                accept="image/png,image/jpeg,image/gif"
                onChange={(event) => onChange(event.target.files?.[0] ?? null)}
                className="rounded-md border bg-background px-3 py-2"
            />
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}
