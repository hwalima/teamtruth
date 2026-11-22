import { route } from 'ziggy-js';
import CrudList, { type SelectOption } from '@/components/hrm/crud-list';
import { StatusBadge, personName, type Paginated } from '@/components/hrm/ui';

type Ref = { id: number; code: string; name: string } | null;
type Department = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    parent_id: number | null;
    cost_center_id: number | null;
    head_id: number | null;
    is_active: boolean;
    parent: Ref;
    cost_center: Ref;
    head: { first_name: string; middle_name: string | null; last_name: string } | null;
};

type Props = {
    company: { name: string };
    records: Paginated<Department>;
    filters: { search: string };
    canManage: boolean;
    parentOptions: SelectOption[];
    costCenterOptions: SelectOption[];
    employeeOptions: SelectOption[];
};

export default function DepartmentsIndex(props: Props) {
    return (
        <CrudList
            title="Departments"
            subtitle={`Organization structure for ${props.company.name}`}
            noun="department"
            records={props.records}
            canManage={props.canManage}
            search={{ value: props.filters.search, url: route('erp.hrm.organization.departments.index') }}
            routes={{
                store: route('erp.hrm.organization.departments.store'),
                update: (id) => route('erp.hrm.organization.departments.update', id),
                destroy: (id) => route('erp.hrm.organization.departments.destroy', id),
            }}
            defaults={{ code: '', name: '', description: '', parent_id: '', cost_center_id: '', head_id: '', is_active: true }}
            fields={[
                { name: 'code', label: 'Code *' },
                { name: 'name', label: 'Name *' },
                { name: 'parent_id', label: 'Parent department', type: 'select', options: props.parentOptions },
                { name: 'cost_center_id', label: 'Cost center', type: 'select', options: props.costCenterOptions },
                { name: 'head_id', label: 'Head of department', type: 'select', options: props.employeeOptions },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
                { name: 'description', label: 'Description', type: 'textarea', wide: true },
            ]}
            columns={[
                { label: 'Code', render: (d) => <span className="font-mono">{d.code}</span> },
                { label: 'Name', render: (d) => <span className="font-medium">{d.name}</span> },
                { label: 'Parent', render: (d) => d.parent?.name ?? '—' },
                { label: 'Head', render: (d) => (d.head ? personName(d.head) : '—') },
                { label: 'Cost center', render: (d) => d.cost_center?.name ?? '—' },
                { label: 'Status', render: (d) => <StatusBadge value={d.is_active ? 'active' : 'inactive'} /> },
            ]}
        />
    );
}
