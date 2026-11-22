import { router } from '@inertiajs/react';
import { route } from 'ziggy-js';
import CrudList from '@/components/hrm/crud-list';
import { Select, formatDate, toDateInput } from '@/components/hrm/ui';

type Holiday = { id: number; name: string; date: string; is_recurring: boolean; description: string | null };

type Props = {
    company: { name: string };
    holidays: Holiday[];
    years: number[];
    year: number;
    canManage: boolean;
};

export default function HolidaysIndex(props: Props) {
    return (
        <CrudList
            title="Public holidays"
            subtitle={`Holidays are skipped when counting leave days · ${props.company.name}`}
            noun="holiday"
            records={props.holidays}
            canManage={props.canManage}
            routes={{
                store: route('erp.hrm.leave.holidays.store'),
                update: (id) => route('erp.hrm.leave.holidays.update', id),
                destroy: (id) => route('erp.hrm.leave.holidays.destroy', id),
            }}
            defaults={{ name: '', date: '', is_recurring: false, description: '' }}
            toForm={(h) => ({ name: h.name, date: toDateInput(h.date), is_recurring: h.is_recurring, description: h.description ?? '' })}
            fields={[
                { name: 'name', label: 'Name *' },
                { name: 'date', label: 'Date *', type: 'date' },
                { name: 'is_recurring', label: 'Repeats every year', type: 'checkbox' },
                { name: 'description', label: 'Description', type: 'textarea', wide: true },
            ]}
            headerActions={
                <div className="w-32">
                    <Select
                        value={props.year}
                        onChange={(year) => router.get(route('erp.hrm.leave.holidays.index'), { year }, { preserveState: true })}
                        options={props.years.map((y) => ({ value: y, label: String(y) }))}
                    />
                </div>
            }
            columns={[
                { label: 'Date', render: (h) => (h.is_recurring ? new Date(`${toDateInput(h.date)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : formatDate(h.date)) },
                { label: 'Holiday', render: (h) => <span className="font-medium">{h.name}</span> },
                { label: 'Repeats', render: (h) => (h.is_recurring ? 'Every year' : 'Once') },
                { label: 'Notes', render: (h) => h.description ?? '—' },
            ]}
        />
    );
}
