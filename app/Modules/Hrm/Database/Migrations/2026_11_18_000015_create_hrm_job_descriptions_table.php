<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hrm_job_descriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('position_id')->constrained('hrm_positions')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->text('purpose');
            $table->json('key_duties')->nullable();
            $table->json('kpis')->nullable();
            $table->text('qualifications')->nullable();
            $table->text('experience_required')->nullable();
            $table->text('skills_required')->nullable();
            $table->text('reporting_line')->nullable();
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamp('acknowledged_by_employee_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'position_id', 'version']);
            $table->index(['company_id', 'position_id']);
            $table->index(['company_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hrm_job_descriptions');
    }
};