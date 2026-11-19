import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Employee = {
    id: number;
    employee_number: string;
    first_name: string;
    last_name: string;
    user: { name: string; email: string } | null;
    position_id: number | null;
    grade_id: number | null;
    employment_type: string;
};
type ContractTemplate = {
    id: number;
    code: string;
    name: string;
    contract_type: string;
    basic_salary: number;
    pay_frequency: string;
    working_hours_per_week: number;
    overtime_eligible: boolean;
    notice_period_days: number;
    annual_leave_days: number;
    sick_leave_days: number;
    grade_id: number | null;
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    employees: Employee[];
    templates: ContractTemplate[];
    typeOptions: Record<string, string>;
    statusOptions: Record<string, string>;
    payFrequencyOptions: Record<string, string>;
};

export default function ContractCreate(props: Props) {
    const form = useForm({
        employee_id: '',
        template_id: '',
        contract_type: 'permanent',
        status: 'draft',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        probation_end_date: '',
        basic_salary: '',
        currency_code: props.company.default_currency,
        pay_frequency: 'monthly',
        working_hours_per_week: 40,
        overtime_eligible: true,
        notice_period_days: 30,
        annual_leave_days: 21,
        sick_leave_days: 14,
        benefits: [],
        allowances: [],
        deductions: [],
        special_conditions: '',
    });

    const errors = form.errors as Record<string, string>;

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.hrm.contracts.store'), form.data);
    };

    const handleTemplateChange = (templateId: string) => {
        form.setData('template_id', templateId);
        if (templateId) {
            const template = props.templates.find(t => t.id === Number(templateId));
            if (template) {
                form.setData('contract_type', template.contract_type);
                form.setData('basic_salary', template.basic_salary.toString());
                form.setData('pay_frequency', template.pay_frequency);
                form.setData('working_hours_per_week', template.working_hours_per_week.toString());
                form.setData('overtime_eligible', template.overtime_eligible);
                form.setData('notice_period_days', template.notice_period_days.toString());
                form.setData('annual_leave_days', template.annual_leave_days.toString());
                form.setData('sick_leave_days', template.sick_leave_days.toString());
            }
        }
    };

    const handleEmployeeChange = (employeeId: string) => {
        form.setData('employee_id', employeeId);
        if (employeeId) {
            const employee = props.employees.find(e => e.id === Number(employeeId));
            if (employee && employee.employment_type) {
                form.setData('contract_type', employee.employment_type);
            }
        }
    };

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">Create Contract</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Create a new employment contract from template or custom terms.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Employee & Template Selection */}
                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Employee & Template</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Employee *</span>
                                <select
                                    value={form.data.employee_id}
                                    onChange={(e) => handleEmployeeChange(e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                >
                                    <option value="">Select employee</option>
                                    {props.employees.map((emp) => (
                                        <option key={emp.id} value={emp.id.toString()}>
                                            {emp.employee_number} — {emp.first_name} {emp.last_name} ({emp.employment_type})
                                        </option>
                                    ))}
                                </select>
                                {errors.employee_id && <p className="text-destructive text-sm mt-1">{errors.employee_id}</p>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Contract Template</span>
                                <select
                                    value={form.data.template_id}
                                    onChange={(e) => handleTemplateChange(e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">No template (custom contract)</option>
                                    {props.templates.map((t) => (
                                        <option key={t.id} value={t.id.toString()}>
                                            {t.code} — {t.name} ({t.contract_type})
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Contract Details */}
                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Contract Details</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Contract Type *</span>
                                <select
                                    value={form.data.contract_type}
                                    onChange={(e) => form.setData('contract_type', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                >
                                    {Object.entries(props.typeOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Status *</span>
                                <select
                                    value={form.data.status}
                                    onChange={(e) => form.setData('status', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                >
                                    {Object.entries(props.statusOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Start Date *</span>
                                <input
                                    type="date"
                                    value={form.data.start_date}
                                    onChange={(e) => form.setData('start_date', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">End Date</span>
                                <input
                                    type="date"
                                    value={form.data.end_date}
                                    onChange={(e) => form.setData('end_date', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Probation End Date</span>
                                <input
                                    type="date"
                                    value={form.data.probation_end_date}
                                    onChange={(e) => form.setData('probation_end_date', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Basic Salary</span>
                                <input
                                    type="number"
                                    value={form.data.basic_salary}
                                    onChange={(e) => form.setData('basic_salary', e.target.value)}
                                    min={0}
                                    step={0.01}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Currency *</span>
                                <input
                                    type="text"
                                    value={form.data.currency_code}
                                    onChange={(e) => form.setData('currency_code', e.target.value.toUpperCase())}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                    maxLength={3}
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Pay Frequency</span>
                                <select
                                    value={form.data.pay_frequency}
                                    onChange={(e) => form.setData('pay_frequency', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    {Object.entries(props.payFrequencyOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Working Hours/Week</span>
                                <input
                                    type="number"
                                    value={form.data.working_hours_per_week}
                                    onChange={(e) => form.setData('working_hours_per_week', Number(e.target.value))}
                                    min={1}
                                    max={80}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Overtime Eligible</span>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.data.overtime_eligible}
                                        onChange={(e) => form.setData('overtime_eligible', e.target.checked)}
                                        className="rounded border-input border-primary/60"
                                    />
                                    <span className="text-sm">Yes</span>
                                </label>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Notice Period (Days)</span>
                                <input
                                    type="number"
                                    value={form.data.notice_period_days}
                                    onChange={(e) => form.setData('notice_period_days', Number(e.target.value))}
                                    min={0}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Annual Leave (Days)</span>
                                <input
                                    type="number"
                                    value={form.data.annual_leave_days}
                                    onChange={(e) => form.setData('annual_leave_days', Number(e.target.value))}
                                    min={0}
                                    max={365}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Sick Leave (Days)</span>
                                <input
                                    type="number"
                                    value={form.data.sick_leave_days}
                                    onChange={(e) => form.setData('sick_leave_days', Number(e.target.value))}
                                    min={0}
                                    max={365}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Benefits (JSON Array)</span>
                                <textarea
                                    value={JSON.stringify(form.data.benefits, null, 2)}
                                    onChange={(e) => {
                                        try {
                                            form.setData('benefits', JSON.parse(e.target.value));
                                        } catch {
                                            // Invalid JSON, keep current
                                        }
                                    }}
                                    rows={3}
                                    placeholder='["Medical Aid", "Pension", "Transport Allowance"]'
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 font-mono text-sm"
                                />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Allowances (JSON Array)</span>
                                <textarea
                                    value={JSON.stringify(form.data.allowances, null, 2)}
                                    onChange={(e) => {
                                        try {
                                            form.setData('allowances', JSON.parse(e.target.value));
                                        } catch {
                                            // Invalid JSON, keep current
                                        }
                                    }}
                                    rows={3}
                                    placeholder='[{"name": "Housing", "amount": 500}, {"name": "Transport", "amount": 200}]'
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 font-mono text-sm"
                                />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Deductions (JSON Array)</span>
                                <textarea
                                    value={JSON.stringify(form.data.deductions, null, 2)}
                                    onChange={(e) => {
                                        try {
                                            form.setData('deductions', JSON.parse(e.target.value));
                                        } catch {
                                            // Invalid JSON, keep current
                                        }
                                    }}
                                    rows={3}
                                    placeholder='[{"name": "Pension", "percentage": 5}, {"name": "Medical", "amount": 50}]'
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4 font-mono text-sm"
                                />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Special Conditions</span>
                                <textarea
                                    value={form.data.special_conditions}
                                    onChange={(e) => form.setData('special_conditions', e.target.value)}
                                    rows={4}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                    </div>
                </section>

                <div className="flex flex-wrap justify-end gap-3 border-t pt-6">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {form.processing ? 'Creating...' : 'Create Contract'}
                    </button>
                </div>
            </form>
        </main>
    );
}