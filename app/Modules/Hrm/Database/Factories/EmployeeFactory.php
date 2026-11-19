<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Core\Models\Company;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Grade;
use App\Modules\Hrm\Models\Position;
use App\Modules\Hrm\Models\CostCenter;
use App\Modules\Hrm\Enums\EmployeeStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class EmployeeFactory extends Factory
{
    protected $model = Employee::class;

    public function definition(): array
    {
        $company = Company::inRandomOrder()->first() ?? Company::factory()->create();

        return [
            'company_id' => $company->id,
            'user_id' => null,
            'employee_number' => 'EMP-' . strtoupper(Str::random(8)),
            'first_name' => $this->faker->firstName(),
            'last_name' => $this->faker->lastName(),
            'middle_name' => $this->faker->optional()->firstName(),
            'gender' => $this->faker->randomElement(['male', 'female']),
            'date_of_birth' => $this->faker->dateTimeBetween('-50 years', '-18 years'),
            'national_id' => $this->faker->optional()->regexify('[0-9]{6}[A-Z]{2}[0-9]{3}[A-Z]'),
            'passport_number' => $this->faker->optional()->regexify('[A-Z]{2}[0-9]{7}'),
            'marital_status' => $this->faker->randomElement(['single', 'married', 'divorced', 'widowed']),
            'nationality' => 'Zimbabwean',
            'personal_email' => $this->faker->unique()->safeEmail(),
            'personal_phone' => $this->faker->phoneNumber(),
            'emergency_contact_name' => $this->faker->name(),
            'emergency_contact_phone' => $this->faker->phoneNumber(),
            'emergency_contact_relation' => $this->faker->randomElement(['Spouse', 'Parent', 'Sibling', 'Friend']),
            'bank_name' => $this->faker->randomElement(['CBZ Bank', 'Standard Chartered', 'FBC Bank', 'Steward Bank', 'NMB Bank']),
            'bank_account_name' => $this->faker->name(),
            'bank_account_number' => $this->faker->regexify('[0-9]{10}'),
            'bank_branch' => $this->faker->city(),
            'tax_number' => $this->faker->optional()->regexify('[0-9]{9}[A-Z]'),
            'nssa_number' => $this->faker->optional()->regexify('[0-9]{10}'),
            'profile_photo_path' => null,
            'status' => EmployeeStatus::Active,
            'hire_date' => $this->faker->dateTimeBetween('-5 years', 'now'),
            'termination_date' => null,
            'termination_reason' => null,
            'line_manager_id' => null,
            'department_id' => Department::where('company_id', $company->id)->inRandomOrder()->first()?->id,
            'position_id' => Position::where('company_id', $company->id)->inRandomOrder()->first()?->id,
            'grade_id' => Grade::where('company_id', $company->id)->inRandomOrder()->first()?->id,
            'cost_center_id' => CostCenter::where('company_id', $company->id)->inRandomOrder()->first()?->id,
            'created_by' => $company->users()->inRandomOrder()->first()?->id,
            'updated_by' => $company->users()->inRandomOrder()->first()?->id,
        ];
    }

    public function withManager(): static
    {
        return $this->state(fn (array $attributes) => [
            'line_manager_id' => Employee::where('company_id', $attributes['company_id'])->inRandomOrder()->first()?->id,
        ]);
    }

    public function terminated(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => EmployeeStatus::Terminated,
            'termination_date' => $this->faker->dateTimeBetween($attributes['hire_date'], 'now'),
            'termination_reason' => $this->faker->randomElement(['Resignation', 'Retrenchment', 'Dismissal', 'Mutual Agreement', 'Retirement']),
        ]);
    }

    public function onLeave(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => EmployeeStatus::OnLeave,
        ]);
    }

    public function probation(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => EmployeeStatus::Probation,
            'hire_date' => $this->faker->dateTimeBetween('-3 months', 'now'),
        ]);
    }
}