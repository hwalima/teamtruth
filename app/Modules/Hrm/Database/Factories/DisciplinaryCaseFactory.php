<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\DisciplinaryCase;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Enums\DisciplinaryOutcome;
use App\Modules\Hrm\Enums\DisciplinaryStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class DisciplinaryCaseFactory extends Factory
{
    protected $model = DisciplinaryCase::class;

    public function definition(): array
    {
        $employee = Employee::inRandomOrder()->first() ?? Employee::factory()->create();
        $company = $employee->company;
        $reportedBy = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first();

        $incidentDate = $this->faker->dateTimeBetween('-1 year', 'now');
        $reportedDate = (clone $incidentDate)->modify('+' . $this->faker->numberBetween(0, 7) . ' days');
        $status = $this->faker->randomElement(DisciplinaryStatus::cases());

        $outcome = null;
        $outcomeDate = null;
        $expiryDate = null;
        $appealDetails = null;
        $appealDecision = null;
        $appealDate = null;

        if (in_array($status, [DisciplinaryStatus::OutcomeDecided, DisciplinaryStatus::Appealed, DisciplinaryStatus::Closed])) {
            $outcome = $this->faker->randomElement(DisciplinaryOutcome::cases());
            $outcomeDate = $this->faker->dateTimeBetween($reportedDate, 'now');
            if ($outcome && $outcome->hasExpiry()) {
                $expiryDate = (clone $outcomeDate)->modify('+' . $this->faker->numberBetween(6, 24) . ' months');
            }
        }

        if (in_array($status, [DisciplinaryStatus::Appealed, DisciplinaryStatus::Closed])) {
            $appealDetails = $this->faker->optional()->paragraph();
            $appealDecision = $this->faker->randomElement(['upheld', 'overturned', 'reduced', 'increased']);
            $appealDate = $this->faker->dateTimeBetween($outcomeDate ?? $reportedDate, 'now');
        }

        return [
            'company_id' => $company->id,
            'employee_id' => $employee->id,
            'case_number' => 'DISC-' . strtoupper($this->faker->unique()->regexify('[A-Z0-9]{8}')),
            'incident_date' => $incidentDate->format('Y-m-d'),
            'reported_date' => $reportedDate->format('Y-m-d'),
            'reported_by' => $reportedBy?->id,
            'incident_description' => $this->faker->paragraph(3),
            'incident_location' => $this->faker->optional()->address(),
            'witnesses' => $this->faker->optional()->randomElements(
                array_map(fn () => ['name' => $this->faker->name(), 'contact' => $this->faker->phoneNumber(), 'statement' => $this->faker->sentence()], range(1, 3)),
                $this->faker->numberBetween(0, 3)
            ),
            'evidence_attachments' => $this->faker->optional()->randomElements(
                array_map(fn () => ['type' => $this->faker->randomElement(['document', 'photo', 'video', 'email']), 'path' => $this->faker->uuid() . '.pdf', 'description' => $this->faker->sentence()], range(1, 3)),
                $this->faker->numberBetween(0, 3)
            ),
            'status' => $status,
            'outcome' => $outcome,
            'outcome_details' => $outcome ? $this->faker->sentence() : null,
            'outcome_date' => $outcomeDate?->format('Y-m-d'),
            'expiry_date' => $expiryDate?->format('Y-m-d'),
            'appeal_details' => $appealDetails,
            'appeal_decision' => $appealDecision,
            'appeal_date' => $appealDate?->format('Y-m-d'),
            'created_by' => $reportedBy?->id,
            'updated_by' => $reportedBy?->id,
        ];
    }
}