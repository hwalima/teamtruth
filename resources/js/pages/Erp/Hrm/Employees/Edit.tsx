import EmployeeForm, { type EmployeeFormProps, type EmployeeRecord } from '@/components/hrm/employee-form';
import { Page, personName } from '@/components/hrm/ui';

type Props = Omit<EmployeeFormProps, 'employee'> & { company: { name: string }; employee: EmployeeRecord };

export default function EmployeeEdit(props: Props) {
    return (
        <Page title={`Edit ${personName(props.employee)}`} subtitle={`${props.employee.employee_number} · ${props.company.name}`}>
            <EmployeeForm {...props} />
        </Page>
    );
}
