<?php

namespace Database\Factories;

use App\Models\Plan;
use Illuminate\Database\Eloquent\Factories\Factory;

class PlanFactory extends Factory
{
    protected $model = Plan::class;

    public function definition(): array
    {
        return [
            'name' => 'Test Plan',
            'price' => 10.00,
            'yearly_price' => 100.00,
            'duration' => 'monthly',
            'description' => 'Test plan description',
            'max_users_per_workspace' => 5,
            'max_clients_per_workspace' => 10,
            'max_managers_per_workspace' => 2,
            'max_projects_per_workspace' => 10,
            'workspace_limit' => 3,
            'enable_chatgpt' => false,
            'storage_limit' => 1,
            'is_trial' => false,
            'trial_day' => 14,
            'is_plan_enable' => true,
            'is_default' => false,
        ];
    }
}