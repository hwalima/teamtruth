<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sal_quotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('inv_customers')->restrictOnDelete();
            $table->foreignId('opportunity_id')->nullable()->constrained('sal_opportunities')->restrictOnDelete();
            $table->string('document_number', 100);
            $table->string('status', 24)->default('draft');
            $table->string('currency_code', 3);
            $table->decimal('subtotal', 20, 4)->default(0);
            $table->decimal('discount_total', 20, 4)->default(0);
            $table->decimal('tax_total', 20, 4)->default(0);
            $table->decimal('total', 20, 4)->default(0);
            $table->date('valid_until')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sal_quotations');
    }
};
