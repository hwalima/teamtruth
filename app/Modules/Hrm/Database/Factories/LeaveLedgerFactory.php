<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveBalance;
use App\Modules\Hrm\Models\LeaveLedger;
use App\Modules\Hrm\Models\LeaveRequest;
use App\Modules\Hrm\Models\LeaveType;
use App\Modules\Hrm\Enums\LeaveLedgerType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeaveLedgerFactory extends Factory
{
    protected $model = LeaveLedger::class;

    public function definition(): array
    {
        $employee = Employee::inRandomOrder()->first() ?? Employee::factory()->create();
        $leaveType = LeaveType::where('company_id', $employee->company_id)->inRandomOrder()->first();
        $leaveBalance = LeaveBalance::where('company_id', $employee->company_id)
            ->where('employee_id', $employee->id)
            ->where('leave_type_id', $leaveType?->id)
            ->first();

        $transactionType = $this->faker->randomElement(LeaveLedgerType::cases());
        $days = $this->faker->randomFloat(2, 0.5, 10);

        return [
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'leave_type_id' => $leaveType?->id ?? LeaveType::factory()->create(['company_id' => $employee->company_id])->id,
            'leave_request_id' => $transactionType === LeaveLedgerType::Taken
                ? LeaveRequest::factory()->create([
                    'company_id' => $employee->company_id,
                    'employee_id' => $employee->id,
                    'leave_type_id' => $leaveType?->id,
                    'status' => \App\Modules\Hrm\Enums\LeaveRequestStatus::Approved,
                ])->id
                : null,
            'transaction_type' => $transactionType,
            'days' => $days,
            'balance_after' => $leaveBalance?->available ?? $this->faker->randomFloat(2, 0, 30),
            'reference' => $this->faker->optional()->regexify('REF-[0-9]{6}'),
            'description' => $this->faker->optional()->sentence(),
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id,
        ];
    }
}