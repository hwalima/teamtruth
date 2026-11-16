<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->foreignId('blanket_order_line_id')->nullable()->after('purchase_order_id')->constrained('purchase_blanket_order_lines')->nullOnDelete();
            $table->index(['company_id', 'blanket_order_line_id'], 'pur_order_line_blanket_line_idx');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->dropIndex('pur_order_line_blanket_line_idx');
            $table->dropConstrainedForeignId('blanket_order_line_id');
        });
    }
};
