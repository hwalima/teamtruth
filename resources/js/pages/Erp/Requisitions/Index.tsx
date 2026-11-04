import { Link } from '@inertiajs/react';
import { route } from 'ziggy-js';

type RequisitionRow = {
    id: number;
    document_number: string;
    requisition_type: string;
    type_label: string;
    status: string;
    requester: string;
    department: string | null;
    currency_code: string;
    estimated_total: string;
    created_at: string;
};

type Props = {
    requisitions: {
        data: RequisitionRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    canCreate: boolean;
    canViewAll: boolean;
    types: Record<string, string>;
};

export default function Index({ requisitions, canCreate, canViewAll, types }: Props) {
    return (
        <main className="mx-auto max-w-6xl space-y-6 p-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Requisitions</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Draft and track requests for company goods and services.
                        {!canViewAll && ' You are viewing your own requests.'}
                    </p>
                </div>
                {canCreate && (
                    <Link
                        href={route('erp.requisitions.create')}
                        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
                    >
                        New requisition
                    </Link>
                )}
            </header>

            <section className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="p-3 font-medium">Reference</th>
                            <th className="p-3 font-medium">Type</th>
                            <th className="p-3 font-medium">Requester</th>
                            <th className="p-3 font-medium">Department</th>
                            <th className="p-3 text-right font-medium">Estimate</th>
                            <th className="p-3 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requisitions.data.map((requisition) => (
                            <tr key={requisition.id} className="border-t">
                                <td className="p-3">
                                    <Link href={route('erp.requisitions.show', requisition.id)} className="text-primary font-medium underline">
                                        {requisition.document_number}
                                    </Link>
                                </td>
                                <td className="p-3">{types[requisition.requisition_type] ?? requisition.type_label}</td>
                                <td className="p-3">{requisition.requester}</td>
                                <td className="p-3">{requisition.department || '—'}</td>
                                <td className="p-3 text-right tabular-nums">
                                    {requisition.currency_code} {requisition.estimated_total}
                                </td>
                                <td className="p-3 capitalize">{requisition.status.replaceAll('_', ' ')}</td>
                            </tr>
                        ))}
                        {requisitions.data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-muted-foreground p-8 text-center">
                                    No requisitions yet. Create one to start the approval process.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>

            <nav className="flex flex-wrap gap-2" aria-label="Pagination">
                {requisitions.links.map((link, index) => (
                    <Link
                        key={`${link.label}-${index}`}
                        href={link.url ?? '#'}
                        preserveScroll
                        className={`rounded border px-3 py-1 text-sm ${link.active ? 'bg-primary text-primary-foreground' : ''} ${!link.url ? 'pointer-events-none opacity-50' : ''}`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ))}
            </nav>
        </main>
    );
}
