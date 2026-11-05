<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_vendors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('code', 40);
            $table->string('name', 255);
            $table->string('tax_no', 100)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('phone', 100)->nullable();
            $table->text('address')->nullable();
            $table->unsignedSmallInteger('payment_terms_days')->default(0);
            $table->string('currency_code', 3)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'name', 'is_active']);
        });

        Schema::create('purchase_rfqs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->string('status', 20)->default('open');
            $table->string('currency_code', 3);
            $table->string('reference', 255)->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'status', 'created_at']);
        });

        Schema::create('purchase_rfq_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_rfq_id')->constrained('purchase_rfqs')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('inventory_products')->restrictOnDelete();
            $table->decimal('quantity', 20, 4);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'purchase_rfq_id', 'sort_order']);
        });

        Schema::create('purchase_quotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_rfq_id')->constrained('purchase_rfqs')->restrictOnDelete();
            $table->foreignId('vendor_id')->constrained('purchase_vendors')->restrictOnDelete();
            $table->string('vendor_reference', 120)->nullable();
            $table->string('status', 20)->default('received');
            $table->decimal('total', 20, 4)->default(0);
            $table->timestamps();

            $table->unique(['purchase_rfq_id', 'vendor_id']);
            $table->index(['company_id', 'purchase_rfq_id', 'total']);
        });

        Schema::create('purchase_quotation_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_quotation_id')->constrained('purchase_quotations')->cascadeOnDelete();
            $table->foreignId('purchase_rfq_line_id')->constrained('purchase_rfq_lines')->restrictOnDelete();
            $table->decimal('quantity', 20, 4);
            $table->decimal('unit_price', 20, 4);
            $table->decimal('line_total', 20, 4);
            $table->timestamps();

            $table->unique(
                ['purchase_quotation_id', 'purchase_rfq_line_id'],
                'purchase_quotation_lines_quotation_rfq_line_unique',
            );
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->foreignId('vendor_id')->constrained('purchase_vendors')->restrictOnDelete();
            $table->foreignId('quotation_id')->nullable()->constrained('purchase_quotations')->restrictOnDelete();
            $table->foreignId('source_requisition_id')->nullable()->constrained('requisitions')->restrictOnDelete();
            $table->string('status', 24)->default('pending_approval');
            $table->string('currency_code', 3);
            $table->decimal('total', 20, 4);
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->unique(['company_id', 'source_requisition_id']);
            $table->index(['company_id', 'status', 'created_at']);
        });

        Schema::create('purchase_order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('inventory_products')->restrictOnDelete();
            $table->decimal('quantity', 20, 4);
            $table->decimal('received_quantity', 20, 4)->default(0);
            $table->decimal('unit_price', 20, 4);
            $table->decimal('line_total', 20, 4);
            $table->timestamps();

            $table->index(['company_id', 'purchase_order_id']);
        });

        Schema::create('purchase_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->restrictOnDelete();
            $table->foreignId('received_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('received_at');
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
        });

        Schema::create('purchase_receipt_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_receipt_id')->constrained('purchase_receipts')->cascadeOnDelete();
            $table->foreignId('purchase_order_line_id')->constrained('purchase_order_lines')->restrictOnDelete();
            $table->foreignId('stock_move_id')->constrained('stock_moves')->restrictOnDelete();
            $table->decimal('quantity', 20, 4);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_receipt_lines');
        Schema::dropIfExists('purchase_receipts');
        Schema::dropIfExists('purchase_order_lines');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('purchase_quotation_lines');
        Schema::dropIfExists('purchase_quotations');
        Schema::dropIfExists('purchase_rfq_lines');
        Schema::dropIfExists('purchase_rfqs');
        Schema::dropIfExists('purchase_vendors');
    }
};
