import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Employee = { id: number; employee_number: string; first_name: string; last_name: string; user: { name: string; email: string } | null };
type LeaveType = { id: number; code: string; name: string };
type LeaveRequest = {
    id: number;
    employee: Employee;
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    working_days: number;
    status: string;
    reason: string | null;
    approved_by: Employee | null;
    approved_at: string | null;
    created_at: string;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    requests: {
        data: LeaveRequest[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    leaveTypes: LeaveType[];
    employees: Employee[];
    filters: {
        search?: string;
        leave_type_id?: string;
        status?: string;
        employee_id?: string;
        date_from?: string;
        date_to?: string;
    };
    statusOptions: Record<string, string>;
    canApprove: boolean;
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default function LeaveRequestsIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        leave_type_id: props.filters.leave_type_id ?? '',
        status: props.filters.status ?? '',
        employee_id: props.filters.employee_id ?? '',
        date_from: props.filters.date_from ?? '',
        date_to: props.filters.date_to ?? '',
    });

    const filterErrors = filterForm.errors as Record<string, string>;

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.hrm.leave.requests.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'leave_type_id', 'status', 'employee_id', 'date_from', 'date_to');
        router.get(route('erp.hrm.leave.requests.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} HRM - Leave Requests</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Review and manage employee leave requests.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Leave Requests</h2>
                    <a
                        href={route('erp.hrm.leave.requests.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Request Leave
                    </a>
                </div>

                <form onSubmit={handleFilterSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="sm:col-span-2 lg:col-span-2">
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Search Employee</span>
                            <input
                                type="text"
                                value={filterForm.data.search}
                                onChange={(e) => filterForm.setData('search', e.target.value)}
                                placeholder="Name, employee #..."
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Leave Type</span>
                            <select
                                value={filterForm.data.leave_type_id}
                                onChange={(e) => filterForm.setData('leave_type_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All types</option>
                                {props.leaveTypes.map((lt) => (
                                    <option key={lt.id} value={lt.id.toString()}>
                                        {lt.code} — {lt.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Status</span>
                            <select
                                value={filterForm.data.status}
                                onChange={(e) => filterForm.setData('status', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All statuses</option>
                                {Object.entries(props.statusOptions).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {props.canApprove && (
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Employee</span>
                                <select
                                    value={filterForm.data.employee_id}
                                    onChange={(e) => filterForm.setData('employee_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">All employees</option>
                                    {props.employees.map((emp) => (
                                        <option key={emp.id} value={emp.id.toString()}>
                                            {emp.employee_number} — {emp.first_name} {emp.last_name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    )}
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">From</span>
                            <input
                                type="date"
                                value={filterForm.data.date_from}
                                onChange={(e) => filterForm.setData('date_from', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">To</span>
                            <input
                                type="date"
                                value={filterForm.data.date_to}
                                onChange={(e) => filterForm.setData('date_to', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:col-span-6">
                        <button
                            type="submit"
                            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </form>
            </section>

            <section className="space-y-4">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-muted-foreground border-b">
                                <th className="pb-3 font-medium">Employee</th>
                                <th className="pb-3 font-medium">Leave Type</th>
                                <th className="pb-3 font-medium">Dates</th>
                                <th className="pb-3 font-medium text-center">Days</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Approved By</th>
                                <th className="pb-3 font-medium">Created</th>
                                <th className="pb-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {props.requests.data.map((req) => (
                                <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-3">
                                        <p className="font-medium">{req.employee.employee_number}</p>
                                        <p className="text-xs text-muted-foreground">{req.employee.first_name} {req.employee.last_name}</p>
                                    </td>
                                    <td className="py-3">
                                        <p className="font-medium">{req.leave_type.code}</p>
                                        <p className="text-xs text-muted-foreground">{req.leave_type.name}</p>
                                    </td>
                                    <td className="py-3">
                                        <p>{formatDate(req.start_date)} – {formatDate(req.end_date)}</p>
                                    </td>
                                    <td className="py-3 text-center font-medium">{req.working_days}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${statusColors[req.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                            {props.statusOptions[req.status] ?? req.status}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        {req.approved_by ? (
                                            <>
                                                <p className="font-medium">{req.approved_by.employee_number}</p>
                                                <p className="text-xs text-muted-foreground">{req.approved_by.first_name} {req.approved_by.last_name}</p>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 text-muted-foreground text-sm">{formatDate(req.created_at)}</td>
                                    <td className="py-3 text-right">
                                        <a
                                            href={route('erp.hrm.leave.requests.show', req.id)}
                                            className="text-primary underline text-sm"
                                        >
                                            View
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {props.requests.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No leave requests found.
                    </div>
                )}

                {/* Pagination */}
                {props.requests.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.requests.current_page > 1 && (
                            <a
                                href={route('erp.hrm.leave.requests.index', { ...props.filters, page: props.requests.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.requests.current_page} of {props.requests.last_page}
                        </span>
                        {props.requests.current_page < props.requests.last_page && (
                            <a
                                href={route('erp.hrm.leave.requests.index', { ...props.filters, page: props.requests.current_page + 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Next
                            </a>
                        )}
                    </nav>
                )}
            </section>
        </main>
    );
}