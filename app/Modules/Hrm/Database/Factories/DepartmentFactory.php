<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\CostCenter;
use App\Modules\Hrm\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class DepartmentFactory extends Factory
{
    protected $model = Department::class;

    public function definition(): array
    {
        $company = \App\Modules\Core\Models\Company::inRandomOrder()->first() ?? \App\Modules\Core\Models\Company::factory()->create();

        $departments = [
            ['name' => 'Human Resources', 'code' => 'HR'],
            ['name' => 'Finance & Accounting', 'code' => 'FIN'],
            ['name' => 'Information Technology', 'code' => 'IT'],
            ['name' => 'Operations', 'code' => 'OPS'],
            ['name' => 'Sales & Marketing', 'code' => 'SAL'],
            ['name' => 'Procurement', 'code' => 'PRO'],
            ['name' => 'Legal & Compliance', 'code' => 'LGL'],
            ['name' => 'Administration', 'code' => 'ADM'],
            ['name' => 'Engineering', 'code' => 'ENG'],
            ['name' => 'Customer Service', 'code' => 'CSR'],
        ];

        $dept = $this->faker->randomElement($departments);

        return [
            'company_id' => $company->id,
            'parent_id' => null,
            'name' => $dept['name'],
            'code' => $dept['code'],
            'description' => $this->faker->optional()->sentence(),
            'cost_center_id' => CostCenter::where('company_id', $company->id)->inRandomOrder()->first()?->id,
            'head_id' => Employee::where('company_id', $company->id)->inRandomOrder()->first()?->id,
            'is_active' => true,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
        ];
    }

    public function withParent(): static
    {
        return $this->state(fn (array $attributes) => [
            'parent_id' => Department::where('company_id', $attributes['company_id'])->inRandomOrder()->first()?->id,
        ]);
    }
}