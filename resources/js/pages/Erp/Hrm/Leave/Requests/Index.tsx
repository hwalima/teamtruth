import { useLiveSearch } from '@/hooks/use-live-search';
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
    idOptions,
    personName,
    primaryButton,
    secondaryButton,
    type Options,
    type Paginated,
} from '@/components/hrm/ui';
import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type LeaveRequest = {
    id: number;
    employee: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string } | null;
    leave_type: { name: string; color: string | null } | null;
    start_date: string;
    end_date: string;
    total_days: string;
    status: string;
    created_at: string;
};

type Props = {
    company: { name: string };
    requests: Paginated<LeaveRequest>;
    leaveTypes: { id: number; name: string }[];
    filters: Record<string, string | undefined>;
    statusOptions: Options;
    canApprove: boolean;
    canRequest: boolean;
    hasEmployeeRecord: boolean;
};

export default function LeaveRequestsIndex(props: Props) {
    const filters = useForm({
        search: props.filters.search ?? '',
        status: props.filters.status ?? '',
        leave_type_id: props.filters.leave_type_id ?? '',
        date_from: props.filters.date_from ?? '',
        date_to: props.filters.date_to ?? '',
    });

    useLiveSearch(filters.data.search, () => apply());
    const apply = (event?: FormEvent) => {
        event?.preventDefault();
        router.get(route('erp.hrm.leave.requests.index'), Object.fromEntries(Object.entries(filters.data).filter(([, v]) => v !== '')), {
            preserveState: true,
        });
    };

    return (
        <Page
            title="Leave requests"
            subtitle={props.canApprove ? `All leave requests in ${props.company.name}` : 'Your leave requests'}
            actions={
                <>
                    <a href={route('erp.hrm.leave.balances.index')} className={secondaryButton}>
                        Balances
                    </a>
                    {props.canRequest && (
                        <a href={route('erp.hrm.leave.requests.create')} className={primaryButton}>
                            Request leave
                        </a>
                    )}
                </>
            }
        >
            {!props.hasEmployeeRecord && !props.canApprove && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Your user account is not linked to an employee record yet, so you cannot request leave. Ask HR to link it on your employee
                    profile.
                </p>
            )}

            <Card>
                <form onSubmit={apply} className="grid gap-3 sm:grid-cols-6">
                    {props.canApprove && (
                        <Field label="Employee" className="sm:col-span-2">
                            <TextInput value={filters.data.search} onChange={(v) => filters.setData('search', v)} placeholder="Name or number" />
                        </Field>
                    )}
                    <Field label="Status">
                        <Select
                            value={filters.data.status}
                            onChange={(v) => filters.setData('status', v)}
                            options={props.statusOptions}
                            placeholder="All"
                        />
                    </Field>
                    <Field label="Leave type">
                        <Select
                            value={filters.data.leave_type_id}
                            onChange={(v) => filters.setData('leave_type_id', v)}
                            options={idOptions(props.leaveTypes, (t) => t.name)}
                            placeholder="All"
                        />
                    </Field>
                    <Field label="From">
                        <TextInput type="date" value={filters.data.date_from} onChange={(v) => filters.setData('date_from', v)} />
                    </Field>
                    <Field label="To">
                        <TextInput type="date" value={filters.data.date_to} onChange={(v) => filters.setData('date_to', v)} />
                    </Field>
                    <div className="flex gap-2 sm:col-span-6">
                        <button type="submit" className={primaryButton}>
                            Apply filters
                        </button>
                        <a href={route('erp.hrm.leave.requests.index')} className={secondaryButton}>
                            Clear
                        </a>
                    </div>
                </form>
            </Card>

            {props.requests.data.length === 0 ? (
                <Empty>No leave requests found.</Empty>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium">Employee</th>
                                <th className="px-4 py-3 font-medium">Leave type</th>
                                <th className="px-4 py-3 font-medium">Dates</th>
                                <th className="px-4 py-3 text-right font-medium">Days</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {props.requests.data.map((request) => (
                                <tr key={request.id} className="hover:bg-muted/30 border-t">
                                    <td className="px-4 py-3">{personName(request.employee)}</td>
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="inline-block size-2.5 rounded-full"
                                                style={{ backgroundColor: request.leave_type?.color ?? '#94a3b8' }}
                                            />
                                            {request.leave_type?.name ?? '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {formatDate(request.start_date)} – {formatDate(request.end_date)}
                                    </td>
                                    <td className="px-4 py-3 text-right">{Number(request.total_days)}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge value={request.status} label={props.statusOptions[request.status]} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <RecordActions viewHref={route('erp.hrm.leave.requests.show', request.id)} />
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
