import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Employee = { id: number; employee_number: string; first_name: string; last_name: string; user: { name: string; email: string } | null };
type SelfServiceRequest = {
    id: number;
    request_number: string;
    employee: Employee;
    request_type: string;
    title: string;
    status: string;
    priority: string;
    assigned_to: { id: number; name: string; email: string } | null;
    created_at: string;
    resolved_at: string | null;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    requests: {
        data: SelfServiceRequest[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    employees: Employee[];
    reviewers: { id: number; name: string; email: string }[];
    filters: {
        search?: string;
        employee_id?: string;
        request_type?: string;
        status?: string;
        priority?: string;
        assigned_to?: string;
        created_from?: string;
        created_to?: string;
    };
    statistics: {
        total: number;
        pending: number;
        under_review: number;
        approved: number;
        rejected: number;
        cancelled: number;
        by_type: Record<string, number>;
        avg_resolution_hours: number | null;
    };
    statusOptions: Record<string, string>;
    typeOptions: Record<string, string>;
    priorityOptions: Record<string, string>;
    canManage: boolean;
};

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800',
    normal: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
};

export default function SelfServiceIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        employee_id: props.filters.employee_id ?? '',
        request_type: props.filters.request_type ?? '',
        status: props.filters.status ?? '',
        priority: props.filters.priority ?? '',
        assigned_to: props.filters.assigned_to ?? '',
        created_from: props.filters.created_from ?? '',
        created_to: props.filters.created_to ?? '',
    });

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.hrm.self-service.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'employee_id', 'request_type', 'status', 'priority', 'assigned_to', 'created_from', 'created_to');
        router.get(route('erp.hrm.self-service.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString();
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} HRM - Self Service Requests</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage employee self-service requests and approvals.
                </p>
            </header>

            {/* Statistics Cards */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                    <p className="text-3xl font-bold">{props.statistics.total}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-3xl font-bold text-yellow-600">{props.statistics.pending}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Under Review</p>
                    <p className="text-3xl font-bold text-blue-600">{props.statistics.under_review}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Avg Resolution</p>
                    <p className="text-3xl font-bold">
                        {props.statistics.avg_resolution_hours ? `${props.statistics.avg_resolution_hours}h` : '—'}
                    </p>
                </div>
            </section>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Requests</h2>
                    <a
                        href={route('erp.hrm.self-service.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        New Request
                    </a>
                </div>

                <form onSubmit={handleFilterSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2 lg:col-span-2">
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Search</span>
                            <input
                                type="text"
                                value={filterForm.data.search}
                                onChange={(e) => filterForm.setData('search', e.target.value)}
                                placeholder="Request #, employee, title..."
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Employee</span>
                            <select
                                value={filterForm.data.employee_id}
                                onChange={(e) => filterForm.setData('employee_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                {props.employees.map((emp) => (
                                    <option key={emp.id} value={emp.id.toString()}>
                                        {emp.employee_number} — {emp.first_name} {emp.last_name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Type</span>
                            <select
                                value={filterForm.data.request_type}
                                onChange={(e) => filterForm.setData('request_type', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All types</option>
                                {Object.entries(props.typeOptions).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
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
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Priority</span>
                            <select
                                value={filterForm.data.priority}
                                onChange={(e) => filterForm.setData('priority', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                {Object.entries(props.priorityOptions).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Assigned To</span>
                            <select
                                value={filterForm.data.assigned_to}
                                onChange={(e) => filterForm.setData('assigned_to', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                {props.reviewers.map((r) => (
                                    <option key={r.id} value={r.id.toString()}>
                                        {r.name} ({r.email})
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Created From</span>
                            <input
                                type="date"
                                value={filterForm.data.created_from}
                                onChange={(e) => filterForm.setData('created_from', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Created To</span>
                            <input
                                type="date"
                                value={filterForm.data.created_to}
                                onChange={(e) => filterForm.setData('created_to', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-4">
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
                                <th className="pb-3 font-medium">Request #</th>
                                <th className="pb-3 font-medium">Employee</th>
                                <th className="pb-3 font-medium">Type</th>
                                <th className="pb-3 font-medium">Title</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Priority</th>
                                <th className="pb-3 font-medium">Assigned To</th>
                                <th className="pb-3 font-medium">Created</th>
                                <th className="pb-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {props.requests.data.map((req) => (
                                <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-3">
                                        <p className="font-medium">{req.request_number}</p>
                                    </td>
                                    <td className="py-3">
                                        <p className="font-medium">{req.employee.employee_number}</p>
                                        <p className="text-xs text-muted-foreground">{req.employee.first_name} {req.employee.last_name}</p>
                                    </td>
                                    <td className="py-3">
                                        <span className="capitalize text-xs">{req.request_type.replaceAll('_', ' ')}</span>
                                    </td>
                                    <td className="py-3">
                                        <p className="font-medium">{req.title}</p>
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${statusColors[req.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                            {props.statusOptions[req.status] ?? req.status.replaceAll('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${priorityColors[req.priority] ?? 'bg-gray-100 text-gray-800'}`}>
                                            {props.priorityOptions[req.priority] ?? req.priority}
                                        </span>
                                    </td>
                                    <td className="py-3 text-muted-foreground text-sm">
                                        {req.assigned_to ? req.assigned_to.name : 'Unassigned'}
                                    </td>
                                    <td className="py-3 text-muted-foreground text-sm">{formatDate(req.created_at)}</td>
                                    <td className="py-3 text-right">
                                        <a
                                            href={route('erp.hrm.self-service.show', req.id)}
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
                        No requests found.
                    </div>
                )}

                {/* Pagination */}
                {props.requests.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.requests.current_page > 1 && (
                            <a
                                href={route('erp.hrm.self-service.index', { ...props.filters, page: props.requests.current_page - 1 })}
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
                                href={route('erp.hrm.self-service.index', { ...props.filters, page: props.requests.current_page + 1 })}
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