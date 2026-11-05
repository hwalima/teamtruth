<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounting_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('accounting_accounts')->restrictOnDelete();
            $table->string('code', 32);
            $table->string('name', 160);
            $table->string('account_type', 20);
            $table->boolean('is_group')->default(false);
            $table->boolean('allow_reconciliation')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'account_type', 'is_active']);
        });

        Schema::create('accounting_journals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('code', 24);
            $table->string('name', 120);
            $table->string('journal_type', 20);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'journal_type', 'is_active']);
        });

        Schema::create('accounting_fiscal_years', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('name', 80);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('status', 16)->default('open');
            $table->timestamps();

            $table->unique(['company_id', 'name']);
            $table->index(['company_id', 'starts_on', 'ends_on']);
        });

        Schema::create('accounting_fiscal_periods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('fiscal_year_id')->constrained('accounting_fiscal_years')->restrictOnDelete();
            $table->string('name', 80);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('status', 16)->default('open');
            $table->foreignId('locked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('locked_at')->nullable();
            $table->timestamps();

            $table->unique(['fiscal_year_id', 'starts_on']);
            $table->index(
                ['company_id', 'starts_on', 'ends_on', 'status'],
                'accounting_periods_date_status_idx',
            );
        });

        Schema::create('accounting_journal_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('journal_id')->constrained('accounting_journals')->restrictOnDelete();
            $table->foreignId('fiscal_period_id')->constrained('accounting_fiscal_periods')->restrictOnDelete();
            $table->foreignId('reversal_of_id')->nullable()->constrained('accounting_journal_entries')->restrictOnDelete();
            $table->string('document_number', 100);
            $table->date('entry_date');
            $table->string('currency_code', 3);
            $table->decimal('exchange_rate', 20, 10);
            $table->string('description', 500);
            $table->string('reference', 120)->nullable();
            $table->decimal('debit_total', 20, 4);
            $table->decimal('credit_total', 20, 4);
            $table->string('status', 16)->default('posted');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('posted_at');
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->unique(['company_id', 'reversal_of_id']);
            $table->index(['company_id', 'entry_date', 'status']);
            $table->index(
                ['company_id', 'journal_id', 'entry_date'],
                'accounting_entries_journal_date_idx',
            );
        });

        Schema::create('accounting_journal_entry_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('journal_entry_id')->constrained('accounting_journal_entries')->restrictOnDelete();
            $table->foreignId('account_id')->constrained('accounting_accounts')->restrictOnDelete();
            $table->string('description', 255)->nullable();
            $table->decimal('currency_debit', 20, 4)->default(0);
            $table->decimal('currency_credit', 20, 4)->default(0);
            $table->decimal('debit', 20, 4)->default(0);
            $table->decimal('credit', 20, 4)->default(0);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(
                ['company_id', 'account_id', 'journal_entry_id'],
                'accounting_entry_lines_account_idx',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_journal_entry_lines');
        Schema::dropIfExists('accounting_journal_entries');
        Schema::dropIfExists('accounting_fiscal_periods');
        Schema::dropIfExists('accounting_fiscal_years');
        Schema::dropIfExists('accounting_journals');
        Schema::dropIfExists('accounting_accounts');
    }
};
