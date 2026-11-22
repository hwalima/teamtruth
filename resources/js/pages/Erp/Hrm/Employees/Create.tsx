import EmployeeForm, { type EmployeeFormProps } from '@/components/hrm/employee-form';
import { Page } from '@/components/hrm/ui';

type Props = Omit<EmployeeFormProps, 'employee'> & { company: { name: string } };

export default function EmployeeCreate(props: Props) {
    return (
        <Page title="New employee" subtitle={props.company.name}>
            <EmployeeForm {...props} employee={null} />
        </Page>
    );
}
