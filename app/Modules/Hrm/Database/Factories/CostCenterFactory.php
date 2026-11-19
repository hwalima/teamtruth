<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\CostCenter;
use App\Modules\Hrm\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CostCenterFactory extends Factory
{
    protected $model = CostCenter::class;

    public function definition(): array
    {
        $company = \App\Modules\Core\Models\Company::inRandomOrder()->first() ?? \App\Modules\Core\Models\Company::factory()->create();

        $costCenters = [
            ['name' => 'HR Operations', 'code' => 'HR001'],
            ['name' => 'Finance Operations', 'code' => 'FIN001'],
            ['name' => 'IT Operations', 'code' => 'IT001'],
            ['name' => 'Sales Operations', 'code' => 'SAL001'],
            ['name' => 'Operations', 'code' => 'OPS001'],
            ['name' => 'Marketing', 'code' => 'MKT001'],
            ['name' => 'Administration', 'code' => 'ADM001'],
            ['name' => 'Engineering', 'code' => 'ENG001'],
            ['name' => 'Project Management', 'code' => 'PM001'],
            ['name' => 'Corporate', 'code' => 'CORP001'],
        ];

        $cc = $this->faker->randomElement($costCenters);

        return [
            'company_id' => $company->id,
            'parent_id' => null,
            'name' => $cc['name'],
            'code' => $cc['code'],
            'description' => $this->faker->optional()->sentence(),
            'budget_owner_id' => Employee::where('company_id', $company->id)->inRandomOrder()->first()?->id,
            'is_active' => true,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
        ];
    }

    public function withParent(): static
    {
        return $this->state(fn (array $attributes) => [
            'parent_id' => CostCenter::where('company_id', $attributes['company_id'])->inRandomOrder()->first()?->id,
        ]);
    }
}