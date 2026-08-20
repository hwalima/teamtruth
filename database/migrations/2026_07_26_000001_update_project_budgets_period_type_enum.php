<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (
            Schema::hasTable('project_budgets') &&
            Schema::hasColumn('project_budgets', 'period_type')
        ) {
            // Update existing 'project' values to 'monthly'
            DB::table('project_budgets')
                ->where('period_type', 'project')
                ->update(['period_type' => 'monthly']);

            // Update enum definition
            Schema::table('project_budgets', function (Blueprint $table) {
                $table->enum('period_type', ['monthly', 'quarterly', 'yearly'])
                    ->default('monthly')->change();
            });
        }
    }

    public function down(): void
    {
        if (
            Schema::hasTable('project_budgets') &&
            Schema::hasColumn('project_budgets', 'period_type')
        ) {
            Schema::table('project_budgets', function (Blueprint $table) {
                $table->enum('period_type', ['project', 'monthly', 'quarterly'])
                    ->default('project')->change();
            });
        }
    }
};
