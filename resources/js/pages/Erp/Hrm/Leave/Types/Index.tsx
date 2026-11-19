import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type LeaveType = {
    id: number;
    name: string;
    code: string;
    category: string;
    description: string | null;
    color: string | null;
    icon: string | null;
    default_entitlement: number | null;
    accrual_frequency: string;
    accrual_rate: number | null;
    max_accrual: number | null;
    min_service_months: number | null;
    gender_restriction: string | null;
    employment_types: string[] | null;
    requires_approval: boolean;
    requires_attachment: boolean;
    allows_past_dates: boolean;
    requires_future_date: boolean;
    min_duration_days: number | null;
    max_duration_days: number | null;
    max_consecutive_days: number | null;
    allows_carry_forward: boolean;
    max_carry_forward: number | null;
    carry_forward_expiry_months: number | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    leaveTypes: {
        data: LeaveType[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    categoryOptions: Record<string, string>;
};

const categoryColors: Record<string, string> = {
    annual: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    sick: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    maternity: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    paternity: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    compassionate: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    study: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    unpaid: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    special: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export default function LeaveTypesIndex(props: Props) {
    const form = useForm({
        name: '',
        code: '',
        category: 'annual',
        description: '',
        color: '#3b82f6',
        icon: '',
        default_entitlement: 0,
        accrual_frequency: 'annually',
        accrual_rate: 0,
        max_accrual: 0,
        min_service_months: 0,
        gender_restriction: '',
        employment_types: [],
        requires_approval: true,
        requires_attachment: false,
        allows_past_dates: false,
        requires_future_date: true,
        min_duration_days: 0.5,
        max_duration_days: 365,
        max_consecutive_days: 0,
        allows_carry_forward: true,
        max_carry_forward: 0,
        carry_forward_expiry_months: 12,
        is_active: true,
        sort_order: 0,
    });

    const errors = form.errors as Record<string, string>;
    const isModalOpen = form.data.id !== undefined;
    const editingId = form.data.id;

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (editingId) {
            router.put(route('erp.hrm.leave.types.update', editingId), form.data, {
                onSuccess: () => closeModal(),
            });
        } else {
            router.post(route('erp.hrm.leave.types.store'), form.data, {
                onSuccess: () => closeModal(),
            });
        }
    };

    const openEditModal = (leaveType: LeaveType) => {
        form.setData({
            id: leaveType.id,
            name: leaveType.name,
            code: leaveType.code,
            category: leaveType.category,
            description: leaveType.description ?? '',
            color: leaveType.color ?? '#3b82f6',
            icon: leaveType.icon ?? '',
            default_entitlement: leaveType.default_entitlement ?? 0,
            accrual_frequency: leaveType.accrual_frequency,
            accrual_rate: leaveType.accrual_rate ?? 0,
            max_accrual: leaveType.max_accrual ?? 0,
            min_service_months: leaveType.min_service_months ?? 0,
            gender_restriction: leaveType.gender_restriction ?? '',
            employment_types: leaveType.employment_types ?? [],
            requires_approval: leaveType.requires_approval,
            requires_attachment: leaveType.requires_attachment,
            allows_past_dates: leaveType.allows_past_dates,
            requires_future_date: leaveType.requires_future_date,
            min_duration_days: leaveType.min_duration_days ?? 0.5,
            max_duration_days: leaveType.max_duration_days ?? 365,
            max_consecutive_days: leaveType.max_consecutive_days ?? 0,
            allows_carry_forward: leaveType.allows_carry_forward,
            max_carry_forward: leaveType.max_carry_forward ?? 0,
            carry_forward_expiry_months: leaveType.carry_forward_expiry_months ?? 12,
            is_active: leaveType.is_active,
            sort_order: leaveType.sort_order,
        });
    };

    const openCreateModal = () => {
        form.reset(
            'id', 'name', 'code', 'category', 'description', 'color', 'icon',
            'default_entitlement', 'accrual_frequency', 'accrual_rate', 'max_accrual',
            'min_service_months', 'gender_restriction', 'employment_types',
            'requires_approval', 'requires_attachment', 'allows_past_dates',
            'requires_future_date', 'min_duration_days', 'max_duration_days',
            'max_consecutive_days', 'allows_carry_forward', 'max_carry_forward',
            'carry_forward_expiry_months', 'is_active', 'sort_order'
        );
    };

    const closeModal = () => {
        form.reset(
            'id', 'name', 'code', 'category', 'description', 'color', 'icon',
            'default_entitlement', 'accrual_frequency', 'accrual_rate', 'max_accrual',
            'min_service_months', 'gender_restriction', 'employment_types',
            'requires_approval', 'requires_attachment', 'allows_past_dates',
            'requires_future_date', 'min_duration_days', 'max_duration_days',
            'max_consecutive_days', 'allows_carry_forward', 'max_carry_forward',
            'carry_forward_expiry_months', 'is_active', 'sort_order'
        );
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this leave type?')) {
            router.delete(route('erp.hrm.leave.types.destroy', id));
        }
    };

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">{props.company.name} HRM - Leave Types</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Configure leave types, entitlements, and accrual rules.
                </p>
            </header>

            <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                <div className="flex flex-wrap justify-between gap-3 items-center">
                    <h2 className="text-lg font-medium">Leave Types</h2>
                    <button
                        onClick={openCreateModal}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        Add Leave Type
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-muted-foreground border-b">
                                <th className="pb-3 font-medium">Name / Code</th>
                                <th className="pb-3 font-medium">Category</th>
                                <th className="pb-3 font-medium">Entitlement</th>
                                <th className="pb-3 font-medium">Accrual</th>
                                <th className="pb-3 font-medium">Approval</th>
                                <th className="pb-3 font-medium">Carry Forward</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {props.leaveTypes.data.map((lt) => (
                                <tr key={lt.id} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-3">
                                        <div className="flex items-center gap-3">
                                            {lt.color && (
                                                <span
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: lt.color }}
                                                />
                                            )}
                                            <div>
                                                <p className="font-medium">{lt.name}</p>
                                                <p className="text-xs text-muted-foreground">{lt.code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${categoryColors[lt.category] ?? 'bg-gray-100 text-gray-800'}`}>
                                            {props.categoryOptions[lt.category] ?? lt.category}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        {lt.default_entitlement ? `${lt.default_entitlement} days` : '—'}
                                    </td>
                                    <td className="py-3">
                                        {lt.accrual_frequency !== 'none'
                                            ? `${lt.accrual_rate} days per ${lt.accrual_frequency.slice(0, -2)}` + (lt.max_accrual ? ` (max ${lt.max_accrual})` : '')
                                            : 'Manual'}
                                    </td>
                                    <td className="py-3">
                                        {lt.requires_approval ? 'Required' : 'Auto-approve'}
                                    </td>
                                    <td className="py-3">
                                        {lt.allows_carry_forward
                                            ? `${lt.max_carry_forward ?? 'Unlimited'} days` + (lt.carry_forward_expiry_months ? ` (expires in ${lt.carry_forward_expiry_months} months)` : '')
                                            : 'Not allowed'}
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${lt.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {lt.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(lt)}
                                                className="text-primary underline text-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(lt.id)}
                                                className="text-destructive underline text-sm"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {props.leaveTypes.last_page > 1 && (
                    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
                        {props.leaveTypes.current_page > 1 && (
                            <a
                                href={route('erp.hrm.leave.types.index', { page: props.leaveTypes.current_page - 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Previous
                            </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Page {props.leaveTypes.current_page} of {props.leaveTypes.last_page}
                        </span>
                        {props.leaveTypes.current_page < props.leaveTypes.last_page && (
                            <a
                                href={route('erp.hrm.leave.types.index', { page: props.leaveTypes.current_page + 1 })}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors"
                            >
                                Next
                            </a>
                        )}
                    </nav>
                )}
            </section>

            {/* Create/Edit Modal */}
            <div className={isModalOpen ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/50' : 'hidden'}>
                <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card rounded-xl p-6 shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit Leave Type' : 'Create Leave Type'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Name *</span>
                                    <input
                                        type="text"
                                        value={form.data.name}
                                        onChange={(e) => form.setData('name', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        required
                                    />
                                    {errors.name && <p className="text-destructive text-sm mt-1">{errors.name}</p>}
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Code *</span>
                                    <input
                                        type="text"
                                        value={form.data.code}
                                        onChange={(e) => form.setData('code', e.target.value.toUpperCase())}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        required
                                        maxLength={10}
                                    />
                                    {errors.code && <p className="text-destructive text-sm mt-1">{errors.code}</p>}
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Category *</span>
                                    <select
                                        value={form.data.category}
                                        onChange={(e) => form.setData('category', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        required
                                    >
                                        {Object.entries(props.categoryOptions).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Color</span>
                                    <input
                                        type="color"
                                        value={form.data.color}
                                        onChange={(e) => form.setData('color', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 h-10 cursor-pointer"
                                    />
                                </label>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Icon (Lucide name)</span>
                                    <input
                                        type="text"
                                        value={form.data.icon}
                                        onChange={(e) => form.setData('icon', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Description</span>
                                    <textarea
                                        value={form.data.description}
                                        onChange={(e) => form.setData('description', e.target.value)}
                                        rows={2}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Default Entitlement (days)</span>
                                    <input
                                        type="number"
                                        value={form.data.default_entitlement}
                                        onChange={(e) => form.setData('default_entitlement', Number(e.target.value))}
                                        min={0}
                                        max={365}
                                        step={0.5}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Accrual Frequency</span>
                                    <select
                                        value={form.data.accrual_frequency}
                                        onChange={(e) => form.setData('accrual_frequency', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    >
                                        <option value="annually">Annually</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="daily">Daily</option>
                                        <option value="none">Manual (No Accrual)</option>
                                    </select>
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Accrual Rate (days per period)</span>
                                    <input
                                        type="number"
                                        value={form.data.accrual_rate}
                                        onChange={(e) => form.setData('accrual_rate', Number(e.target.value))}
                                        min={0}
                                        step={0.01}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Max Accrual (days)</span>
                                    <input
                                        type="number"
                                        value={form.data.max_accrual}
                                        onChange={(e) => form.setData('max_accrual', Number(e.target.value))}
                                        min={0}
                                        max={365}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Min Service (months)</span>
                                    <input
                                        type="number"
                                        value={form.data.min_service_months}
                                        onChange={(e) => form.setData('min_service_months', Number(e.target.value))}
                                        min={0}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Gender Restriction</span>
                                    <select
                                        value={form.data.gender_restriction}
                                        onChange={(e) => form.setData('gender_restriction', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    >
                                        <option value="">None</option>
                                        <option value="male">Male Only</option>
                                        <option value="female">Female Only</option>
                                    </select>
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Employment Types</span>
                                    <select
                                        value={form.data.employment_types}
                                        onChange={(e) => form.setData('employment_types', Array.from(e.target.selectedOptions).map(o => o.value))}
                                        multiple
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    >
                                        <option value="permanent">Permanent</option>
                                        <option value="fixed_term">Fixed Term</option>
                                        <option value="casual">Casual</option>
                                        <option value="probation">Probation</option>
                                        <option value="intern">Intern</option>
                                        <option value="contractor">Contractor</option>
                                        <option value="seasonal">Seasonal</option>
                                        <option value="part_time">Part Time</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                            <h4 className="font-medium">Approval & Validation Rules</h4>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="requires_approval"
                                        checked={form.data.requires_approval}
                                        onChange={(e) => form.setData('requires_approval', e.target.checked)}
                                        className="rounded border-input border-primary/60"
                                    />
                                    <label htmlFor="requires_approval" className="text-sm">Requires Approval</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="requires_attachment"
                                        checked={form.data.requires_attachment}
                                        onChange={(e) => form.setData('requires_attachment', e.target.checked)}
                                        className="rounded border-input border-primary/60"
                                    />
                                    <label htmlFor="requires_attachment" className="text-sm">Requires Attachment</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="allows_past_dates"
                                        checked={form.data.allows_past_dates}
                                        onChange={(e) => form.setData('allows_past_dates', e.target.checked)}
                                        className="rounded border-input border-primary/60"
                                    />
                                    <label htmlFor="allows_past_dates" className="text-sm">Allows Past Dates</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="requires_future_date"
                                        checked={form.data.requires_future_date}
                                        onChange={(e) => form.setData('requires_future_date', e.target.checked)}
                                        className="rounded border-input border-primary/60"
                                    />
                                    <label htmlFor="requires_future_date" className="text-sm">Requires Future Date</label>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                            <h4 className="font-medium">Duration Limits</h4>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="grid gap-1.5 text-sm">
                                        <span className="text-foreground/85 font-medium">Min Duration (days)</span>
                                        <input
                                            type="number"
                                            value={form.data.min_duration_days}
                                            onChange={(e) => form.setData('min_duration_days', Number(e.target.value))}
                                            min={0.5}
                                            step={0.5}
                                            className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        />
                                    </label>
                                </div>
                                <div>
                                    <label className="grid gap-1.5 text-sm">
                                        <span className="text-foreground/85 font-medium">Max Duration (days)</span>
                                        <input
                                            type="number"
                                            value={form.data.max_duration_days}
                                            onChange={(e) => form.setData('max_duration_days', Number(e.target.value))}
                                            min={0.5}
                                            max={365}
                                            className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        />
                                    </label>
                                </div>
                                <div>
                                    <label className="grid gap-1.5 text-sm">
                                        <span className="text-foreground/85 font-medium">Max Consecutive (days)</span>
                                        <input
                                            type="number"
                                            value={form.data.max_consecutive_days}
                                            onChange={(e) => form.setData('max_consecutive_days', Number(e.target.value))}
                                            min={0}
                                            className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                            <h4 className="font-medium">Carry Forward Rules</h4>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="allows_carry_forward"
                                        checked={form.data.allows_carry_forward}
                                        onChange={(e) => form.setData('allows_carry_forward', e.target.checked)}
                                        className="rounded border-input border-primary/60"
                                    />
                                    <label htmlFor="allows_carry_forward" className="text-sm">Allows Carry Forward</label>
                                </div>
                                <div>
                                    <label className="grid gap-1.5 text-sm">
                                        <span className="text-foreground/85 font-medium">Max Carry Forward (days)</span>
                                        <input
                                            type="number"
                                            value={form.data.max_carry_forward}
                                            onChange={(e) => form.setData('max_carry_forward', Number(e.target.value))}
                                            min={0}
                                            max={365}
                                            className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        />
                                    </label>
                                </div>
                                <div>
                                    <label className="grid gap-1.5 text-sm">
                                        <span className="text-foreground/85 font-medium">Expiry (months)</span>
                                        <input
                                            type="number"
                                            value={form.data.carry_forward_expiry_months}
                                            onChange={(e) => form.setData('carry_forward_expiry_months', Number(e.target.value))}
                                            min={1}
                                            className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                            <h4 className="font-medium">Status</h4>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={form.data.is_active}
                                        onChange={(e) => form.setData('is_active', e.target.checked)}
                                        className="rounded border-input border-primary/60"
                                    />
                                    <label htmlFor="is_active" className="text-sm">Active</label>
                                </div>
                                <div>
                                    <label className="grid gap-1.5 text-sm">
                                        <span className="text-foreground/85 font-medium">Sort Order</span>
                                        <input
                                            type="number"
                                            value={form.data.sort_order}
                                            onChange={(e) => form.setData('sort_order', Number(e.target.value))}
                                            min={0}
                                            className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                        />
                                    </label>
                                </div>
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
                                {form.processing ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}