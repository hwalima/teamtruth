import { useLiveSearch } from '@/hooks/use-live-search';
import { RecordActions } from '@/components/erp/record-actions';
import {
    Card,
    Empty,
    Field,
    Page,
    Pagination,
    Select,
    StatusBadge,
    TextInput,
    formatDate,
    personName,
    primaryButton,
    secondaryButton,
    type Options,
    type Paginated,
} from '@/components/hrm/ui';
import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Contract = {
    id: number;
    employee: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string } | null;
    template: { name: string } | null;
    contract_type: string;
    start_date: string;
    end_date: string | null;
    basic_salary?: string;
    currency_code: string;
    status: string;
    signed_by_employee_at: string | null;
    signed_by_employer_at: string | null;
};

type Props = {
    company: { name: string };
    contracts: Paginated<Contract>;
    filters: Record<string, string | undefined>;
    statusOptions: Options;
    typeOptions: Options;
    expiringCount: number;
    canManage: boolean;
};

function signatures(contract: Contract): string {
    if (contract.status !== 'draft') return '';
    const missing = [!contract.signed_by_employee_at && 'employee', !contract.signed_by_employer_at && 'employer'].filter(Boolean);
    return missing.length ? `Awaiting ${missing.join(' & ')}` : '';
}

export default function ContractsIndex(props: Props) {
    const filters = useForm({
        search: props.filters.search ?? '',
        status: props.filters.status ?? '',
        contract_type: props.filters.contract_type ?? '',
    });

    useLiveSearch(filters.data.search, () => apply());
    const apply = (event?: FormEvent) => {
        event?.preventDefault();
        router.get(route('erp.hrm.contracts.index'), Object.fromEntries(Object.entries(filters.data).filter(([, v]) => v !== '')), {
            preserveState: true,
        });
    };

    return (
        <Page
            title="Contracts"
            subtitle={`Employment contracts · ${props.company.name}`}
            actions={
                <>
                    <a href={route('erp.hrm.contracts.templates.index')} className={secondaryButton}>
                        Templates
                    </a>
                    {props.canManage && (
                        <a href={route('erp.hrm.contracts.create')} className={primaryButton}>
                            New contract
                        </a>
                    )}
                </>
            }
        >
            {props.expiringCount > 0 && !props.filters.expiring && (
                <button
                    type="button"
                    onClick={() => router.get(route('erp.hrm.contracts.index'), { expiring: 1 })}
                    className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900"
                >
                    {props.expiringCount} active contract(s) end within 60 days. Show them →
                </button>
            )}

            <Card>
                <form onSubmit={apply} className="grid gap-3 sm:grid-cols-4">
                    <Field label="Employee">
                        <TextInput value={filters.data.search} onChange={(v) => filters.setData('search', v)} placeholder="Name or number" />
                    </Field>
                    <Field label="Status">
                        <Select
                            value={filters.data.status}
                            onChange={(v) => filters.setData('status', v)}
                            options={props.statusOptions}
                            placeholder="All"
                        />
                    </Field>
                    <Field label="Type">
                        <Select
                            value={filters.data.contract_type}
                            onChange={(v) => filters.setData('contract_type', v)}
                            options={props.typeOptions}
                            placeholder="All"
                        />
                    </Field>
                    <div className="flex items-end gap-2">
                        <button type="submit" className={primaryButton}>
                            Apply
                        </button>
                        <a href={route('erp.hrm.contracts.index')} className={secondaryButton}>
                            Clear
                        </a>
                    </div>
                </form>
            </Card>

            {props.contracts.data.length === 0 ? (
                <Empty>No contracts found.</Empty>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium">Employee</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 font-medium">Period</th>
                                {props.contracts.data.some((c) => c.basic_salary !== undefined) && (
                                    <th className="px-4 py-3 text-right font-medium">Salary</th>
                                )}
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {props.contracts.data.map((contract) => (
                                <tr key={contract.id} className="hover:bg-muted/30 border-t">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{personName(contract.employee)}</div>
                                        <div className="text-muted-foreground text-xs">{contract.employee?.employee_number}</div>
                                    </td>
                                    <td className="px-4 py-3">{props.typeOptions[contract.contract_type] ?? contract.contract_type}</td>
                                    <td className="px-4 py-3">
                                        {formatDate(contract.start_date)} – {contract.end_date ? formatDate(contract.end_date) : 'open-ended'}
                                    </td>
                                    {contract.basic_salary !== undefined && (
                                        <td className="px-4 py-3 text-right">
                                            {contract.currency_code}{' '}
                                            {Number(contract.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    )}
                                    <td className="px-4 py-3">
                                        <StatusBadge value={contract.status} label={props.statusOptions[contract.status]} />
                                        <div className="text-muted-foreground mt-1 text-xs">{signatures(contract)}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <RecordActions viewHref={route('erp.hrm.contracts.show', contract.id)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination page={props.contracts} />
        </Page>
    );
}
