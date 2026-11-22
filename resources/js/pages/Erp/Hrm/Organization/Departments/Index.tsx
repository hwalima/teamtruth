import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Employee = { id: number; employee_number: string; first_name: string; last_name: string; user: { name: string; email: string } | null };
type CostCenter = { id: number; code: string; name: string };
type Department = {
    id: number;
    name: string;
    code: string;
    description: string | null;
    manager: Employee | null;
    cost_center: CostCenter | null;
    parent: { id: number; name: string; code: string } | null;
    children: Department[];
    is_active: boolean;
    sort_order: number;
    employee_count: number;
    position_count: number;
    created_at: string;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    departments: {
        data: Department[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    managers: Employee[];
    costCenters: CostCenter[];
    parentOptions: { id: number; name: string; code: string }[];
    filters: {
        search?: string;
        parent_id?: string;
        is_active?: string;
        manager_id?: string;
    };
};

const renderDepartmentTree = (departments: Department[], level = 0) => (
    <tbody>
        {departments.map((dept) => (
            <tr key={dept.id} className="border-b border-border/50 hover:bg-muted/30" style={{ paddingLeft: `${level * 20}px` }}>
                <td className="py-3">
                    <div className="flex items-center gap-2">
                        <span style={{ marginLeft: `${level * 20}px` }} />
                        <span className="font-medium">{dept.code}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="font-medium">{dept.name}</span>
                        {!dept.is_active && (
                            <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">Inactive</span>
                        )}
                    </div>
                    {dept.description && (
                        <p className="text-xs text-muted-foreground mt-1">{dept.description}</p>
                    )}
                </td>
                <td className="py-3 text-muted-foreground text-sm">
                    {dept.parent ? `${dept.parent.code} / ${dept.parent.name}` : '—'}
                </td>
                <td className="py-3">
                    {dept.manager ? (
                        <>
                            <p className="font-medium">{dept.manager.employee_number}</p>
                            <p className="text-xs text-muted-foreground">{dept.manager.first_name} {dept.manager.last_name}</p>
                        </>
                    ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                    )}
                </td>
                <td className="py-3 text-muted-foreground text-sm">
                    {dept.cost_center ? `${dept.cost_center.code} / ${dept.cost_center.name}` : '—'}
                </td>
                <td className="py-3 text-center text-sm">
                    <span className="font-medium">{dept.employee_count}</span> employees
                </td>
                <td className="py-3 text-center text-sm">
                    <span className="font-medium">{dept.position_count}</span> positions
                </td>
                <td className="py-3 text-center text-sm">
                    {dept.sort_order}
                </td>
                <td className="py-3 text-right">
                    {route().has('erp.hrm.organization.departments.edit') && (<a
                        href={route('erp.hrm.organization.departments.edit', dept.id)}
                        className="text-primary underline text-sm"
                    >
                        Edit
                    </a>)}
                </td>
            </tr>
        ))}
    </tbody>
);

export default function DepartmentsIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        parent_id: props.filters.parent_id ?? '',
        is_active: props.filters.is_active ?? '',
        manager_id: props.filters.manager_id ?? '',
    });

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.hrm.organization.departments.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'parent_id', 'is_active', 'manager_id');
        router.get(route('erp.hrm.organization.departments.index'), {}, { preserveState: true, preserveScroll: true });
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} HRM - Departments</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage organizational structure, departments, and reporting lines.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Departments</h2>
                    {route().has('erp.hrm.organization.departments.create') && (<a
                        href={route('erp.hrm.organization.departments.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Add Department
                    </a>)}
                </div>

                <form onSubmit={handleFilterSubmit} className="grid gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Search</span>
                            <input
                                type="text"
                                value={filterForm.data.search}
                                onChange={(e) => filterForm.setData('search', e.target.value)}
                                placeholder="Name, code, description..."
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Parent Department</span>
                            <select
                                value={filterForm.data.parent_id}
                                onChange={(e) => filterForm.setData('parent_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                {props.parentOptions.map((p) => (
                                    <option key={p.id} value={p.id.toString()}>
                                        {p.code} — {p.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Status</span>
                            <select
                                value={filterForm.data.is_active}
                                onChange={(e) => filterForm.setData('is_active', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Manager</span>
                            <select
                                value={filterForm.data.manager_id}
                                onChange={(e) => filterForm.setData('manager_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                {props.managers.map((m) => (
                                    <option key={m.id} value={m.id.toString()}>
                                        {m.employee_number} — {m.first_name} {m.last_name}
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
                                <th className="pb-3 font-medium">Department</th>
                                <th className="pb-3 font-medium">Parent</th>
                                <th className="pb-3 font-medium">Manager</th>
                                <th className="pb-3 font-medium">Cost Center</th>
                                <th className="pb-3 font-medium text-center">Employees</th>
                                <th className="pb-3 font-medium text-center">Positions</th>
                                <th className="pb-3 font-medium text-center">Sort Order</th>
                                <th className="pb-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        {renderDepartmentTree(props.departments.data, 0)}
                    </table>
                </div>

                {props.departments.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No departments found. {route().has('erp.hrm.organization.departments.create') && (<a href={route('erp.hrm.organization.departments.create')} className="text-primary underline">Create your first department</a>)}.
                    </div>
                )}

                {/* Pagination */}
                {props.departments.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.departments.current_page > 1 && (
                            <a
                                href={route('erp.hrm.organization.departments.index', { ...props.filters, page: props.departments.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.departments.current_page} of {props.departments.last_page}
                        </span>
                        {props.departments.current_page < props.departments.last_page && (
                            <a
                                href={route('erp.hrm.organization.departments.index', { ...props.filters, page: props.departments.current_page + 1 })}
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