<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\JobDescription;
use App\Modules\Hrm\Models\Position;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class JobDescriptionFactory extends Factory
{
    protected $model = JobDescription::class;

    public function definition(): array
    {
        $position = Position::inRandomOrder()->first() ?? Position::factory()->create();
        $company = $position->company;

        return [
            'company_id' => $company->id,
            'position_id' => $position->id,
            'version' => 1,
            'purpose' => $this->faker->paragraph(2),
            'key_duties' => $this->faker->randomElements([
                'Manage daily operations and team activities',
                'Develop and implement departmental strategies',
                'Monitor and report on key performance indicators',
                'Ensure compliance with company policies and regulations',
                'Coordinate with other departments on cross-functional projects',
                'Mentor and develop team members',
                'Prepare and present reports to senior management',
                'Manage budget and resource allocation',
            ], $this->faker->numberBetween(3, 6)),
            'kpis' => $this->faker->randomElements([
                'Team productivity increase of 10% YoY',
                'Employee satisfaction score > 4.0/5.0',
                'Project delivery on-time rate > 90%',
                'Budget variance < 5%',
                'Customer satisfaction score > 4.2/5.0',
                'Staff turnover rate < 15%',
            ], $this->faker->numberBetween(2, 4)),
            'qualifications' => $this->faker->randomElement([
                'Bachelor\'s degree in relevant field',
                'Master\'s degree preferred',
                'Professional certification (e.g., CIPD, ACCA, PMP)',
                'Diploma with 5+ years experience',
            ]),
            'experience_required' => $this->faker->randomElement([
                '3-5 years in similar role',
                '5-7 years with 2 years in leadership',
                '7+ years with proven track record',
                '2-3 years for junior positions',
            ]),
            'skills_required' => $this->faker->randomElement([
                'Leadership, Communication, Problem Solving, Strategic Planning',
                'Project Management, Data Analysis, Reporting, Stakeholder Management',
                'Technical expertise, Team Building, Conflict Resolution, Decision Making',
                'Financial Management, Process Improvement, Change Management, Negotiation',
            ]),
            'reporting_line' => $position->reportsTo?->name ?? 'Department Head',
            'status' => $this->faker->randomElement(['draft', 'published', 'archived']),
            'published_at' => $this->faker->optional()->dateTimeBetween('-1 year', 'now'),
            'acknowledged_by_employee_at' => null,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'published',
            'published_at' => $this->faker->dateTimeBetween('-6 months', 'now'),
        ]);
    }
}