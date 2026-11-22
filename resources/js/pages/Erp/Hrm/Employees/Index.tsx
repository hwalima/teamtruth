import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Empty, Field, Page, Pagination, Select, StatusBadge, TextInput, formatDate, idOptions, personName, primaryButton, secondaryButton, type Options, type Paginated } from '@/components/hrm/ui';

type Employee = {
    id: number;
    employee_number: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    personal_email: string | null;
    personal_phone: string | null;
    status: string;
    hire_date: string | null;
    department: { name: string } | null;
    position: { name: string } | null;
    line_manager: { first_name: string; middle_name: string | null; last_name: string } | null;
};

type Props = {
    company: { name: string };
    employees: Paginated<Employee>;
    departments: { id: number; name: string }[];
    positions: { id: number; name: string }[];
    filters: Record<string, string | undefined>;
    statusOptions: Options;
    canManage: boolean;
};

export default function EmployeesIndex(props: Props) {
    const filters = useForm({
        search: props.filters.search ?? '',
        status: props.filters.status ?? '',
        department_id: props.filters.department_id ?? '',
        position_id: props.filters.position_id ?? '',
    });

    const apply = (event: FormEvent) => {
        event.preventDefault();
        const params = Object.fromEntries(Object.entries(filters.data).filter(([, value]) => value !== ''));
        router.get(route('erp.hrm.employees.index'), params, { preserveState: true });
    };

    return (
        <Page
            title="Employees"
            subtitle={`${props.employees.total} employee(s) in ${props.company.name}`}
            actions={
                props.canManage && (
                    <a href={route('erp.hrm.employees.create')} className={primaryButton}>
                        Add employee
                    </a>
                )
            }
        >
            <Card>
                <form onSubmit={apply} className="grid gap-3 sm:grid-cols-5">
                    <Field label="Search" className="sm:col-span-2">
                        <TextInput value={filters.data.search} onChange={(v) => filters.setData('search', v)} placeholder="Name, number, email, ID..." />
                    </Field>
                    <Field label="Status">
                        <Select value={filters.data.status} onChange={(v) => filters.setData('status', v)} options={props.statusOptions} placeholder="All" />
                    </Field>
                    <Field label="Department">
                        <Select value={filters.data.department_id} onChange={(v) => filters.setData('department_id', v)} options={idOptions(props.departments, (d) => d.name)} placeholder="All" />
                    </Field>
                    <Field label="Position">
                        <Select value={filters.data.position_id} onChange={(v) => filters.setData('position_id', v)} options={idOptions(props.positions, (p) => p.name)} placeholder="All" />
                    </Field>
                    <div className="flex gap-2 sm:col-span-5">
                        <button type="submit" className={primaryButton}>
                            Apply filters
                        </button>
                        <a href={route('erp.hrm.employees.index')} className={secondaryButton}>
                            Clear
                        </a>
                    </div>
                </form>
            </Card>

            {props.employees.data.length === 0 ? (
                <Empty>No employees found.</Empty>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium">Employee</th>
                                <th className="px-4 py-3 font-medium">Department</th>
                                <th className="px-4 py-3 font-medium">Position</th>
                                <th className="px-4 py-3 font-medium">Line manager</th>
                                <th className="px-4 py-3 font-medium">Hired</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {props.employees.data.map((employee) => (
                                <tr key={employee.id} className="border-t">
                                    <td className="px-4 py-3">
                                        <a href={route('erp.hrm.employees.show', employee.id)} className="font-medium hover:underline">
                                            {personName(employee)}
                                        </a>
                                        <div className="text-muted-foreground text-xs">
                                            {employee.employee_number}
                                            {employee.personal_email && ` · ${employee.personal_email}`}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{employee.department?.name ?? '—'}</td>
                                    <td className="px-4 py-3">{employee.position?.name ?? '—'}</td>
                                    <td className="px-4 py-3">{employee.line_manager ? personName(employee.line_manager) : '—'}</td>
                                    <td className="px-4 py-3">{formatDate(employee.hire_date)}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge value={employee.status} label={props.statusOptions[employee.status]} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination page={props.employees} />
        </Page>
    );
}
