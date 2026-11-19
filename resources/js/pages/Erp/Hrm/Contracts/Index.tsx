import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Employee = { id: number; employee_number: string; first_name: string; last_name: string; user: { name: string; email: string } | null };
type ContractTemplate = { id: number; code: string; name: string };
type Contract = {
    id: number;
    contract_number: string;
    employee: Employee;
    template: ContractTemplate | null;
    contract_type: string;
    status: string;
    start_date: string;
    end_date: string | null;
    basic_salary: number;
    currency_code: string;
    signed_by_employee_at: string | null;
    signed_by_employer_at: string | null;
    created_at: string;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    contracts: {
        data: Contract[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    employees: Employee[];
    templates: ContractTemplate[];
    filters: {
        search?: string;
        employee_id?: string;
        status?: string;
        contract_type?: string;
        template_id?: string;
        start_date_from?: string;
        start_date_to?: string;
        end_date_from?: string;
        end_date_to?: string;
    };
    statusOptions: Record<string, string>;
    typeOptions: Record<string, string>;
};

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    pending_signature: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    terminated: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    expired: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export default function ContractsIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        employee_id: props.filters.employee_id ?? '',
        status: props.filters.status ?? '',
        contract_type: props.filters.contract_type ?? '',
        template_id: props.filters.template_id ?? '',
        start_date_from: props.filters.start_date_from ?? '',
        start_date_to: props.filters.start_date_to ?? '',
        end_date_from: props.filters.end_date_from ?? '',
        end_date_to: props.filters.end_date_to ?? '',
    });

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.hrm.contracts.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'employee_id', 'status', 'contract_type', 'template_id', 'start_date_from', 'start_date_to', 'end_date_from', 'end_date_to');
        router.get(route('erp.hrm.contracts.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString();
    };

    const formatCurrency = (amount: number, currency: string) => {
        return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} HRM - Contracts</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage employee contracts, templates, and renewals.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Contracts</h2>
                    <a
                        href={route('erp.hrm.contracts.create')}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Create Contract
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
                                placeholder="Contract #, employee name..."
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
                            <span className="text-foreground/85 font-medium">Type</span>
                            <select
                                value={filterForm.data.contract_type}
                                onChange={(e) => filterForm.setData('contract_type', e.target.value)}
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
                            <span className="text-foreground/85 font-medium">Template</span>
                            <select
                                value={filterForm.data.template_id}
                                onChange={(e) => filterForm.setData('template_id', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            >
                                <option value="">All templates</option>
                                {props.templates.map((t) => (
                                    <option key={t.id} value={t.id.toString()}>
                                        {t.code} — {t.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Start From</span>
                            <input
                                type="date"
                                value={filterForm.data.start_date_from}
                                onChange={(e) => filterForm.setData('start_date_from', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Start To</span>
                            <input
                                type="date"
                                value={filterForm.data.start_date_to}
                                onChange={(e) => filterForm.setData('start_date_to', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">End From</span>
                            <input
                                type="date"
                                value={filterForm.data.end_date_from}
                                onChange={(e) => filterForm.setData('end_date_from', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">End To</span>
                            <input
                                type="date"
                                value={filterForm.data.end_date_to}
                                onChange={(e) => filterForm.setData('end_date_to', e.target.value)}
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
                                <th className="pb-3 font-medium">Contract #</th>
                                <th className="pb-3 font-medium">Employee</th>
                                <th className="pb-3 font-medium">Type</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Dates</th>
                                <th className="pb-3 font-medium text-right">Salary</th>
                                <th className="pb-3 font-medium">Signatures</th>
                                <th className="pb-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {props.contracts.data.map((contract) => (
                                <tr key={contract.id} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-3">
                                        <p className="font-medium">{contract.contract_number}</p>
                                        {contract.template && (
                                            <p className="text-xs text-muted-foreground">{contract.template.code}</p>
                                        )}
                                    </td>
                                    <td className="py-3">
                                        <p className="font-medium">{contract.employee.employee_number}</p>
                                        <p className="text-xs text-muted-foreground">{contract.employee.first_name} {contract.employee.last_name}</p>
                                    </td>
                                    <td className="py-3">
                                        <span className="capitalize text-xs">{contract.contract_type.replaceAll('_', ' ')}</span>
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${statusColors[contract.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                            {props.statusOptions[contract.status] ?? contract.status.replaceAll('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <p>{formatDate(contract.start_date)} – {contract.end_date ? formatDate(contract.end_date) : 'Indefinite'}</p>
                                    </td>
                                    <td className="py-3 text-right font-medium">
                                        {formatCurrency(contract.basic_salary, contract.currency_code)}
                                    </td>
                                    <td className="py-3">
                                        <div className="flex gap-2">
                                            {contract.signed_by_employee_at ? (
                                                <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Employee ✓</span>
                                            ) : (
                                                <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">Employee ✗</span>
                                            )}
                                            {contract.signed_by_employer_at ? (
                                                <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Employer ✓</span>
                                            ) : (
                                                <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">Employer ✗</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 text-right">
                                        <a
                                            href={route('erp.hrm.contracts.show', contract.id)}
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

                {props.contracts.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No contracts found. <a href={route('erp.hrm.contracts.create')} className="text-primary underline">Create your first contract</a>.
                    </div>
                )}

                {/* Pagination */}
                {props.contracts.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.contracts.current_page > 1 && (
                            <a
                                href={route('erp.hrm.contracts.index', { ...props.filters, page: props.contracts.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.contracts.current_page} of {props.contracts.last_page}
                        </span>
                        {props.contracts.current_page < props.contracts.last_page && (
                            <a
                                href={route('erp.hrm.contracts.index', { ...props.filters, page: props.contracts.current_page + 1 })}
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