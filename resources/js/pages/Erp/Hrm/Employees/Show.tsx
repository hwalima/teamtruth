import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Department = { id: number; code: string; name: string };
type Position = { id: number; code: string; name: string };
type Grade = { id: number; code: string; name: string };
type CostCenter = { id: number; code: string; name: string };
type User = { id: number; name: string; email: string };
type EmployeeDocument = {
    id: number;
    document_type: string;
    name: string;
    file_path: string;
    file_size: number | null;
    mime_type: string | null;
    issued_at: string | null;
    expires_at: string | null;
    is_verified: boolean;
    uploaded_by: number;
    created_at: string;
};
type Contract = {
    id: number;
    contract_number: string;
    contract_type: string;
    status: string;
    start_date: string;
    end_date: string | null;
    basic_salary: number;
    currency_code: string;
};
type LeaveBalance = {
    id: number;
    leave_type: { id: number; name: string; code: string };
    entitled_days: number;
    carried_forward: number;
    accrued_days: number;
    used_days: number;
    pending_days: number;
    available_balance: number;
    period_start: string;
    period_end: string;
};
type LeaveRequest = {
    id: number;
    leave_type: { id: number; name: string; code: string };
    start_date: string;
    end_date: string;
    working_days: number;
    status: string;
    created_at: string;
};
type DisciplinaryCase = {
    id: number;
    case_number: string;
    incident_date: string;
    status: string;
    outcome: string | null;
};
type SelfServiceRequest = {
    id: number;
    request_number: string;
    request_type: string;
    title: string;
    status: string;
    created_at: string;
};
type Transfer = {
    id: number;
    transfer_number: string;
    transfer_type: string;
    effective_date: string;
    status: string;
};
type Employee = {
    id: number;
    employee_number: string;
    first_name: string;
    last_name: string;
    gender: string;
    date_of_birth: string | null;
    national_id: string | null;
    passport_number: string | null;
    phone: string | null;
    personal_email: string | null;
    work_email: string | null;
    address: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    emergency_contact_relationship: string | null;
    bank_name: string | null;
    bank_account_name: string | null;
    bank_account_number: string | null;
    bank_branch: string | null;
    bank_swift_code: string | null;
    tax_number: string | null;
    social_security_number: string | null;
    pension_number: string | null;
    department: Department | null;
    position: Position | null;
    grade: Grade | null;
    cost_center: CostCenter | null;
    manager: { employee_number: string; first_name: string; last_name: string; user: User | null } | null;
    user: User | null;
    employment_status: string;
    employment_type: string;
    hire_date: string;
    probation_end_date: string | null;
    confirmation_date: string | null;
    termination_date: string | null;
    termination_reason: string | null;
    notice_period_days: number;
    annual_leave_entitlement: number;
    work_schedule: Record<string, boolean>;
    overtime_eligible: boolean;
    documents: EmployeeDocument[];
    contracts: Contract[];
    leave_balances: LeaveBalance[];
    leave_requests: LeaveRequest[];
    disciplinary_cases: DisciplinaryCase[];
    self_service_requests: SelfServiceRequest[];
    transfers: Transfer[];
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    employee: Employee;
    canUpdate: boolean;
    canTerminate: boolean;
    canRehire: boolean;
    canManageDocuments: boolean;
    canManageContracts: boolean;
    canViewSalary: boolean;
};

const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    on_leave: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    suspended: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    terminated: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    probation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    signed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    under_investigation: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    investigation_complete: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    hearing_scheduled: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    hearing_completed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    outcome_decided: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    appealed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default function EmployeeShow(props: Props) {
    const { employee, canUpdate, canTerminate, canRehire, canManageDocuments, canManageContracts, canViewSalary } = props;
    const isTerminated = employee.employment_status === 'terminated';

    const documentForm = useForm({
        document_type: '',
        name: '',
        file_path: '',
        file_size: '',
        mime_type: '',
        issued_at: '',
        expires_at: '',
        is_verified: false,
        notes: '',
    });

    const handleDocumentSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.hrm.employees.documents.store', employee.id), documentForm.data, {
            onSuccess: () => documentForm.reset(),
        });
    };

    const deleteDocument = (documentId: number) => {
        if (confirm('Are you sure you want to delete this document?')) {
            router.delete(route('erp.hrm.employees.documents.destroy', [employee.id, documentId]));
        }
    };

    const handleTerminate = () => {
        if (confirm('Are you sure you want to terminate this employee? This action cannot be undone easily.')) {
            const terminationDate = prompt('Enter termination date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
            if (terminationDate) {
                const reason = prompt('Enter termination reason:');
                router.post(route('erp.hrm.employees.terminate', employee.id), {
                    termination_date: terminationDate,
                    termination_reason: reason,
                });
            }
        }
    };

    const handleRehire = () => {
        if (confirm('Are you sure you want to rehire this employee?')) {
            const rehireDate = prompt('Enter rehire date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
            if (rehireDate) {
                router.post(route('erp.hrm.employees.rehire', employee.id), { rehire_date: rehireDate });
            }
        }
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
            <header className="flex flex-wrap justify-between gap-4 items-start">
                <div>
                    <p className="text-muted-foreground text-sm">{props.company.code}</p>
                    <h1 className="text-2xl font-semibold">{employee.employee_number} — {employee.first_name} {employee.last_name}</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {employee.work_email ?? 'No work email'} · {employee.phone ?? 'No phone'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-lg text-xs ${statusColors[employee.employment_status] ?? 'bg-gray-100 text-gray-800'}`}>
                        {employee.employment_status.replaceAll('_', ' ')}
                    </span>
                    {canUpdate && (
                        <a
                            href={route('erp.hrm.employees.edit', employee.id)}
                            className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                        >
                            Edit
                        </a>
                    )}
                    {canTerminate && !isTerminated && (
                        <button
                            onClick={handleTerminate}
                            className="border-destructive/50 bg-destructive/10 hover:bg-destructive/20 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium text-destructive transition-colors"
                        >
                            Terminate
                        </button>
                    )}
                    {canRehire && isTerminated && (
                        <button
                            onClick={handleRehire}
                            className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                        >
                            Rehire
                        </button>
                    )}
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column - Personal & Employment Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Personal Information */}
                    <section className="rounded-xl border bg-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Personal Information</h2>
                        <dl className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm text-muted-foreground">Employee Number</dt>
                                <dd className="font-medium">{employee.employee_number}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Gender</dt>
                                <dd className="font-medium capitalize">{employee.gender}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Date of Birth</dt>
                                <dd className="font-medium">{formatDate(employee.date_of_birth)}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">National ID</dt>
                                <dd className="font-medium">{employee.national_id ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Passport</dt>
                                <dd className="font-medium">{employee.passport_number ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Personal Email</dt>
                                <dd className="font-medium">{employee.personal_email ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Work Email</dt>
                                <dd className="font-medium">{employee.work_email ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Phone</dt>
                                <dd className="font-medium">{employee.phone ?? '—'}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-sm text-muted-foreground">Address</dt>
                                <dd className="font-medium whitespace-pre-wrap">{employee.address ?? '—'}</dd>
                            </div>
                        </dl>
                    </section>

                    {/* Employment Details */}
                    <section className="rounded-xl border bg-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Employment Details</h2>
                        <dl className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm text-muted-foreground">Status</dt>
                                <dd className="font-medium">
                                    <span className={`px-2 py-1 rounded text-xs ${statusColors[employee.employment_status] ?? 'bg-gray-100 text-gray-800'}`}>
                                        {employee.employment_status.replaceAll('_', ' ')}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Type</dt>
                                <dd className="font-medium capitalize">{employee.employment_type}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Department</dt>
                                <dd className="font-medium">{employee.department?.code ?? '—'} — {employee.department?.name ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Position</dt>
                                <dd className="font-medium">{employee.position?.code ?? '—'} — {employee.position?.name ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Grade</dt>
                                <dd className="font-medium">{employee.grade?.code ?? '—'} — {employee.grade?.name ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Cost Center</dt>
                                <dd className="font-medium">{employee.cost_center?.code ?? '—'} — {employee.cost_center?.name ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Manager</dt>
                                <dd className="font-medium">
                                    {employee.manager ? `${employee.manager.employee_number} — ${employee.manager.first_name} ${employee.manager.last_name}` : '—'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">User Account</dt>
                                <dd className="font-medium">{employee.user?.name ?? 'Not linked'} ({employee.user?.email ?? '—'})</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Hire Date</dt>
                                <dd className="font-medium">{formatDate(employee.hire_date)}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Probation End</dt>
                                <dd className="font-medium">{formatDate(employee.probation_end_date)}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Confirmation Date</dt>
                                <dd className="font-medium">{formatDate(employee.confirmation_date)}</dd>
                            </div>
                            {employee.termination_date && (
                                <>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">Termination Date</dt>
                                        <dd className="font-medium text-destructive">{formatDate(employee.termination_date)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">Termination Reason</dt>
                                        <dd className="font-medium">{employee.termination_reason ?? '—'}</dd>
                                    </div>
                                </>
                            )}
                            <div>
                                <dt className="text-sm text-muted-foreground">Notice Period</dt>
                                <dd className="font-medium">{employee.notice_period_days} days</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Annual Leave</dt>
                                <dd className="font-medium">{employee.annual_leave_entitlement} days</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-muted-foreground">Overtime Eligible</dt>
                                <dd className="font-medium">{employee.overtime_eligible ? 'Yes' : 'No'}</dd>
                            </div>
                        </dl>
                    </section>

                    {/* Emergency Contact */}
                    {(employee.emergency_contact_name || employee.emergency_contact_phone) && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Emergency Contact</h2>
                            <dl className="grid gap-3 sm:grid-cols-3">
                                <div>
                                    <dt className="text-sm text-muted-foreground">Name</dt>
                                    <dd className="font-medium">{employee.emergency_contact_name}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-muted-foreground">Phone</dt>
                                    <dd className="font-medium">{employee.emergency_contact_phone}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-muted-foreground">Relationship</dt>
                                    <dd className="font-medium">{employee.emergency_contact_relationship ?? '—'}</dd>
                                </div>
                            </dl>
                        </section>
                    )}

                    {/* Bank Details */}
                    {(employee.bank_name || employee.bank_account_number) && canViewSalary && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Bank Details</h2>
                            <dl className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <dt className="text-sm text-muted-foreground">Bank</dt>
                                    <dd className="font-medium">{employee.bank_name ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-muted-foreground">Account Name</dt>
                                    <dd className="font-medium">{employee.bank_account_name ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-muted-foreground">Account Number</dt>
                                    <dd className="font-medium">{employee.bank_account_number ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-muted-foreground">Branch</dt>
                                    <dd className="font-medium">{employee.bank_branch ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-muted-foreground">SWIFT</dt>
                                    <dd className="font-medium">{employee.bank_swift_code ?? '—'}</dd>
                                </div>
                            </dl>
                        </section>
                    )}

                    {/* Statutory Details */}
                    {(employee.tax_number || employee.social_security_number || employee.pension_number) && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Statutory Details (Zimbabwe)</h2>
                            <dl className="grid gap-3 sm:grid-cols-3">
                                <div>
                                    <dt className="text-sm text-muted-foreground">Tax Number (ZIMRA)</dt>
                                    <dd className="font-medium">{employee.tax_number ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-muted-foreground">NSSA Number</dt>
                                    <dd className="font-medium">{employee.social_security_number ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm text-muted-foreground">Pension Number</dt>
                                    <dd className="font-medium">{employee.pension_number ?? '—'}</dd>
                                </div>
                            </dl>
                        </section>
                    )}

                    {/* Work Schedule */}
                    <section className="rounded-xl border bg-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Work Schedule</h2>
                        <div className="flex flex-wrap gap-4">
                            {Object.entries(employee.work_schedule).map(([day, working]) => (
                                <span
                                    key={day}
                                    className={`px-3 py-1 rounded-full text-sm ${working ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                                >
                                    {day.charAt(0).toUpperCase() + day.slice(1)}: {working ? 'Working' : 'Off'}
                                </span>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Right Column - Documents, Contracts, Leave, etc. */}
                <div className="space-y-6">
                    {/* Documents */}
                    {canManageDocuments && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-semibold">Documents</h2>
                                <button
                                    className="text-primary underline text-sm"
                                    onClick={() => document.getElementById('doc-modal')?.classList.remove('hidden')}
                                >
                                    Add Document
                                </button>
                            </div>
                            {employee.documents.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No documents uploaded.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {employee.documents.map((doc) => (
                                        <li key={doc.id} className="flex flex-wrap justify-between gap-2 items-center p-3 rounded-lg border border-border/50">
                                            <div>
                                                <p className="font-medium">{doc.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {doc.document_type} · {doc.is_verified ? 'Verified' : 'Unverified'} · {formatDate(doc.created_at)}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <a href={doc.file_path} target="_blank" className="text-primary underline text-sm">View</a>
                                                <button onClick={() => deleteDocument(doc.id)} className="text-destructive underline text-sm">Delete</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}

                    {/* Contracts */}
                    {canManageContracts && (
                        <section className="rounded-xl border bg-card p-6 space-y-4">
                            <h2 className="text-lg font-semibold">Contracts</h2>
                            {employee.contracts.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No contracts.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {employee.contracts.map((contract) => (
                                        <li key={contract.id} className="flex flex-wrap justify-between gap-2 items-center p-3 rounded-lg border border-border/50">
                                            <div>
                                                <p className="font-medium">{contract.contract_number}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {contract.contract_type.replaceAll('_', ' ')} · {formatDate(contract.start_date)} – {contract.end_date ? formatDate(contract.end_date) : 'Indefinite'}
                                                </p>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs ${statusColors[contract.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                                {contract.status.replaceAll('_', ' ')}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}

                    {/* Leave Balances */}
                    <section className="rounded-xl border bg-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Leave Balances</h2>
                        {employee.leave_balances.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No leave balances recorded.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground border-b">
                                            <th className="pb-2 font-medium">Leave Type</th>
                                            <th className="pb-2 font-medium text-right">Entitled</th>
                                            <th className="pb-2 font-medium text-right">Carried</th>
                                            <th className="pb-2 font-medium text-right">Accrued</th>
                                            <th className="pb-2 font-medium text-right">Used</th>
                                            <th className="pb-2 font-medium text-right">Available</th>
                                            <th className="pb-2 font-medium text-right">Period</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employee.leave_balances.map((balance) => (
                                            <tr key={balance.id} className="border-b border-border/50">
                                                <td className="py-2 font-medium">{balance.leave_type.code} — {balance.leave_type.name}</td>
                                                <td className="py-2 text-right">{balance.entitled_days}</td>
                                                <td className="py-2 text-right">{balance.carried_forward}</td>
                                                <td className="py-2 text-right">{balance.accrued_days}</td>
                                                <td className="py-2 text-right">{balance.used_days}</td>
                                                <td className="py-2 text-right font-semibold">{balance.available_balance}</td>
                                                <td className="py-2 text-right text-muted-foreground">
                                                    {formatDate(balance.period_start)} – {formatDate(balance.period_end)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    {/* Recent Leave Requests */}
                    <section className="rounded-xl border bg-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Recent Leave Requests</h2>
                        {employee.leave_requests.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No leave requests.</p>
                        ) : (
                            <ul className="space-y-2">
                                {employee.leave_requests.slice(0, 5).map((req) => (
                                    <li key={req.id} className="flex flex-wrap justify-between gap-2 items-center p-3 rounded-lg border border-border/50">
                                        <div>
                                            <p className="font-medium">{req.leave_type.code} — {req.leave_type.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(req.start_date)} – {formatDate(req.end_date)} ({req.working_days} days)
                                            </p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs ${statusColors[req.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                            {req.status.replaceAll('_', ' ')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Disciplinary Cases */}
                    <section className="rounded-xl border bg-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Disciplinary Cases</h2>
                        {employee.disciplinary_cases.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No disciplinary cases.</p>
                        ) : (
                            <ul className="space-y-2">
                                {employee.disciplinary_cases.map((case_) => (
                                    <li key={case_.id} className="flex flex-wrap justify-between gap-2 items-center p-3 rounded-lg border border-border/50">
                                        <div>
                                            <p className="font-medium">{case_.case_number}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Incident: {formatDate(case_.incident_date)} · Status: {case_.status.replaceAll('_', ' ')}
                                            </p>
                                        </div>
                                        {case_.outcome && (
                                            <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">
                                                {case_.outcome.replaceAll('_', ' ')}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Self-Service Requests */}
                    <section className="rounded-xl border bg-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Self-Service Requests</h2>
                        {employee.self_service_requests.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No self-service requests.</p>
                        ) : (
                            <ul className="space-y-2">
                                {employee.self_service_requests.slice(0, 5).map((req) => (
                                    <li key={req.id} className="flex flex-wrap justify-between gap-2 items-center p-3 rounded-lg border border-border/50">
                                        <div>
                                            <p className="font-medium">{req.request_number}</p>
                                            <p className="text-xs text-muted-foreground">{req.request_type.replaceAll('_', ' ')} · {req.title}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs ${statusColors[req.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                            {req.status.replaceAll('_', ' ')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Transfers */}
                    <section className="rounded-xl border bg-card p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Transfers</h2>
                        {employee.transfers.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No transfers.</p>
                        ) : (
                            <ul className="space-y-2">
                                {employee.transfers.map((transfer) => (
                                    <li key={transfer.id} className="flex flex-wrap justify-between gap-2 items-center p-3 rounded-lg border border-border/50">
                                        <div>
                                            <p className="font-medium">{transfer.transfer_number}</p>
                                            <p className="text-xs text-muted-foreground">{transfer.transfer_type.replaceAll('_', ' ')} · Effective: {formatDate(transfer.effective_date)}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs ${statusColors[transfer.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                            {transfer.status.replaceAll('_', ' ')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>

            {/* Add Document Modal */}
            <div id="doc-modal" className="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-md bg-card rounded-xl p-6 shadow-xl">
                    <h3 className="text-lg font-semibold mb-4">Upload Document</h3>
                    <form onSubmit={handleDocumentSubmit} className="space-y-4">
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Type</span>
                                <input
                                    type="text"
                                    value={documentForm.data.document_type}
                                    onChange={(e) => documentForm.setData('document_type', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Name</span>
                                <input
                                    type="text"
                                    value={documentForm.data.name}
                                    onChange={(e) => documentForm.setData('name', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                            </label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">File Path</span>
                                <input
                                    type="text"
                                    value={documentForm.data.file_path}
                                    onChange={(e) => documentForm.setData('file_path', e.target.value)}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    required
                                />
                            </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">File Size (bytes)</span>
                                    <input
                                        type="number"
                                        value={documentForm.data.file_size}
                                        onChange={(e) => documentForm.setData('file_size', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">MIME Type</span>
                                    <input
                                        type="text"
                                        value={documentForm.data.mime_type}
                                        onChange={(e) => documentForm.setData('mime_type', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Issued Date</span>
                                    <input
                                        type="date"
                                        value={documentForm.data.issued_at}
                                        onChange={(e) => documentForm.setData('issued_at', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                            <div>
                                <label className="grid gap-1.5 text-sm">
                                    <span className="text-foreground/85 font-medium">Expiry Date</span>
                                    <input
                                        type="date"
                                        value={documentForm.data.expires_at}
                                        onChange={(e) => documentForm.setData('expires_at', e.target.value)}
                                        className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_verified"
                                checked={documentForm.data.is_verified}
                                onChange={(e) => documentForm.setData('is_verified', e.target.checked)}
                                className="rounded border-input border-primary/60"
                            />
                            <label htmlFor="is_verified" className="text-sm">Verified</label>
                        </div>
                        <div>
                            <label className="grid gap-1.5 text-sm">
                                <span className="text-foreground/85 font-medium">Notes</span>
                                <textarea
                                    value={documentForm.data.notes}
                                    onChange={(e) => documentForm.setData('notes', e.target.value)}
                                    rows={3}
                                    className="border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 w-full rounded-xl border px-3 py-2.5 shadow-sm transition outline-none focus:ring-4"
                                />
                            </label>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => document.getElementById('doc-modal')?.classList.add('hidden')}
                                className="border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={documentForm.processing}
                                className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
                            >
                                {documentForm.processing ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}