<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Enums\ContractStatus;
use App\Modules\Hrm\Enums\ContractType;
use App\Modules\Hrm\Models\Contract;
use App\Modules\Hrm\Models\ContractTemplate;
use App\Modules\Hrm\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ContractService
{
    public function __construct(
        private CompanyContext $companyContext,
    ) {}

    /**
     * Create a new contract from template or custom data
     */
    public function createContract(User $actor, array $data): Contract
    {
        $company = $this->companyContext->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data) {
            // Validate employee
            $employee = Employee::where('company_id', $company->id)
                ->where('id', $data['employee_id'])
                ->firstOrFail();

            // Validate template if provided
            $template = null;
            if (! empty($data['template_id'])) {
                $template = ContractTemplate::where('company_id', $company->id)
                    ->where('id', $data['template_id'])
                    ->firstOrFail();

                if (! $template->is_active) {
                    throw ValidationException::withMessages(['template_id' => 'The selected template is not active.']);
                }
            }

            // Check for overlapping active contracts
            $overlapping = Contract::where('employee_id', $employee->id)
                ->whereIn('status', [ContractStatus::Active, ContractStatus::PendingSignature])
                ->where(function ($q) use ($data) {
                    $q->whereBetween('start_date', [$data['start_date'], $data['end_date'] ?? '9999-12-31'])
                        ->orWhere(function ($q2) use ($data) {
                            $q2->where('start_date', '<=', $data['start_date'])
                                ->where(function ($q3) use ($data) {
                                    $q3->whereNull('end_date')
                                        ->orWhere('end_date', '>=', $data['start_date']);
                                });
                        });
                })
                ->exists();

            if ($overlapping) {
                throw ValidationException::withMessages([
                    'employee_id' => 'Employee already has an active contract overlapping these dates.',
                ]);
            }

            // Generate contract number
            $contractNumber = $this->generateContractNumber($company);

            // Use template data as defaults if template provided
            $contractData = [
                'company_id' => $company->id,
                'employee_id' => $employee->id,
                'template_id' => $data['template_id'] ?? null,
                'contract_number' => $contractNumber,
                'contract_type' => $data['contract_type'] ?? ($template->contract_type ?? ContractType::Permanent),
                'status' => $data['status'] ?? ContractStatus::Draft,
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'] ?? null,
                'probation_end_date' => $data['probation_end_date'] ?? null,
                'basic_salary' => $data['basic_salary'] ?? ($template->basic_salary ?? 0),
                'currency_code' => $data['currency_code'] ?? $company->default_currency,
                'pay_frequency' => $data['pay_frequency'] ?? ($template->pay_frequency ?? 'monthly'),
                'working_hours_per_week' => $data['working_hours_per_week'] ?? ($template->working_hours_per_week ?? 40),
                'overtime_eligible' => $data['overtime_eligible'] ?? ($template->overtime_eligible ?? true),
                'notice_period_days' => $data['notice_period_days'] ?? ($template->notice_period_days ?? 30),
                'annual_leave_days' => $data['annual_leave_days'] ?? ($template->annual_leave_days ?? 21),
                'sick_leave_days' => $data['sick_leave_days'] ?? ($template->sick_leave_days ?? 14),
                'benefits' => $data['benefits'] ?? ($template->benefits ?? []),
                'allowances' => $data['allowances'] ?? ($template->allowances ?? []),
                'deductions' => $data['deductions'] ?? ($template->deductions ?? []),
                'special_conditions' => $data['special_conditions'] ?? ($template->special_conditions ?? null),
                'document_path' => $data['document_path'] ?? null,
                'signed_by_employee_at' => null,
                'signed_by_employer_at' => null,
                'signed_by_employee_ip' => null,
                'signed_by_employer_ip' => null,
                'termination_date' => null,
                'termination_reason' => null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ];

            $contract = Contract::query()->create($contractData);

            // If status is active, update employee employment details
            if ($contract->status === ContractStatus::Active) {
                $this->applyContractToEmployee($contract);
            }

            return $contract->load(['employee.user', 'template']);
        });
    }

    /**
     * Create contract from template with pre-filled data
     */
    public function createFromTemplate(User $actor, int $templateId, int $employeeId, array $overrides = []): Contract
    {
        $company = $this->companyContext->requireActiveCompany();

        $template = ContractTemplate::where('company_id', $company->id)->findOrFail($templateId);

        $data = array_merge([
            'template_id' => $templateId,
            'employee_id' => $employeeId,
            'contract_type' => $template->contract_type,
            'basic_salary' => $template->basic_salary,
            'pay_frequency' => $template->pay_frequency,
            'working_hours_per_week' => $template->working_hours_per_week,
            'overtime_eligible' => $template->overtime_eligible,
            'notice_period_days' => $template->notice_period_days,
            'annual_leave_days' => $template->annual_leave_days,
            'sick_leave_days' => $template->sick_leave_days,
            'benefits' => $template->benefits,
            'allowances' => $template->allowances,
            'deductions' => $template->deductions,
            'special_conditions' => $template->special_conditions,
            'start_date' => now()->toDateString(),
        ], $overrides);

        return $this->createContract($actor, $data);
    }

    /**
     * Update a contract
     */
    public function updateContract(User $actor, Contract $contract, array $data): Contract
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $contract->company_id !== (int) $company->id) {
            throw new AuthorizationException('Contract belongs to a different company.');
        }

        // Prevent updating signed/active contracts except for specific fields
        if (in_array($contract->status, [ContractStatus::Active, ContractStatus::Completed, ContractStatus::Terminated])) {
            $allowedFields = ['document_path', 'special_conditions', 'benefits', 'allowances', 'deductions'];
            $data = array_intersect_key($data, array_flip($allowedFields));
        }

        $oldStatus = $contract->status;
        $oldEmployeeId = $contract->employee_id;

        $contract->update(array_merge($data, ['updated_by' => $actor->id]));

        // Handle status changes
        if (isset($data['status']) && $data['status'] !== $oldStatus) {
            $this->handleStatusChange($contract, $oldStatus, $data['status'], $actor);
        }

        // Handle employee change
        if (isset($data['employee_id']) && $data['employee_id'] !== $oldEmployeeId) {
            // Decrement old position headcount
            $oldEmployee = Employee::find($oldEmployeeId);
            if ($oldEmployee && $oldEmployee->position_id) {
                \App\Modules\Hrm\Models\Position::where('id', $oldEmployee->position_id)->decrement('headcount_current');
            }

            // Apply to new employee if active
            if ($contract->status === ContractStatus::Active) {
                $this->applyContractToEmployee($contract->fresh());
            }
        }

        return $contract->fresh()->load(['employee.user', 'template']);
    }

    /**
     * Sign contract by employee
     */
    public function signByEmployee(User $actor, Contract $contract, string $ipAddress = null): Contract
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $contract->company_id !== (int) $company->id) {
            throw new AuthorizationException('Contract belongs to a different company.');
        }

        if ($contract->status !== ContractStatus::PendingSignature) {
            throw ValidationException::withMessages(['contract' => 'Contract is not pending signature.']);
        }

        // Verify actor is the employee or has permission
        $employee = $contract->employee;
        if ($employee->user_id !== $actor->id && ! $actor->can('sign contracts', $contract)) {
            throw new AuthorizationException('You are not authorized to sign this contract.');
        }

        $contract->update([
            'signed_by_employee_at' => now(),
            'signed_by_employee_ip' => $ipAddress,
            'updated_by' => $actor->id,
        ]);

        // If employer already signed, activate
        if ($contract->signed_by_employer_at) {
            $contract->update([
                'status' => ContractStatus::Active,
            ]);
            $this->applyContractToEmployee($contract->fresh());
        }

        return $contract->fresh();
    }

    /**
     * Sign contract by employer
     */
    public function signByEmployer(User $actor, Contract $contract, string $ipAddress = null): Contract
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $contract->company_id !== (int) $company->id) {
            throw new AuthorizationException('Contract belongs to a different company.');
        }

        if ($contract->status !== ContractStatus::PendingSignature) {
            throw ValidationException::withMessages(['contract' => 'Contract is not pending signature.']);
        }

        // Verify actor has permission
        if (! $actor->can('sign contracts', $contract)) {
            throw new AuthorizationException('You are not authorized to sign this contract.');
        }

        $contract->update([
            'signed_by_employer_at' => now(),
            'signed_by_employer_ip' => $ipAddress,
            'updated_by' => $actor->id,
        ]);

        // If employee already signed, activate
        if ($contract->signed_by_employee_at) {
            $contract->update([
                'status' => ContractStatus::Active,
            ]);
            $this->applyContractToEmployee($contract->fresh());
        }

        return $contract->fresh();
    }

    /**
     * Renew a contract
     */
    public function renewContract(User $actor, Contract $contract, array $data): Contract
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $contract->company_id !== (int) $company->id) {
            throw new AuthorizationException('Contract belongs to a different company.');
        }

        if ($contract->status !== ContractStatus::Active && $contract->status !== ContractStatus::Expired) {
            throw ValidationException::withMessages(['contract' => 'Only active or expired contracts can be renewed.']);
        }

        return DB::transaction(function () use ($actor, $contract, $data) {
            // Create new contract based on current one
            $newContract = Contract::query()->create([
                'company_id' => $contract->company_id,
                'employee_id' => $contract->employee_id,
                'template_id' => $contract->template_id,
                'contract_number' => $this->generateContractNumber($company),
                'contract_type' => $data['contract_type'] ?? $contract->contract_type,
                'status' => $data['status'] ?? ContractStatus::Draft,
                'start_date' => $data['start_date'] ?? (CarbonImmutable::parse($contract->end_date ?? now())->addDay()->toDateString()),
                'end_date' => $data['end_date'] ?? null,
                'probation_end_date' => $data['probation_end_date'] ?? null,
                'basic_salary' => $data['basic_salary'] ?? $contract->basic_salary,
                'currency_code' => $data['currency_code'] ?? $contract->currency_code,
                'pay_frequency' => $data['pay_frequency'] ?? $contract->pay_frequency,
                'working_hours_per_week' => $data['working_hours_per_week'] ?? $contract->working_hours_per_week,
                'overtime_eligible' => $data['overtime_eligible'] ?? $contract->overtime_eligible,
                'notice_period_days' => $data['notice_period_days'] ?? $contract->notice_period_days,
                'annual_leave_days' => $data['annual_leave_days'] ?? $contract->annual_leave_days,
                'sick_leave_days' => $data['sick_leave_days'] ?? $contract->sick_leave_days,
                'benefits' => $data['benefits'] ?? $contract->benefits,
                'allowances' => $data['allowances'] ?? $contract->allowances,
                'deductions' => $data['deductions'] ?? $contract->deductions,
                'special_conditions' => $data['special_conditions'] ?? $contract->special_conditions,
                'document_path' => null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            // Mark old contract as completed if it was active
            if ($contract->status === ContractStatus::Active) {
                $contract->update([
                    'status' => ContractStatus::Completed,
                    'termination_date' => CarbonImmutable::parse($newContract->start_date)->subDay()->toDateString(),
                    'termination_reason' => 'Contract renewed',
                    'updated_by' => $actor->id,
                ]);
            }

            return $newContract->load(['employee.user', 'template']);
        });
    }

    /**
     * Terminate a contract
     */
    public function terminateContract(User $actor, Contract $contract, array $data): Contract
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $contract->company_id !== (int) $company->id) {
            throw new AuthorizationException('Contract belongs to a different company.');
        }

        if (! in_array($contract->status, [ContractStatus::Active, ContractStatus::PendingSignature])) {
            throw ValidationException::withMessages(['contract' => 'Only active or pending contracts can be terminated.']);
        }

        return DB::transaction(function () use ($actor, $contract, $data) {
            $contract->update([
                'status' => ContractStatus::Terminated,
                'termination_date' => $data['termination_date'] ?? now()->toDateString(),
                'termination_reason' => $data['termination_reason'] ?? null,
                'updated_by' => $actor->id,
            ]);

            // If contract was active, update employee
            if ($contract->status === ContractStatus::Active) {
                $employee = $contract->employee;
                $employee->update([
                    'employment_status' => \App\Modules\Hrm\Enums\EmploymentStatus::Terminated,
                    'termination_date' => $contract->termination_date,
                    'termination_reason' => $contract->termination_reason,
                    'updated_by' => $actor->id,
                ]);

                if ($employee->position_id) {
                    \App\Modules\Hrm\Models\Position::where('id', $employee->position_id)->decrement('headcount_current');
                }
            }

            return $contract->fresh();
        });
    }

    /**
     * Apply contract terms to employee record
     */
    private function applyContractToEmployee(Contract $contract): void
    {
        $employee = $contract->employee;

        $employee->update([
            'employment_type' => $contract->contract_type,
            'employment_status' => \App\Modules\Hrm\Enums\EmploymentStatus::Active,
            'probation_end_date' => $contract->probation_end_date,
            'confirmation_date' => $contract->probation_end_date,
            'notice_period_days' => $contract->notice_period_days,
            'annual_leave_entitlement' => $contract->annual_leave_days,
            'updated_by' => $contract->updated_by,
        ]);
    }

    /**
     * Handle contract status changes
     */
    private function handleStatusChange(Contract $contract, string $oldStatus, string $newStatus, User $actor): void
    {
        // Draft -> PendingSignature: send for signing
        if ($oldStatus === ContractStatus::Draft && $newStatus === ContractStatus::PendingSignature) {
            // Notification would be sent here
        }

        // PendingSignature -> Active: apply to employee
        if ($oldStatus === ContractStatus::PendingSignature && $newStatus === ContractStatus::Active) {
            $this->applyContractToEmployee($contract);
        }

        // Active -> Completed/Terminated: handle employee status
        if ($oldStatus === ContractStatus::Active && in_array($newStatus, [ContractStatus::Completed, ContractStatus::Terminated])) {
            $employee = $contract->employee;
            $employee->update([
                'employment_status' => \App\Modules\Hrm\Enums\EmploymentStatus::Terminated,
                'termination_date' => $contract->termination_date ?? now()->toDateString(),
                'termination_reason' => $contract->termination_reason ?? 'Contract ' . strtolower($newStatus),
                'updated_by' => $actor->id,
            ]);

            if ($employee->position_id) {
                \App\Modules\Hrm\Models\Position::where('id', $employee->position_id)->decrement('headcount_current');
            }
        }

        // Expired -> Active (renewal): already handled in renewContract
    }

    /**
     * Generate unique contract number
     */
    private function generateContractNumber(\App\Modules\Core\Models\Company $company): string
    {
        $prefix = 'CTR';
        $lastNumber = Contract::where('company_id', $company->id)
            ->where('contract_number', 'like', $prefix . '-%')
            ->latest('contract_number')
            ->value('contract_number');

        if ($lastNumber) {
            $num = (int) substr($lastNumber, strlen($prefix) + 1) + 1;
        } else {
            $num = 1;
        }

        return sprintf('%s-%05d', $prefix, $num);
    }

    /**
     * Get expiring contracts
     */
    public function getExpiringContracts(int $daysAhead = 30): \Illuminate\Database\Eloquent\Collection
    {
        $company = $this->companyContext->requireActiveCompany();

        return Contract::where('company_id', $company->id)
            ->where('status', ContractStatus::Active)
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<=', now()->addDays($daysAhead))
            ->whereDate('end_date', '>=', now())
            ->with(['employee.user', 'template'])
            ->orderBy('end_date')
            ->get();
    }

    /**
     * Get contracts pending signature
     */
    public function getPendingSignatureContracts(): \Illuminate\Database\Eloquent\Collection
    {
        $company = $this->companyContext->requireActiveCompany();

        return Contract::where('company_id', $company->id)
            ->where('status', ContractStatus::PendingSignature)
            ->with(['employee.user', 'template'])
            ->orderBy('created_at')
            ->get();
    }

    /**
     * Search contracts
     */
    public function searchContracts(array $filters, int $perPage = 15)
    {
        $company = $this->companyContext->requireActiveCompany();

        $query = Contract::where('company_id', $company->id)
            ->with(['employee.user', 'template']);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->whereHas('employee', fn ($q) => $q->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('employee_number', 'like', "%{$search}%"))
                ->orWhere('contract_number', 'like', "%{$search}%");
        }

        if (! empty($filters['employee_id'])) {
            $query->where('employee_id', $filters['employee_id']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['contract_type'])) {
            $query->where('contract_type', $filters['contract_type']);
        }

        if (! empty($filters['template_id'])) {
            $query->where('template_id', $filters['template_id']);
        }

        if (! empty($filters['start_date_from'])) {
            $query->whereDate('start_date', '>=', $filters['start_date_from']);
        }

        if (! empty($filters['start_date_to'])) {
            $query->whereDate('start_date', '<=', $filters['start_date_to']);
        }

        if (! empty($filters['end_date_from'])) {
            $query->whereDate('end_date', '>=', $filters['end_date_from']);
        }

        if (! empty($filters['end_date_to'])) {
            $query->whereDate('end_date', '<=', $filters['end_date_to']);
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }
}