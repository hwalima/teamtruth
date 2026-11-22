import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Field, Select, TextInput, idOptions, personName, primaryButton, secondaryButton, toDateInput, type Options } from './ui';

type Named = { id: number; name: string; code?: string | null };
export type EmployeeRecord = {
    id: number;
    employee_number: string;
    user_id: number | null;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    gender: string | null;
    date_of_birth: string | null;
    marital_status: string | null;
    nationality: string | null;
    national_id: string | null;
    passport_number: string | null;
    personal_email: string | null;
    personal_phone: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    emergency_contact_relation: string | null;
    bank_name: string | null;
    bank_account_name: string | null;
    bank_account_number: string | null;
    bank_branch: string | null;
    tax_number: string | null;
    nssa_number: string | null;
    status: string;
    hire_date: string | null;
    line_manager_id: number | null;
    department_id: number | null;
    position_id: number | null;
    grade_id: number | null;
    cost_center_id: number | null;
};

export type EmployeeFormProps = {
    employee: EmployeeRecord | null;
    departments: Named[];
    positions: (Named & { department_id: number | null })[];
    grades: Named[];
    costCenters: Named[];
    managers: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string }[];
    users: { id: number; name: string; email: string }[];
    genderOptions: Options;
    statusOptions: Options;
    maritalStatusOptions: Options;
};

const fields = [
    'user_id', 'first_name', 'middle_name', 'last_name', 'gender', 'date_of_birth', 'marital_status', 'nationality',
    'national_id', 'passport_number', 'personal_email', 'personal_phone', 'emergency_contact_name', 'emergency_contact_phone',
    'emergency_contact_relation', 'bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch', 'tax_number',
    'nssa_number', 'status', 'hire_date', 'line_manager_id', 'department_id', 'position_id', 'grade_id', 'cost_center_id',
] as const;
type FieldName = (typeof fields)[number];

const label = (item: Named) => (item.code ? `${item.code} — ${item.name}` : item.name);

export default function EmployeeForm(props: EmployeeFormProps) {
    const initial = Object.fromEntries(
        fields.map((name) => {
            const value = props.employee?.[name];
            if (name === 'date_of_birth' || name === 'hire_date') {
                return [name, toDateInput(value as string | null) || (name === 'hire_date' && !props.employee ? new Date().toISOString().slice(0, 10) : '')];
            }
            if (name === 'status') return [name, (value as string) ?? 'active'];
            return [name, value === null || value === undefined ? '' : String(value)];
        }),
    ) as Record<FieldName, string>;

    const form = useForm(initial);
    const errors = form.errors as Partial<Record<FieldName, string>>;
    const editing = props.employee !== null;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (editing) {
            form.put(route('erp.hrm.employees.update', props.employee!.id));
        } else {
            form.post(route('erp.hrm.employees.store'));
        }
    };

    const text = (name: FieldName, title: string, type = 'text') => (
        <Field label={title} error={errors[name]}>
            <TextInput type={type} value={form.data[name]} onChange={(value) => form.setData(name, value)} />
        </Field>
    );
    const select = (name: FieldName, title: string, options: Parameters<typeof Select>[0]['options'], placeholder = '— None —') => (
        <Field label={title} error={errors[name]}>
            <Select value={form.data[name]} onChange={(value) => form.setData(name, value)} options={options} placeholder={placeholder} />
        </Field>
    );

    const positions = form.data.department_id
        ? props.positions.filter((p) => !p.department_id || String(p.department_id) === form.data.department_id)
        : props.positions;

    return (
        <form onSubmit={submit} className="space-y-6">
            <Card title="Personal details">
                <div className="grid gap-4 sm:grid-cols-3">
                    {text('first_name', 'First name *')}
                    {text('middle_name', 'Middle name')}
                    {text('last_name', 'Last name *')}
                    {select('gender', 'Gender', props.genderOptions, '— Select —')}
                    {text('date_of_birth', 'Date of birth', 'date')}
                    {select('marital_status', 'Marital status', props.maritalStatusOptions, '— Select —')}
                    {text('nationality', 'Nationality')}
                    {text('national_id', 'National ID')}
                    {text('passport_number', 'Passport number')}
                </div>
            </Card>

            <Card title="Contact">
                <div className="grid gap-4 sm:grid-cols-3">
                    {text('personal_email', 'Email', 'email')}
                    {text('personal_phone', 'Phone')}
                    <div />
                    {text('emergency_contact_name', 'Emergency contact name')}
                    {text('emergency_contact_phone', 'Emergency contact phone')}
                    {text('emergency_contact_relation', 'Relationship')}
                </div>
            </Card>

            <Card title="Employment">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Status *" error={errors.status}>
                        <Select value={form.data.status} onChange={(value) => form.setData('status', value)} options={props.statusOptions} />
                    </Field>
                    {text('hire_date', 'Hire date *', 'date')}
                    {select('user_id', 'Linked system user', idOptions(props.users, (u) => `${u.name} (${u.email})`))}
                    {select('department_id', 'Department', idOptions(props.departments, label))}
                    {select('position_id', 'Position', idOptions(positions, label))}
                    {select('grade_id', 'Grade', idOptions(props.grades, label))}
                    {select('cost_center_id', 'Cost center', idOptions(props.costCenters, label))}
                    {select('line_manager_id', 'Line manager', idOptions(props.managers, (m) => `${m.employee_number} — ${personName(m)}`))}
                </div>
            </Card>

            <Card title="Bank and statutory">
                <div className="grid gap-4 sm:grid-cols-3">
                    {text('bank_name', 'Bank name')}
                    {text('bank_branch', 'Branch')}
                    {text('bank_account_name', 'Account name')}
                    {text('bank_account_number', 'Account number')}
                    {text('tax_number', 'Tax number')}
                    {text('nssa_number', 'NSSA number')}
                </div>
            </Card>

            <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={form.processing} className={primaryButton}>
                    {editing ? 'Save changes' : 'Create employee'}
                </button>
                <a href={editing ? route('erp.hrm.employees.show', props.employee!.id) : route('erp.hrm.employees.index')} className={secondaryButton}>
                    Cancel
                </a>
            </div>
        </form>
    );
}
