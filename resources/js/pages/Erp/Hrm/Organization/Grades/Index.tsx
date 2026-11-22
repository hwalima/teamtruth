import { route } from 'ziggy-js';
import CrudList from '@/components/hrm/crud-list';
import { StatusBadge, type Paginated } from '@/components/hrm/ui';

type Grade = {
    id: number;
    code: string;
    name: string;
    level: number;
    min_salary: string;
    max_salary: string;
    currency_code: string;
    description: string | null;
    is_active: boolean;
};

type Props = {
    company: { name: string };
    records: Paginated<Grade>;
    filters: { search: string };
    canManage: boolean;
    defaultCurrency: string;
};

const money = (value: string) => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GradesIndex(props: Props) {
    return (
        <CrudList
            title="Grades"
            subtitle={`Pay grades and salary bands for ${props.company.name}`}
            noun="grade"
            records={props.records}
            canManage={props.canManage}
            search={{ value: props.filters.search, url: route('erp.hrm.organization.grades.index') }}
            routes={{
                store: route('erp.hrm.organization.grades.store'),
                update: (id) => route('erp.hrm.organization.grades.update', id),
                destroy: (id) => route('erp.hrm.organization.grades.destroy', id),
            }}
            defaults={{ code: '', name: '', level: 1, min_salary: '', max_salary: '', currency_code: props.defaultCurrency, description: '', is_active: true }}
            toForm={(g) => ({ ...g, min_salary: Number(g.min_salary), max_salary: Number(g.max_salary) })}
            fields={[
                { name: 'code', label: 'Code *' },
                { name: 'name', label: 'Name *' },
                { name: 'level', label: 'Level *', type: 'number' },
                { name: 'min_salary', label: 'Minimum salary', type: 'number', step: '0.01' },
                { name: 'max_salary', label: 'Maximum salary', type: 'number', step: '0.01' },
                { name: 'currency_code', label: 'Currency *', placeholder: 'USD' },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
                { name: 'description', label: 'Description', type: 'textarea', wide: true },
            ]}
            columns={[
                { label: 'Level', render: (g) => g.level },
                { label: 'Code', render: (g) => <span className="font-mono">{g.code}</span> },
                { label: 'Name', render: (g) => <span className="font-medium">{g.name}</span> },
                { label: 'Salary band', render: (g) => `${g.currency_code} ${money(g.min_salary)} – ${money(g.max_salary)}` },
                { label: 'Status', render: (g) => <StatusBadge value={g.is_active ? 'active' : 'inactive'} /> },
            ]}
        />
    );
}
