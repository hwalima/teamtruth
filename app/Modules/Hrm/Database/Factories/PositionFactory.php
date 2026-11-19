<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\Position;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Grade;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PositionFactory extends Factory
{
    protected $model = Position::class;

    public function definition(): array
    {
        $company = \App\Modules\Core\Models\Company::inRandomOrder()->first() ?? \App\Modules\Core\Models\Company::factory()->create();
        $department = Department::where('company_id', $company->id)->inRandomOrder()->first();
        $grade = Grade::where('company_id', $company->id)->inRandomOrder()->first();

        $positions = [
            ['name' => 'Manager', 'code' => 'MGR', 'headcount_planned' => 1],
            ['name' => 'Senior Officer', 'code' => 'SNR', 'headcount_planned' => 2],
            ['name' => 'Officer', 'code' => 'OFC', 'headcount_planned' => 3],
            ['name' => 'Assistant', 'code' => 'AST', 'headcount_planned' => 2],
            ['name' => 'Intern', 'code' => 'INT', 'headcount_planned' => 1],
            ['name' => 'Team Lead', 'code' => 'TLD', 'headcount_planned' => 1],
            ['name' => 'Specialist', 'code' => 'SPC', 'headcount_planned' => 1],
            ['name' => 'Analyst', 'code' => 'ANL', 'headcount_planned' => 2],
            ['name' => 'Coordinator', 'code' => 'CRD', 'headcount_planned' => 1],
            ['name' => 'Supervisor', 'code' => 'SUP', 'headcount_planned' => 1],
        ];

        $pos = $this->faker->randomElement($positions);

        return [
            'company_id' => $company->id,
            'department_id' => $department?->id ?? Department::factory()->create(['company_id' => $company->id])->id,
            'name' => $pos['name'],
            'code' => $pos['code'],
            'description' => $this->faker->optional()->sentence(),
            'grade_id' => $grade?->id ?? Grade::factory()->create(['company_id' => $company->id])->id,
            'reports_to_position_id' => null,
            'headcount_planned' => $pos['headcount_planned'],
            'headcount_current' => 0,
            'is_active' => true,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
        ];
    }
}