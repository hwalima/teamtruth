<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Enums\LeaveStatus;
use App\Modules\Hrm\Enums\LeaveTypeCategory;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveBalance;
use App\Modules\Hrm\Models\LeaveLedger;
use App\Modules\Hrm\Models\LeaveRequest;
use App\Modules\Hrm\Models\LeaveType;
use App\Modules\Hrm\Models\PublicHoliday;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LeaveService
{
    public function __construct(
        private CompanyContext $companyContext,
    ) {}

    /**
     * Create a new leave request
     */
    public function createLeaveRequest(User $actor, array $data): LeaveRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        // Determine employee - either from actor's employee record or explicitly provided
        $employee = $data['employee_id']
            ? Employee::where('company_id', $company->id)->findOrFail($data['employee_id'])
            : Employee::where('company_id', $company->id)->where('user_id', $actor->id)->firstOrFail();

        return DB::transaction(function () use ($company, $actor, $employee, $data) {
            // Validate leave type
            $leaveType = LeaveType::where('company_id', $company->id)
                ->where('id', $data['leave_type_id'])
                ->firstOrFail();

            if (! $leaveType->is_active) {
                throw ValidationException::withMessages(['leave_type_id' => 'The selected leave type is not active.']);
            }

            // Check if employee is eligible for this leave type
            if (! $this->isEmployeeEligibleForLeaveType($employee, $leaveType)) {
                throw ValidationException::withMessages(['leave_type_id' => 'Employee is not eligible for this leave type.']);
            }

            // Validate dates
            $startDate = CarbonImmutable::parse($data['start_date']);
            $endDate = CarbonImmutable::parse($data['end_date']);

            if ($endDate->lt($startDate)) {
                throw ValidationException::withMessages(['end_date' => 'End date must be on or after start date.']);
            }

            // Check if leave type requires future dates
            if ($leaveType->requires_future_date && $startDate->lte(now()->toDateString())) {
                throw ValidationException::withMessages(['start_date' => 'This leave type must be requested for future dates.']);
            }

            // Check if leave type allows past dates
            if (! $leaveType->allows_past_dates && $startDate->lt(now()->toDateString())) {
                throw ValidationException::withMessages(['start_date' => 'This leave type cannot be requested for past dates.']);
            }

            // Calculate working days
            $workingDays = $this->calculateWorkingDays($employee, $startDate, $endDate);

            // Check balance for leave types that track balance
            if ($leaveType->tracks_balance) {
                $balance = LeaveBalance::where('employee_id', $employee->id)
                    ->where('leave_type_id', $leaveType->id)
                    ->first();

                $available = $balance?->available_balance ?? 0;

                if ($workingDays > $available) {
                    throw ValidationException::withMessages([
                        'leave_type_id' => "Insufficient leave balance. Available: {$available} days, Requested: {$workingDays} days.",
                    ]);
                }
            }

            // Check for overlapping requests
            $overlapping = LeaveRequest::where('employee_id', $employee->id)
                ->whereIn('status', [LeaveStatus::Pending, LeaveStatus::Approved])
                ->where(function ($q) use ($startDate, $endDate) {
                    $q->whereBetween('start_date', [$startDate, $endDate])
                        ->orWhereBetween('end_date', [$startDate, $endDate])
                        ->orWhere(function ($q2) use ($startDate, $endDate) {
                            $q2->where('start_date', '<=', $startDate)
                                ->where('end_date', '>=', $endDate);
                        });
                })
                ->exists();

            if ($overlapping) {
                throw ValidationException::withMessages([
                    'dates' => 'Leave request overlaps with an existing request.',
                ]);
            }

            // Check max consecutive days
            if ($leaveType->max_consecutive_days && $workingDays > $leaveType->max_consecutive_days) {
                throw ValidationException::withMessages([
                    'end_date' => "This leave type allows a maximum of {$leaveType->max_consecutive_days} consecutive days.",
                ]);
            }

            // Check min/max duration
            if ($leaveType->min_duration_days && $workingDays < $leaveType->min_duration_days) {
                throw ValidationException::withMessages([
                    'end_date' => "This leave type requires a minimum of {$leaveType->min_duration_days} days.",
                ]);
            }

            if ($leaveType->max_duration_days && $workingDays > $leaveType->max_duration_days) {
                throw ValidationException::withMessages([
                    'end_date' => "This leave type allows a maximum of {$leaveType->max_duration_days} days per request.",
                ]);
            }

            // Check attachment requirement
            if ($leaveType->requires_attachment && empty($data['attachment_path'])) {
                throw ValidationException::withMessages([
                    'attachment_path' => 'An attachment is required for this leave type.',
                ]);
            }

            // Check if approval is required
            $status = $leaveType->requires_approval ? LeaveStatus::Pending : LeaveStatus::Approved;
            $approvedAt = $status === LeaveStatus::Approved ? now() : null;
            $approvedBy = $status === LeaveStatus::Approved ? $actor->id : null;

            $leaveRequest = LeaveRequest::query()->create([
                'company_id' => $company->id,
                'employee_id' => $employee->id,
                'leave_type_id' => $leaveType->id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'working_days' => $workingDays,
                'reason' => $data['reason'] ?? null,
                'attachment_path' => $data['attachment_path'] ?? null,
                'contact_during_leave' => $data['contact_during_leave'] ?? null,
                'handover_notes' => $data['handover_notes'] ?? null,
                'status' => $status,
                'approved_by' => $approvedBy,
                'approved_at' => $approvedAt,
                'rejection_reason' => null,
                'cancelled_at' => null,
                'cancelled_by' => null,
                'cancellation_reason' => null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            // If auto-approved, create ledger entries
            if ($status === LeaveStatus::Approved && $leaveType->tracks_balance) {
                $this->createLedgerEntries($leaveRequest, $actor);
            }

            return $leaveRequest->load(['employee.user', 'leaveType', 'approvedBy']);
        });
    }

    /**
     * Approve a leave request
     */
    public function approveLeaveRequest(User $actor, LeaveRequest $leaveRequest, ?string $notes = null): LeaveRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $leaveRequest->company_id !== (int) $company->id) {
            throw new AuthorizationException('Leave request belongs to a different company.');
        }

        if (! $leaveRequest->canBeApproved()) {
            throw ValidationException::withMessages(['leave_request' => 'This leave request cannot be approved.']);
        }

        return DB::transaction(function () use ($actor, $leaveRequest, $notes) {
            $leaveRequest = LeaveRequest::query()->lockForUpdate()->findOrFail($leaveRequest->id);

            if (! $leaveRequest->canBeApproved()) {
                throw ValidationException::withMessages(['leave_request' => 'This leave request cannot be approved.']);
            }

            $leaveType = $leaveRequest->leaveType;

            $leaveRequest->update([
                'status' => LeaveStatus::Approved,
                'approved_by' => $actor->id,
                'approved_at' => now(),
                'approval_notes' => $notes,
                'updated_by' => $actor->id,
            ]);

            // Create ledger entries for balance-tracking leave types
            if ($leaveType->tracks_balance) {
                $this->createLedgerEntries($leaveRequest->fresh(), $actor);
            }

            return $leaveRequest->fresh()->load(['employee.user', 'leaveType', 'approvedBy']);
        });
    }

    /**
     * Reject a leave request
     */
    public function rejectLeaveRequest(User $actor, LeaveRequest $leaveRequest, string $reason): LeaveRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $leaveRequest->company_id !== (int) $company->id) {
            throw new AuthorizationException('Leave request belongs to a different company.');
        }

        if (! $leaveRequest->canBeRejected()) {
            throw ValidationException::withMessages(['leave_request' => 'This leave request cannot be rejected.']);
        }

        $leaveRequest->update([
            'status' => LeaveStatus::Rejected,
            'rejection_reason' => $reason,
            'updated_by' => $actor->id,
        ]);

        return $leaveRequest->fresh()->load(['employee.user', 'leaveType']);
    }

    /**
     * Cancel a leave request
     */
    public function cancelLeaveRequest(User $actor, LeaveRequest $leaveRequest, string $reason): LeaveRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $leaveRequest->company_id !== (int) $company->id) {
            throw new AuthorizationException('Leave request belongs to a different company.');
        }

        if (! $leaveRequest->canBeCancelled()) {
            throw ValidationException::withMessages(['leave_request' => 'This leave request cannot be cancelled.']);
        }

        return DB::transaction(function () use ($actor, $leaveRequest, $reason) {
            $leaveRequest = LeaveRequest::query()->lockForUpdate()->findOrFail($leaveRequest->id);

            if (! $leaveRequest->canBeCancelled()) {
                throw ValidationException::withMessages(['leave_request' => 'This leave request cannot be cancelled.']);
            }

            $leaveType = $leaveRequest->leaveType;

            // If already approved and tracking balance, reverse ledger entries
            if ($leaveRequest->status === LeaveStatus::Approved && $leaveType->tracks_balance) {
                $this->reverseLedgerEntries($leaveRequest, $actor);
            }

            $leaveRequest->update([
                'status' => LeaveStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
                'cancellation_reason' => $reason,
                'updated_by' => $actor->id,
            ]);

            return $leaveRequest->fresh()->load(['employee.user', 'leaveType']);
        });
    }

    /**
     * Create leave balance for employee
     */
    public function createLeaveBalance(User $actor, array $data): LeaveBalance
    {
        $company = $this->companyContext->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data) {
            $employee = Employee::where('company_id', $company->id)->findOrFail($data['employee_id']);
            $leaveType = LeaveType::where('company_id', $company->id)->findOrFail($data['leave_type_id']);

            // Check if balance already exists for this period
            $existing = LeaveBalance::where('employee_id', $employee->id)
                ->where('leave_type_id', $leaveType->id)
                ->where('period_start', $data['period_start'])
                ->where('period_end', $data['period_end'])
                ->first();

            if ($existing) {
                throw ValidationException::withMessages(['leave_type_id' => 'Leave balance already exists for this period.']);
            }

            $balance = LeaveBalance::query()->create([
                'company_id' => $company->id,
                'employee_id' => $employee->id,
                'leave_type_id' => $leaveType->id,
                'period_start' => $data['period_start'],
                'period_end' => $data['period_end'],
                'entitled_days' => $data['entitled_days'] ?? $leaveType->default_entitlement ?? 0,
                'carried_forward' => $data['carried_forward'] ?? 0,
                'accrued_days' => $data['accrued_days'] ?? 0,
                'used_days' => 0,
                'pending_days' => 0,
                'adjusted_days' => 0,
                'is_frozen' => false,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            return $balance->load(['employee', 'leaveType']);
        });
    }

    /**
     * Adjust leave balance
     */
    public function adjustLeaveBalance(User $actor, LeaveBalance $balance, float $adjustment, string $reason): LeaveBalance
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $balance->company_id !== (int) $company->id) {
            throw new AuthorizationException('Leave balance belongs to a different company.');
        }

        $newAdjusted = bcadd((string) $balance->adjusted_days, (string) $adjustment, 4);

        // Ensure adjusted balance doesn't make available negative
        $available = bcadd(
            bcadd((string) $balance->entitled_days, (string) $balance->carried_forward, 4),
            bcadd((string) $balance->accrued_days, (string) $newAdjusted, 4),
            4
        );
        $available = bcsub($available, (string) $balance->used_days, 4);

        if (bccomp($available, '0', 4) < 0) {
            throw ValidationException::withMessages(['adjustment' => 'Adjustment would result in negative available balance.']);
        }

        $balance->update([
            'adjusted_days' => $newAdjusted,
            'updated_by' => $actor->id,
        ]);

        // Create ledger entry for adjustment
        LeaveLedger::query()->create([
            'company_id' => $company->id,
            'employee_id' => $balance->employee_id,
            'leave_type_id' => $balance->leave_type_id,
            'leave_balance_id' => $balance->id,
            'transaction_type' => 'adjustment',
            'reference_type' => 'manual',
            'reference_id' => null,
            'days' => $adjustment,
            'balance_before' => $balance->getAttribute('adjusted_days') - $adjustment,
            'balance_after' => $newAdjusted,
            'description' => $reason,
            'created_by' => $actor->id,
        ]);

        return $balance->fresh()->load(['employee', 'leaveType']);
    }

    /**
     * Accrue leave for all eligible employees (run via scheduler)
     */
    public function accrueLeaveForPeriod(string $periodStart, string $periodEnd): int
    {
        $company = $this->companyContext->requireActiveCompany();

        $leaveTypes = LeaveType::where('company_id', $company->id)
            ->where('tracks_balance', true)
            ->where('accrual_frequency', '!=', 'none')
            ->get();

        $accruedCount = 0;

        foreach ($leaveTypes as $leaveType) {
            $employees = Employee::where('company_id', $company->id)
                ->where('employment_status', 'active')
                ->where('hire_date', '<=', $periodEnd)
                ->get();

            foreach ($employees as $employee) {
                // Check eligibility based on leave type rules
                if (! $this->isEmployeeEligibleForLeaveType($employee, $leaveType)) {
                    continue;
                }

                $balance = LeaveBalance::where('employee_id', $employee->id)
                    ->where('leave_type_id', $leaveType->id)
                    ->where('period_start', $periodStart)
                    ->where('period_end', $periodEnd)
                    ->first();

                if (! $balance) {
                    continue; // Balance should be created during onboarding or period setup
                }

                $accrualDays = $this->calculateAccrual($employee, $leaveType, $periodStart, $periodEnd);

                if ($accrualDays > 0) {
                    $balance->increment('accrued_days', $accrualDays);
                    $balance->increment('updated_by', $actor->id ?? 0); // System user

                    LeaveLedger::query()->create([
                        'company_id' => $company->id,
                        'employee_id' => $employee->id,
                        'leave_type_id' => $leaveType->id,
                        'leave_balance_id' => $balance->id,
                        'transaction_type' => 'accrual',
                        'reference_type' => 'system',
                        'reference_id' => null,
                        'days' => $accrualDays,
                        'balance_before' => $balance->getAttribute('accrued_days') - $accrualDays,
                        'balance_after' => $balance->fresh()->accrued_days,
                        'description' => "Accrual for period {$periodStart} to {$periodEnd}",
                        'created_by' => $actor->id ?? 0,
                    ]);

                    $accruedCount++;
                }
            }
        }

        return $accruedCount;
    }

    /**
     * Carry forward leave balances to new period
     */
    public function carryForwardBalances(string $fromPeriodStart, string $fromPeriodEnd, string $toPeriodStart, string $toPeriodEnd): int
    {
        $company = $this->companyContext->requireActiveCompany();

        $balances = LeaveBalance::where('company_id', $company->id)
            ->where('period_start', $fromPeriodStart)
            ->where('period_end', $fromPeriodEnd)
            ->where('is_frozen', false)
            ->get();

        $carriedCount = 0;

        foreach ($balances as $balance) {
            if (! $balance->leaveType->allows_carry_forward) {
                continue;
            }

            $available = $balance->available_balance;

            // Apply carry forward limit
            $carryForward = min($available, $balance->leaveType->max_carry_forward ?? $available);

            // Apply expiry if configured
            $expiryDate = null;
            if ($balance->leaveType->carry_forward_expiry_months) {
                $expiryDate = CarbonImmutable::parse($toPeriodStart)->addMonths($balance->leaveType->carry_forward_expiry_months);
            }

            // Check if balance already exists for target period
            $existing = LeaveBalance::where('employee_id', $balance->employee_id)
                ->where('leave_type_id', $balance->leave_type_id)
                ->where('period_start', $toPeriodStart)
                ->where('period_end', $toPeriodEnd)
                ->first();

            if ($existing) {
                $existing->increment('carried_forward', $carryForward);
                $existing->update(['updated_by' => 0]); // System user
            } else {
                LeaveBalance::query()->create([
                    'company_id' => $company->id,
                    'employee_id' => $balance->employee_id,
                    'leave_type_id' => $balance->leave_type_id,
                    'period_start' => $toPeriodStart,
                    'period_end' => $toPeriodEnd,
                    'entitled_days' => $balance->leaveType->default_entitlement ?? 0,
                    'carried_forward' => $carryForward,
                    'accrued_days' => 0,
                    'used_days' => 0,
                    'pending_days' => 0,
                    'adjusted_days' => 0,
                    'is_frozen' => false,
                    'created_by' => 0,
                    'updated_by' => 0,
                ]);
            }

            // Mark source as frozen
            $balance->update(['is_frozen' => true, 'updated_by' => 0]);

            $carriedCount++;
        }

        return $carriedCount;
    }

    /**
     * Calculate working days between two dates for an employee
     */
    public function calculateWorkingDays(Employee $employee, CarbonImmutable $startDate, CarbonImmutable $endDate): float
    {
        $schedule = $employee->work_schedule ?? [
            'monday' => true, 'tuesday' => true, 'wednesday' => true,
            'thursday' => true, 'friday' => true, 'saturday' => false, 'sunday' => false,
        ];

        $company = $this->companyContext->requireActiveCompany();
        $holidays = PublicHoliday::where('company_id', $company->id)
            ->whereDate('date', '>=', $startDate)
            ->whereDate('date', '<=', $endDate)
            ->pluck('date')
            ->map(fn ($d) => CarbonImmutable::parse($d)->toDateString())
            ->toArray();

        $period = CarbonPeriod::create($startDate, $endDate);
        $workingDays = 0;

        foreach ($period as $date) {
            $dayName = strtolower($date->format('l'));

            // Skip if not a working day per schedule
            if (! ($schedule[$dayName] ?? false)) {
                continue;
            }

            // Skip if public holiday
            if (in_array($date->toDateString(), $holidays)) {
                continue;
            }

            $workingDays++;
        }

        return $workingDays;
    }

    /**
     * Check if employee is eligible for leave type
     */
    private function isEmployeeEligibleForLeaveType(Employee $employee, LeaveType $leaveType): bool
    {
        // Check gender restrictions
        if ($leaveType->gender_restriction && $leaveType->gender_restriction !== $employee->gender->value) {
            return false;
        }

        // Check minimum service requirement
        if ($leaveType->min_service_months) {
            $monthsOfService = $employee->hire_date
                ? CarbonImmutable::parse($employee->hire_date)->diffInMonths(now())
                : 0;

            if ($monthsOfService < $leaveType->min_service_months) {
                return false;
            }
        }

        // Check employment type restrictions
        if ($leaveType->employment_types && ! in_array($employee->employment_type->value, $leaveType->employment_types)) {
            return false;
        }

        return true;
    }

    /**
     * Calculate accrual days for employee and leave type
     */
    private function calculateAccrual(Employee $employee, LeaveType $leaveType, string $periodStart, string $periodEnd): float
    {
        if ($leaveType->accrual_frequency === 'none') {
            return 0;
        }

        // Calculate pro-rated accrual based on hire date
        $hireDate = CarbonImmutable::parse($employee->hire_date);
        $periodStartDate = CarbonImmutable::parse($periodStart);
        $periodEndDate = CarbonImmutable::parse($periodEnd);

        // If hired after period start, pro-rate
        $effectiveStart = $hireDate->gt($periodStartDate) ? $hireDate : $periodStartDate;

        if ($effectiveStart->gt($periodEndDate)) {
            return 0; // Hired after period end
        }

        $annualEntitlement = $leaveType->default_entitlement ?? 0;
        $accrualRate = $annualEntitlement / 12; // Monthly accrual

        $monthsWorked = $effectiveStart->diffInMonths($periodEndDate->addMonth()) + 1;

        return round($accrualRate * $monthsWorked, 2);
    }

    /**
     * Create ledger entries for approved leave
     */
    private function createLedgerEntries(LeaveRequest $leaveRequest, User $actor): void
    {
        $company = $this->companyContext->requireActiveCompany();
        $leaveType = $leaveRequest->leaveType;

        $balance = LeaveBalance::where('employee_id', $leaveRequest->employee_id)
            ->where('leave_type_id', $leaveType->id)
            ->where('period_start', '<=', $leaveRequest->start_date)
            ->where('period_end', '>=', $leaveRequest->end_date)
            ->first();

        if (! $balance) {
            return;
        }

        $days = $leaveRequest->working_days;
        $before = $balance->available_balance;
        $after = bcsub((string) $before, (string) $days, 4);

        // Update balance
        $balance->increment('used_days', $days);
        $balance->increment('pending_days', -$days);

        LeaveLedger::query()->create([
            'company_id' => $company->id,
            'employee_id' => $leaveRequest->employee_id,
            'leave_type_id' => $leaveType->id,
            'leave_balance_id' => $balance->id,
            'transaction_type' => 'used',
            'reference_type' => 'leave_request',
            'reference_id' => $leaveRequest->id,
            'days' => -$days,
            'balance_before' => $before,
            'balance_after' => $after,
            'description' => "Leave request {$leaveRequest->id} approved",
            'created_by' => $actor->id,
        ]);
    }

    /**
     * Reverse ledger entries for cancelled leave
     */
    private function reverseLedgerEntries(LeaveRequest $leaveRequest, User $actor): void
    {
        $company = $this->companyContext->requireActiveCompany();
        $leaveType = $leaveRequest->leaveType;

        $balance = LeaveBalance::where('employee_id', $leaveRequest->employee_id)
            ->where('leave_type_id', $leaveType->id)
            ->where('period_start', '<=', $leaveRequest->start_date)
            ->where('period_end', '>=', $leaveRequest->end_date)
            ->first();

        if (! $balance) {
            return;
        }

        $days = $leaveRequest->working_days;
        $before = $balance->available_balance;
        $after = bcadd((string) $before, (string) $days, 4);

        // Update balance
        $balance->decrement('used_days', $days);

        LeaveLedger::query()->create([
            'company_id' => $company->id,
            'employee_id' => $leaveRequest->employee_id,
            'leave_type_id' => $leaveType->id,
            'leave_balance_id' => $balance->id,
            'transaction_type' => 'reversal',
            'reference_type' => 'leave_request',
            'reference_id' => $leaveRequest->id,
            'days' => $days,
            'balance_before' => $before,
            'balance_after' => $after,
            'description' => "Leave request {$leaveRequest->id} cancelled",
            'created_by' => $actor->id,
        ]);
    }

    /**
     * Get employee leave summary
     */
    public function getEmployeeLeaveSummary(int $employeeId, string $periodStart, string $periodEnd): array
    {
        $company = $this->companyContext->requireActiveCompany();

        $employee = Employee::where('company_id', $company->id)->findOrFail($employeeId);

        $balances = LeaveBalance::where('employee_id', $employeeId)
            ->where('period_start', '<=', $periodEnd)
            ->where('period_end', '>=', $periodStart)
            ->with('leaveType')
            ->get();

        $requests = LeaveRequest::where('employee_id', $employeeId)
            ->where(function ($q) use ($periodStart, $periodEnd) {
                $q->whereBetween('start_date', [$periodStart, $periodEnd])
                    ->orWhereBetween('end_date', [$periodStart, $periodEnd])
                    ->orWhere(function ($q2) use ($periodStart, $periodEnd) {
                        $q2->where('start_date', '<=', $periodStart)
                            ->where('end_date', '>=', $periodEnd);
                    });
            })
            ->with('leaveType')
            ->orderBy('start_date')
            ->get();

        $summary = [];
        foreach ($balances as $balance) {
            $summary[$balance->leave_type_id] = [
                'leave_type' => $balance->leaveType,
                'entitled' => $balance->entitled_days,
                'carried_forward' => $balance->carried_forward,
                'accrued' => $balance->accrued_days,
                'used' => $balance->used_days,
                'pending' => $balance->pending_days,
                'adjusted' => $balance->adjusted_days,
                'available' => $balance->available_balance,
                'requests' => $requests->where('leave_type_id', $balance->leave_type_id)->values(),
            ];
        }

        return [
            'employee' => $employee,
            'period' => ['start' => $periodStart, 'end' => $periodEnd],
            'balances' => array_values($summary),
        ];
    }
}