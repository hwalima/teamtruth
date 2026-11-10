<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('requisitions', function (Blueprint $table) {
            // project_id links to the existing projects table (SaaS projects)
            if (!Schema::hasColumn('requisitions', 'project_id')) {
                $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            }

            // budget_id links to ERP budget (to be created) for budget validation
            if (!Schema::hasColumn('requisitions', 'budget_id')) {
                $table->foreignId('budget_id')->nullable()->constrained('erp_budgets')->nullOnDelete();
            }

            // budget_line is already on requisition_lines - keep as is
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('requisitions', function (Blueprint $table) {
            $table->dropForeign(['project_id']);
            $table->dropForeign(['budget_id']);
            $table->dropColumn(['project_id', 'budget_id']);
        });
    }
};
