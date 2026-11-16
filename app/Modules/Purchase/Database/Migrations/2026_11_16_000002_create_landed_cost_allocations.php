<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tableName = 'purchase_landed_cost_allocations';
        if (Schema::hasTable($tableName)) {
            if (DB::table($tableName)->exists()) {
                throw new RuntimeException('Refusing to replace non-empty purchase landed-cost allocations table.');
            }

            Schema::drop($tableName);
        }

        Schema::create($tableName, function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_landed_cost_line_id')->constrained('purchase_landed_cost_lines', 'id', 'pur_lca_cost_line_fk')->restrictOnDelete();
            $table->foreignId('purchase_receipt_line_id')->constrained('purchase_receipt_lines', 'id', 'pur_lca_receipt_line_fk')->restrictOnDelete();
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
