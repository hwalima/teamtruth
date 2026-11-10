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
        Schema::create('erp_budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('name', 120);
            $table->string('code', 40); // e.g., "BUD-2026-Q1"
            $table->text('description')->nullable();
            $table->string('period_type', 20); // annual, quarterly, monthly
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('total_amount', 20, 4)->default(0);
            $table->string('currency_code', 3);
            $table->enum('status', ['draft', 'active', 'closed', 'archived'])->default('draft');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'status', 'start_date', 'end_date']);
        });

        Schema::create('erp_budget_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('budget_id')->constrained('erp_budgets')->cascadeOnDelete();
            $table->string('code', 60); // e.g., "6100", "IT-EQUIP"
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->decimal('allocated_amount', 20, 4)->default(0);
            $table->string('currency_code', 3);
            $table->foreignId('parent_id')->nullable()->constrained('erp_budget_lines')->nullOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['budget_id', 'code']);
            $table->index(['company_id', 'budget_id', 'is_active']);
        });

        Schema::create('erp_budget_commitments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('budget_line_id')->constrained('erp_budget_lines')->cascadeOnDelete();
            $table->string('commitment_type', 40); // requisition, purchase_order, expense
            $table->unsignedBigInteger('commitment_id');
            $table->decimal('amount', 20, 4);
            $table->string('currency_code', 3);
            $table->enum('status', ['reserved', 'confirmed', 'released', 'cancelled'])->default('reserved');
            $table->timestamps();

            $table->index(['company_id', 'budget_line_id', 'status']);
            $table->index(['commitment_type', 'commitment_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('erp_budget_commitments');
        Schema::dropIfExists('erp_budget_lines');
        Schema::dropIfExists('erp_budgets');
    }
};
