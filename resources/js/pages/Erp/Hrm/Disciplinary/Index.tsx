import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Empty, Field, Page, Pagination, Select, StatusBadge, TextInput, formatDate, personName, primaryButton, secondaryButton, type Options, type Paginated } from '@/components/hrm/ui';

type DisciplinaryCase = {
    id: number;
    case_number: string;
    employee: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string } | null;
    incident_date: string;
    status: string;
    outcome: string | null;
    expiry_date: string | null;
};

type Props = {
    company: { name: string };
    cases: Paginated<DisciplinaryCase>;
    filters: Record<string, string | undefined>;
    statusOptions: Options;
    outcomeOptions: Options;
    canManage: boolean;
    seesAll: boolean;
};

export default function DisciplinaryIndex(props: Props) {
    const filters = useForm({ search: props.filters.search ?? '', status: props.filters.status ?? '', outcome: props.filters.outcome ?? '' });

    const apply = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('erp.hrm.disciplinary.index'), Object.fromEntries(Object.entries(filters.data).filter(([, v]) => v !== '')), { preserveState: true });
    };

    return (
        <Page
            title={props.seesAll ? 'Disciplinary cases' : 'My disciplinary cases'}
            subtitle={props.company.name}
            actions={
                props.canManage && (
                    <a href={route('erp.hrm.disciplinary.create')} className={primaryButton}>
                        Open case
                    </a>
                )
            }
        >
            {props.seesAll && (
                <Card>
                    <form onSubmit={apply} className="grid gap-3 sm:grid-cols-4">
                        <Field label="Search">
                            <TextInput value={filters.data.search} onChange={(v) => filters.setData('search', v)} placeholder="Case number or employee" />
                        </Field>
                        <Field label="Status">
                            <Select value={filters.data.status} onChange={(v) => filters.setData('status', v)} options={props.statusOptions} placeholder="All" />
                        </Field>
                        <Field label="Outcome">
                            <Select value={filters.data.outcome} onChange={(v) => filters.setData('outcome', v)} options={props.outcomeOptions} placeholder="All" />
                        </Field>
                        <div className="flex items-end gap-2">
                            <button type="submit" className={primaryButton}>
                                Apply
                            </button>
                            <a href={route('erp.hrm.disciplinary.index')} className={secondaryButton}>
                                Clear
                            </a>
                        </div>
                    </form>
                </Card>
            )}

            {props.cases.data.length === 0 ? (
                <Empty>{props.seesAll ? 'No disciplinary cases found.' : 'You have no disciplinary cases.'}</Empty>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium">Case</th>
                                <th className="px-4 py-3 font-medium">Employee</th>
                                <th className="px-4 py-3 font-medium">Incident</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Outcome</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {props.cases.data.map((c) => (
                                <tr key={c.id} className="border-t">
                                    <td className="px-4 py-3 font-mono text-xs">{c.case_number}</td>
                                    <td className="px-4 py-3">{personName(c.employee)}</td>
                                    <td className="px-4 py-3">{formatDate(c.incident_date)}</td>
                                    <td className="px-4 py-3">
                                        <StatusBadge value={c.status} label={props.statusOptions[c.status]} />
                                    </td>
                                    <td className="px-4 py-3">
                                        {c.outcome ? props.outcomeOptions[c.outcome] : '—'}
                                        {c.expiry_date && <div className="text-muted-foreground text-xs">on record until {formatDate(c.expiry_date)}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <a href={route('erp.hrm.disciplinary.show', c.id)} className="text-primary underline">
                                            Open
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination page={props.cases} />
        </Page>
    );
}
