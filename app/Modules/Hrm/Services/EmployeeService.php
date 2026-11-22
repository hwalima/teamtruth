<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Enums\EmployeeStatus;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\EmployeeDocument;
use App\Modules\Hrm\Models\Position;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EmployeeService
{
    /** Columns a form may write on hrm_employees. */
    public const FIELDS = [
        'user_id', 'first_name', 'middle_name', 'last_name', 'gender', 'date_of_birth',
        'marital_status', 'nationality', 'national_id', 'passport_number',
        'personal_email', 'personal_phone',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
        'bank_name', 'bank_account_name', 'bank_account_number', 'bank_branch',
        'tax_number', 'nssa_number', 'status', 'hire_date',
        'line_manager_id', 'department_id', 'position_id', 'grade_id', 'cost_center_id',
    ];

    public function __construct(
        private CompanyContext $companyContext,
    ) {}

    public function createEmployee(User $actor, array $data): Employee
    {
        $company = $this->companyContext->requireActiveCompany();
        $data = array_intersect_key($data, array_flip(self::FIELDS));

        $this->assertUserIsFree($company, $data['user_id'] ?? null, null);

        return DB::transaction(function () use ($company, $actor, $data) {
            $employee = Employee::query()->create([
                ...$data,
                'employee_number' => $this->generateEmployeeNumber($company),
                'status' => $data['status'] ?? EmployeeStatus::Active->value,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            if ($employee->position_id) {
                Position::whereKey($employee->position_id)->increment('headcount_current');
            }

            return $employee;
        });
    }

    public function updateEmployee(User $actor, Employee $employee, array $data): Employee
    {
        $company = $this->companyContext->requireActiveCompany();
        $data = array_intersect_key($data, array_flip(self::FIELDS));

        $this->assertUserIsFree($company, $data['user_id'] ?? null, $employee->id);

        if (! empty($data['line_manager_id']) && $this->wouldCreateCircularReporting($employee->id, (int) $data['line_manager_id'])) {
            throw ValidationException::withMessages([
                'line_manager_id' => 'This would create a circular reporting line.',
            ]);
        }

        return DB::transaction(function () use ($actor, $employee, $data) {
            $oldPositionId = $employee->position_id;

            $employee->update([...$data, 'updated_by' => $actor->id]);

            if ((int) $oldPositionId !== (int) $employee->position_id) {
                if ($oldPositionId) {
                    Position::whereKey($oldPositionId)->where('headcount_current', '>', 0)->decrement('headcount_current');
                }
                if ($employee->position_id) {
                    Position::whereKey($employee->position_id)->increment('headcount_current');
                }
            }

            return $employee->fresh();
        });
    }

    public function terminateEmployee(User $actor, Employee $employee, array $data): Employee
    {
        if (! $employee->canBeTerminated()) {
            throw ValidationException::withMessages(['employee' => 'This employee is already terminated.']);
        }

        return DB::transaction(function () use ($actor, $employee, $data) {
            $employee->update([
                'status' => EmployeeStatus::Terminated,
                'termination_date' => $data['termination_date'] ?? now()->toDateString(),
                'termination_reason' => $data['termination_reason'] ?? null,
                'updated_by' => $actor->id,
            ]);

            if ($employee->position_id) {
                Position::whereKey($employee->position_id)->where('headcount_current', '>', 0)->decrement('headcount_current');
            }

            return $employee->fresh();
        });
    }

    public function rehireEmployee(User $actor, Employee $employee, array $data): Employee
    {
        if ($employee->status !== EmployeeStatus::Terminated) {
            throw ValidationException::withMessages(['employee' => 'Only terminated employees can be rehired.']);
        }

        return DB::transaction(function () use ($actor, $employee, $data) {
            $employee->update([
                'status' => EmployeeStatus::Active,
                'hire_date' => $data['rehire_date'] ?? now()->toDateString(),
                'termination_date' => null,
                'termination_reason' => null,
                'updated_by' => $actor->id,
            ]);

            if ($employee->position_id) {
                Position::whereKey($employee->position_id)->increment('headcount_current');
            }

            return $employee->fresh();
        });
    }

    /**
     * Removes an employee added by mistake. One with HR history (contracts,
     * leave, cases) is kept: terminate them instead, so the history stays.
     */
    public function deleteEmployee(User $actor, Employee $employee): void
    {
        $history = $employee->historyLabels();
        if ($history !== []) {
            throw ValidationException::withMessages([
                'employee' => $employee->full_name.' has '.implode(', ', $history).' on record, so they cannot be deleted. Terminate them instead to keep that history.',
            ]);
        }

        DB::transaction(function () use ($actor, $employee): void {
            Employee::query()->where('line_manager_id', $employee->id)->update(['line_manager_id' => null]);
            Department::query()->where('head_id', $employee->id)->update(['head_id' => null]);
            if ($employee->position_id && $employee->status === EmployeeStatus::Active) {
                Position::whereKey($employee->position_id)->where('headcount_current', '>', 0)->decrement('headcount_current');
            }
            $employee->forceFill(['updated_by' => $actor->id])->save();
            $employee->delete();
        });
    }

    public function uploadDocument(User $actor, Employee $employee, array $data): EmployeeDocument
    {
        return EmployeeDocument::query()->create([
            'employee_id' => $employee->id,
            'document_type' => $data['document_type'],
            'document_number' => $data['document_number'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'file_path' => $data['file_path'],
            'file_mime' => $data['file_mime'] ?? null,
            'file_size' => $data['file_size'] ?? null,
            'issued_date' => $data['issued_date'] ?? null,
            'expiry_date' => $data['expiry_date'] ?? null,
            'created_by' => $actor->id,
            'updated_by' => $actor->id,
        ]);
    }

    public function deleteDocument(User $actor, EmployeeDocument $document): void
    {
        $document->delete();
    }

    public function getEmployeeWithRelations(int $employeeId): ?Employee
    {
        return Employee::query()
            ->with([
                'department:id,name,code',
                'position:id,name,code',
                'grade:id,name,code',
                'costCenter:id,name,code',
                'lineManager:id,employee_number,first_name,last_name,middle_name',
                'user:id,name,email',
                'documents' => fn ($q) => $q->latest(),
                'contracts' => fn ($q) => $q->latest('start_date'),
                'leaveBalances' => fn ($q) => $q->with('leaveType:id,name,code,color')->latest('period_start'),
                'leaveRequests' => fn ($q) => $q->with('leaveType:id,name,code,color')->latest()->limit(10),
                'disciplinaryCases' => fn ($q) => $q->latest()->limit(5),
                'selfServiceRequests' => fn ($q) => $q->latest()->limit(10),
            ])
            ->find($employeeId);
    }

    public function searchEmployees(array $filters, int $perPage = 20)
    {
        $query = Employee::query()
            ->with(['department:id,name', 'position:id,name', 'grade:id,name', 'lineManager:id,first_name,last_name,middle_name', 'user:id,name,email']);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_number', 'like', "%{$search}%")
                    ->orWhere('personal_email', 'like', "%{$search}%")
                    ->orWhere('national_id', 'like', "%{$search}%");
            });
        }

        foreach (['department_id', 'position_id', 'grade_id', 'cost_center_id', 'status'] as $column) {
            if (! empty($filters[$column])) {
                $query->where($column, $filters[$column]);
            }
        }

        return $query->orderBy('last_name')->orderBy('first_name')->paginate($perPage)->withQueryString();
    }

    private function assertUserIsFree(Company $company, mixed $userId, ?int $ignoreEmployeeId): void
    {
        if (empty($userId)) {
            return;
        }

        $taken = Employee::query()
            ->where('user_id', $userId)
            ->when($ignoreEmployeeId, fn ($q) => $q->whereKeyNot($ignoreEmployeeId))
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages(['user_id' => 'This user already has an employee record.']);
        }
    }

    private function generateEmployeeNumber(Company $company): string
    {
        $prefix = preg_replace('/[^A-Z]/', '', strtoupper((string) ($company->code ?: $company->name))) ?: 'EMP';
        $prefix = substr($prefix, 0, 6);

        $numbers = Employee::withTrashed()
            ->where('employee_number', 'like', $prefix.'-%')
            ->pluck('employee_number')
            ->map(fn (string $number) => (int) substr($number, strlen($prefix) + 1));

        return sprintf('%s-%04d', $prefix, ($numbers->max() ?? 0) + 1);
    }

    private function wouldCreateCircularReporting(int $employeeId, int $managerId): bool
    {
        $visited = [];
        $currentId = $managerId;

        while ($currentId) {
            if ($currentId === $employeeId || in_array($currentId, $visited, true)) {
                return true;
            }

            $visited[] = $currentId;
            $currentId = (int) Employee::query()->whereKey($currentId)->value('line_manager_id');
        }

        return false;
    }
}
