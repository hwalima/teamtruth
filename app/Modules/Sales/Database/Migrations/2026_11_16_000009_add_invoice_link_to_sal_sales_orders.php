<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sal_sales_orders', function (Blueprint $table) {
            $table->foreignId('invoice_id')->nullable()->unique()->after('quotation_id')->constrained('inv_invoices')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sal_sales_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invoice_id');
        });
    }
};
