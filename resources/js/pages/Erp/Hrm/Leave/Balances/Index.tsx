import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Employee = { id: number; employee_number: string; first_name: string; last_name: string; user: { name: string; email: string } | null };
type LeaveType = { id: number; code: string; name: string; default_entitlement: number | null };
type Period = { period_start: string; period_end: string };
type LeaveBalance = {
    id: number;
    employee: Employee;
    leave_type: LeaveType;
    period_start: string;
    period_end: string;
    entitled_days: number;
    carried_forward: number;
    accrued_days: number;
    used_days: number;
    pending_days: number;
    adjusted_days: number;
    available_balance: number;
    is_frozen: boolean;
    ledger_entries_sum_used_sum: number | null;
    ledger_entries_sum_pending_sum: number | null;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    balances: {
        data: LeaveBalance[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    employees: Employee[];
    leaveTypes: LeaveType[];
    periods: Period[];
    filters: {
        search?: string;
        leave_type_id?: string;
        period_start?: string;
        period_end?: string;
    };
};

export default function LeaveBalancesIndex(props: Props) {
    const filterForm = useForm({
        search: props.filters.search ?? '',
        leave_type_id: props.filters.leave_type_id ?? '',
        period_start: props.filters.period_start ?? '',
        period_end: props.filters.period_end ?? '',
    });

    const form = useForm({
        employee_id: '',
        leave_type_id: '',
        period_start: '',
        period_end: '',
        entitled_days: '',
        carried_forward: '',
        accrued_days: '',
    });

    const adjustForm = useForm({
        adjustment: 0,
        reason: '',
    });

    const filterErrors = filterForm.errors as Record<string, string>;
    const isModalOpen = form.data.id !== undefined;
    const editingId = form.data.id;
    const adjustModalOpen = adjustForm.data.balanceId !== undefined;

    const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const params: Record<string, string | undefined> = {};
        Object.entries(filterForm.data).forEach(([key, value]) => {
            if (value !== '' && value !== undefined) {
                params[key] = value;
            }
        });
        router.get(route('erp.hrm.leave.balances.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        filterForm.reset('search', 'leave_type_id', 'period_start', 'period_end');
        router.get(route('erp.hrm.leave.balances.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.hrm.leave.balances.store'), form.data, {
            onSuccess: () => closeModal(),
        });
    };

    const handleAdjust = (event: FormEvent<HTMLFormElement>, balanceId: number) => {
        event.preventDefault();
        router.post(route('erp.hrm.leave.balances.adjust', balanceId), adjustForm.data, {
            onSuccess: () => closeAdjustModal(),
        });
    };

    const openCreateModal = () => {
        form.reset('id', 'employee_id', 'leave_type_id', 'period_start', 'period_end', 'entitled_days', 'carried_forward', 'accrued_days');
    };

    const closeModal = () => {
        form.reset('id', 'employee_id', 'leave_type_id', 'period_start', 'period_end', 'entitled_days', 'carried_forward', 'accrued_days');
    };

    const openAdjustModal = (balance: LeaveBalance) => {
        adjustForm.setData({
            balanceId: balance.id,
            adjustment: 0,
            reason: '',
        });
    };

    const closeAdjustModal = () => {
        adjustForm.reset('balanceId', 'adjustment', 'reason');
    };

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} HRM - Leave Balances</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Manage employee leave entitlements, accruals, and balances.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Leave Balances</h2>
                    <button
                        onClick={openCreateModal}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Add Balance
                    </button>
                </div>

                <form onSubmit={handleFilterSubmit} className="grid gap-3 sm:grid-cols-4">
                    <div>
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
                            <span className="text-foreground/85 font-medium">Period Start</span>
                            <input
                                type="date"
                                value={filterForm.data.period_start}
                                onChange={(e) => filterForm.setData('period_start', e.target.value)}
                                className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="grid gap-1.5 text-sm">
                            <span className="text-foreground/85 font-medium">Period End</span>
                            <input
                                type="date"
                                value={filterForm.data.period_end}
                                onChange={(e) => filterForm.setData('period_end', e.target.value)}
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
                                <th className="pb-3 font-medium">Employee</th>
                                <th className="pb-3 font-medium">Leave Type</th>
                                <th className="pb-3 font-medium text-right">Entitled</th>
                                <th className="pb-3 font-medium text-right">Carried</th>
                                <th className="pb-3 font-medium text-right">Accrued</th>
                                <th className="pb-3 font-medium text-right">Used</th>
                                <th className="pb-3 font-medium text-right">Pending</th>
                                <th className="pb-3 font-medium text-right">Adjusted</th>
                                <th className="pb-3 font-medium text-right">Available</th>
                                <th className="pb-3 font-medium text-right">Period</th>
                                <th className="pb-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {props.balances.data.map((balance) => (
                                <tr key={balance.id} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-3">
                                        <p className="font-medium">{balance.employee.employee_number}</p>
                                        <p className="text-xs text-muted-foreground">{balance.employee.first_name} {balance.employee.last_name}</p>
                                    </td>
                                    <td className="py-3">
                                        <p className="font-medium">{balance.leave_type.code}</p>
                                        <p className="text-xs text-muted-foreground">{balance.leave_type.name}</p>
                                    </td>
                                    <td className="py-3 text-right">{balance.entitled_days}</td>
                                    <td className="py-3 text-right">{balance.carried_forward}</td>
                                    <td className="py-3 text-right">{balance.accrued_days}</td>
                                    <td className="py-3 text-right">{balance.used_days}</td>
                                    <td className="py-3 text-right">{balance.pending_days}</td>
                                    <td className="py-3 text-right">{balance.adjusted_days >= 0 ? '+' : ''}{balance.adjusted_days}</td>
                                    <td className="py-3 text-right font-semibold">
                                        <span className={balance.available_balance < 0 ? 'text-destructive' : 'text-green-600'}>
                                            {balance.available_balance}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right text-muted-foreground">
                                        {formatDate(balance.period_start)} – {formatDate(balance.period_end)}
                                    </td>
                                    <td className="py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => openAdjustModal(balance)}
                                                className="text-primary underline text-sm"
                                            >
                                                Adjust
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {props.balances.data.length === 0 && (
                    <div className="border-border/80 bg-muted/20 text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm leading-6">
                        No leave balances found.
                    </div>
                )}

                {/* Pagination */}
                {props.balances.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.balances.current_page > 1 && (
                            <a
                                href={route('erp.hrm.leave.balances.index', { ...props.filters, page: props.balances.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.balances.current_page} of {props.balances.last_page}
                        </span>
                        {props.balances.current_page < props.balances.last_page && (
                            <a
                                href={route('erp.hrm.leave.balances.index', { ...props.filters, page: props.balances.current_page + 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Next
                            </a>
                        )}
                    </nav>
                )}
            </section>

            {/* Create Modal */}
            <div className={isModalOpen ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/50' : 'hidden'}>
                <div className="w-full max-w-md bg-card rounded-xl p-6 shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">Create Leave Balance</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Employee *</span>
                                <select
                                    value={form.data.employee_id}
                                    onChange={(e) => form.setData('employee_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                >
                                    <option value="">Select employee</option>
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
                                <span className="text-foreground/85 font-medium">Leave Type *</span>
                                <select
                                    value={form.data.leave_type_id}
                                    onChange={(e) => form.setData('leave_type_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                >
                                    <option value="">Select leave type</option>
                                    {props.leaveTypes.map((lt) => (
                                        <option key={lt.id} value={lt.id.toString()}>
                                            {lt.code} — {lt.name} (default: {lt.default_entitlement ?? 0} days)
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Period Start *</span>
                                    <input
                                        type="date"
                                        value={form.data.period_start}
                                        onChange={(e) => form.setData('period_start', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        required
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Period End *</span>
                                    <input
                                        type="date"
                                        value={form.data.period_end}
                                        onChange={(e) => form.setData('period_end', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        required
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Entitled Days</span>
                                    <input
                                        type="number"
                                        value={form.data.entitled_days}
                                        onChange={(e) => form.setData('entitled_days', Number(e.target.value) || '')}
                                        min={0}
                                        max={365}
                                        step={0.5}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Carried Forward</span>
                                    <input
                                        type="number"
                                        value={form.data.carried_forward}
                                        onChange={(e) => form.setData('carried_forward', Number(e.target.value) || '')}
                                        min={0}
                                        max={365}
                                        step={0.5}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Accrued Days</span>
                                    <input
                                        type="number"
                                        value={form.data.accrued_days}
                                        onChange={(e) => form.setData('accrued_days', Number(e.target.value) || '')}
                                        min={0}
                                        max={365}
                                        step={0.5}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={form.processing}
                                className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                            >
                                {form.processing ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Adjust Modal */}
            <div className={adjustModalOpen ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/50' : 'hidden'}>
                <div className="w-full max-w-md bg-card rounded-xl p-6 shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">Adjust Leave Balance</h3>
                    <form onSubmit={(e) => handleAdjust(e, adjustForm.data.balanceId!)} className="space-y-4">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Adjustment (days) *</span>
                                <input
                                    type="number"
                                    value={adjustForm.data.adjustment}
                                    onChange={(e) => adjustForm.setData('adjustment', Number(e.target.value))}
                                    step={0.5}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                <p className="text-xs text-muted-foreground">Use positive for increase, negative for decrease</p>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Reason *</span>
                                <textarea
                                    value={adjustForm.data.reason}
                                    onChange={(e) => adjustForm.setData('reason', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <button
                                type="button"
                                onClick={closeAdjustModal}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={adjustForm.processing}
                                className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                            >
                                {adjustForm.processing ? 'Adjusting...' : 'Apply Adjustment'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}