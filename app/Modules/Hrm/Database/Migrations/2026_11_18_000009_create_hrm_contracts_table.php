<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hrm_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('hrm_employees')->cascadeOnDelete();
            $table->enum('contract_type', ['permanent', 'fixed_term', 'probation', 'casual', 'apprenticeship']);
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('probation_end_date')->nullable();
            $table->decimal('basic_salary', 18, 4)->default(0);
            $table->string('currency_code', 3)->default('USD');
            $table->enum('pay_frequency', ['weekly', 'biweekly', 'monthly'])->default('monthly');
            $table->decimal('working_hours_per_week', 5, 2)->default(40);
            $table->foreignId('shift_pattern_id')->nullable()->constrained('hrm_shift_patterns')->nullOnDelete();
            $table->foreignId('template_id')->nullable()->constrained('hrm_contract_templates')->nullOnDelete();
            $table->enum('status', ['draft', 'active', 'expired', 'terminated', 'renewed'])->default('draft');
            $table->timestamp('signed_by_employee_at')->nullable();
            $table->timestamp('signed_by_employer_at')->nullable();
            $table->string('employee_signature_path')->nullable();
            $table->string('employer_signature_path')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'employee_id']);
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hrm_contracts');
    }
};