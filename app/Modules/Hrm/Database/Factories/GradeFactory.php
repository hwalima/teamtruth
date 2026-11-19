<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\Grade;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class GradeFactory extends Factory
{
    protected $model = Grade::class;

    public function definition(): array
    {
        $company = \App\Modules\Core\Models\Company::inRandomOrder()->first() ?? \App\Modules\Core\Models\Company::factory()->create();

        $grades = [
            ['name' => 'Grade 1', 'code' => 'G1', 'level' => 1, 'min_salary' => 500, 'max_salary' => 1000],
            ['name' => 'Grade 2', 'code' => 'G2', 'level' => 2, 'min_salary' => 1000, 'max_salary' => 2000],
            ['name' => 'Grade 3', 'code' => 'G3', 'level' => 3, 'min_salary' => 2000, 'max_salary' => 3500],
            ['name' => 'Grade 4', 'code' => 'G4', 'level' => 4, 'min_salary' => 3500, 'max_salary' => 5500],
            ['name' => 'Grade 5', 'code' => 'G5', 'level' => 5, 'min_salary' => 5500, 'max_salary' => 8000],
            ['name' => 'Grade 6', 'code' => 'G6', 'level' => 6, 'min_salary' => 8000, 'max_salary' => 12000],
            ['name' => 'Grade 7', 'code' => 'G7', 'level' => 7, 'min_salary' => 12000, 'max_salary' => 20000],
            ['name' => 'Grade 8', 'code' => 'G8', 'level' => 8, 'min_salary' => 20000, 'max_salary' => 35000],
        ];

        $grade = $this->faker->randomElement($grades);

        return [
            'company_id' => $company->id,
            'name' => $grade['name'],
            'code' => $grade['code'],
            'level' => $grade['level'],
            'min_salary' => $grade['min_salary'],
            'max_salary' => $grade['max_salary'],
            'currency_code' => 'USD',
            'description' => $this->faker->optional()->sentence(),
            'is_active' => true,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
        ];
    }
}