import { router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Empty, Field, Page, Pagination, Select, TextInput, idOptions, personName, primaryButton, secondaryButton, type Paginated } from '@/components/hrm/ui';

type Person = { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string };
type Balance = {
    id: number;
    employee: Person | null;
    leave_type: { id: number; name: string; code: string; color: string | null } | null;
    period_start: string;
    period_end: string;
    brought_forward: string;
    accrued: string;
    carried_over: string;
    adjusted: string;
    taken: string;
    available: number;
    total_entitlement: number;
};

type Props = {
    company: { name: string };
    balances: Paginated<Balance>;
    filters: { search?: string; leave_type_id?: string; year: number };
    leaveTypes: { id: number; name: string; code: string }[];
    employees: Person[];
    canManage: boolean;
};

const year = new Date().getFullYear();

export default function LeaveBalancesIndex(props: Props) {
    const [creating, setCreating] = useState(false);
    const [adjusting, setAdjusting] = useState<Balance | null>(null);
    const filters = useForm({ search: props.filters.search ?? '', leave_type_id: props.filters.leave_type_id ?? '', year: String(props.filters.year) });
    const createForm = useForm({ employee_id: '', leave_type_id: '', period_start: `${year}-01-01`, period_end: `${year}-12-31`, brought_forward: '0', accrued: '0' });
    const adjustForm = useForm({ days: '', reason: '' });

    const applyFilters = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('erp.hrm.leave.balances.index'), Object.fromEntries(Object.entries(filters.data).filter(([, v]) => v !== '')), { preserveState: true });
    };

    const create = (event: FormEvent) => {
        event.preventDefault();
        createForm.post(route('erp.hrm.leave.balances.store'), { preserveScroll: true, onSuccess: () => setCreating(false) });
    };

    const adjust = (event: FormEvent) => {
        event.preventDefault();
        if (!adjusting) return;
        adjustForm.post(route('erp.hrm.leave.balances.adjust', adjusting.id), {
            preserveScroll: true,
            onSuccess: () => {
                adjustForm.reset();
                setAdjusting(null);
            },
        });
    };

    return (
        <Page
            title="Leave balances"
            subtitle={`Entitlements, days taken and days left · ${props.company.name}`}
            actions={
                props.canManage && (
                    <button type="button" onClick={() => setCreating((v) => !v)} className={primaryButton}>
                        Add balance
                    </button>
                )
            }
        >
            {creating && (
                <Card title="New leave balance">
                    <form onSubmit={create} className="grid gap-4 sm:grid-cols-3">
                        <Field label="Employee *" error={createForm.errors.employee_id}>
                            <Select value={createForm.data.employee_id} onChange={(v) => createForm.setData('employee_id', v)} options={idOptions(props.employees, (e) => `${e.employee_number} — ${personName(e)}`)} placeholder="— Select —" />
                        </Field>
                        <Field label="Leave type *" error={createForm.errors.leave_type_id}>
                            <Select value={createForm.data.leave_type_id} onChange={(v) => createForm.setData('leave_type_id', v)} options={idOptions(props.leaveTypes, (t) => t.name)} placeholder="— Select —" />
                        </Field>
                        <div />
                        <Field label="Period start *" error={createForm.errors.period_start}>
                            <TextInput type="date" value={createForm.data.period_start} onChange={(v) => createForm.setData('period_start', v)} />
                        </Field>
                        <Field label="Period end *" error={createForm.errors.period_end}>
                            <TextInput type="date" value={createForm.data.period_end} onChange={(v) => createForm.setData('period_end', v)} />
                        </Field>
                        <div />
                        <Field label="Entitled days" error={createForm.errors.accrued}>
                            <TextInput type="number" step="0.5" value={createForm.data.accrued} onChange={(v) => createForm.setData('accrued', v)} />
                        </Field>
                        <Field label="Brought forward" error={createForm.errors.brought_forward}>
                            <TextInput type="number" step="0.5" value={createForm.data.brought_forward} onChange={(v) => createForm.setData('brought_forward', v)} />
                        </Field>
                        <div className="flex gap-2 sm:col-span-3">
                            <button type="submit" disabled={createForm.processing} className={primaryButton}>
                                Save
                            </button>
                            <button type="button" onClick={() => setCreating(false)} className={secondaryButton}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </Card>
            )}

            {adjusting && (
                <Card title={`Adjust ${adjusting.leave_type?.name ?? 'leave'} for ${personName(adjusting.employee)}`}>
                    <form onSubmit={adjust} className="grid gap-4 sm:grid-cols-3">
                        <Field label="Days (use a minus sign to deduct)" error={adjustForm.errors.days}>
                            <TextInput type="number" step="0.5" value={adjustForm.data.days} onChange={(v) => adjustForm.setData('days', v)} />
                        </Field>
                        <Field label="Reason *" error={adjustForm.errors.reason} className="sm:col-span-2">
                            <TextInput value={adjustForm.data.reason} onChange={(v) => adjustForm.setData('reason', v)} />
                        </Field>
                        <div className="flex gap-2 sm:col-span-3">
                            <button type="submit" disabled={adjustForm.processing} className={primaryButton}>
                                Apply adjustment
                            </button>
                            <button type="button" onClick={() => setAdjusting(null)} className={secondaryButton}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </Card>
            )}

            <Card>
                <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-4">
                    <Field label="Employee">
                        <TextInput value={filters.data.search} onChange={(v) => filters.setData('search', v)} placeholder="Name or number" />
                    </Field>
                    <Field label="Leave type">
                        <Select value={filters.data.leave_type_id} onChange={(v) => filters.setData('leave_type_id', v)} options={idOptions(props.leaveTypes, (t) => t.name)} placeholder="All" />
                    </Field>
                    <Field label="Year">
                        <TextInput type="number" value={filters.data.year} onChange={(v) => filters.setData('year', v)} />
                    </Field>
                    <div className="flex items-end">
                        <button type="submit" className={primaryButton}>
                            Apply
                        </button>
                    </div>
                </form>
            </Card>

            {props.balances.data.length === 0 ? (
                <Empty>No leave balances for {props.filters.year}. Balances are created automatically the first time someone requests leave.</Empty>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium">Employee</th>
                                <th className="px-4 py-3 font-medium">Leave type</th>
                                <th className="px-4 py-3 text-right font-medium">Entitled</th>
                                <th className="px-4 py-3 text-right font-medium">Brought fwd</th>
                                <th className="px-4 py-3 text-right font-medium">Adjusted</th>
                                <th className="px-4 py-3 text-right font-medium">Taken</th>
                                <th className="px-4 py-3 text-right font-medium">Available</th>
                                {props.canManage && <th className="px-4 py-3" />}
                            </tr>
                        </thead>
                        <tbody>
                            {props.balances.data.map((balance) => (
                                <tr key={balance.id} className="border-t">
                                    <td className="px-4 py-3">
                                        {balance.employee ? (
                                            <a href={route('erp.hrm.employees.show', balance.employee.id)} className="font-medium hover:underline">
                                                {personName(balance.employee)}
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-3">{balance.leave_type?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-right">{Number(balance.accrued)}</td>
                                    <td className="px-4 py-3 text-right">{Number(balance.brought_forward) + Number(balance.carried_over)}</td>
                                    <td className="px-4 py-3 text-right">{Number(balance.adjusted)}</td>
                                    <td className="px-4 py-3 text-right">{Number(balance.taken)}</td>
                                    <td className="px-4 py-3 text-right font-semibold">{balance.available}</td>
                                    {props.canManage && (
                                        <td className="px-4 py-3 text-right">
                                            <button type="button" onClick={() => setAdjusting(balance)} className="text-primary underline">
                                                Adjust
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination page={props.balances} />
        </Page>
    );
}
