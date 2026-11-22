import { fundStatus, stamp, type FundRequestRow, type Signer } from '@/components/banking/fund-request';
import { money } from '@/components/banking/money';
import { Card, Empty, Field, Page, Pagination, Select, TextInput, secondaryButton, type Paginated } from '@/components/hrm/ui';
import { Link, router } from '@inertiajs/react';
import { ArrowRight, FileDown, LayoutDashboard, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { route } from 'ziggy-js';

type Filters = { view?: string; status?: string; from_company?: string; to_company?: string; from?: string; to?: string; q?: string };

type Props = {
    requests: Paginated<FundRequestRow>;
    filters: Filters;
    summary: { status: string; currency: string; count: number; total: number }[];
    awaitingCount: number;
    companies: { id: number; code: string; name: string }[];
    statuses: string[];
};

const views = [
    { value: 'all', label: 'All requests' },
    { value: 'awaiting', label: 'Awaiting my approval' },
    { value: 'mine', label: 'My requests' },
];

export default function FundRequests({ requests, filters, summary, awaitingCount, companies, statuses }: Props) {
    const [search, setSearch] = useState(filters.q ?? '');
    const first = useRef(true);
    const view = filters.view ?? 'all';
    const companyOptions = companies.map((c) => ({ value: String(c.id), label: c.name }));

    const apply = (next: Filters) => {
        const merged = { ...filters, ...next };
        const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'));
        router.get(route('erp.banking.fund-requests.index'), clean, { preserveState: true, preserveScroll: true, replace: true });
    };

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const timer = setTimeout(() => apply({ q: search }), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const hasFilters = Boolean(filters.status || filters.from_company || filters.to_company || filters.from || filters.to || filters.q);
    const registerQuery = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

    return (
        <Page
            title="Fund requests"
            subtitle="Money between companies. The paying company's manager approves and signs before any transfer is made."
            actions={
                <>
                    <a href={route('erp.banking.dashboard')} className={secondaryButton}>
                        <LayoutDashboard className="mr-1.5 size-4" /> Dashboard
                    </a>
                    <a href={route('erp.banking.fund-requests.register', registerQuery)} className={secondaryButton}>
                        <FileDown className="mr-1.5 size-4" /> Register PDF
                    </a>
                </>
            }
        >
            <div className="flex flex-wrap gap-2">
                {views.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => apply({ view: item.value })}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition ${
                            view === item.value ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-primary/10'
                        }`}
                    >
                        {item.label}
                        {item.value === 'awaiting' && awaitingCount > 0 && (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${view === item.value ? 'bg-white/25' : 'bg-amber-500 text-white'}`}>
                                {awaitingCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {summary.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {statuses.map((status) => {
                        const rows = summary.filter((s) => s.status === status);
                        const count = rows.reduce((n, r) => n + r.count, 0);
                        const active = filters.status === status;
                        return (
                            <button
                                key={status}
                                type="button"
                                onClick={() => apply({ status: active ? '' : status })}
                                className={`bg-card/70 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${active ? 'ring-primary ring-2' : ''}`}
                            >
                                <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                                    <span className={`size-2 rounded-full ${fundStatus[status].dot}`} />
                                    {fundStatus[status].label}
                                </div>
                                <div className="mt-1 text-2xl font-semibold tabular-nums">{count}</div>
                                <div className="text-muted-foreground truncate text-xs tabular-nums">
                                    {rows.length === 0 ? '—' : rows.map((r) => `${r.currency} ${money(r.total)}`).join(' · ')}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            <Card>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <Field label="Search">
                        <TextInput value={search} onChange={setSearch} placeholder="Reference, purpose or name…" />
                    </Field>
                    <Field label="Status">
                        <Select
                            value={filters.status ?? ''}
                            onChange={(v) => apply({ status: v })}
                            options={statuses.map((s) => ({ value: s, label: fundStatus[s].label }))}
                            placeholder="Any status"
                        />
                    </Field>
                    <Field label="Paid by">
                        <Select
                            value={filters.from_company ?? ''}
                            onChange={(v) => apply({ from_company: v })}
                            options={companyOptions}
                            placeholder="Any company"
                        />
                    </Field>
                    <Field label="Paid to">
                        <Select
                            value={filters.to_company ?? ''}
                            onChange={(v) => apply({ to_company: v })}
                            options={companyOptions}
                            placeholder="Any company"
                        />
                    </Field>
                    <Field label="Requested from">
                        <TextInput type="date" value={filters.from ?? ''} onChange={(v) => apply({ from: v })} />
                    </Field>
                    <Field label="Requested to">
                        <TextInput type="date" value={filters.to ?? ''} onChange={(v) => apply({ to: v })} />
                    </Field>
                </div>
                {hasFilters && (
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
                        onClick={() => {
                            setSearch('');
                            router.get(route('erp.banking.fund-requests.index'), view === 'all' ? {} : { view }, { preserveScroll: true });
                        }}
                    >
                        <X className="size-3.5" /> Clear filters
                    </button>
                )}

                {requests.data.length === 0 ? (
                    <Empty>
                        {view === 'awaiting' ? 'Nothing is waiting for your approval.' : 'No fund requests match.'}
                        <br />
                        Requests are made from Banking with <strong>Move funds</strong>, choosing an account in another company.
                    </Empty>
                ) : (
                    <div className="-mx-4 overflow-x-auto sm:mx-0">
                        <table className="w-full min-w-[960px] text-sm">
                            <thead>
                                <tr className="text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
                                    <th className="px-3 py-2 font-medium">Request</th>
                                    <th className="px-3 py-2 font-medium">From → to</th>
                                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                                    <th className="px-3 py-2 font-medium">Requested by</th>
                                    <th className="px-3 py-2 font-medium">Approved by</th>
                                    <th className="px-3 py-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.data.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="hover:bg-muted/40 cursor-pointer border-b align-top last:border-0"
                                        onClick={() => router.visit(route('erp.banking.fund-requests.show', row.id))}
                                    >
                                        <td className="px-3 py-3">
                                            <Link
                                                href={route('erp.banking.fund-requests.show', row.id)}
                                                className="text-primary font-semibold"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {row.reference}
                                            </Link>
                                            <div className="text-muted-foreground mt-0.5 line-clamp-2 max-w-[220px] text-xs">{row.purpose}</div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5 font-medium">
                                                {row.from.company} <ArrowRight className="text-muted-foreground size-3.5" /> {row.to.company}
                                            </div>
                                            <div className="text-muted-foreground text-xs tabular-nums">
                                                {row.from.account} → {row.to.account}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                                            {row.currency} {money(row.amount)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <SignerCell signer={row.requester} />
                                        </td>
                                        <td className="px-3 py-3">
                                            {row.approver ? (
                                                <SignerCell signer={row.approver} rejected={row.status === 'rejected'} />
                                            ) : (
                                                <span className="text-muted-foreground text-xs">Not yet decided</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span
                                                className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${fundStatus[row.status].className}`}
                                            >
                                                {fundStatus[row.status].label}
                                            </span>
                                            {row.can_decide && (
                                                <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                    <ShieldCheck className="size-3.5" /> Needs you
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination page={requests} />
            </Card>
        </Page>
    );
}

function SignerCell({ signer, rejected = false }: { signer: Signer; rejected?: boolean }) {
    return (
        <div className="min-w-[150px]">
            {signer.signature_url && !rejected ? (
                <img src={signer.signature_url} alt="" className="mb-1 h-9 max-w-[130px] rounded bg-white object-contain px-1" />
            ) : rejected ? (
                <div className="mb-1 text-xs font-bold tracking-wide text-rose-600 uppercase">Rejected</div>
            ) : null}
            <div className="font-medium">{signer.name}</div>
            {signer.title && <div className="text-muted-foreground text-xs">{signer.title}</div>}
            <div className="text-muted-foreground text-xs">{stamp(signer.at)}</div>
        </div>
    );
}
