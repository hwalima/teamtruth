<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * MySQL refuses a foreign key to a table that does not exist yet. The HRM
 * tables point at each other (employees -> departments -> employees, etc.),
 * so the keys that point "forward" are added here, once every table exists.
 */
return new class extends Migration
{
    /** table => [column => referenced table] */
    private array $keys = [
        'hrm_employees' => [
            'department_id' => 'hrm_departments',
            'position_id' => 'hrm_positions',
            'grade_id' => 'hrm_grades',
            'cost_center_id' => 'hrm_cost_centers',
        ],
        'hrm_contracts' => [
            'template_id' => 'hrm_contract_templates',
        ],
        'hrm_departments' => [
            'cost_center_id' => 'hrm_cost_centers',
        ],
        'hrm_positions' => [
            'grade_id' => 'hrm_grades',
        ],
    ];

    public function up(): void
    {
        foreach ($this->keys as $table => $columns) {
            Schema::table($table, function (Blueprint $blueprint) use ($columns) {
                foreach ($columns as $column => $references) {
                    $blueprint->foreign($column)->references('id')->on($references)->nullOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        foreach ($this->keys as $table => $columns) {
            Schema::table($table, function (Blueprint $blueprint) use ($columns) {
                foreach (array_keys($columns) as $column) {
                    $blueprint->dropForeign([$column]);
                }
            });
        }
    }
};
