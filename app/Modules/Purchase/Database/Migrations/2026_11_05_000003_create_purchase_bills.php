<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->foreignId('vendor_id')->constrained('purchase_vendors')->restrictOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->restrictOnDelete();
            $table->foreignId('purchase_receipt_id')->nullable()->constrained('purchase_receipts')->restrictOnDelete();
            $table->string('vendor_reference', 120)->nullable();
            $table->string('status', 24)->default('draft');
            $table->string('currency_code', 3);
            $table->decimal('exchange_rate', 20, 10)->default(1);
            $table->decimal('untaxed_amount', 20, 4)->default(0);
            $table->decimal('tax_amount', 20, 4)->default(0);
            $table->decimal('total_amount', 20, 4)->default(0);
            $table->decimal('amount_paid', 20, 4)->default(0);
            $table->decimal('amount_residual', 20, 4)->default(0);
            $table->date('bill_date');
            $table->date('due_date')->nullable();
            $table->foreignId('journal_id')->nullable()->constrained('accounting_journals')->restrictOnDelete();
            $table->foreignId('account_id')->nullable()->constrained('accounting_accounts')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'vendor_id', 'status']);
            $table->index(['company_id', 'purchase_order_id']);
            $table->index(['company_id', 'purchase_receipt_id']);
        });

        Schema::create('purchase_bill_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_bill_id')->constrained('purchase_bills')->cascadeOnDelete();
            $table->foreignId('purchase_order_line_id')->nullable()->constrained('purchase_order_lines')->restrictOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('inventory_products')->restrictOnDelete();
            $table->string('name', 500);
            $table->string('account_code', 40)->nullable();
            $table->decimal('quantity', 20, 4)->default(1);
            $table->decimal('unit_price', 20, 4);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 20, 4)->default(0);
            $table->decimal('line_total', 20, 4);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'purchase_bill_id', 'sort_order']);
        });

        Schema::create('purchase_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->foreignId('vendor_id')->constrained('purchase_vendors')->restrictOnDelete();
            $table->foreignId('journal_id')->constrained('accounting_journals')->restrictOnDelete();
            $table->string('payment_method', 40);
            $table->string('currency_code', 3);
            $table->decimal('exchange_rate', 20, 10)->default(1);
            $table->decimal('amount', 20, 4);
            $table->date('payment_date');
            $table->string('reference', 255)->nullable();
            $table->string('status', 20)->default('draft');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'vendor_id', 'status']);
            $table->index(['company_id', 'payment_date']);
        });

        Schema::create('purchase_payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_payment_id')->constrained('purchase_payments')->cascadeOnDelete();
            $table->foreignId('purchase_bill_id')->constrained('purchase_bills')->restrictOnDelete();
            $table->decimal('amount', 20, 4);
            $table->decimal('exchange_rate_gain_loss', 20, 4)->default(0);
            $table->timestamps();
        });

        Schema::create('purchase_vendor_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('vendor_id')->constrained('purchase_vendors')->restrictOnDelete();
            $table->unsignedSmallInteger('period_year');
            $table->unsignedTinyInteger('period_month');
            $table->decimal('on_time_delivery_rate', 5, 2)->default(0);
            $table->decimal('price_variance', 10, 2)->default(0);
            $table->decimal('rejection_rate', 5, 2)->default(0);
            $table->unsignedInteger('total_orders')->default(0);
            $table->unsignedInteger('on_time_orders')->default(0);
            $table->unsignedInteger('total_receipts')->default(0);
            $table->unsignedInteger('rejected_receipts')->default(0);
            $table->timestamps();

            $table->unique(['company_id', 'vendor_id', 'period_year', 'period_month'], 'pur_vendor_eval_unique');
            $table->index(['company_id', 'period_year', 'period_month']);
        });

        Schema::create('purchase_vendor_price_lists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('vendor_id')->constrained('purchase_vendors')->restrictOnDelete();
            $table->foreignId('product_id')->constrained('inventory_products')->restrictOnDelete();
            $table->decimal('min_quantity', 20, 4)->default(1);
            $table->decimal('price', 20, 4);
            $table->string('currency_code', 3);
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'vendor_id', 'product_id', 'valid_from'], 'pur_vendor_pricelist_idx');
        });

        Schema::create('purchase_blanket_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->foreignId('vendor_id')->constrained('purchase_vendors')->restrictOnDelete();
            $table->string('currency_code', 3);
            $table->decimal('max_amount', 20, 4)->default(0);
            $table->decimal('amount_used', 20, 4)->default(0);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('status', 20)->default('active');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'vendor_id', 'status']);
        });

        Schema::create('purchase_blanket_order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_blanket_order_id')->constrained('purchase_blanket_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('inventory_products')->restrictOnDelete();
            $table->decimal('quantity', 20, 4);
            $table->decimal('unit_price', 20, 4);
            $table->decimal('quantity_delivered', 20, 4)->default(0);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'purchase_blanket_order_id', 'sort_order']);
        });

        Schema::create('purchase_landed_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->foreignId('purchase_receipt_id')->constrained('purchase_receipts')->restrictOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained('purchase_vendors')->restrictOnDelete();
            $table->string('currency_code', 3);
            $table->decimal('total_amount', 20, 4);
            $table->string('status', 20)->default('draft');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'purchase_receipt_id']);
        });

        Schema::create('purchase_landed_cost_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_landed_cost_id')->constrained('purchase_landed_costs')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('inventory_products')->restrictOnDelete();
            $table->foreignId('account_id')->constrained('accounting_accounts')->restrictOnDelete();
            $table->string('name', 255);
            $table->decimal('amount', 20, 4);
            $table->string('split_method', 20)->default('by_quantity');
            $table->timestamps();
        });

        Schema::create('purchase_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->foreignId('vendor_id')->constrained('purchase_vendors')->restrictOnDelete();
            $table->foreignId('purchase_receipt_id')->constrained('purchase_receipts')->restrictOnDelete();
            $table->foreignId('source_location_id')->constrained('stock_locations')->restrictOnDelete();
            $table->foreignId('destination_location_id')->constrained('stock_locations')->restrictOnDelete();
            $table->string('status', 20)->default('draft');
            $table->date('return_date');
            $table->text('reason')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'vendor_id', 'status']);
        });

        Schema::create('purchase_return_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_return_id')->constrained('purchase_returns')->cascadeOnDelete();
            $table->foreignId('purchase_receipt_line_id')->constrained('purchase_receipt_lines')->restrictOnDelete();
            $table->decimal('quantity', 20, 4);
            $table->string('lot_code', 120)->nullable();
            $table->text('reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_return_lines');
        Schema::dropIfExists('purchase_returns');
        Schema::dropIfExists('purchase_landed_cost_lines');
        Schema::dropIfExists('purchase_landed_costs');
        Schema::dropIfExists('purchase_blanket_order_lines');
        Schema::dropIfExists('purchase_blanket_orders');
        Schema::dropIfExists('purchase_vendor_price_lists');
        Schema::dropIfExists('purchase_vendor_evaluations');
        Schema::dropIfExists('purchase_payment_allocations');
        Schema::dropIfExists('purchase_payments');
        Schema::dropIfExists('purchase_bill_lines');
        Schema::dropIfExists('purchase_bills');
    }
};