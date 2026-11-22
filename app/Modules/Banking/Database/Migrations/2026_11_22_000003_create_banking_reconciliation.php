<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bank reconciliation: each statement line is either matched to the payments
 * recorded for it (customer receipts for money in, vendor payments for money
 * out) or explained with a note, such as bank charges. A payment can sit on
 * one statement line only.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banking_transactions', function (Blueprint $table) {
            $table->string('reconcile_kind', 16)->nullable()->after('transfer_id');
            $table->string('reconcile_note')->nullable()->after('reconcile_kind');
            $table->timestamp('reconciled_at')->nullable()->after('reconcile_note');
            $table->foreignId('reconciled_by')->nullable()->after('reconciled_at')->constrained('users')->nullOnDelete();
        });

        Schema::create('banking_reconciliation_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('banking_transactions')->cascadeOnDelete();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            // customer_payment (inv_invoice_payments) or vendor_payment (purchase_payments)
            $table->string('matchable_type', 32);
            $table->unsignedBigInteger('matchable_id');
            $table->decimal('amount', 18, 2);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['matchable_type', 'matchable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banking_reconciliation_matches');
        Schema::table('banking_transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reconciled_by');
            $table->dropColumn(['reconcile_kind', 'reconcile_note', 'reconciled_at']);
        });
    }
};
