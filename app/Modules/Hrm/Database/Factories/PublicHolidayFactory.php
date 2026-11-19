<?php

namespace App\Modules\Hrm\Database\Factories;

use App\Modules\Hrm\Models\PublicHoliday;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PublicHolidayFactory extends Factory
{
    protected $model = PublicHoliday::class;

    public function definition(): array
    {
        $company = \App\Modules\Core\Models\Company::inRandomOrder()->first() ?? \App\Modules\Core\Models\Company::factory()->create();

        $holidays = [
            ['name' => 'New Year\'s Day', 'date' => '01-01', 'is_recurring' => true],
            ['name' => 'Independence Day', 'date' => '04-18', 'is_recurring' => true],
            ['name' => 'Workers\' Day', 'date' => '05-01', 'is_recurring' => true],
            ['name' => 'Africa Day', 'date' => '05-25', 'is_recurring' => true],
            ['name' => 'Heroes\' Day', 'date' => '08-11', 'is_recurring' => true],
            ['name' => 'Defence Forces Day', 'date' => '08-12', 'is_recurring' => true],
            ['name' => 'Unity Day', 'date' => '12-22', 'is_recurring' => true],
            ['name' => 'Christmas Day', 'date' => '12-25', 'is_recurring' => true],
            ['name' => 'Boxing Day', 'date' => '12-26', 'is_recurring' => true],
        ];

        $holiday = $this->faker->randomElement($holidays);
        $year = $this->faker->numberBetween(now()->year - 1, now()->year + 1);

        return [
            'company_id' => $company->id,
            'name' => $holiday['name'],
            'date' => "{$year}-{$holiday['date']}",
            'is_recurring' => $holiday['is_recurring'],
            'description' => $this->faker->optional()->sentence(),
            'created_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
            'updated_by' => User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))->inRandomOrder()->first()?->id,
        ];
    }
}