<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hrm_positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('hrm_departments')->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 16);
            $table->text('description')->nullable();
            $table->foreignId('grade_id')->nullable()->constrained('hrm_grades')->nullOnDelete();
            $table->foreignId('reports_to_position_id')->nullable()->constrained('hrm_positions')->nullOnDelete();
            $table->unsignedInteger('headcount_planned')->default(1);
            $table->unsignedInteger('headcount_current')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'department_id']);
            $table->index(['company_id', 'grade_id']);
            $table->index(['company_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hrm_positions');
    }
};