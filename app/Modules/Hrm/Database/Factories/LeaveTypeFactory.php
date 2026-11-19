<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\LeaveType;
use App\Modules\Hrm\Enums\LeaveAccrualType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeaveTypeFactory extends Factory
{
    protected $model = LeaveType::class;

    public function definition(): array
    {
        $company = \App\Modules\Core\Models\Company::inRandomOrder()->first() ?? \App\Modules\Core\Models\Company::factory()->create();
        $accrualType = $this->faker->randomElement(LeaveAccrualType::cases());

        $leaveTypes = [
            ['name' => 'Annual Leave', 'code' => 'ANN', 'accrual_type' => LeaveAccrualType::Yearly, 'accrual_rate' => 30, 'is_paid' => true, 'color' => '#3B82F6'],
            ['name' => 'Sick Leave', 'code' => 'SCK', 'accrual_type' => LeaveAccrualType::Yearly, 'accrual_rate' => 90, 'is_paid' => true, 'color' => '#EF4444'],
            ['name' => 'Maternity Leave', 'code' => 'MAT', 'accrual_type' => LeaveAccrualType::Fixed, 'accrual_rate' => 98, 'is_paid' => true, 'color' => '#EC4899'],
            ['name' => 'Paternity Leave', 'code' => 'PAT', 'accrual_type' => LeaveAccrualType::Fixed, 'accrual_rate' => 14, 'is_paid' => true, 'color' => '#8B5CF6'],
            ['name' => 'Compassionate Leave', 'code' => 'COM', 'accrual_type' => LeaveAccrualType::Fixed, 'accrual_rate' => 5, 'is_paid' => true, 'color' => '#F59E0B'],
            ['name' => 'Study Leave', 'code' => 'STU', 'accrual_type' => LeaveAccrualType::Fixed, 'accrual_rate' => 10, 'is_paid' => false, 'color' => '#06B6D4'],
            ['name' => 'Unpaid Leave', 'code' => 'UNP', 'accrual_type' => LeaveAccrualType::Fixed, 'accrual_rate' => 0, 'is_paid' => false, 'color' => '#6B7280'],
        ];

        $type = $this->faker->randomElement($leaveTypes);

        return [
            'company_id' => $company->id,
            'name' => $type['name'],
            'code' => $type['code'],
            'description' => $this->faker->optional()->sentence(),
            'accrual_type' => $type['accrual_type'],
            'accrual_rate' => $type['accrual_rate'],
            'max_accrual' => $accrualType !== LeaveAccrualType::Fixed ? $type['accrual_rate'] * 2 : null,
            'carry_over_limit' => $type['code'] === 'ANN' ? 15 : null,
            'carry_over_expiry_months' => $type['code'] === 'ANN' ? 12 : null,
            'is_paid' => $type['is_paid'],
            'requires_approval' => true,
            'requires_document' => in_array($type['code'], ['SCK', 'MAT', 'COM']),
            'color' => $type['color'],
            'is_active' => true,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
        ];
    }
}