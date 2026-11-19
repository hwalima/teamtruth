import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Employee = { id: number; employee_number: string; first_name: string; last_name: string; user: { name: string; email: string } | null };
type DisciplinaryCase = {
    id: number;
    case_number: string;
    employee: Employee;
    reported_by: { id: number; name: string; email: string } | null;
    incident_date: string;
    reported_date: string;
    status: string;
    outcome: string | null;
    outcome_date: string | null;
    expiry_date: string | null;
    created_at: string;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    cases: {
        data: DisciplinaryCase[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    employees: Employee[];
    reportedByUsers: { id: number; name: string; email: string }[];
    filters: {
        search?: string;
        employee_id?: string;
        status?: string;
        outcome?: string;
        reported_by?: string;
        incident_date_from?: string;
        incident_date_to?: string;
    };
    statusOptions: Record<string, string>;
    outcomeOptions: Record<string, string>;
};

const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    under_investigation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    investigation_complete: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    hearing_scheduled: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    hearing_completed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    outcome_decided: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    appealed: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const outcomeColors: Record<string, string> = {
    verbal_warning: 'bg-yellow-100 text-yellow-800',
    written_warning: 'bg-orange-100 text-orange-800',
    final_written_warning: 'bg-red-100 text-red-800',
    suspension: 'bg-purple-100 text-purple-800',
    demotion: 'bg-indigo-100 text-indigo-800',
    dismissal: 'bg-red-100 text-red-800',
    counselling: 'bg-blue-100 text-blue-800',
    training_required: 'bg-green-100 text-green-800',
    no_action: 'bg-gray-100 text-gray-800',
};

export default function DisciplinaryIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        employee_id: props.filters.employee_id ?? '',
        status: props.filters.status ?? '',
        outcome: props.filters.outcome ?? '',
        reported_by: props.filters.reported_by ?? '',
        incident_date_from: props.filters.incident_date_from ?? '',
        incident_date_to: props.filters.incident_date_to ?? '',
    });

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.hrm.disciplinary.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'employee_id', 'status', 'outcome', 'reported_by', 'incident_date_from', 'incident_date_to');
        router.get(route('erp.hrm.disciplinary.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString();
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} HRM - Disciplinary Cases</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage disciplinary cases, investigations, hearings, and outcomes.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Disciplinary Cases</h2>
                    <a
                        href={route('erp.hrm.disciplinary.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Create Case
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
                                placeholder="Case #, employee, incident..."
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
                                <option value="">All employees</option>
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
                            <span className="text-foreground/85 font-medium">Outcome</span>
                            <select
                                value={filterForm.data.outcome}
                                onChange={(e) => filterForm.setData('outcome', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All outcomes</option>
                                {Object.entries(props.outcomeOptions).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Reported By</span>
                            <select
                                value={filterForm.data.reported_by}
                                onChange={(e) => filterForm.setData('reported_by', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                {props.reportedByUsers.map((u) => (
                                    <option key={u.id} value={u.id.toString()}>
                                        {u.name} ({u.email})
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Incident From</span>
                            <input
                                type="date"
                                value={filterForm.data.incident_date_from}
                                onChange={(e) => filterForm.setData('incident_date_from', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Incident To</span>
                            <input
                                type="date"
                                value={filterForm.data.incident_date_to}
                                onChange={(e) => filterForm.setData('incident_date_to', e.target.value)}
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
                                <th className="pb-3 font-medium">Case #</th>
                                <th className="pb-3 font-medium">Employee</th>
                                <th className="pb-3 font-medium">Incident Date</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Outcome</th>
                                <th className="pb-3 font-medium">Expiry</th>
                                <th className="pb-3 font-medium">Created</th>
                                <th className="pb-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {props.cases.data.map((case_) => (
                                <tr key={case_.id} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-3">
                                        <p className="font-medium">{case_.case_number}</p>
                                    </td>
                                    <td className="py-3">
                                        <p className="font-medium">{case_.employee.employee_number}</p>
                                        <p className="text-xs text-muted-foreground">{case_.employee.first_name} {case_.employee.last_name}</p>
                                    </td>
                                    <td className="py-3">{formatDate(case_.incident_date)}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${statusColors[case_.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                            {props.statusOptions[case_.status] ?? case_.status.replaceAll('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        {case_.outcome ? (
                                            <span className={`px-2 py-1 rounded text-xs ${outcomeColors[case_.outcome] ?? 'bg-gray-100 text-gray-800'}`}>
                                                {props.outcomeOptions[case_.outcome] ?? case_.outcome.replaceAll('_', ' ')}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="py-3">
                                        {case_.expiry_date ? (
                                            <span className={new Date(case_.expiry_date) < new Date() ? 'text-destructive' : 'text-muted-foreground'}>
                                                {formatDate(case_.expiry_date)}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 text-muted-foreground">{formatDate(case_.created_at)}</td>
                                    <td className="py-3 text-right">
                                        <a
                                            href={route('erp.hrm.disciplinary.show', case_.id)}
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

                {props.cases.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No disciplinary cases found. <a href={route('erp.hrm.disciplinary.create')} className="text-primary underline">Create your first case</a>.
                    </div>
                )}

                {/* Pagination */}
                {props.cases.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.cases.current_page > 1 && (
                            <a
                                href={route('erp.hrm.disciplinary.index', { ...props.filters, page: props.cases.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.cases.current_page} of {props.cases.last_page}
                        </span>
                        {props.cases.current_page < props.cases.last_page && (
                            <a
                                href={route('erp.hrm.disciplinary.index', { ...props.filters, page: props.cases.current_page + 1 })}
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