<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hrm_leave_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 16);
            $table->text('description')->nullable();
            $table->enum('accrual_type', ['fixed', 'monthly', 'yearly', 'hours_based']);
            $table->decimal('accrual_rate', 6, 2)->default(0);
            $table->decimal('max_accrual', 6, 2)->nullable();
            $table->decimal('carry_over_limit', 6, 2)->nullable();
            $table->unsignedInteger('carry_over_expiry_months')->nullable();
            $table->boolean('is_paid')->default(true);
            $table->boolean('requires_approval')->default(true);
            $table->boolean('requires_document')->default(false);
            $table->string('color', 7)->nullable(); // hex color for calendar
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hrm_leave_types');
    }
};