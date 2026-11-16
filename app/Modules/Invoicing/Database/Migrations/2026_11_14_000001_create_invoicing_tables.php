<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Customers (partners for invoicing)
        Schema::create('inv_customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('code', 50)->unique(); // per company
            $table->string('name');
            $table->string('tax_no')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('billing_address')->nullable();
            $table->text('shipping_address')->nullable();
            $table->foreignId('payment_term_id')->nullable()->constrained('inv_payment_terms')->nullOnDelete();
            $table->string('currency_code', 3)->default('USD');
            $table->decimal('credit_limit', 18, 4)->default(0);
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'is_active']);
        });

        // Payment Terms
        Schema::create('inv_payment_terms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('code', 50);
            $table->string('name');
            $table->string('description')->nullable();
            $table->integer('net_days')->default(30);
            $table->integer('discount_days')->nullable();
            $table->decimal('discount_percent', 5, 2)->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'is_active']);
        });

        // Invoices
        Schema::create('inv_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('document_number', 100); // from SequenceService
            $table->foreignId('customer_id')->constrained('inv_customers')->restrictOnDelete();
            $table->enum('status', ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'proforma', 'partial_paid'])->default('draft');
            $table->enum('type', ['invoice', 'proforma'])->default('invoice');
            $table->date('invoice_date');
            $table->date('due_date')->nullable();
            $table->string('currency_code', 3);
            $table->decimal('exchange_rate', 18, 10)->default(1);
            $table->decimal('subtotal', 18, 4)->default(0);
            $table->decimal('tax_amount', 18, 4)->default(0);
            $table->decimal('discount_amount', 18, 4)->default(0);
            $table->decimal('total_amount', 18, 4)->default(0);
            $table->decimal('paid_amount', 18, 4)->default(0);
            $table->decimal('balance_due', 18, 4)->default(0);
            $table->foreignId('journal_id')->nullable()->constrained('accounting_journals')->nullOnDelete();
            $table->foreignId('fiscal_period_id')->nullable()->constrained('accounting_fiscal_periods')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->text('terms')->nullable();
            $table->text('footer_notes')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'customer_id', 'status']);
            $table->index(['company_id', 'invoice_date']);
            $table->index(['company_id', 'due_date', 'status']);
        });

        // Invoice Lines
        Schema::create('inv_invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained('inv_invoices')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('inventory_products')->nullOnDelete();
            $table->foreignId('account_id')->nullable()->constrained('accounting_accounts')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('quantity', 18, 4)->default(1);
            $table->string('unit', 20)->nullable(); // e.g., 'pcs', 'hours', 'kg'
            $table->decimal('unit_price', 18, 4)->default(0);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('discount_amount', 18, 4)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 18, 4)->default(0);
            $table->decimal('line_total', 18, 4)->default(0);
            $table->integer('sort_order')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['invoice_id', 'sort_order']);
        });

        // Credit Notes
        Schema::create('inv_credit_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('document_number', 100);
            $table->foreignId('customer_id')->constrained('inv_customers')->restrictOnDelete();
            $table->foreignId('original_invoice_id')->nullable()->constrained('inv_invoices')->nullOnDelete();
            $table->enum('status', ['draft', 'issued', 'applied', 'cancelled'])->default('draft');
            $table->date('credit_note_date');
            $table->string('currency_code', 3);
            $table->decimal('exchange_rate', 18, 10)->default(1);
            $table->decimal('subtotal', 18, 4)->default(0);
            $table->decimal('tax_amount', 18, 4)->default(0);
            $table->decimal('total_amount', 18, 4)->default(0);
            $table->decimal('applied_amount', 18, 4)->default(0);
            $table->decimal('balance_due', 18, 4)->default(0);
            $table->text('reason')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('journal_id')->nullable()->constrained('accounting_journals')->nullOnDelete();
            $table->foreignId('fiscal_period_id')->nullable()->constrained('accounting_fiscal_periods')->nullOnDelete();
            $table->timestamp('issued_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'customer_id', 'status']);
        });

        // Credit Note Lines
        Schema::create('inv_credit_note_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('credit_note_id')->constrained('inv_credit_notes')->cascadeOnDelete();
            $table->foreignId('invoice_line_id')->nullable()->constrained('inv_invoice_lines')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('inventory_products')->nullOnDelete();
            $table->foreignId('account_id')->nullable()->constrained('accounting_accounts')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('quantity', 18, 4)->default(1);
            $table->string('unit', 20)->nullable();
            $table->decimal('unit_price', 18, 4)->default(0);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 18, 4)->default(0);
            $table->decimal('line_total', 18, 4)->default(0);
            $table->integer('sort_order')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['credit_note_id', 'sort_order']);
        });

        // Recurring Invoices
        Schema::create('inv_recurring_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->foreignId('customer_id')->constrained('inv_customers')->restrictOnDelete();
            $table->foreignId('payment_term_id')->nullable()->constrained('inv_payment_terms')->nullOnDelete();
            $table->string('currency_code', 3);
            $table->enum('frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
            $table->integer('interval')->default(1); // every N periods
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('next_run_date');
            $table->integer('max_occurrences')->nullable();
            $table->integer('occurrences_count')->default(0);
            $table->enum('status', ['active', 'paused', 'completed', 'cancelled'])->default('active');
            $table->json('template_data'); // stores invoice lines, notes, terms, etc.
            $table->text('notes')->nullable();
            $table->text('terms')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'status', 'next_run_date']);
        });

        // Invoice Payments (allocations)
        Schema::create('inv_invoice_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained('inv_invoices')->cascadeOnDelete();
            $table->foreignId('credit_note_id')->nullable()->constrained('inv_credit_notes')->nullOnDelete();
            $table->date('payment_date');
            $table->string('currency_code', 3);
            $table->decimal('exchange_rate', 18, 10)->default(1);
            $table->decimal('amount', 18, 4)->default(0);
            $table->decimal('base_amount', 18, 4)->default(0); // in company currency
            $table->string('payment_method')->nullable(); // cash, bank, card, mobile_money, etc.
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'invoice_id']);
            $table->index(['company_id', 'credit_note_id']);
            $table->index(['company_id', 'payment_date']);
        });

        // Fiscal Documents (ZIMRA integration)
        Schema::create('inv_fiscal_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->morphs('document'); // invoice or credit_note
            $table->string('fiscal_device_id')->nullable();
            $table->string('fiscal_invoice_number')->nullable();
            $table->string('fiscal_receipt_number')->nullable();
            $table->string('fiscal_day_end_number')->nullable();
            $table->string('fiscal_signature')->nullable();
            $table->string('fiscal_qr_code')->nullable();
            $table->timestamp('fiscalized_at')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();
            $table->enum('status', ['pending', 'success', 'failed', 'void'])->default('pending');
            $table->text('error_message')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'document_type', 'document_id']);
            $table->index(['company_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inv_fiscal_documents');
        Schema::dropIfExists('inv_invoice_payments');
        Schema::dropIfExists('inv_recurring_invoices');
        Schema::dropIfExists('inv_credit_note_lines');
        Schema::dropIfExists('inv_credit_notes');
        Schema::dropIfExists('inv_invoice_lines');
        Schema::dropIfExists('inv_invoices');
        Schema::dropIfExists('inv_payment_terms');
        Schema::dropIfExists('inv_customers');
    }
};