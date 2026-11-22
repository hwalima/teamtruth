import { route } from 'ziggy-js';
import CrudList, { type SelectOption } from '@/components/hrm/crud-list';
import { StatusBadge, personName, type Paginated } from '@/components/hrm/ui';

type CostCenter = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    parent_id: number | null;
    budget_owner_id: number | null;
    is_active: boolean;
    parent: { name: string } | null;
    budget_owner: { first_name: string; middle_name: string | null; last_name: string } | null;
};

type Props = {
    company: { name: string };
    records: Paginated<CostCenter>;
    filters: { search: string };
    canManage: boolean;
    parentOptions: SelectOption[];
    employeeOptions: SelectOption[];
};

export default function CostCentersIndex(props: Props) {
    return (
        <CrudList
            title="Cost centers"
            subtitle={`Budget units for ${props.company.name}`}
            noun="cost center"
            records={props.records}
            canManage={props.canManage}
            search={{ value: props.filters.search, url: route('erp.hrm.organization.cost-centers.index') }}
            routes={{
                store: route('erp.hrm.organization.cost-centers.store'),
                update: (id) => route('erp.hrm.organization.cost-centers.update', id),
                destroy: (id) => route('erp.hrm.organization.cost-centers.destroy', id),
            }}
            defaults={{ code: '', name: '', description: '', parent_id: '', budget_owner_id: '', is_active: true }}
            fields={[
                { name: 'code', label: 'Code *' },
                { name: 'name', label: 'Name *' },
                { name: 'parent_id', label: 'Parent cost center', type: 'select', options: props.parentOptions },
                { name: 'budget_owner_id', label: 'Budget owner', type: 'select', options: props.employeeOptions },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
                { name: 'description', label: 'Description', type: 'textarea', wide: true },
            ]}
            columns={[
                { label: 'Code', render: (c) => <span className="font-mono">{c.code}</span> },
                { label: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
                { label: 'Parent', render: (c) => c.parent?.name ?? '—' },
                { label: 'Budget owner', render: (c) => (c.budget_owner ? personName(c.budget_owner) : '—') },
                { label: 'Status', render: (c) => <StatusBadge value={c.is_active ? 'active' : 'inactive'} /> },
            ]}
        />
    );
}
