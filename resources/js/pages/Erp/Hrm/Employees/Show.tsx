import { useConfirmDelete } from '@/components/erp/record-actions';
import type { EmployeeRecord } from '@/components/hrm/employee-form';
import {
    Card,
    Detail,
    Empty,
    Field,
    Page,
    Select,
    StatusBadge,
    TextArea,
    TextInput,
    dangerButton,
    formatDate,
    humanize,
    personName,
    primaryButton,
    secondaryButton,
    type Options,
} from '@/components/hrm/ui';
import { router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';

type Named = { id: number; name: string; code?: string } | null;
type LeaveType = { id: number; name: string; code: string; color: string | null } | null;

type Employee = EmployeeRecord & {
    termination_date: string | null;
    termination_reason: string | null;
    department: Named;
    position: Named;
    grade: Named;
    cost_center: Named;
    line_manager: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string } | null;
    user: { id: number; name: string; email: string } | null;
    documents: {
        id: number;
        document_type: string;
        title: string;
        document_number: string | null;
        issued_date: string | null;
        expiry_date: string | null;
        file_size: number | null;
    }[];
    contracts: {
        id: number;
        contract_type: string;
        status: string;
        start_date: string;
        end_date: string | null;
        basic_salary?: string;
        currency_code: string;
        pay_frequency: string;
    }[];
    leave_balances: {
        id: number;
        leave_type: LeaveType;
        period_start: string;
        period_end: string;
        available: number;
        taken: string;
        total_entitlement: number;
    }[];
    leave_requests: { id: number; leave_type: LeaveType; start_date: string; end_date: string; total_days: string; status: string }[];
    disciplinary_cases: { id: number; case_number: string; incident_date: string; status: string }[];
    self_service_requests: { id: number; request_type: string; status: string; created_at: string }[];
};

type Props = {
    company: { name: string };
    employee: Employee;
    documentTypeOptions: Options;
    canUpdate: boolean;
    canTerminate: boolean;
    canDelete: boolean;
    canManageDocuments: boolean;
    canManageContracts: boolean;
    canViewSalary: boolean;
};

const tabs = ['profile', 'contracts', 'leave', 'documents', 'history'] as const;

export default function EmployeeShow({ employee, ...props }: Props) {
    const [tab, setTab] = useState<(typeof tabs)[number]>('profile');
    const [showTerminate, setShowTerminate] = useState(false);
    const { askDelete, deleteDialog } = useConfirmDelete();
    const terminated = employee.status === 'terminated';

    const terminateForm = useForm({ termination_date: new Date().toISOString().slice(0, 10), termination_reason: '' });
    const rehireForm = useForm({ rehire_date: new Date().toISOString().slice(0, 10) });
    const documentForm = useForm<{
        document_type: string;
        title: string;
        document_number: string;
        issued_date: string;
        expiry_date: string;
        file: File | null;
    }>({
        document_type: 'other',
        title: '',
        document_number: '',
        issued_date: '',
        expiry_date: '',
        file: null,
    });

    const terminate = (event: FormEvent) => {
        event.preventDefault();
        terminateForm.post(route('erp.hrm.employees.terminate', employee.id), { onSuccess: () => setShowTerminate(false) });
    };

    const uploadDocument = (event: FormEvent) => {
        event.preventDefault();
        documentForm.post(route('erp.hrm.employees.documents.store', employee.id), { forceFormData: true, onSuccess: () => documentForm.reset() });
    };

    const deleteDocument = (id: number) => {
        if (window.confirm('Delete this document?')) {
            router.delete(route('erp.hrm.employees.documents.destroy', [employee.id, id]), { preserveScroll: true });
        }
    };

    return (
        <Page
            title={personName(employee)}
            subtitle={
                <span className="flex flex-wrap items-center gap-2">
                    {employee.employee_number} · {employee.position?.name ?? 'No position'} · {employee.department?.name ?? 'No department'}
                    <StatusBadge value={employee.status} />
                </span>
            }
            actions={
                <>
                    <a href={route('erp.hrm.employees.index')} className={secondaryButton}>
                        Back
                    </a>
                    {props.canUpdate && (
                        <a href={route('erp.hrm.employees.edit', employee.id)} className={primaryButton}>
                            Edit
                        </a>
                    )}
                    {props.canDelete && (
                        <button
                            type="button"
                            className={secondaryButton}
                            onClick={() =>
                                askDelete({
                                    url: route('erp.hrm.employees.destroy', employee.id),
                                    title: 'Delete ' + personName(employee) + '?',
                                    description:
                                        'Use this for a record added by mistake. An employee with contracts, leave, cases or documents is kept: terminate them instead so their history stays.',
                                })
                            }
                        >
                            Delete
                        </button>
                    )}
                    {props.canTerminate && !terminated && (
                        <button type="button" onClick={() => setShowTerminate((v) => !v)} className={dangerButton}>
                            Terminate
                        </button>
                    )}
                </>
            }
        >
            {deleteDialog}
            {showTerminate && (
                <Card title="Terminate employee">
                    <form onSubmit={terminate} className="grid gap-3 sm:grid-cols-3">
                        <Field label="Termination date" error={terminateForm.errors.termination_date}>
                            <TextInput
                                type="date"
                                value={terminateForm.data.termination_date}
                                onChange={(v) => terminateForm.setData('termination_date', v)}
                            />
                        </Field>
                        <Field label="Reason" error={terminateForm.errors.termination_reason} className="sm:col-span-2">
                            <TextArea
                                value={terminateForm.data.termination_reason}
                                onChange={(v) => terminateForm.setData('termination_reason', v)}
                                rows={2}
                            />
                        </Field>
                        <div className="sm:col-span-3">
                            <button type="submit" disabled={terminateForm.processing} className={dangerButton}>
                                Confirm termination
                            </button>
                        </div>
                    </form>
                </Card>
            )}

            {terminated && props.canTerminate && (
                <Card title="Terminated">
                    <p className="text-sm">
                        Terminated on {formatDate(employee.termination_date)}
                        {employee.termination_reason && ` — ${employee.termination_reason}`}
                    </p>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            rehireForm.post(route('erp.hrm.employees.rehire', employee.id));
                        }}
                        className="flex flex-wrap items-end gap-3"
                    >
                        <Field label="Rehire date" error={rehireForm.errors.rehire_date}>
                            <TextInput type="date" value={rehireForm.data.rehire_date} onChange={(v) => rehireForm.setData('rehire_date', v)} />
                        </Field>
                        <button type="submit" disabled={rehireForm.processing} className={primaryButton}>
                            Rehire
                        </button>
                    </form>
                </Card>
            )}

            <nav className="flex flex-wrap gap-2 border-b pb-2">
                {tabs.map((name) => (
                    <button
                        key={name}
                        type="button"
                        onClick={() => setTab(name)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === name ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'}`}
                    >
                        {humanize(name)}
                    </button>
                ))}
            </nav>

            {tab === 'profile' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card title="Personal">
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Detail label="Gender" value={humanize(employee.gender)} />
                            <Detail label="Date of birth" value={formatDate(employee.date_of_birth)} />
                            <Detail label="Marital status" value={humanize(employee.marital_status)} />
                            <Detail label="Nationality" value={employee.nationality} />
                            <Detail label="National ID" value={employee.national_id} />
                            <Detail label="Passport" value={employee.passport_number} />
                            <Detail label="Email" value={employee.personal_email} />
                            <Detail label="Phone" value={employee.personal_phone} />
                        </dl>
                    </Card>
                    <Card title="Employment">
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Detail label="Hire date" value={formatDate(employee.hire_date)} />
                            <Detail label="Department" value={employee.department?.name} />
                            <Detail label="Position" value={employee.position?.name} />
                            <Detail label="Grade" value={employee.grade?.name} />
                            <Detail label="Cost center" value={employee.cost_center?.name} />
                            <Detail
                                label="Line manager"
                                value={
                                    employee.line_manager && (
                                        <a href={route('erp.hrm.employees.show', employee.line_manager.id)} className="text-primary underline">
                                            {personName(employee.line_manager)}
                                        </a>
                                    )
                                }
                            />
                            <Detail label="System user" value={employee.user ? `${employee.user.name} (${employee.user.email})` : null} />
                        </dl>
                    </Card>
                    <Card title="Emergency contact">
                        <dl className="grid gap-4 sm:grid-cols-3">
                            <Detail label="Name" value={employee.emergency_contact_name} />
                            <Detail label="Phone" value={employee.emergency_contact_phone} />
                            <Detail label="Relationship" value={employee.emergency_contact_relation} />
                        </dl>
                    </Card>
                    <Card title="Bank and statutory">
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Detail label="Bank" value={[employee.bank_name, employee.bank_branch].filter(Boolean).join(', ')} />
                            <Detail label="Account" value={[employee.bank_account_name, employee.bank_account_number].filter(Boolean).join(' · ')} />
                            <Detail label="Tax number" value={employee.tax_number} />
                            <Detail label="NSSA number" value={employee.nssa_number} />
                        </dl>
                    </Card>
                </div>
            )}

            {tab === 'contracts' && (
                <Card
                    title="Contracts"
                    actions={
                        props.canManageContracts && (
                            <a href={route('erp.hrm.contracts.create', { employee_id: employee.id })} className={primaryButton}>
                                New contract
                            </a>
                        )
                    }
                >
                    {employee.contracts.length === 0 ? (
                        <Empty>No contracts yet.</Empty>
                    ) : (
                        <ul className="divide-y">
                            {employee.contracts.map((contract) => (
                                <li key={contract.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                                    <a href={route('erp.hrm.contracts.show', contract.id)} className="font-medium hover:underline">
                                        {humanize(contract.contract_type)} · {formatDate(contract.start_date)} –{' '}
                                        {contract.end_date ? formatDate(contract.end_date) : 'open-ended'}
                                    </a>
                                    <span className="flex items-center gap-3">
                                        {props.canViewSalary && contract.basic_salary !== undefined && (
                                            <span>
                                                {contract.currency_code}{' '}
                                                {Number(contract.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })} /{' '}
                                                {humanize(contract.pay_frequency)}
                                            </span>
                                        )}
                                        <StatusBadge value={contract.status} />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            )}

            {tab === 'leave' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card title="Leave balances">
                        {employee.leave_balances.length === 0 ? (
                            <Empty>No leave balances.</Empty>
                        ) : (
                            <ul className="divide-y">
                                {employee.leave_balances.map((balance) => (
                                    <li key={balance.id} className="flex justify-between py-2 text-sm">
                                        <span>
                                            {balance.leave_type?.name ?? 'Leave'}{' '}
                                            <span className="text-muted-foreground">
                                                ({formatDate(balance.period_start)} – {formatDate(balance.period_end)})
                                            </span>
                                        </span>
                                        <span className="font-medium">
                                            {balance.available} / {balance.total_entitlement} days
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <Card title="Recent leave requests">
                        {employee.leave_requests.length === 0 ? (
                            <Empty>No leave requests.</Empty>
                        ) : (
                            <ul className="divide-y">
                                {employee.leave_requests.map((request) => (
                                    <li key={request.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                                        <a href={route('erp.hrm.leave.requests.show', request.id)} className="hover:underline">
                                            {request.leave_type?.name ?? 'Leave'} · {formatDate(request.start_date)} – {formatDate(request.end_date)}{' '}
                                            ({Number(request.total_days)} d)
                                        </a>
                                        <StatusBadge value={request.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            )}

            {tab === 'documents' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card title="Documents">
                        {employee.documents.length === 0 ? (
                            <Empty>No documents uploaded.</Empty>
                        ) : (
                            <ul className="divide-y">
                                {employee.documents.map((document) => (
                                    <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                                        <span>
                                            <span className="font-medium">{document.title}</span>{' '}
                                            <span className="text-muted-foreground">
                                                {props.documentTypeOptions[document.document_type] ?? humanize(document.document_type)}
                                                {document.expiry_date && ` · expires ${formatDate(document.expiry_date)}`}
                                            </span>
                                        </span>
                                        {props.canManageDocuments && (
                                            <button
                                                type="button"
                                                onClick={() => deleteDocument(document.id)}
                                                className="text-destructive text-sm underline"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    {props.canManageDocuments && (
                        <Card title="Upload document">
                            <form onSubmit={uploadDocument} className="grid gap-3 sm:grid-cols-2">
                                <Field label="Type" error={documentForm.errors.document_type}>
                                    <Select
                                        value={documentForm.data.document_type}
                                        onChange={(v) => documentForm.setData('document_type', v)}
                                        options={props.documentTypeOptions}
                                    />
                                </Field>
                                <Field label="Title" error={documentForm.errors.title}>
                                    <TextInput value={documentForm.data.title} onChange={(v) => documentForm.setData('title', v)} />
                                </Field>
                                <Field label="Document number" error={documentForm.errors.document_number}>
                                    <TextInput
                                        value={documentForm.data.document_number}
                                        onChange={(v) => documentForm.setData('document_number', v)}
                                    />
                                </Field>
                                <Field label="File (max 10 MB)" error={documentForm.errors.file}>
                                    <input
                                        type="file"
                                        onChange={(e) => documentForm.setData('file', e.target.files?.[0] ?? null)}
                                        className="text-sm"
                                    />
                                </Field>
                                <Field label="Issued" error={documentForm.errors.issued_date}>
                                    <TextInput
                                        type="date"
                                        value={documentForm.data.issued_date}
                                        onChange={(v) => documentForm.setData('issued_date', v)}
                                    />
                                </Field>
                                <Field label="Expires" error={documentForm.errors.expiry_date}>
                                    <TextInput
                                        type="date"
                                        value={documentForm.data.expiry_date}
                                        onChange={(v) => documentForm.setData('expiry_date', v)}
                                    />
                                </Field>
                                <div className="sm:col-span-2">
                                    <button type="submit" disabled={documentForm.processing} className={primaryButton}>
                                        Upload
                                    </button>
                                </div>
                            </form>
                        </Card>
                    )}
                </div>
            )}

            {tab === 'history' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card title="Disciplinary cases">
                        {employee.disciplinary_cases.length === 0 ? (
                            <Empty>No disciplinary cases.</Empty>
                        ) : (
                            <ul className="divide-y">
                                {employee.disciplinary_cases.map((item) => (
                                    <li key={item.id} className="flex justify-between py-2 text-sm">
                                        <a href={route('erp.hrm.disciplinary.show', item.id)} className="hover:underline">
                                            {item.case_number} · {formatDate(item.incident_date)}
                                        </a>
                                        <StatusBadge value={item.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    <Card title="Self-service requests">
                        {employee.self_service_requests.length === 0 ? (
                            <Empty>No requests.</Empty>
                        ) : (
                            <ul className="divide-y">
                                {employee.self_service_requests.map((item) => (
                                    <li key={item.id} className="flex justify-between py-2 text-sm">
                                        <a href={route('erp.hrm.self-service.show', item.id)} className="hover:underline">
                                            {humanize(item.request_type)} · {formatDate(item.created_at)}
                                        </a>
                                        <StatusBadge value={item.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            )}
        </Page>
    );
}
