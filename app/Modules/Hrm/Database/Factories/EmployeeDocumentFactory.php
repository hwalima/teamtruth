<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\EmployeeDocument;
use App\Modules\Hrm\Enums\EmployeeDocumentType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class EmployeeDocumentFactory extends Factory
{
    protected $model = EmployeeDocument::class;

    public function definition(): array
    {
        $employee = Employee::inRandomOrder()->first() ?? Employee::factory()->create();

        return [
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'document_type' => $this->faker->randomElement(EmployeeDocumentType::cases()),
            'document_number' => $this->faker->optional()->regexify('DOC-[0-9]{6}'),
            'title' => $this->faker->sentence(3),
            'description' => $this->faker->optional()->paragraph(),
            'file_path' => 'hrm/documents/' . $this->faker->uuid() . '.pdf',
            'file_mime' => 'application/pdf',
            'file_size' => $this->faker->numberBetween(50000, 5000000),
            'issued_date' => $this->faker->dateTimeBetween('-2 years', 'now'),
            'expiry_date' => $this->faker->optional()->dateTimeBetween('now', '+5 years'),
            'is_expired_alert_sent' => false,
            'alert_before_days' => 30,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $employee->company_id))->inRandomOrder()->first()?->id,
        ];
    }

    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'expiry_date' => $this->faker->dateTimeBetween('-6 months', '-1 day'),
        ]);
    }

    public function expiringSoon(): static
    {
        return $this->state(fn (array $attributes) => [
            'expiry_date' => $this->faker->dateTimeBetween('now', '+30 days'),
        ]);
    }
}