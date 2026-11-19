<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Enums\ContractType;
use App\Modules\Hrm\Enums\EmploymentStatus;
use App\Modules\Hrm\Enums\Gender;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\EmployeeDocument;
use App\Modules\Hrm\Models\Grade;
use App\Modules\Hrm\Models\Position;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EmployeeService
{
    public function __construct(
        private CompanyContext $companyContext,
    ) {}

    /**
     * Create a new employee
     */
    public function createEmployee(User $actor, array $data): Employee
    {
        $company = $this->companyContext->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data) {
            // Validate department
            if (! empty($data['department_id'])) {
                Department::where('company_id', $company->id)
                    ->where('id', $data['department_id'])
                    ->firstOrFail();
            }

            // Validate position
            if (! empty($data['position_id'])) {
                $position = Position::where('company_id', $company->id)
                    ->where('id', $data['position_id'])
                    ->firstOrFail();

                // Validate grade matches position if provided
                if (! empty($data['grade_id'])) {
                    $grade = Grade::where('company_id', $company->id)
                        ->where('id', $data['grade_id'])
                        ->firstOrFail();

                    if ($position->grade_id && $position->grade_id !== $grade->id) {
                        throw ValidationException::withMessages([
                            'grade_id' => 'The selected grade does not match the position grade.',
                        ]);
                    }
                }
            }

            // Validate grade
            if (! empty($data['grade_id'])) {
                Grade::where('company_id', $company->id)
                    ->where('id', $data['grade_id'])
                    ->firstOrFail();
            }

            // Validate cost center
            if (! empty($data['cost_center_id'])) {
                \App\Modules\Hrm\Models\CostCenter::where('company_id', $company->id)
                    ->where('id', $data['cost_center_id'])
                    ->firstOrFail();
            }

            // Validate manager
            if (! empty($data['manager_id'])) {
                $manager = Employee::where('company_id', $company->id)
                    ->where('id', $data['manager_id'])
                    ->firstOrFail();

                if ($manager->user_id && $manager->user_id === $data['user_id']) {
                    throw ValidationException::withMessages([
                        'manager_id' => 'An employee cannot be their own manager.',
                    ]);
                }
            }

            // Validate user if provided
            if (! empty($data['user_id'])) {
                $user = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))
                    ->where('id', $data['user_id'])
                    ->firstOrFail();

                // Check if user already has an employee record
                $existing = Employee::where('company_id', $company->id)
                    ->where('user_id', $user->id)
                    ->first();

                if ($existing) {
                    throw ValidationException::withMessages([
                        'user_id' => 'This user already has an employee record.',
                    ]);
                }
            }

            // Generate employee number
            $employeeNumber = $this->generateEmployeeNumber($company);

            $employee = Employee::query()->create([
                'company_id' => $company->id,
                'employee_number' => $employeeNumber,
                'user_id' => $data['user_id'] ?? null,
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'gender' => $data['gender'] ?? Gender::Male,
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'national_id' => $data['national_id'] ?? null,
                'passport_number' => $data['passport_number'] ?? null,
                'phone' => $data['phone'] ?? null,
                'personal_email' => $data['personal_email'] ?? null,
                'work_email' => $data['work_email'] ?? null,
                'address' => $data['address'] ?? null,
                'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
                'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
                'emergency_contact_relationship' => $data['emergency_contact_relationship'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'bank_account_name' => $data['bank_account_name'] ?? null,
                'bank_account_number' => $data['bank_account_number'] ?? null,
                'bank_branch' => $data['bank_branch'] ?? null,
                'bank_swift_code' => $data['bank_swift_code'] ?? null,
                'tax_number' => $data['tax_number'] ?? null,
                'social_security_number' => $data['social_security_number'] ?? null,
                'pension_number' => $data['pension_number'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'position_id' => $data['position_id'] ?? null,
                'grade_id' => $data['grade_id'] ?? null,
                'cost_center_id' => $data['cost_center_id'] ?? null,
                'manager_id' => $data['manager_id'] ?? null,
                'employment_status' => $data['employment_status'] ?? EmploymentStatus::Active,
                'employment_type' => $data['employment_type'] ?? ContractType::Permanent,
                'hire_date' => $data['hire_date'] ?? now()->toDateString(),
                'probation_end_date' => $data['probation_end_date'] ?? null,
                'confirmation_date' => $data['confirmation_date'] ?? null,
                'termination_date' => null,
                'termination_reason' => null,
                'notice_period_days' => $data['notice_period_days'] ?? 30,
                'annual_leave_entitlement' => $data['annual_leave_entitlement'] ?? 21,
                'work_schedule' => $data['work_schedule'] ?? ['monday' => true, 'tuesday' => true, 'wednesday' => true, 'thursday' => true, 'friday' => true, 'saturday' => false, 'sunday' => false],
                'overtime_eligible' => $data['overtime_eligible'] ?? true,
                'metadata' => $data['metadata'] ?? null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            // Update position headcount
            if ($employee->position_id) {
                $position = Position::find($employee->position_id);
                if ($position) {
                    $position->increment('headcount_current');
                }
            }

            return $employee->load(['department', 'position', 'grade', 'costCenter', 'manager', 'user']);
        });
    }

    /**
     * Update an employee
     */
    public function updateEmployee(User $actor, Employee $employee, array $data): Employee
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $employee->company_id !== (int) $company->id) {
            throw new AuthorizationException('Employee belongs to a different company.');
        }

        return DB::transaction(function () use ($company, $actor, $employee, $data) {
            // Validate department
            if (isset($data['department_id'])) {
                if ($data['department_id']) {
                    Department::where('company_id', $company->id)
                        ->where('id', $data['department_id'])
                        ->firstOrFail();
                }
            }

            // Validate position
            $oldPositionId = $employee->position_id;
            if (isset($data['position_id'])) {
                if ($data['position_id']) {
                    $position = Position::where('company_id', $company->id)
                        ->where('id', $data['position_id'])
                        ->firstOrFail();

                    // Validate grade matches position if provided
                    $gradeId = $data['grade_id'] ?? $employee->grade_id;
                    if ($gradeId) {
                        $grade = Grade::where('company_id', $company->id)
                            ->where('id', $gradeId)
                            ->firstOrFail();

                        if ($position->grade_id && $position->grade_id !== $grade->id) {
                            throw ValidationException::withMessages([
                                'grade_id' => 'The selected grade does not match the position grade.',
                            ]);
                        }
                    }
                }
            }

            // Validate grade
            if (isset($data['grade_id']) && $data['grade_id']) {
                Grade::where('company_id', $company->id)
                    ->where('id', $data['grade_id'])
                    ->firstOrFail();
            }

            // Validate cost center
            if (isset($data['cost_center_id']) && $data['cost_center_id']) {
                \App\Modules\Hrm\Models\CostCenter::where('company_id', $company->id)
                    ->where('id', $data['cost_center_id'])
                    ->firstOrFail();
            }

            // Validate manager
            if (isset($data['manager_id'])) {
                if ($data['manager_id']) {
                    $manager = Employee::where('company_id', $company->id)
                        ->where('id', $data['manager_id'])
                        ->firstOrFail();

                    if ($manager->user_id && $manager->user_id === ($data['user_id'] ?? $employee->user_id)) {
                        throw ValidationException::withMessages([
                            'manager_id' => 'An employee cannot be their own manager.',
                        ]);
                    }

                    // Prevent circular reporting
                    if ($this->wouldCreateCircularReporting($employee->id, $manager->id)) {
                        throw ValidationException::withMessages([
                            'manager_id' => 'This would create a circular reporting structure.',
                        ]);
                    }
                }
            }

            // Validate user
            if (isset($data['user_id']) && $data['user_id']) {
                $user = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))
                    ->where('id', $data['user_id'])
                    ->firstOrFail();

                $existing = Employee::where('company_id', $company->id)
                    ->where('user_id', $user->id)
                    ->where('id', '!=', $employee->id)
                    ->first();

                if ($existing) {
                    throw ValidationException::withMessages([
                        'user_id' => 'This user already has an employee record.',
                    ]);
                }
            }

            // Handle position change
            $newPositionId = $data['position_id'] ?? $employee->position_id;
            if ($oldPositionId !== $newPositionId) {
                if ($oldPositionId) {
                    Position::where('id', $oldPositionId)->decrement('headcount_current');
                }
                if ($newPositionId) {
                    Position::where('id', $newPositionId)->increment('headcount_current');
                }
            }

            $employee->update(array_merge($data, [
                'updated_by' => $actor->id,
            ]));

            return $employee->fresh()->load(['department', 'position', 'grade', 'costCenter', 'manager', 'user']);
        });
    }

    /**
     * Terminate an employee
     */
    public function terminateEmployee(User $actor, Employee $employee, array $data): Employee
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $employee->company_id !== (int) $company->id) {
            throw new AuthorizationException('Employee belongs to a different company.');
        }

        if (! $employee->canBeTerminated()) {
            throw ValidationException::withMessages([
                'employee' => 'This employee cannot be terminated.',
            ]);
        }

        return DB::transaction(function () use ($actor, $employee, $data) {
            $employee->update([
                'employment_status' => EmploymentStatus::Terminated,
                'termination_date' => $data['termination_date'] ?? now()->toDateString(),
                'termination_reason' => $data['termination_reason'] ?? null,
                'updated_by' => $actor->id,
            ]);

            // Decrement position headcount
            if ($employee->position_id) {
                Position::where('id', $employee->position_id)->decrement('headcount_current');
            }

            return $employee->fresh();
        });
    }

    /**
     * Rehire a terminated employee
     */
    public function rehireEmployee(User $actor, Employee $employee, array $data): Employee
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $employee->company_id !== (int) $company->id) {
            throw new AuthorizationException('Employee belongs to a different company.');
        }

        if ($employee->employment_status !== EmploymentStatus::Terminated) {
            throw ValidationException::withMessages([
                'employee' => 'Only terminated employees can be rehired.',
            ]);
        }

        return DB::transaction(function () use ($actor, $employee, $data) {
            $employee->update([
                'employment_status' => EmploymentStatus::Active,
                'termination_date' => null,
                'termination_reason' => null,
                'rehire_date' => $data['rehire_date'] ?? now()->toDateString(),
                'updated_by' => $actor->id,
            ]);

            // Increment position headcount
            if ($employee->position_id) {
                Position::where('id', $employee->position_id)->increment('headcount_current');
            }

            return $employee->fresh();
        });
    }

    /**
     * Upload employee document
     */
    public function uploadDocument(User $actor, Employee $employee, array $data): EmployeeDocument
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $employee->company_id !== (int) $company->id) {
            throw new AuthorizationException('Employee belongs to a different company.');
        }

        return DB::transaction(function () use ($actor, $employee, $data) {
            $document = EmployeeDocument::query()->create([
                'company_id' => $company->id,
                'employee_id' => $employee->id,
                'document_type' => $data['document_type'],
                'name' => $data['name'],
                'file_path' => $data['file_path'],
                'file_size' => $data['file_size'] ?? null,
                'mime_type' => $data['mime_type'] ?? null,
                'issued_at' => $data['issued_at'] ?? null,
                'expires_at' => $data['expires_at'] ?? null,
                'is_verified' => $data['is_verified'] ?? false,
                'verified_by' => $data['is_verified'] ? $actor->id : null,
                'verified_at' => $data['is_verified'] ? now() : null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            return $document;
        });
    }

    /**
     * Update employee document
     */
    public function updateDocument(User $actor, EmployeeDocument $document, array $data): EmployeeDocument
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $document->company_id !== (int) $company->id) {
            throw new AuthorizationException('Document belongs to a different company.');
        }

        $document->update(array_merge($data, [
            'updated_by' => $actor->id,
            'verified_by' => ($data['is_verified'] ?? false) ? $actor->id : ($document->is_verified ? $document->verified_by : null),
            'verified_at' => ($data['is_verified'] ?? false) ? now() : ($document->is_verified ? $document->verified_at : null),
        ]));

        return $document->fresh();
    }

    /**
     * Delete employee document
     */
    public function deleteDocument(User $actor, EmployeeDocument $document): void
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $document->company_id !== (int) $company->id) {
            throw new AuthorizationException('Document belongs to a different company.');
        }

        $document->delete();
    }

    /**
     * Generate unique employee number
     */
    private function generateEmployeeNumber(\App\Modules\Core\Models\Company $company): string
    {
        $prefix = strtoupper(substr($company->name, 0, 3));
        $prefix = preg_replace('/[^A-Z]/', '', $prefix) ?? 'EMP';

        $lastNumber = Employee::where('company_id', $company->id)
            ->where('employee_number', 'like', $prefix . '-%')
            ->latest('employee_number')
            ->value('employee_number');

        if ($lastNumber) {
            $num = (int) substr($lastNumber, strlen($prefix) + 1) + 1;
        } else {
            $num = 1;
        }

        return sprintf('%s-%04d', $prefix, $num);
    }

    /**
     * Check for circular reporting
     */
    private function wouldCreateCircularReporting(int $employeeId, int $managerId): bool
    {
        $visited = [];
        $currentId = $managerId;

        while ($currentId) {
            if ($currentId === $employeeId) {
                return true;
            }

            if (in_array($currentId, $visited)) {
                return true; // Existing circular reference
            }

            $visited[] = $currentId;

            $manager = Employee::where('id', $currentId)->value('manager_id');
            $currentId = $manager ?? 0;
        }

        return false;
    }

    /**
     * Get employee with all relations
     */
    public function getEmployeeWithRelations(int $employeeId): ?Employee
    {
        $company = $this->companyContext->requireActiveCompany();

        return Employee::where('company_id', $company->id)
            ->with([
                'department',
                'position',
                'grade',
                'costCenter',
                'manager',
                'user',
                'documents',
                'contracts' => fn ($q) => $q->latest(),
                'leaveBalances.leaveType',
                'leaveRequests' => fn ($q) => $q->latest()->limit(10),
                'disciplinaryCases' => fn ($q) => $q->latest()->limit(5),
                'selfServiceRequests' => fn ($q) => $q->latest()->limit(10),
                'transfers' => fn ($q) => $q->latest()->limit(5),
            ])
            ->find($employeeId);
    }

    /**
     * Search employees
     */
    public function searchEmployees(array $filters, int $perPage = 15)
    {
        $company = $this->companyContext->requireActiveCompany();

        $query = Employee::where('company_id', $company->id)
            ->with(['department', 'position', 'grade', 'manager', 'user']);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_number', 'like', "%{$search}%")
                    ->orWhere('work_email', 'like', "%{$search}%")
                    ->orWhere('national_id', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['department_id'])) {
            $query->where('department_id', $filters['department_id']);
        }

        if (! empty($filters['position_id'])) {
            $query->where('position_id', $filters['position_id']);
        }

        if (! empty($filters['employment_status'])) {
            $query->where('employment_status', $filters['employment_status']);
        }

        if (! empty($filters['employment_type'])) {
            $query->where('employment_type', $filters['employment_type']);
        }

        if (! empty($filters['grade_id'])) {
            $query->where('grade_id', $filters['grade_id']);
        }

        if (! empty($filters['cost_center_id'])) {
            $query->where('cost_center_id', $filters['cost_center_id']);
        }

        return $query->orderBy('last_name')->orderBy('first_name')->paginate($perPage);
    }
}