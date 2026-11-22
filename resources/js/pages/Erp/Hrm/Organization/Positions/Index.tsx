import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Department = { id: number; code: string; name: string };
type Grade = { id: number; code: string; name: string };
type Position = {
    id: number;
    name: string;
    code: string;
    description: string | null;
    department: Department;
    grade: Grade;
    reports_to: Position | null;
    headcount_planned: number;
    headcount_current: number;
    is_active: boolean;
    sort_order: number;
    children: Position[];
    created_at: string;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    positions: {
        data: Position[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    departments: Department[];
    grades: Grade[];
    reportingPositions: { id: number; code: string; name: string }[];
    filters: {
        search?: string;
        department_id?: string;
        grade_id?: string;
        is_active?: string;
        reports_to_position_id?: string;
        has_vacancy?: string;
    };
};

const renderPositionTree = (positions: Position[], level = 0) => (
    <tbody>
        {positions.map((pos) => (
            <tr key={pos.id} className="border-b border-border/50 hover:bg-muted/30" style={{ paddingLeft: `${level * 20}px` }}>
                <td className="py-3">
                    <div className="flex items-center gap-2">
                        <span style={{ marginLeft: `${level * 20}px` }} />
                        <span className="font-medium">{pos.code}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="font-medium">{pos.name}</span>
                        {!pos.is_active && (
                            <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">Inactive</span>
                        )}
                        {pos.headcount_current >= pos.headcount_planned && pos.headcount_planned > 0 && (
                            <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">Full</span>
                        )}
                        {pos.headcount_current < pos.headcount_planned && pos.headcount_planned > 0 && (
                            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">{pos.headcount_planned - pos.headcount_current} vacancy</span>
                        )}
                    </div>
                    {pos.description && (
                        <p className="text-xs text-muted-foreground mt-1">{pos.description}</p>
                    )}
                </td>
                <td className="py-3 text-muted-foreground text-sm">
                    {pos.department.code} / {pos.department.name}
                </td>
                <td className="py-3 text-muted-foreground text-sm">
                    {pos.grade.code} / {pos.grade.name}
                </td>
                <td className="py-3 text-center text-sm">
                    {pos.headcount_current} / {pos.headcount_planned}
                </td>
                <td className="py-3 text-muted-foreground text-sm">
                    {pos.reports_to ? `${pos.reports_to.code} / ${pos.reports_to.name}` : '—'}
                </td>
                <td className="py-3 text-center text-sm">
                    {pos.sort_order}
                </td>
                <td className="py-3 text-right">
                    {route().has('erp.hrm.organization.positions.edit') && (<a
                        href={route('erp.hrm.organization.positions.edit', pos.id)}
                        className="text-primary underline text-sm"
                    >
                        Edit
                    </a>)}
                </td>
            </tr>
        ))}
    </tbody>
);

export default function PositionsIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        department_id: props.filters.department_id ?? '',
        grade_id: props.filters.grade_id ?? '',
        is_active: props.filters.is_active ?? '',
        reports_to_position_id: props.filters.reports_to_position_id ?? '',
        has_vacancy: props.filters.has_vacancy ?? '',
    });

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.hrm.organization.positions.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'department_id', 'grade_id', 'is_active', 'reports_to_position_id', 'has_vacancy');
        router.get(route('erp.hrm.organization.positions.index'), {}, { preserveState: true, preserveScroll: true });
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} HRM - Positions</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage positions, reporting structure, and headcount planning.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Positions</h2>
                    {route().has('erp.hrm.organization.positions.create') && (<a
                        href={route('erp.hrm.organization.positions.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Add Position
                    </a>)}
                </div>

                <form onSubmit={handleFilterSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2 lg:col-span-2">
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
                            <span className="text-foreground/85 font-medium">Department</span>
                            <select
                                value={filterForm.data.department_id}
                                onChange={(e) => filterForm.setData('department_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                {props.departments.map((d) => (
                                    <option key={d.id} value={d.id.toString()}>
                                        {d.code} — {d.name}
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
                                <option value="">All</option>
                                {props.grades.map((g) => (
                                    <option key={g.id} value={g.id.toString()}>
                                        {g.code} — {g.name}
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
                            <span className="text-foreground/85 font-medium">Reports To</span>
                            <select
                                value={filterForm.data.reports_to_position_id}
                                onChange={(e) => filterForm.setData('reports_to_position_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All</option>
                                {props.reportingPositions.map((p) => (
                                    <option key={p.id} value={p.id.toString()}>
                                        {p.code} — {p.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filterForm.data.has_vacancy === 'true'}
                                onChange={(e) => filterForm.setData('has_vacancy', e.target.checked ? 'true' : '')}
                                className="rounded border-input border-primary/60"
                            />
                            <span className="text-sm">Has Vacancy</span>
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
                                <th className="pb-3 font-medium">Position</th>
                                <th className="pb-3 font-medium">Department</th>
                                <th className="pb-3 font-medium">Grade</th>
                                <th className="pb-3 font-medium text-center">Headcount</th>
                                <th className="pb-3 font-medium">Reports To</th>
                                <th className="pb-3 font-medium text-center">Sort Order</th>
                                <th className="pb-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        {renderPositionTree(props.positions.data, 0)}
                    </table>
                </div>

                {props.positions.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No positions found. {route().has('erp.hrm.organization.positions.create') && (<a href={route('erp.hrm.organization.positions.create')} className="text-primary underline">Create your first position</a>)}.
                    </div>
                )}

                {/* Pagination */}
                {props.positions.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.positions.current_page > 1 && (
                            <a
                                href={route('erp.hrm.organization.positions.index', { ...props.filters, page: props.positions.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.positions.current_page} of {props.positions.last_page}
                        </span>
                        {props.positions.current_page < props.positions.last_page && (
                            <a
                                href={route('erp.hrm.organization.positions.index', { ...props.filters, page: props.positions.current_page + 1 })}
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