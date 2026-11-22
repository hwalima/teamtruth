<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Hrm\Enums\LeaveAccrualType;
use App\Modules\Hrm\Enums\LeaveLedgerType;
use App\Modules\Hrm\Enums\LeaveRequestStatus;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveBalance;
use App\Modules\Hrm\Models\LeaveLedger;
use App\Modules\Hrm\Models\LeaveRequest;
use App\Modules\Hrm\Models\LeaveType;
use App\Modules\Hrm\Models\PublicHoliday;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LeaveService
{
    /** Statuses that hold days against a balance or block overlapping dates. */
    public const OPEN_STATUSES = [LeaveRequestStatus::Submitted, LeaveRequestStatus::InApproval, LeaveRequestStatus::Approved];

    /**
     * Working days (Monday–Friday) between two dates, skipping public holidays.
     */
    public function countWorkingDays(string $start, string $end): float
    {
        $start = CarbonImmutable::parse($start)->startOfDay();
        $end = CarbonImmutable::parse($end)->startOfDay();

        if ($end->lt($start)) {
            return 0;
        }

        $holidays = PublicHoliday::query()->get(['date', 'is_recurring']);
        $fixed = $holidays->where('is_recurring', false)->map(fn ($h) => $h->date->toDateString())->all();
        $recurring = $holidays->where('is_recurring', true)->map(fn ($h) => $h->date->format('m-d'))->all();

        $days = 0;
        foreach (CarbonPeriod::create($start, $end) as $day) {
            if ($day->isWeekend() || in_array($day->toDateString(), $fixed, true) || in_array($day->format('m-d'), $recurring, true)) {
                continue;
            }
            $days++;
        }

        return (float) $days;
    }

    /**
     * The balance covering a date, created for the calendar year on first use.
     */
    public function balanceFor(Employee $employee, LeaveType $leaveType, string $date, ?User $actor = null): LeaveBalance
    {
        $existing = LeaveBalance::query()
            ->where('employee_id', $employee->id)
            ->where('leave_type_id', $leaveType->id)
            ->whereDate('period_start', '<=', $date)
            ->whereDate('period_end', '>=', $date)
            ->first();

        if ($existing) {
            return $existing;
        }

        $day = CarbonImmutable::parse($date);

        return LeaveBalance::query()->create([
            'employee_id' => $employee->id,
            'leave_type_id' => $leaveType->id,
            'period_start' => $day->startOfYear()->toDateString(),
            'period_end' => $day->endOfYear()->toDateString(),
            'accrued' => $this->entitlementFor($leaveType, $day),
            'created_by' => $actor?->id,
            'updated_by' => $actor?->id,
        ]);
    }

    /**
     * Days earned in the year up to $asOf. Fixed and yearly types grant the
     * full rate up front; monthly types earn the rate for each month started.
     */
    public function entitlementFor(LeaveType $leaveType, CarbonImmutable $asOf): float
    {
        $rate = (float) $leaveType->accrual_rate;

        $days = match ($leaveType->accrual_type) {
            LeaveAccrualType::Monthly => $rate * $asOf->month,
            LeaveAccrualType::HoursBased => 0.0,
            default => $rate,
        };

        if ($leaveType->max_accrual !== null && (float) $leaveType->max_accrual > 0) {
            $days = min($days, (float) $leaveType->max_accrual);
        }

        return round($days, 2);
    }

    /** Days on submitted / in-approval requests that will draw on this balance. */
    public function pendingDays(LeaveBalance $balance, ?int $ignoreRequestId = null): float
    {
        return (float) LeaveRequest::query()
            ->where('employee_id', $balance->employee_id)
            ->where('leave_type_id', $balance->leave_type_id)
            ->whereIn('status', [LeaveRequestStatus::Submitted, LeaveRequestStatus::InApproval])
            ->whereBetween('start_date', [$balance->period_start->toDateString(), $balance->period_end->toDateString()])
            ->when($ignoreRequestId, fn ($q) => $q->whereKeyNot($ignoreRequestId))
            ->sum('total_days');
    }

    public function createLeaveRequest(User $actor, Employee $employee, array $data): LeaveRequest
    {
        $leaveType = LeaveType::query()->where('is_active', true)->findOrFail($data['leave_type_id']);
        $days = $this->countWorkingDays($data['start_date'], $data['end_date']);

        if ($days <= 0) {
            throw ValidationException::withMessages(['end_date' => 'The selected dates contain no working days.']);
        }

        if ($leaveType->requires_document && empty($data['attachment_path'])) {
            throw ValidationException::withMessages(['attachment' => 'This leave type requires a supporting document.']);
        }

        $overlap = LeaveRequest::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', self::OPEN_STATUSES)
            ->whereDate('start_date', '<=', $data['end_date'])
            ->whereDate('end_date', '>=', $data['start_date'])
            ->exists();

        if ($overlap) {
            throw ValidationException::withMessages(['start_date' => 'These dates overlap another leave request.']);
        }

        return DB::transaction(function () use ($actor, $employee, $leaveType, $data, $days) {
            $balance = $this->balanceFor($employee, $leaveType, $data['start_date'], $actor);
            $available = $balance->available - $this->pendingDays($balance);

            if ($days > $available) {
                throw ValidationException::withMessages([
                    'end_date' => "Not enough {$leaveType->name} balance: {$days} day(s) requested, {$available} available.",
                ]);
            }

            $request = LeaveRequest::query()->create([
                'employee_id' => $employee->id,
                'leave_type_id' => $leaveType->id,
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'total_days' => $days,
                'reason' => $data['reason'],
                'attachment_path' => $data['attachment_path'] ?? null,
                'status' => LeaveRequestStatus::Submitted,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            if (! $leaveType->requires_approval) {
                $this->markApproved($actor, $request, $balance);
            }

            return $request->fresh();
        });
    }

    public function approveLeaveRequest(User $actor, LeaveRequest $request): LeaveRequest
    {
        if (! in_array($request->status, [LeaveRequestStatus::Submitted, LeaveRequestStatus::InApproval], true)) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
        }

        return DB::transaction(function () use ($actor, $request) {
            $balance = $this->balanceFor($request->employee, $request->leaveType, $request->start_date->toDateString(), $actor);

            if ((float) $request->total_days > $balance->available) {
                throw ValidationException::withMessages(['status' => "Not enough balance to approve: {$balance->available} day(s) available."]);
            }

            $this->markApproved($actor, $request, $balance);

            return $request->fresh();
        });
    }

    public function rejectLeaveRequest(User $actor, LeaveRequest $request, string $reason): LeaveRequest
    {
        if (! in_array($request->status, [LeaveRequestStatus::Submitted, LeaveRequestStatus::InApproval], true)) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }

        $request->update([
            'status' => LeaveRequestStatus::Rejected,
            'rejection_reason' => $reason,
            'approved_by' => $actor->id,
            'approved_at' => now(),
            'updated_by' => $actor->id,
        ]);

        return $request->fresh();
    }

    public function cancelLeaveRequest(User $actor, LeaveRequest $request, ?string $reason): LeaveRequest
    {
        if (! in_array($request->status, self::OPEN_STATUSES, true)) {
            throw ValidationException::withMessages(['status' => 'This request can no longer be cancelled.']);
        }

        return DB::transaction(function () use ($actor, $request, $reason) {
            if ($request->status === LeaveRequestStatus::Approved) {
                $balance = $this->balanceFor($request->employee, $request->leaveType, $request->start_date->toDateString(), $actor);
                $balance->update(['taken' => max(0, (float) $balance->taken - (float) $request->total_days), 'updated_by' => $actor->id]);
                $this->ledger($actor, $balance->fresh(), LeaveLedgerType::Adjustment, (float) $request->total_days, $request, 'Cancelled approved leave'.($reason ? ": {$reason}" : ''));
            }

            $request->update([
                'status' => LeaveRequestStatus::Cancelled,
                'rejection_reason' => $reason,
                'updated_by' => $actor->id,
            ]);

            return $request->fresh();
        });
    }

    public function adjustBalance(User $actor, LeaveBalance $balance, float $days, string $reason): LeaveBalance
    {
        return DB::transaction(function () use ($actor, $balance, $days, $reason) {
            $balance->update(['adjusted' => (float) $balance->adjusted + $days, 'updated_by' => $actor->id]);
            $balance = $balance->fresh();
            $this->ledger($actor, $balance, LeaveLedgerType::Adjustment, $days, null, $reason);

            return $balance;
        });
    }

    private function markApproved(User $actor, LeaveRequest $request, LeaveBalance $balance): void
    {
        $request->update([
            'status' => LeaveRequestStatus::Approved,
            'approved_by' => $actor->id,
            'approved_at' => now(),
            'updated_by' => $actor->id,
        ]);

        $balance->update(['taken' => (float) $balance->taken + (float) $request->total_days, 'updated_by' => $actor->id]);
        $this->ledger($actor, $balance->fresh(), LeaveLedgerType::Taken, -1 * (float) $request->total_days, $request, $request->reason);
    }

    private function ledger(User $actor, LeaveBalance $balance, LeaveLedgerType $type, float $days, ?LeaveRequest $request, ?string $description): void
    {
        LeaveLedger::query()->create([
            'employee_id' => $balance->employee_id,
            'leave_type_id' => $balance->leave_type_id,
            'leave_request_id' => $request?->id,
            'transaction_type' => $type,
            'days' => $days,
            'balance_after' => $balance->available,
            'reference' => $request ? "LR-{$request->id}" : null,
            'description' => $description,
            'created_by' => $actor->id,
        ]);
    }
}
