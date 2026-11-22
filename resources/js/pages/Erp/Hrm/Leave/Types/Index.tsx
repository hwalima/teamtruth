import { route } from 'ziggy-js';
import CrudList from '@/components/hrm/crud-list';
import { StatusBadge, type Options, type Paginated } from '@/components/hrm/ui';

type LeaveType = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    accrual_type: string;
    accrual_rate: string;
    max_accrual: string | null;
    carry_over_limit: string | null;
    carry_over_expiry_months: number | null;
    is_paid: boolean;
    requires_approval: boolean;
    requires_document: boolean;
    color: string | null;
    is_active: boolean;
};

type Props = {
    company: { name: string };
    records: Paginated<LeaveType>;
    filters: { search: string };
    canManage: boolean;
    accrualTypeOptions: Options;
};

const rateLabel = (t: LeaveType, options: Options) => {
    const rate = Number(t.accrual_rate);
    if (t.accrual_type === 'monthly') return `${rate} day(s) per month`;
    if (t.accrual_type === 'hours_based') return 'Hours based';
    return `${rate} day(s) per year (${options[t.accrual_type] ?? t.accrual_type})`;
};

export default function LeaveTypesIndex(props: Props) {
    return (
        <CrudList
            title="Leave types"
            subtitle={`Leave policies for ${props.company.name}`}
            noun="leave type"
            records={props.records}
            canManage={props.canManage}
            search={{ value: props.filters.search, url: route('erp.hrm.leave.types.index') }}
            routes={{
                store: route('erp.hrm.leave.types.store'),
                update: (id) => route('erp.hrm.leave.types.update', id),
                destroy: (id) => route('erp.hrm.leave.types.destroy', id),
            }}
            defaults={{
                code: '',
                name: '',
                description: '',
                accrual_type: 'yearly',
                accrual_rate: 0,
                max_accrual: '',
                carry_over_limit: '',
                carry_over_expiry_months: '',
                is_paid: true,
                requires_approval: true,
                requires_document: false,
                color: '#3b82f6',
                is_active: true,
            }}
            toForm={(t) => ({
                ...t,
                accrual_rate: Number(t.accrual_rate),
                max_accrual: t.max_accrual ?? '',
                carry_over_limit: t.carry_over_limit ?? '',
                carry_over_expiry_months: t.carry_over_expiry_months ?? '',
                color: t.color ?? '#3b82f6',
                description: t.description ?? '',
            })}
            fields={[
                { name: 'code', label: 'Code *', placeholder: 'AL' },
                { name: 'name', label: 'Name *', placeholder: 'Annual leave' },
                { name: 'color', label: 'Calendar colour', type: 'color' },
                { name: 'accrual_type', label: 'Accrual *', type: 'select', options: props.accrualTypeOptions, required: true },
                { name: 'accrual_rate', label: 'Days (per year, or per month for monthly)', type: 'number', step: '0.01' },
                { name: 'max_accrual', label: 'Maximum days per year', type: 'number', step: '0.01' },
                { name: 'carry_over_limit', label: 'Carry-over limit (days)', type: 'number', step: '0.01' },
                { name: 'carry_over_expiry_months', label: 'Carry-over expires after (months)', type: 'number' },
                { name: 'is_paid', label: 'Paid leave', type: 'checkbox' },
                { name: 'requires_approval', label: 'Needs approval', type: 'checkbox' },
                { name: 'requires_document', label: 'Needs a supporting document', type: 'checkbox' },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
                { name: 'description', label: 'Description', type: 'textarea', wide: true },
            ]}
            columns={[
                {
                    label: 'Leave type',
                    render: (t) => (
                        <span className="flex items-center gap-2">
                            <span className="inline-block size-3 rounded-full" style={{ backgroundColor: t.color ?? '#94a3b8' }} />
                            <span className="font-medium">{t.name}</span>
                            <span className="text-muted-foreground font-mono text-xs">{t.code}</span>
                        </span>
                    ),
                },
                { label: 'Entitlement', render: (t) => rateLabel(t, props.accrualTypeOptions) },
                { label: 'Paid', render: (t) => (t.is_paid ? 'Yes' : 'No') },
                { label: 'Approval', render: (t) => (t.requires_approval ? 'Required' : 'Automatic') },
                { label: 'Status', render: (t) => <StatusBadge value={t.is_active ? 'active' : 'inactive'} /> },
            ]}
        />
    );
}
