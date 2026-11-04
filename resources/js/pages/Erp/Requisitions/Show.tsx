import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Requisition = {
    id: number;
    document_number: string;
    requisition_type: string;
    type_label: string;
    status: string;
    department: string | null;
    cost_center: string | null;
    required_by: string | null;
    priority: string;
    justification: string;
    currency_code: string;
    estimated_total: string;
    submitted_at: string | null;
    requester: { id: number; name: string; email: string };
    lines: Array<{
        id: number;
        item: string;
        description: string | null;
        quantity: string;
        unit: string;
        estimated_unit_price: string;
        estimated_total: string;
        gl_account: string | null;
        budget_line: string | null;
    }>;
    attachments: Array<{ id: number; original_name: string; size: number; uploader: string; download_url: string }>;
    approval: { status: string; url: string } | null;
};

type Props = {
    requisition: Requisition;
    canEdit: boolean;
    canSubmit: boolean;
    canCancel: boolean;
};

export default function Show({ requisition, canEdit, canSubmit, canCancel }: Props) {
    const upload = useForm<{ attachments: File[] }>({ attachments: [] });
    const errors = upload.errors as Record<string, string>;
    const submitFiles = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        upload.post(route('erp.requisitions.attachments.store', requisition.id), { forceFormData: true });
    };

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-muted-foreground text-sm">{requisition.type_label}</p>
                    <h1 className="mt-1 text-2xl font-semibold">{requisition.document_number}</h1>
                    <p className="text-muted-foreground mt-2 text-sm capitalize">{requisition.status.replaceAll('_', ' ')}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <a className="rounded-md border px-4 py-2 text-sm" href={route('erp.requisitions.pdf', requisition.id)}>
                        Download PDF
                    </a>
                    {canEdit && (
                        <a className="rounded-md border px-4 py-2 text-sm" href={route('erp.requisitions.edit', requisition.id)}>
                            Edit draft
                        </a>
                    )}
                    {canSubmit && (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm('Submit this requisition to the active approval workflow?')) {
                                    router.post(route('erp.requisitions.submit', requisition.id));
                                }
                            }}
                            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
                        >
                            Submit for approval
                        </button>
                    )}
                    {canCancel && (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm('Cancel this requisition?')) {
                                    router.post(route('erp.requisitions.cancel', requisition.id));
                                }
                            }}
                            className="border-destructive text-destructive rounded-md border px-4 py-2 text-sm"
                        >
                            Cancel requisition
                        </button>
                    )}
                </div>
            </header>

            {requisition.approval && (
                <p className="rounded-md border p-3 text-sm">
                    Approval status: <strong className="capitalize">{requisition.approval.status}</strong>
                    {' · '}
                    <a className="text-primary underline" href={requisition.approval.url}>
                        View approval record
                    </a>
                </p>
            )}

            <section className="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Requester" value={requisition.requester.name} />
                <Info label="Department" value={requisition.department} />
                <Info label="Cost center" value={requisition.cost_center} />
                <Info label="Priority" value={requisition.priority} />
                <Info label="Required by" value={requisition.required_by} />
                <Info label="Estimated total" value={`${requisition.currency_code} ${requisition.estimated_total}`} />
                <div className="sm:col-span-2 lg:col-span-3">
                    <Info label="Justification" value={requisition.justification} />
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-medium">Lines</h2>
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-3">Item</th>
                                <th className="p-3">Qty</th>
                                <th className="p-3">Unit price</th>
                                <th className="p-3">GL / budget</th>
                                <th className="p-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requisition.lines.map((line) => (
                                <tr key={line.id} className="border-t">
                                    <td className="p-3">
                                        <strong>{line.item}</strong>
                                        {line.description && <p className="text-muted-foreground">{line.description}</p>}
                                    </td>
                                    <td className="p-3">
                                        {line.quantity} {line.unit}
                                    </td>
                                    <td className="p-3">
                                        {requisition.currency_code} {line.estimated_unit_price}
                                    </td>
                                    <td className="p-3">
                                        {line.gl_account || '—'} / {line.budget_line || '—'}
                                    </td>
                                    <td className="p-3 text-right">
                                        {requisition.currency_code} {line.estimated_total}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="space-y-3 rounded-md border p-4">
                <h2 className="text-lg font-medium">Supporting documents</h2>
                {requisition.attachments.length > 0 ? (
                    <ul className="space-y-2">
                        {requisition.attachments.map((attachment) => (
                            <li key={attachment.id} className="text-sm">
                                <a className="text-primary underline" href={attachment.download_url}>
                                    {attachment.original_name}
                                </a>
                                <span className="text-muted-foreground ml-2">
                                    uploaded by {attachment.uploader} · {Math.ceil(attachment.size / 1024)} KB
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-sm">No supporting documents attached.</p>
                )}
                {canEdit && (
                    <form onSubmit={submitFiles} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div>
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                                onChange={(event) => upload.setData('attachments', Array.from(event.target.files ?? []))}
                                className="block w-full text-sm"
                            />
                            <p className="text-muted-foreground mt-1 text-xs">
                                Up to 10 files, 10 MB each. Attachments are available only to authorised company users.
                            </p>
                            {errors.attachments && <p className="text-destructive text-sm">{errors.attachments}</p>}
                        </div>
                        <button
                            disabled={upload.processing || upload.data.attachments.length === 0}
                            className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                        >
                            Upload files
                        </button>
                    </form>
                )}
            </section>

            <a href={route('erp.requisitions.index')} className="text-primary inline-block text-sm underline">
                Back to requisitions
            </a>
        </main>
    );
}

function Info({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{value || '—'}</p>
        </div>
    );
}
