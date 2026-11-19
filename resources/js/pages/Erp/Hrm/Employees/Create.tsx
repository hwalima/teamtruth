import { router, useForm } from '@inertiajs/react';
import type { FormEvent, ChangeEvent } from 'react';
import { route } from 'ziggy-js';

type Department = { id: number; code: string; name: string };
type Position = { id: number; code: string; name: string; department_id: number; grade_id: number };
type Grade = { id: number; code: string; name: string; min_salary: number; max_salary: number; currency_code: string };
type CostCenter = { id: number; code: string; name: string };
type Manager = { id: number; employee_number: string; first_name: string; last_name: string; user_id: number };
type User = { id: number; name: string; email: string };
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    departments: Department[];
    positions: Position[];
    grades: Grade[];
    costCenters: CostCenter[];
    managers: Manager[];
    users: User[];
    genderOptions: Record<string, string>;
    statusOptions: Record<string, string>;
    typeOptions: Record<string, string>;
};

const WORK_SCHEDULE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function EmployeeCreate(props: Props) {
    const form = useForm({
        first_name: '',
        last_name: '',
        gender: 'male',
        date_of_birth: '',
        national_id: '',
        passport_number: '',
        phone: '',
        personal_email: '',
        work_email: '',
        address: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: '',
        bank_name: '',
        bank_account_name: '',
        bank_account_number: '',
        bank_branch: '',
        bank_swift_code: '',
        tax_number: '',
        social_security_number: '',
        pension_number: '',
        department_id: '',
        position_id: '',
        grade_id: '',
        cost_center_id: '',
        manager_id: '',
        user_id: '',
        employment_status: 'active',
        employment_type: 'permanent',
        hire_date: new Date().toISOString().split('T')[0],
        probation_end_date: '',
        confirmation_date: '',
        notice_period_days: 30,
        annual_leave_entitlement: 21,
        work_schedule: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
        },
        overtime_eligible: true,
    });

    const errors = form.errors as Record<string, string>;

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.hrm.employees.store'), form.data);
    };

    const handleWorkScheduleChange = (day: string, checked: boolean) => {
        form.setData('work_schedule', { ...form.data.work_schedule, [day]: checked });
    };

    const filteredPositions = props.positions.filter(p =>
        !form.data.department_id || p.department_id === Number(form.data.department_id)
    );

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{props.company.code}</p>
                <h1 className="text-2xl font-semibold">Add New Employee</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Create a new employee record with personal, employment, and organizational details.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Personal Information</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">First Name *</span>
                                <input
                                    type="text"
                                    value={form.data.first_name}
                                    onChange={(e) => form.setData('first_name', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                {errors.first_name && <p className="text-destructive text-sm mt-1">{errors.first_name}</p>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Last Name *</span>
                                <input
                                    type="text"
                                    value={form.data.last_name}
                                    onChange={(e) => form.setData('last_name', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                                {errors.last_name && <p className="text-destructive text-sm mt-1">{errors.last_name}</p>}
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Gender *</span>
                                <select
                                    value={form.data.gender}
                                    onChange={(e) => form.setData('gender', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                >
                                    {Object.entries(props.genderOptions).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Date of Birth</span>
                                <input
                                    type="date"
                                    value={form.data.date_of_birth}
                                    onChange={(e) => form.setData('date_of_birth', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">National ID</span>
                                <input
                                    type="text"
                                    value={form.data.national_id}
                                    onChange={(e) => form.setData('national_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Passport Number</span>
                                <input
                                    type="text"
                                    value={form.data.passport_number}
                                    onChange={(e) => form.setData('passport_number', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Phone</span>
                                <input
                                    type="tel"
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Personal Email</span>
                                <input
                                    type="email"
                                    value={form.data.personal_email}
                                    onChange={(e) => form.setData('personal_email', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Work Email</span>
                                <input
                                    type="email"
                                    value={form.data.work_email}
                                    onChange={(e) => form.setData('work_email', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Address</span>
                                <textarea
                                    value={form.data.address}
                                    onChange={(e) => form.setData('address', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                    </div>
                </section>

                {/* Emergency Contact */}
                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Emergency Contact</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Name</span>
                                <input
                                    type="text"
                                    value={form.data.emergency_contact_name}
                                    onChange={(e) => form.setData('emergency_contact_name', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Phone</span>
                                <input
                                    type="tel"
                                    value={form.data.emergency_contact_phone}
                                    onChange={(e) => form.setData('emergency_contact_phone', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Relationship</span>
                                <input
                                    type="text"
                                    value={form.data.emergency_contact_relationship}
                                    onChange={(e) => form.setData('emergency_contact_relationship', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                    </div>
                </section>

                {/* Bank Details */}
                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Bank Details</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Bank Name</span>
                                <input
                                    type="text"
                                    value={form.data.bank_name}
                                    onChange={(e) => form.setData('bank_name', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Account Name</span>
                                <input
                                    type="text"
                                    value={form.data.bank_account_name}
                                    onChange={(e) => form.setData('bank_account_name', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Account Number</span>
                                <input
                                    type="text"
                                    value={form.data.bank_account_number}
                                    onChange={(e) => form.setData('bank_account_number', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Branch</span>
                                <input
                                    type="text"
                                    value={form.data.bank_branch}
                                    onChange={(e) => form.setData('bank_branch', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">SWIFT Code</span>
                                <input
                                    type="text"
                                    value={form.data.bank_swift_code}
                                    onChange={(e) => form.setData('bank_swift_code', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                    </div>
                </section>

                {/* Statutory Details */}
                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Statutory Details (Zimbabwe)</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Tax Number (ZIMRA)</span>
                                <input
                                    type="text"
                                    value={form.data.tax_number}
                                    onChange={(e) => form.setData('tax_number', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Social Security (NSSA)</span>
                                <input
                                    type="text"
                                    value={form.data.social_security_number}
                                    onChange={(e) => form.setData('social_security_number', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Pension Number</span>
                                <input
                                    type="text"
                                    value={form.data.pension_number}
                                    onChange={(e) => form.setData('pension_number', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                    </div>
                </section>

                {/* Employment Details */}
                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Employment Details</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Department</span>
                                <select
                                    value={form.data.department_id}
                                    onChange={(e) => form.setData('department_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">Select department</option>
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
                                    value={form.data.position_id}
                                    onChange={(e) => form.setData('position_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">Select position</option>
                                    {filteredPositions.map((pos) => (
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
                                    value={form.data.grade_id}
                                    onChange={(e) => form.setData('grade_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">Select grade</option>
                                    {props.grades.map((grade) => (
                                        <option key={grade.id} value={grade.id.toString()}>
                                            {grade.code} — {grade.name} ({grade.currency_code} {grade.min_salary} - {grade.max_salary})
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Cost Center</span>
                                <select
                                    value={form.data.cost_center_id}
                                    onChange={(e) => form.setData('cost_center_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">Select cost center</option>
                                    {props.costCenters.map((cc) => (
                                        <option key={cc.id} value={cc.id.toString()}>
                                            {cc.code} — {cc.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Manager</span>
                                <select
                                    value={form.data.manager_id}
                                    onChange={(e) => form.setData('manager_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">Select manager</option>
                                    {props.managers.map((mgr) => (
                                        <option key={mgr.id} value={mgr.id.toString()}>
                                            {mgr.employee_number} — {mgr.first_name} {mgr.last_name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">User Account</span>
                                <select
                                    value={form.data.user_id}
                                    onChange={(e) => form.setData('user_id', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                >
                                    <option value="">No user account (create later)</option>
                                    {props.users.map((user) => (
                                        <option key={user.id} value={user.id.toString()}>
                                            {user.name} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Employment Status *</span>
                                <select
                                    value={form.data.employment_status}
                                    onChange={(e) => form.setData('employment_status', e.target.value)}
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
                                <span className="text-foreground/85 font-medium">Employment Type *</span>
                                <select
                                    value={form.data.employment_type}
                                    onChange={(e) => form.setData('employment_type', e.target.value)}
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
                                <span className="text-foreground/85 font-medium">Hire Date *</span>
                                <input
                                    type="date"
                                    value={form.data.hire_date}
                                    onChange={(e) => form.setData('hire_date', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
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
                                <span className="text-foreground/85 font-medium">Confirmation Date</span>
                                <input
                                    type="date"
                                    value={form.data.confirmation_date}
                                    onChange={(e) => form.setData('confirmation_date', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
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
                                <span className="text-foreground/85 font-medium">Annual Leave Entitlement</span>
                                <input
                                    type="number"
                                    value={form.data.annual_leave_entitlement}
                                    onChange={(e) => form.setData('annual_leave_entitlement', Number(e.target.value))}
                                    min={0}
                                    max={365}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Overtime Eligible</span>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.data.overtime_eligible}
                                        onChange={(e) => form.setData('overtime_eligible', e.target.checked)}
                                        className="rounded border-input border-primary/60"
                                    />
                                    <span className="text-sm">Yes, this employee is eligible for overtime pay</span>
                                </label>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Work Schedule */}
                <section className="rounded-xl border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold">Work Schedule</h2>
                    <div className="flex flex-wrap gap-4">
                        {WORK_SCHEDULE_DAYS.map((day) => (
                            <label key={day} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.data.work_schedule[day]}
                                    onChange={(e) => handleWorkScheduleChange(day, e.target.checked)}
                                    className="rounded border-input border-primary/60"
                                />
                                <span className="capitalize text-sm">{day}</span>
                            </label>
                        ))}
                    </div>
                </section>

                {/* Actions */}
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
                        {form.processing ? 'Creating...' : 'Create Employee'}
                    </button>
                </div>
            </form>
        </main>
    );
}