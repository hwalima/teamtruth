<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_landed_cost_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_landed_cost_line_id')->constrained('purchase_landed_cost_lines')->restrictOnDelete();
            $table->foreignId('purchase_receipt_line_id')->constrained('purchase_receipt_lines')->restrictOnDelete();
            $table->decimal('amount', 20, 4);
            $table->timestamps();
            $table->unique(['purchase_landed_cost_line_id', 'purchase_receipt_line_id'], 'pur_lc_alloc_line_receipt_unique');
            $table->index(['company_id', 'purchase_receipt_line_id'], 'pur_lc_alloc_receipt_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_landed_cost_allocations');
    }
};
