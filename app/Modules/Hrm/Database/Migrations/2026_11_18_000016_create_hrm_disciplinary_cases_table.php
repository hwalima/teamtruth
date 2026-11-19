<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hrm_disciplinary_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('hrm_employees')->cascadeOnDelete();
            $table->string('case_number', 32);
            $table->date('incident_date');
            $table->date('reported_date');
            $table->foreignId('reported_by')->constrained('users')->cascadeOnDelete();
            $table->text('incident_description');
            $table->string('incident_location')->nullable();
            $table->json('witnesses')->nullable();
            $table->json('evidence_attachments')->nullable();
            $table->enum('status', ['open', 'under_investigation', 'notice_issued', 'hearing_scheduled', 'hearing_completed', 'outcome_decided', 'appealed', 'closed'])->default('open');
            $table->enum('outcome', ['verbal_warning', 'written_warning', 'final_warning', 'suspension', 'dismissal', 'demotion', 'no_action'])->nullable();
            $table->text('outcome_details')->nullable();
            $table->date('outcome_date')->nullable();
            $table->date('expiry_date')->nullable(); // for warnings
            $table->text('appeal_details')->nullable();
            $table->enum('appeal_decision', ['upheld', 'overturned', 'reduced', 'increased'])->nullable();
            $table->date('appeal_date')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'case_number']);
            $table->index(['company_id', 'employee_id']);
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'incident_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hrm_disciplinary_cases');
    }
};