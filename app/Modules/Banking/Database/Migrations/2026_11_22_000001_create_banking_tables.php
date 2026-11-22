<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Banking: banks, the accounts they hold for group companies, every statement
 * line exactly as recorded, transfers between companies, and statement imports.
 * Amounts are decimal(18,2) so nothing is rounded on the way in.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banking_banks', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('code', 32)->nullable();
            $table->timestamps();
        });

        Schema::create('banking_statement_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('filename');
            $table->string('file_path');
            $table->string('file_hash', 64)->index();
            $table->string('status', 16)->default('preview');
            $table->json('summary')->nullable();
            $table->json('result')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('imported_at')->nullable();
            $table->timestamps();
        });

        Schema::create('banking_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bank_id')->constrained('banking_banks')->restrictOnDelete();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('account_number', 32)->unique();
            $table->string('source_account_number', 64)->nullable();
            $table->string('account_name');
            $table->string('currency', 3)->default('USD');
            $table->decimal('opening_balance', 18, 2)->default(0);
            $table->date('opening_date')->nullable();
            $table->string('status', 16)->default('active');
            $table->text('notes')->nullable();
            $table->foreignId('import_id')->nullable()->constrained('banking_statement_imports')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'status']);
        });

        Schema::create('banking_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_account_id')->constrained('banking_accounts')->restrictOnDelete();
            $table->foreignId('to_account_id')->constrained('banking_accounts')->restrictOnDelete();
            $table->date('transfer_date');
            $table->decimal('amount', 18, 2);
            $table->string('description')->nullable();
            $table->string('reference', 64)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('banking_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('banking_accounts')->cascadeOnDelete();
            $table->date('transaction_date');
            $table->unsignedInteger('sequence');
            $table->string('type', 64)->nullable();
            $table->string('description', 500)->nullable();
            $table->string('reference', 64)->nullable();
            $table->decimal('debit', 18, 2)->default(0);
            $table->decimal('credit', 18, 2)->default(0);
            // The balance the source statement printed on this line, kept for reconciliation.
            $table->decimal('stated_balance', 18, 2)->nullable();
            $table->string('source_sheet')->nullable();
            $table->unsignedInteger('source_row')->nullable();
            $table->foreignId('import_id')->nullable()->constrained('banking_statement_imports')->cascadeOnDelete();
            $table->foreignId('transfer_id')->nullable()->constrained('banking_transfers')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['account_id', 'transaction_date', 'sequence']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banking_transactions');
        Schema::dropIfExists('banking_transfers');
        Schema::dropIfExists('banking_accounts');
        Schema::dropIfExists('banking_statement_imports');
        Schema::dropIfExists('banking_banks');
    }
};
