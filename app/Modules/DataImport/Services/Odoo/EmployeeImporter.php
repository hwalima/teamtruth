<?php

namespace App\Modules\DataImport\Services\Odoo;

use App\Modules\DataImport\Services\ImportContext;
use App\Modules\Hrm\Enums\EmployeeStatus;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Position;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Odoo employees (hr.employee) become HRM employees.
 *
 * Odoo keeps the whole name in one field. It is split by the chosen order:
 * "last_first" reads "Doe Jane" as surname Doe, first name Jane.
 * Job titles become positions and departments are created when missing;
 * positions without a department go under "General". Managers are linked
 * after every row is in, so their order in the file does not matter.
 */
class EmployeeImporter extends OdooImporter
{
    public const MODEL = 'hr.employee';

    private const GENERAL = 'General';

    /** @var array<string, Department> */
    private array $departments = [];

    /** @var array<string, Position> */
    private array $positions = [];

    /** @var array<string, true> codes handed out in this run */
    private array $codes = [];

    private ?string $numberPrefix = null;

    private ?int $lastNumber = null;

    public function model(): string
    {
        return self::MODEL;
    }

    public function label(): string
    {
        return 'Employees';
    }

    public function permissions(): array
    {
        return ['erp.hrm.employee.manage'];
    }

    public function aliases(): array
    {
        return [
            'id' => ['id', 'External ID', 'ID'],
            'name' => ['name', 'Employee Name', 'Name'],
            'job_title' => ['job_title', 'Job Title', 'job_id', 'Job Position'],
            'department' => ['department_id', 'Department'],
            'manager' => ['parent_id', 'Manager'],
            'work_email' => ['work_email', 'Work Email'],
            'private_email' => ['private_email', 'Private Email'],
            'work_phone' => ['work_phone', 'Work Phone'],
            'mobile_phone' => ['mobile_phone', 'Work Mobile', 'Mobile'],
            'private_phone' => ['private_phone', 'Private Phone'],
            'start_date' => ['first_contract_date', 'Contract Start Date', 'First Contract Date', 'Start Date', 'Hire Date'],
            'birthday' => ['birthday', 'Date of Birth', 'Birthday', 'Public Date of Birth'],
            'gender' => ['gender', 'Gender'],
            'marital' => ['marital', 'Marital Status'],
            'nationality' => ['country_id', 'Nationality (Country)', 'Nationality'],
            'national_id' => ['identification_id', 'Identification No', 'National ID'],
            'passport' => ['passport_id', 'Passport No'],
            'bank_account' => ['bank_account_id', 'Bank Account Number', 'Bank Account'],
            'emergency_name' => ['emergency_contact', 'Contact Name', 'Emergency Contact'],
            'emergency_phone' => ['emergency_phone', 'Contact Phone', 'Emergency Phone'],
            'active' => ['active', 'Active'],
        ];
    }

    public function run(ImportContext $context, array $rows, array $columns): void
    {
        $order = $context->option('name_order', 'last_first');
        $sharedEmails = $this->sharedEmails($rows, $columns);
        foreach ($sharedEmails as $email) {
            $context->warn("Every employee shares the work email {$email}, so it was not stored on them.");
        }

        $managers = [];
        $seen = [];
        $withoutStart = 0;

        foreach ($rows as $row) {
            $rowNumber = $row['row_number'];
            $data = $row['data'];
            $fullName = $this->text($data, $columns, 'name');
            if ($fullName === null) {
                $context->row($rowNumber, 'skipped', ['No name.']);

                continue;
            }

            $key = $this->nameKey($fullName);
            if (isset($seen[$key])) {
                $context->row($rowNumber, 'skipped', ["{$fullName} is already on row {$seen[$key]} of this file."]);

                continue;
            }
            $seen[$key] = $rowNumber;

            [$first, $middle, $last] = $this->splitName($fullName, $order);
            $messages = [];
            if ($last === '') {
                $messages[] = 'Only one name was given, so the surname is blank. Add it on the employee.';
            }

            $odooId = $this->text($data, $columns, 'id');
            $existing = $context->find(self::MODEL, $odooId) ?? $context->find(self::MODEL, $key) ?? $this->byName($first, $middle, $last);
            if ($existing && ! $context->option('update_existing', true)) {
                $context->row($rowNumber, 'skipped', ['Already in the HRM as '.$existing->employee_number.'.'], $existing);
                $this->rememberEmployee($context, $existing, $odooId, $key);

                continue;
            }

            $department = $this->department($context, $this->text($data, $columns, 'department', 255));
            $jobTitle = $this->text($data, $columns, 'job_title', 255);
            $position = $jobTitle ? $this->position($context, $jobTitle, $department) : null;

            $start = $this->date($this->value($data, $columns, 'start_date'));
            $details = array_filter([
                'first_name' => mb_substr($first, 0, 255),
                'middle_name' => $middle !== null ? mb_substr($middle, 0, 255) : null,
                'last_name' => mb_substr($last, 0, 255),
                'date_of_birth' => $this->date($this->value($data, $columns, 'birthday'))?->toDateString(),
                'gender' => $this->gender($this->text($data, $columns, 'gender')),
                'marital_status' => $this->marital($this->text($data, $columns, 'marital')),
                'nationality' => $this->text($data, $columns, 'nationality', 255),
                'national_id' => $this->text($data, $columns, 'national_id', 255),
                'passport_number' => $this->text($data, $columns, 'passport', 255),
                'bank_account_number' => $this->text($data, $columns, 'bank_account', 255),
                'emergency_contact_name' => $this->text($data, $columns, 'emergency_name', 255),
                'emergency_contact_phone' => $this->text($data, $columns, 'emergency_phone', 255),
                'personal_email' => $this->email($this->text($data, $columns, 'private_email'))
                    ?? $this->email($this->text($data, $columns, 'work_email'), $sharedEmails),
                'personal_phone' => $this->text($data, $columns, 'mobile_phone', 255)
                    ?? $this->text($data, $columns, 'private_phone', 255)
                    ?? $this->text($data, $columns, 'work_phone', 255),
                'department_id' => $position?->department_id ?? $department?->id,
                'position_id' => $position?->id,
                'hire_date' => $start?->toDateString(),
            ], fn ($value) => $value !== null);

            if ($this->flag($data, $columns, 'active', true) === false) {
                $details['status'] = EmployeeStatus::Inactive->value;
            }

            if ($existing) {
                $employee = $this->updateEmployee($context, $existing, $details);
                $action = 'updated';
            } else {
                if ($start === null) {
                    $withoutStart++;
                    $messages[] = 'Odoo has no start date for this employee, so the hire date is set to today. Correct it on the employee.';
                }
                $employee = $this->createEmployee($context, $details);
                $context->created('employees', trim("{$employee->first_name} {$employee->last_name}"), $employee);
                $action = 'created';
            }

            $this->rememberEmployee($context, $employee, $odooId, $key);
            $manager = $this->text($data, $columns, 'manager');
            if ($manager !== null) {
                $managers[$rowNumber] = [$employee, $manager];
            }

            $position && $messages[] = "Position: {$position->name}.";
            $context->add($action === 'created' ? 'employees created' : 'employees updated');
            $context->row($rowNumber, $action, $messages, $employee);
        }

        if ($withoutStart > 0) {
            $context->warn("{$withoutStart} employee(s) have no start date in Odoo; their hire date is set to today. Correct it on each employee, or export \"Contract Start Date\" from Odoo.");
        }

        $this->linkManagers($context, $managers, $order);
    }

    /** "Banda Sam Lee" → [Jane, Ann, Doe] when the surname comes first. @return array{string, ?string, string} */
    public function splitName(string $name, string $order = 'last_first'): array
    {
        $parts = preg_split('/\s+/u', trim($name)) ?: [];
        if (count($parts) === 1) {
            return [$parts[0], null, ''];
        }

        if ($order === 'first_last') {
            $first = array_shift($parts);
            $last = array_pop($parts);
        } else {
            $last = array_shift($parts);
            $first = array_shift($parts);
        }

        return [$first, $parts === [] ? null : implode(' ', $parts), $last];
    }

    private function createEmployee(ImportContext $context, array $details): Employee
    {
        $employee = Employee::query()->create([
            'status' => EmployeeStatus::Active->value,
            'hire_date' => now()->toDateString(),
            ...$details,
            'employee_number' => $this->nextNumber($context),
            'created_by' => $context->user->id,
            'updated_by' => $context->user->id,
        ]);

        if ($employee->position_id && $employee->status === EmployeeStatus::Active) {
            Position::query()->whereKey($employee->position_id)->increment('headcount_current');
        }

        return $employee;
    }

    private function updateEmployee(ImportContext $context, Employee $employee, array $details): Employee
    {
        $oldPosition = $employee->position_id;
        $employee->fill([...$details, 'updated_by' => $context->user->id])->save();

        if ($oldPosition !== $employee->position_id && $employee->status === EmployeeStatus::Active) {
            if ($oldPosition) {
                Position::query()->whereKey($oldPosition)->where('headcount_current', '>', 0)->decrement('headcount_current');
            }
            if ($employee->position_id) {
                Position::query()->whereKey($employee->position_id)->increment('headcount_current');
            }
        }

        return $employee;
    }

    /** Odoo names managers by their full name. */
    private function linkManagers(ImportContext $context, array $managers, string $order): void
    {
        foreach ($managers as $rowNumber => [$employee, $managerName]) {
            $manager = $context->find(self::MODEL, $this->nameKey($managerName));
            if (! $manager) {
                [$first, $middle, $last] = $this->splitName($managerName, $order);
                $manager = $this->byName($first, $middle, $last);
            }

            if (! $manager || $manager->is($employee)) {
                $context->row($rowNumber, $context->rows[$rowNumber]['action'], ["The manager \"{$managerName}\" was not found, so no line manager was set."]);

                continue;
            }

            $employee->forceFill(['line_manager_id' => $manager->id])->save();
            $context->row($rowNumber, $context->rows[$rowNumber]['action'], ["Reports to {$manager->first_name} {$manager->last_name}."]);
        }
    }

    private function rememberEmployee(ImportContext $context, Employee $employee, ?string $odooId, string $key): void
    {
        $context->remember(self::MODEL, $odooId, $employee);
        $context->remember(self::MODEL, $key, $employee);
    }

    private function byName(string $first, ?string $middle, string $last): ?Employee
    {
        return Employee::query()
            ->whereRaw('lower(first_name) = ?', [mb_strtolower($first)])
            ->whereRaw('lower(last_name) = ?', [mb_strtolower($last)])
            ->when($middle !== null, fn ($query) => $query->whereRaw('lower(coalesce(middle_name, \'\')) = ?', [mb_strtolower($middle)]))
            ->orderBy('id')
            ->first();
    }

    private function department(ImportContext $context, ?string $name): ?Department
    {
        if ($name === null) {
            return null;
        }
        // Odoo writes nested departments as "Mining / Plant".
        $name = trim((string) last(explode(' / ', $name)));
        $key = OdooSheet::key($name);

        return $this->departments[$key] ??= Department::query()->whereRaw('lower(name) = ?', [$key])->first()
            ?? $this->createDepartment($context, $name);
    }

    private function createDepartment(ImportContext $context, string $name): Department
    {
        $department = Department::query()->create([
            'name' => $name,
            'code' => $this->code(Department::class, $name),
            'is_active' => true,
            'created_by' => $context->user->id,
            'updated_by' => $context->user->id,
        ]);
        $context->created('departments', $department->name, $department);

        return $department;
    }

    private function position(ImportContext $context, string $title, ?Department $department): Position
    {
        $key = OdooSheet::key($title);
        if (isset($this->positions[$key])) {
            return $this->positions[$key];
        }

        $position = Position::query()->whereRaw('lower(name) = ?', [$key])
            ->when($department, fn ($query) => $query->orderByRaw('department_id = ? desc', [$department->id]))
            ->first();

        if (! $position) {
            $department ??= $this->department($context, self::GENERAL);
            $position = Position::query()->create([
                'department_id' => $department->id,
                'name' => $title,
                'code' => $this->code(Position::class, $title),
                'headcount_planned' => 0,
                'headcount_current' => 0,
                'is_active' => true,
                'created_by' => $context->user->id,
                'updated_by' => $context->user->id,
            ]);
            $context->created('positions', $position->name, $position);
        }

        return $this->positions[$key] = $position;
    }

    /** "Plant Operator" → PLANTOPERATOR, then PLANTOPERATO2… while taken. @param class-string<Model> $class */
    private function code(string $class, string $name): string
    {
        $base = substr(preg_replace('/[^A-Z0-9]/', '', strtoupper(Str::ascii($name))) ?: 'X', 0, 14);
        for ($n = 1; ; $n++) {
            $code = $n === 1 ? $base : substr($base, 0, 14 - strlen((string) $n)).$n;
            if (! isset($this->codes[$class.$code]) && ! $class::query()->where('code', $code)->exists()) {
                $this->codes[$class.$code] = true;

                return $code;
            }
        }
    }

    /** Same numbering as employees added by hand: PREFIX-0001. */
    private function nextNumber(ImportContext $context): string
    {
        if ($this->numberPrefix === null) {
            $company = $context->company;
            $prefix = preg_replace('/[^A-Z]/', '', strtoupper((string) ($company->code ?: $company->name))) ?: 'EMP';
            $this->numberPrefix = substr($prefix, 0, 6);
            $this->lastNumber = (int) Employee::withTrashed()
                ->where('employee_number', 'like', $this->numberPrefix.'-%')
                ->pluck('employee_number')
                ->map(fn (string $number) => (int) substr($number, strlen($this->numberPrefix) + 1))
                ->max();
        }

        return sprintf('%s-%04d', $this->numberPrefix, ++$this->lastNumber);
    }

    /** Work emails used by more than one row (a shared admin mailbox). @return list<string> */
    private function sharedEmails(array $rows, array $columns): array
    {
        $counts = [];
        foreach ($rows as $row) {
            $email = $this->text($row['data'], $columns, 'work_email');
            if ($email !== null) {
                $email = mb_strtolower($email);
                $counts[$email] = ($counts[$email] ?? 0) + 1;
            }
        }

        return array_keys(array_filter($counts, fn ($count) => $count > 1));
    }

    private function email(?string $email, array $shared = []): ?string
    {
        if ($email === null || in_array(mb_strtolower($email), $shared, true)) {
            return null;
        }

        return filter_var($email, FILTER_VALIDATE_EMAIL) ? mb_substr($email, 0, 255) : null;
    }

    /** Excel serial numbers or written dates; anything else ("hidden") is ignored. */
    private function date(mixed $value): ?CarbonImmutable
    {
        if ($value === null || $value === '' || is_bool($value)) {
            return null;
        }

        try {
            if (is_numeric($value)) {
                $date = CarbonImmutable::instance(ExcelDate::excelToDateTimeObject((float) $value));
            } elseif (preg_match('/\d/', (string) $value)) {
                $date = CarbonImmutable::parse((string) $value);
            } else {
                return null;
            }
        } catch (\Throwable) {
            return null;
        }

        return $date->year >= 1900 && $date->year <= 2100 ? $date->startOfDay() : null;
    }

    private function gender(?string $gender): ?string
    {
        return match (mb_strtolower((string) $gender)) {
            'male', 'm' => 'male',
            'female', 'f' => 'female',
            'other' => 'other',
            default => null,
        };
    }

    private function marital(?string $status): ?string
    {
        return match (mb_strtolower((string) $status)) {
            'single' => 'single',
            'married', 'cohabitant', 'legal cohabitant' => 'married',
            'divorced' => 'divorced',
            'widower', 'widowed', 'widow' => 'widowed',
            default => null,
        };
    }
}
