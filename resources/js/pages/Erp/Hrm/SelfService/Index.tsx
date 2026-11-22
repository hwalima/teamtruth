import { RecordActions } from '@/components/erp/record-actions';
import {
    Card,
    Empty,
    Field,
    Page,
    Pagination,
    Select,
    StatusBadge,
    TextInput,
    formatDate,
    personName,
    primaryButton,
    secondaryButton,
    type Options,
    type Paginated,
} from '@/components/hrm/ui';
import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Person = { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string };
type SelfServiceRequest = {
    id: number;
    employee: Person | null;
    request_type: string;
    request_data: { subject?: string } | null;
    status: string;
    processed_by: { name: string } | null;
    created_at: string;
};

type Props = {
    company: { name: string };
    requests: Paginated<SelfServiceRequest>;
    filters: Record<string, string | undefined>;
    statusOptions: Options;
    typeOptions: Options;
    canManage: boolean;
    hasEmployeeRecord: boolean;
    myRecords: { employee: Person; contractsToSign: { id: number; contract_type: string; start_date: string }[]; openCases: number } | null;
};

const quickRequests: [string, string][] = [
    ['profile_update', 'Update my details'],
    ['payslip_request', 'Request a payslip'],
    ['certificate_request', 'Request a letter or certificate'],
    ['document_upload', 'Send HR a document'],
];

export default function SelfServiceIndex(props: Props) {
    const filters = useForm({
        search: props.filters.search ?? '',
        status: props.filters.status ?? '',
        request_type: props.filters.request_type ?? '',
    });
    const mine = Boolean(props.filters.mine);

    const apply = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            route('erp.hrm.self-service.index'),
            Object.fromEntries(Object.entries({ ...filters.data, mine: mine ? '1' : '' }).filter(([, v]) => v !== '')),
            { preserveState: true },
        );
    };

    return (
        <Page
            title={props.canManage && !mine ? 'Self-service requests' : 'My HR'}
            subtitle={
                props.canManage && !mine
                    ? `Requests from employees of ${props.company.name}`
                    : 'Your requests to HR, contracts to sign and other records'
            }
            actions={
                <>
                    {props.canManage && props.hasEmployeeRecord && (
                        <a href={route('erp.hrm.self-service.index', mine ? {} : { mine: 1 })} className={secondaryButton}>
                            {mine ? 'All requests' : 'My requests'}
                        </a>
                    )}
                    {props.hasEmployeeRecord && (
                        <a href={route('erp.hrm.self-service.create')} className={primaryButton}>
                            New request
                        </a>
                    )}
                </>
            }
        >
            {!props.hasEmployeeRecord && !props.canManage && (
                <Empty>
                    Your user account is not linked to an employee record yet. Ask HR to link it on your employee profile, then you can send requests
                    here.
                </Empty>
            )}

            {props.myRecords && (!props.canManage || mine) && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {quickRequests.map(([type, label]) => (
                        <a
                            key={type}
                            href={route('erp.hrm.self-service.create', { type })}
                            className="hover:bg-muted/40 rounded-xl border p-4 text-sm font-medium"
                        >
                            {label} →
                        </a>
                    ))}
                </div>
            )}

            {props.myRecords && props.myRecords.contractsToSign.length > 0 && (
                <Card title="Contracts waiting for your signature">
                    <ul className="divide-y">
                        {props.myRecords.contractsToSign.map((c) => (
                            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                                <span>Contract starting {formatDate(c.start_date)}</span>
                                <a href={route('erp.hrm.contracts.show', c.id)} className={primaryButton}>
                                    Review and sign
                                </a>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            {props.myRecords && props.myRecords.openCases > 0 && (
                <a
                    href={route('erp.hrm.disciplinary.index')}
                    className="block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                    You have {props.myRecords.openCases} open disciplinary case(s). View →
                </a>
            )}

            {props.myRecords && (
                <div className="flex flex-wrap gap-3 text-sm">
                    <a href={route('erp.hrm.leave.requests.index')} className="text-primary underline">
                        My leave
                    </a>
                    <a href={route('erp.hrm.leave.balances.index')} className="text-primary underline">
                        My leave balances
                    </a>
                </div>
            )}

            {props.canManage && !mine && (
                <Card>
                    <form onSubmit={apply} className="grid gap-3 sm:grid-cols-4">
                        <Field label="Employee">
                            <TextInput value={filters.data.search} onChange={(v) => filters.setData('search', v)} placeholder="Name or number" />
                        </Field>
                        <Field label="Status">
                            <Select
                                value={filters.data.status}
                                onChange={(v) => filters.setData('status', v)}
                                options={props.statusOptions}
                                placeholder="All"
                            />
                        </Field>
                        <Field label="Type">
                            <Select
                                value={filters.data.request_type}
                                onChange={(v) => filters.setData('request_type', v)}
                                options={props.typeOptions}
                                placeholder="All"
                            />
                        </Field>
                        <div className="flex items-end gap-2">
                            <button type="submit" className={primaryButton}>
                                Apply
                            </button>
                            <a href={route('erp.hrm.self-service.index')} className={secondaryButton}>
                                Clear
                            </a>
                        </div>
                    </form>
                </Card>
            )}

            {props.requests.data.length === 0 ? (
                (props.hasEmployeeRecord || props.canManage) && <Empty>No requests yet.</Empty>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left">
                            <tr>
                                {props.canManage && !mine && <th className="px-4 py-3 font-medium">Employee</th>}
                                <th className="px-4 py-3 font-medium">Request</th>
                                <th className="px-4 py-3 font-medium">Sent</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Handled by</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {props.requests.data.map((r) => (
                                <tr key={r.id} className="hover:bg-muted/30 border-t">
                                    {props.canManage && !mine && <td className="px-4 py-3">{personName(r.employee)}</td>}
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{props.typeOptions[r.request_type]}</div>
                                        {r.request_data?.subject && <div className="text-muted-foreground text-xs">{r.request_data.subject}</div>}
                                    </td>
                                    <td className="px-4 py-3">{formatDate(r.created_at)}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge value={r.status} label={props.statusOptions[r.status]} />
                                    </td>
                                    <td className="px-4 py-3">{r.processed_by?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <RecordActions viewHref={route('erp.hrm.self-service.show', r.id)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination page={props.requests} />
        </Page>
    );
}
