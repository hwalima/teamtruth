<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveRequest;
use App\Modules\Hrm\Models\LeaveType;
use App\Modules\Hrm\Enums\LeaveRequestStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeaveRequestFactory extends Factory
{
    protected $model = LeaveRequest::class;

    public function definition(): array
    {
        $employee = Employee::inRandomOrder()->first() ?? Employee::factory()->create();
        $leaveType = LeaveType::where('company_id', $employee->company_id)->inRandomOrder()->first();

        $startDate = $this->faker->dateTimeBetween('-3 months', '+3 months');
        $endDate = (clone $startDate)->modify('+' . $this->faker->numberBetween(1, 10) . ' days');
        $totalDays = max(1, $startDate->diffInDays($endDate) + 1);

        $status = $this->faker->randomElement(LeaveRequestStatus::cases());

        return [
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'leave_type_id' => $leaveType?->id ?? LeaveType::factory()->create(['company_id' => $employee->company_id])->id,
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => $endDate->format('Y-m-d'),
            'start_time' => $this->faker->optional()->time(),
            'end_time' => $this->faker->optional()->time(),
            'total_days' => $totalDays,
            'reason' => $this->faker->sentence(6),
            'status' => $status,
            'approved_by' => in_array($status, [LeaveRequestStatus::Approved, LeaveRequestStatus::Rejected])
                ? User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id
                : null,
            'approved_at' => in_array($status, [LeaveRequestStatus::Approved, LeaveRequestStatus::Rejected])
                ? $this->faker->dateTimeBetween($startDate, 'now')
                : null,
            'rejection_reason' => $status === LeaveRequestStatus::Rejected ? $this->faker->sentence() : null,
            'attachment_path' => null,
            'approval_request_id' => null,
            'created_by' => $employee->user_id ?? User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => LeaveRequestStatus::Submitted,
            'approved_by' => null,
            'approved_at' => null,
        ]);
    }

    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => LeaveRequestStatus::Approved,
            'approved_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $attributes['company_id']))->inRandomOrder()->first()?->id,
            'approved_at' => $this->faker->dateTimeBetween($attributes['start_date'], 'now'),
        ]);
    }

    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => LeaveRequestStatus::Rejected,
            'approved_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $attributes['company_id']))->inRandomOrder()->first()?->id,
            'approved_at' => $this->faker->dateTimeBetween($attributes['start_date'], 'now'),
            'rejection_reason' => $this->faker->sentence(),
        ]);
    }
}