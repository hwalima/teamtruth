<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Core\Models\Company;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\EmployeeTransfer;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class EmployeeTransferFactory extends Factory
{
    protected $model = EmployeeTransfer::class;

    public function definition(): array
    {
        $company = Company::inRandomOrder()->first() ?? Company::factory()->create();
        $employee = Employee::where('company_id', $company->id)->inRandomOrder()->first();
        $fromSubsidiary = Company::where('company_id', $company->id)->orWhere('parent_id', $company->id)->inRandomOrder()->first();
        $toSubsidiary = Company::where('company_id', $company->id)->orWhere('parent_id', $company->id)->inRandomOrder()->first();

        return [
            'company_id' => $company->id,
            'employee_id' => $employee?->id ?? Employee::factory()->create(['company_id' => $company->id])->id,
            'from_subsidiary_id' => $fromSubsidiary?->id ?? $company->id,
            'to_subsidiary_id' => $toSubsidiary?->id ?? $company->id,
            'transfer_date' => $this->faker->dateTimeBetween('-1 year', 'now'),
            'reason' => $this->faker->optional()->sentence(),
            'approved_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
        ];
    }
}