<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->foreignId('blanket_order_id')->nullable()->after('source_requisition_id')->constrained('purchase_blanket_orders')->nullOnDelete();
            $table->date('expected_delivery_date')->nullable()->after('blanket_order_id');
            $table->index(['company_id', 'blanket_order_id'], 'pur_order_blanket_idx');
        });

        Schema::table('purchase_receipt_lines', function (Blueprint $table) {
            $table->decimal('returned_quantity', 20, 4)->default(0)->after('quantity');
        });

        Schema::table('purchase_return_lines', function (Blueprint $table) {
            $table->foreignId('stock_move_id')->nullable()->after('purchase_receipt_line_id')->constrained('stock_moves')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_return_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('stock_move_id');
        });

        Schema::table('purchase_receipt_lines', function (Blueprint $table) {
            $table->dropColumn('returned_quantity');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex('pur_order_blanket_idx');
            $table->dropConstrainedForeignId('blanket_order_id');
            $table->dropColumn('expected_delivery_date');
        });
    }
};
