<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Deliveries against sales orders (stock out to the customer), and every invoice raised from an order. Safe to run again. */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('sal_deliveries')) {
            Schema::create('sal_deliveries', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->restrictOnDelete();
                $table->foreignId('sales_order_id')->constrained('sal_sales_orders')->restrictOnDelete();
                $table->string('document_number', 100);
                $table->foreignId('delivered_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('delivered_at');
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'document_number']);
                $table->index(['company_id', 'sales_order_id']);
            });
        }

        if (! Schema::hasTable('sal_delivery_lines')) {
            Schema::create('sal_delivery_lines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->restrictOnDelete();
                $table->foreignId('delivery_id')->constrained('sal_deliveries')->cascadeOnDelete();
                $table->foreignId('sales_order_line_id')->constrained('sal_sales_order_lines')->restrictOnDelete();
                $table->foreignId('stock_move_id')->nullable()->constrained('stock_moves')->nullOnDelete();
                $table->foreignId('from_location_id')->nullable()->constrained('stock_locations')->nullOnDelete();
                $table->decimal('quantity', 20, 4);
                $table->string('lot_code', 100)->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('sal_sales_order_invoices')) {
            Schema::create('sal_sales_order_invoices', function (Blueprint $table) {
                $table->id();
                $table->foreignId('company_id')->constrained()->restrictOnDelete();
                $table->foreignId('sales_order_id')->constrained('sal_sales_orders')->cascadeOnDelete();
                $table->foreignId('invoice_id')->constrained('inv_invoices')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['sales_order_id', 'invoice_id']);
            });
        }

        Schema::table('sal_sales_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('sal_sales_orders', 'customer_reference')) {
                $table->string('customer_reference', 100)->nullable();
            }
            if (! Schema::hasColumn('sal_sales_orders', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sal_sales_order_invoices');
        Schema::dropIfExists('sal_delivery_lines');
        Schema::dropIfExists('sal_deliveries');
        Schema::table('sal_sales_orders', function (Blueprint $table) {
            foreach (['customer_reference', 'notes'] as $column) {
                if (Schema::hasColumn('sal_sales_orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
