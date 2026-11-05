<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_receipt_lines', function (Blueprint $table) {
            $table->foreign('stock_move_id', 'purchase_receipt_lines_stock_move_fk')
                ->references('id')
                ->on('stock_moves')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_receipt_lines', function (Blueprint $table) {
            $table->dropForeign('purchase_receipt_lines_stock_move_fk');
        });
    }
};
