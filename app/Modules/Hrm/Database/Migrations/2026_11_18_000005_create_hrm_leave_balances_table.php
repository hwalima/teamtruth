<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hrm_leave_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('hrm_employees')->cascadeOnDelete();
            $table->foreignId('leave_type_id')->constrained('hrm_leave_types')->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('brought_forward', 6, 2)->default(0);
            $table->decimal('accrued', 6, 2)->default(0);
            $table->decimal('taken', 6, 2)->default(0);
            $table->decimal('carried_over', 6, 2)->default(0);
            $table->decimal('adjusted', 6, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'employee_id', 'leave_type_id', 'period_start'], 'hrm_leave_balances_period_unique');
            $table->index(['company_id', 'employee_id']);
            $table->index(['company_id', 'period_start', 'period_end']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hrm_leave_balances');
    }
};