import { route } from 'ziggy-js';
import CrudList, { type SelectOption } from '@/components/hrm/crud-list';
import { StatusBadge, type Paginated } from '@/components/hrm/ui';

type Ref = { id: number; code: string; name: string } | null;
type Position = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    department_id: number | null;
    grade_id: number | null;
    reports_to_position_id: number | null;
    headcount_planned: number;
    headcount_current: number;
    is_active: boolean;
    department: Ref;
    grade: Ref;
    reports_to: Ref;
};

type Props = {
    company: { name: string };
    records: Paginated<Position>;
    filters: { search: string };
    canManage: boolean;
    departmentOptions: SelectOption[];
    gradeOptions: SelectOption[];
    positionOptions: SelectOption[];
};

export default function PositionsIndex(props: Props) {
    return (
        <CrudList
            title="Positions"
            subtitle={`Job positions and headcount for ${props.company.name}`}
            noun="position"
            records={props.records}
            canManage={props.canManage}
            search={{ value: props.filters.search, url: route('erp.hrm.organization.positions.index') }}
            routes={{
                store: route('erp.hrm.organization.positions.store'),
                update: (id) => route('erp.hrm.organization.positions.update', id),
                destroy: (id) => route('erp.hrm.organization.positions.destroy', id),
            }}
            defaults={{ code: '', name: '', description: '', department_id: '', grade_id: '', reports_to_position_id: '', headcount_planned: 1, is_active: true }}
            fields={[
                { name: 'code', label: 'Code *' },
                { name: 'name', label: 'Title *' },
                { name: 'department_id', label: 'Department', type: 'select', options: props.departmentOptions },
                { name: 'grade_id', label: 'Grade', type: 'select', options: props.gradeOptions },
                { name: 'reports_to_position_id', label: 'Reports to', type: 'select', options: props.positionOptions },
                { name: 'headcount_planned', label: 'Planned headcount *', type: 'number' },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
                { name: 'description', label: 'Description', type: 'textarea', wide: true },
            ]}
            columns={[
                { label: 'Code', render: (p) => <span className="font-mono">{p.code}</span> },
                { label: 'Title', render: (p) => <span className="font-medium">{p.name}</span> },
                { label: 'Department', render: (p) => p.department?.name ?? '—' },
                { label: 'Grade', render: (p) => p.grade?.name ?? '—' },
                { label: 'Reports to', render: (p) => p.reports_to?.name ?? '—' },
                {
                    label: 'Headcount',
                    render: (p) => (
                        <span className={p.headcount_current < p.headcount_planned ? 'text-amber-600' : ''}>
                            {p.headcount_current} / {p.headcount_planned}
                        </span>
                    ),
                },
                { label: 'Status', render: (p) => <StatusBadge value={p.is_active ? 'active' : 'inactive'} /> },
            ]}
        />
    );
}
