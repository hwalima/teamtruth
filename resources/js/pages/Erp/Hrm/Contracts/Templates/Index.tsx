import { route } from 'ziggy-js';
import CrudList from '@/components/hrm/crud-list';
import { Card, StatusBadge, type Options, type Paginated } from '@/components/hrm/ui';

type Template = { id: number; name: string; contract_type: string; description: string | null; body: string; is_default: boolean; contracts_count: number };

type Props = {
    company: { name: string };
    templates: Paginated<Template>;
    filters: { search: string };
    typeOptions: Options;
    mergeFields: string[];
    canManage: boolean;
};

export default function ContractTemplatesIndex(props: Props) {
    return (
        <CrudList
            title="Contract templates"
            subtitle={`Reusable contract wording · ${props.company.name}`}
            noun="template"
            records={props.templates}
            canManage={props.canManage}
            search={{ value: props.filters.search, url: route('erp.hrm.contracts.templates.index') }}
            routes={{
                store: route('erp.hrm.contracts.templates.store'),
                update: (id) => route('erp.hrm.contracts.templates.update', id),
                destroy: (id) => route('erp.hrm.contracts.templates.destroy', id),
            }}
            defaults={{ name: '', contract_type: 'permanent', description: '', body: '', is_default: false }}
            toForm={(t) => ({ name: t.name, contract_type: t.contract_type, description: t.description ?? '', body: t.body ?? '', is_default: t.is_default })}
            fields={[
                { name: 'name', label: 'Name *' },
                { name: 'contract_type', label: 'Contract type *', type: 'select', options: props.typeOptions, required: true },
                { name: 'is_default', label: 'Default for this contract type', type: 'checkbox' },
                { name: 'description', label: 'Description', type: 'textarea', wide: true },
                { name: 'body', label: 'Contract wording', type: 'textarea', wide: true },
            ]}
            headerActions={
                <a href={route('erp.hrm.contracts.index')} className="text-primary self-center text-sm underline">
                    ← Contracts
                </a>
            }
            columns={[
                { label: 'Name', render: (t) => <span className="font-medium">{t.name}</span> },
                { label: 'Type', render: (t) => props.typeOptions[t.contract_type] ?? t.contract_type },
                { label: 'Default', render: (t) => (t.is_default ? <StatusBadge value="active" label="Default" /> : '—') },
                { label: 'Contracts', render: (t) => t.contracts_count },
            ]}
        >
            <Card title="Merge fields">
                <p className="text-muted-foreground text-sm">Type these into the contract wording; they are filled in on each contract:</p>
                <div className="flex flex-wrap gap-2">
                    {props.mergeFields.map((field) => (
                        <code key={field} className="bg-muted rounded px-2 py-1 text-xs">{`{{${field}}}`}</code>
                    ))}
                </div>
            </Card>
        </CrudList>
    );
}
