import { route } from 'ziggy-js';
import ContractForm from '@/components/hrm/contract-form';
import { Card, Empty, Page, secondaryButton, type Options } from '@/components/hrm/ui';

type Props = {
    company: { name: string };
    employees: { id: number; employee_number: string; first_name: string; middle_name: string | null; last_name: string }[];
    templates: { id: number; name: string; contract_type: string; is_default: boolean }[];
    typeOptions: Options;
    payFrequencyOptions: Options;
    defaultCurrency: string;
    employeeId: number | null;
};

export default function ContractCreate(props: Props) {
    const cancel = (
        <a href={route('erp.hrm.contracts.index')} className={secondaryButton}>
            Cancel
        </a>
    );

    return (
        <Page title="New contract" subtitle="Draft the terms. The contract becomes active once the employee and the employer have both signed.">
            {props.employees.length === 0 ? (
                <Empty>
                    Add an employee first.{' '}
                    <a href={route('erp.hrm.employees.create')} className="text-primary underline">
                        New employee
                    </a>
                </Empty>
            ) : (
                <Card title="Contract terms">
                    <ContractForm
                        employees={props.employees}
                        employeeId={props.employeeId}
                        templates={props.templates}
                        typeOptions={props.typeOptions}
                        payFrequencyOptions={props.payFrequencyOptions}
                        defaultCurrency={props.defaultCurrency}
                        submitUrl={route('erp.hrm.contracts.store')}
                        method="post"
                        submitLabel="Save draft"
                        footer={cancel}
                    />
                </Card>
            )}
        </Page>
    );
}
