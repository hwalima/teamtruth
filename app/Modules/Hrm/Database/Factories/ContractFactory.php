<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\Contract;
use App\Modules\Hrm\Models\ContractTemplate;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Enums\ContractStatus;
use App\Modules\Hrm\Enums\ContractType;
use App\Modules\Hrm\Enums\PayFrequency;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ContractFactory extends Factory
{
    protected $model = Contract::class;

    public function definition(): array
    {
        $employee = Employee::inRandomOrder()->first() ?? Employee::factory()->create();
        $template = ContractTemplate::where('company_id', $employee->company_id)
            ->where('contract_type', ContractType::Permanent)
            ->inRandomOrder()->first();

        $contractType = $this->faker->randomElement(ContractType::cases());
        $startDate = $this->faker->dateTimeBetween('-2 years', 'now');
        $endDate = $contractType === ContractType::Permanent ? null : $this->faker->dateTimeBetween($startDate, '+3 years');

        return [
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'contract_type' => $contractType,
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => $endDate?->format('Y-m-d'),
            'probation_end_date' => $contractType === ContractType::Probation
                ? (clone $startDate)->modify('+3 months')->format('Y-m-d')
                : null,
            'basic_salary' => $this->faker->randomFloat(4, 500, 10000),
            'currency_code' => 'USD',
            'pay_frequency' => $this->faker->randomElement(PayFrequency::cases()),
            'working_hours_per_week' => 40,
            'shift_pattern_id' => null,
            'template_id' => $template?->id,
            'status' => $this->faker->randomElement(ContractStatus::cases()),
            'signed_by_employee_at' => $this->faker->optional()->dateTimeBetween($startDate, 'now'),
            'signed_by_employer_at' => $this->faker->optional()->dateTimeBetween($startDate, 'now'),
            'employee_signature_path' => null,
            'employer_signature_path' => null,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id,
        ];
    }

    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ContractStatus::Active,
            'start_date' => $this->faker->dateTimeBetween('-2 years', 'now')->format('Y-m-d'),
            'end_date' => $attributes['contract_type'] === ContractType::Permanent
                ? null
                : $this->faker->dateTimeBetween('now', '+3 years')->format('Y-m-d'),
        ]);
    }

    public function expiringSoon(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ContractStatus::Active,
            'end_date' => $this->faker->dateTimeBetween('now', '+30 days')->format('Y-m-d'),
        ]);
    }
}