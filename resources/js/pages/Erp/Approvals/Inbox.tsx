import { Link } from '@inertiajs/react';
import { route } from 'ziggy-js';

type Approval = {
    id: number;
    status: string;
    current_step: number;
    amount: string;
    currency_code: string | null;
    submitted_at: string;
    workflow: { name: string };
    requester: { id: number; name: string } | null;
    approvable_type: string;
    approvable_id: number;
};
type Props = {
    approvals: {
        data: Approval[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
        current_page: number;
        last_page: number;
    };
    counts: { pending: number; submitted: number };
};

export default function Inbox({ approvals, counts }: Props) {
    return (
        <main className="mx-auto max-w-5xl space-y-8 p-6">
            <section>
                <h1 className="text-2xl font-semibold">My approvals</h1>
                <p className="mt-2 text-sm text-muted-foreground">Review documents assigned to you for the active company.</p>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
                <CountCard label="Awaiting your action" count={counts.pending} />
                <CountCard label="Submitted by you, pending" count={counts.submitted} />
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-medium">Approval inbox</h2>
                {approvals.data.length === 0 ? (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">There are no approvals waiting for your action.</p>
                ) : (
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b bg-muted/50">
                                <tr>
                                    <th className="p-3 font-medium">Document</th>
                                    <th className="p-3 font-medium">Workflow</th>
                                    <th className="p-3 font-medium">Requester</th>
                                    <th className="p-3 font-medium">Amount</th>
                                    <th className="p-3 font-medium">Submitted</th>
                                    <th className="p-3 font-medium"><span className="sr-only">Action</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {approvals.data.map((approval) => (
                                    <tr key={approval.id} className="border-b last:border-0">
                                        <td className="p-3">
                                            {approval.approvable_type.split('\\').pop()} #{approval.approvable_id}
                                        </td>
                                        <td className="p-3">{approval.workflow.name} · Step {approval.current_step}</td>
                                        <td className="p-3">{approval.requester?.name ?? 'Unknown'}</td>
                                        <td className="p-3">{approval.amount} {approval.currency_code ?? ''}</td>
                                        <td className="p-3">{new Date(approval.submitted_at).toLocaleString()}</td>
                                        <td className="p-3">
                                            <Link
                                                href={route('erp.approvals.show', approval.id)}
                                                className="font-medium text-primary underline"
                                            >
                                                Review
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {approvals.last_page > 1 && (
                    <nav className="flex flex-wrap gap-2" aria-label="Approval inbox pages">
                        {approvals.links.map((link, index) => (
                            <Link
                                key={`${link.label}-${index}`}
                                href={link.url ?? ''}
                                aria-disabled={!link.url}
                                aria-current={link.active ? 'page' : undefined}
                                className={`rounded border px-3 py-1 text-sm ${link.active ? 'bg-primary text-primary-foreground' : ''} ${!link.url ? 'pointer-events-none opacity-50' : ''}`}
                            >
                                {link.label.replace(/<[^>]*>/g, '').replace(/&laquo;/g, '<<').replace(/&raquo;/g, '>>')}
                            </Link>
                        ))}
                    </nav>
                )}
            </section>
        </main>
    );
}

function CountCard({ label, count }: { label: string; count: number }) {
    return (
        <div className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{count}</p>
        </div>
    );
}
