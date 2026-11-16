<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sal_sales_order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('sales_order_id')->constrained('sal_sales_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('inventory_products')->restrictOnDelete();
            $table->string('description', 255);
            $table->decimal('quantity', 20, 4);
            $table->decimal('delivered_quantity', 20, 4)->default(0);
            $table->decimal('invoiced_quantity', 20, 4)->default(0);
            $table->decimal('unit_price', 20, 4);
            $table->decimal('discount', 20, 4)->default(0);
            $table->decimal('tax_rate', 20, 4)->default(0);
            $table->decimal('total', 20, 4)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'sales_order_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sal_sales_order_lines');
    }
};
