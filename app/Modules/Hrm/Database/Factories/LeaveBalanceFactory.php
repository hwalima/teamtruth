<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveBalance;
use App\Modules\Hrm\Models\LeaveType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeaveBalanceFactory extends Factory
{
    protected $model = LeaveBalance::class;

    public function definition(): array
    {
        $employee = Employee::inRandomOrder()->first() ?? Employee::factory()->create();
        $leaveType = LeaveType::where('company_id', $employee->company_id)->inRandomOrder()->first();

        $broughtForward = $this->faker->randomFloat(2, 0, 30);
        $accrued = $this->faker->randomFloat(2, 0, 30);
        $taken = $this->faker->randomFloat(2, 0, min($broughtForward + $accrued, 20));
        $carriedOver = $this->faker->randomFloat(2, 0, 15);
        $adjusted = $this->faker->randomFloat(2, -5, 5);

        $periodStart = now()->startOfYear()->format('Y-m-d');
        $periodEnd = now()->endOfYear()->format('Y-m-d');

        return [
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'leave_type_id' => $leaveType?->id ?? LeaveType::factory()->create(['company_id' => $employee->company_id])->id,
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'brought_forward' => $broughtForward,
            'accrued' => $accrued,
            'taken' => $taken,
            'carried_over' => $carriedOver,
            'adjusted' => $adjusted,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id,
        ];
    }
}