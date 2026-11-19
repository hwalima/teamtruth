<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\ContractTemplate;
use App\Modules\Hrm\Enums\ContractType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ContractTemplateFactory extends Factory
{
    protected $model = ContractTemplate::class;

    public function definition(): array
    {
        $company = \App\Modules\Core\Models\Company::inRandomOrder()->first() ?? \App\Modules\Core\Models\Company::factory()->create();
        $contractType = $this->faker->randomElement(ContractType::cases());

        $templates = [
            ContractType::Permanent => [
                'name' => 'Standard Permanent Employment Contract',
                'description' => 'Standard permanent employment contract template',
                'template_content' => [
                    'position' => '{{position_name}}',
                    'department' => '{{department_name}}',
                    'start_date' => '{{start_date}}',
                    'basic_salary' => '{{basic_salary}}',
                    'currency' => '{{currency_code}}',
                    'pay_frequency' => '{{pay_frequency}}',
                    'working_hours' => '{{working_hours_per_week}}',
                ],
            ],
            ContractType::FixedTerm => [
                'name' => 'Fixed Term Employment Contract',
                'description' => 'Fixed term employment contract template',
                'template_content' => [
                    'position' => '{{position_name}}',
                    'department' => '{{department_name}}',
                    'start_date' => '{{start_date}}',
                    'end_date' => '{{end_date}}',
                    'basic_salary' => '{{basic_salary}}',
                    'currency' => '{{currency_code}}',
                    'pay_frequency' => '{{pay_frequency}}',
                    'working_hours' => '{{working_hours_per_week}}',
                ],
            ],
            ContractType::Probation => [
                'name' => 'Probationary Employment Contract',
                'description' => 'Probationary employment contract template',
                'template_content' => [
                    'position' => '{{position_name}}',
                    'department' => '{{department_name}}',
                    'start_date' => '{{start_date}}',
                    'probation_end_date' => '{{probation_end_date}}',
                    'basic_salary' => '{{basic_salary}}',
                    'currency' => '{{currency_code}}',
                    'pay_frequency' => '{{pay_frequency}}',
                    'working_hours' => '{{working_hours_per_week}}',
                ],
            ],
            ContractType::Casual => [
                'name' => 'Casual Employment Contract',
                'description' => 'Casual employment contract template',
                'template_content' => [
                    'position' => '{{position_name}}',
                    'department' => '{{department_name}}',
                    'start_date' => '{{start_date}}',
                    'basic_salary' => '{{basic_salary}}',
                    'currency' => '{{currency_code}}',
                    'pay_frequency' => '{{pay_frequency}}',
                    'working_hours' => '{{working_hours_per_week}}',
                ],
            ],
            ContractType::Apprenticeship => [
                'name' => 'Apprenticeship Contract',
                'description' => 'Apprenticeship contract template',
                'template_content' => [
                    'position' => '{{position_name}}',
                    'department' => '{{department_name}}',
                    'start_date' => '{{start_date}}',
                    'end_date' => '{{end_date}}',
                    'basic_salary' => '{{basic_salary}}',
                    'currency' => '{{currency_code}}',
                    'pay_frequency' => '{{pay_frequency}}',
                    'working_hours' => '{{working_hours_per_week}}',
                ],
            ],
        ];

        $template = $templates[$contractType];

        return [
            'company_id' => $company->id,
            'name' => $template['name'],
            'contract_type' => $contractType,
            'description' => $template['description'],
            'template_content' => $template['template_content'],
            'file_path' => 'hrm/contracts/templates/' . strtolower($contractType->value) . '.blade.php',
            'is_default' => true,
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
        ];
    }
}