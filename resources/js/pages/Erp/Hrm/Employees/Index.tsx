import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Department = { id: number; code: string; name: string };
type Position = { id: number; code: string; name: string };
type Grade = { id: number; code: string; name: string };
type CostCenter = { id: number; code: string; name: string };
type Employee = {
    id: number;
    employee_number: string;
    first_name: string;
    last_name: string;
    gender: string;
    work_email: string | null;
    phone: string | null;
    employment_status: string;
    employment_type: string;
    hire_date: string;
    department: Department | null;
    position: Position | null;
    grade: Grade | null;
    cost_center: CostCenter | null;
    manager: { employee_number: string; first_name: string; last_name: string } | null;
    user: { name: string; email: string } | null;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    employees: {
        data: Employee[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    departments: Department[];
    positions: Position[];
    grades: Grade[];
    costCenters: CostCenter[];
    filters: {
        search?: string;
        department_id?: string;
        position_id?: string;
        employment_status?: string;
        employment_type?: string;
        grade_id?: string;
        cost_center_id?: string;
    };
    statusOptions: Record<string, string>;
    typeOptions: Record<string, string>;
};

const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    on_leave: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    suspended: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    terminated: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    probation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

export default function EmployeeIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        department_id: props.filters.department_id ?? '',
        position_id: props.filters.position_id ?? '',
        employment_status: props.filters.employment_status ?? '',
        employment_type: props.filters.employment_type ?? '',
        grade_id: props.filters.grade_id ?? '',
        cost_center_id: props.filters.cost_center_id ?? '',
    });

    const submitFilters = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.hrm.employees.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'department_id', 'position_id', 'employment_status', 'employment_type', 'grade_id', 'cost_center_id');
        router.get(route('erp.hrm.employees.index'), {}, { preserveState: true, preserveScroll: true });
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} HRM - Employees</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage employee records, contracts, and organizational structure.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Employees</h2>
                    <a
                        href={route('erp.hrm.employees.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Add Employee
                    </a>
                </div>

                <form onSubmit={submitFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Search</span>
                            <input
                                type="text"
                                value={filterForm.data.search}
                                onChange={(e) => filterForm.setData('search', e.target.value)}
                                placeholder="Name, employee #, email..."
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Status</span>
                            <select
                                value={filterForm.data.employment_status}
                                onChange={(e) => filterForm.setData('employment_status', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All statuses</option>
                                {Object.entries(props.statusOptions).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Type</span>
                            <select
                                value={filterForm.data.employment_type}
                                onChange={(e) => filterForm.setData('employment_type', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All types</option>
                                {Object.entries(props.typeOptions).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Department</span>
                            <select
                                value={filterForm.data.department_id}
                                onChange={(e) => filterForm.setData('department_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All departments</option>
                                {props.departments.map((dept) => (
                                    <option key={dept.id} value={dept.id.toString()}>
                                        {dept.code} — {dept.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Position</span>
                            <select
                                value={filterForm.data.position_id}
                                onChange={(e) => filterForm.setData('position_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All positions</option>
                                {props.positions.map((pos) => (
                                    <option key={pos.id} value={pos.id.toString()}>
                                        {pos.code} — {pos.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Grade</span>
                            <select
                                value={filterForm.data.grade_id}
                                onChange={(e) => filterForm.setData('grade_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All grades</option>
                                {props.grades.map((grade) => (
                                    <option key={grade.id} value={grade.id.toString()}>
                                        {grade.code} — {grade.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Cost Center</span>
                            <select
                                value={filterForm.data.cost_center_id}
                                onChange={(e) => filterForm.setData('cost_center_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All cost centers</option>
                                {props.costCenters.map((cc) => (
                                    <option key={cc.id} value={cc.id.toString()}>
                                        {cc.code} — {cc.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-4">
                        <button
                            type="submit"
                            className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            Apply Filters
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
                {props.employees.data.map((employee) => (
                    <article
                        key={employee.id}
                        className="space-y-3 rounded-xl border bg-card/70 p-4 shadow-[0_8px_32px_rgba(0,26,77,0.06)] backdrop-blur-xl transition-shadow hover:shadow-[0_12px_40px_rgba(0,26,77,0.09)]"
                    >
                        <header className="flex flex-wrap justify-between gap-3 items-start">
                            <div>
                                <h3 className="font-semibold text-lg">
                                    <a href={route('erp.hrm.employees.show', employee.id)} className="hover:underline">
                                        {employee.employee_number} — {employee.first_name} {employee.last_name}
                                    </a>
                                </h3>
                                <p className="text-muted-foreground text-sm mt-1">
                                    {employee.work_email ?? 'No work email'} · {employee.phone ?? 'No phone'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-right">
                                <span className={`px-2 py-1 rounded text-xs ${statusColors[employee.employment_status] ?? 'bg-gray-100 text-gray-800'}`}>
                                    {props.statusOptions[employee.employment_status] ?? employee.employment_status.replaceAll('_', ' ')}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {props.typeOptions[employee.employment_type] ?? employee.employment_type}
                                </span>
                            </div>
                        </header>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <div className="flex flex-wrap gap-4">
                                {employee.department && (
                                    <span>{employee.department.code} — {employee.department.name}</span>
                                )}
                                {employee.position && (
                                    <span>{employee.position.code} — {employee.position.name}</span>
                                )}
                                {employee.grade && (
                                    <span>{employee.grade.code} — {employee.grade.name}</span>
                                )}
                                {employee.cost_center && (
                                    <span>{employee.cost_center.code} — {employee.cost_center.name}</span>
                                )}
                                {employee.manager && (
                                    <span>Reports to: {employee.manager.employee_number} — {employee.manager.first_name} {employee.manager.last_name}</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <a
                                    href={route('erp.hrm.employees.show', employee.id)}
                                    className="text-primary underline text-sm"
                                >
                                    View
                                </a>
                            </div>
                        </div>
                    </article>
                ))}
                {props.employees.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No employees found. <a href={route('erp.hrm.employees.create')} className="text-primary underline">Add your first employee</a>.
                    </div>
                )}

                {/* Pagination */}
                {props.employees.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.employees.current_page > 1 && (
                            <a
                                href={route('erp.hrm.employees.index', { ...props.filters, page: props.employees.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.employees.current_page} of {props.employees.last_page}
                        </span>
                        {props.employees.current_page < props.employees.last_page && (
                            <a
                                href={route('erp.hrm.employees.index', { ...props.filters, page: props.employees.current_page + 1 })}
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