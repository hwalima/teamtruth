<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bank reconciliation: each statement line is either matched to the payments
 * recorded for it (customer receipts for money in, vendor payments for money
 * out) or explained with a note, such as bank charges. A payment can sit on
 * one statement line only.
 *
 * Each step checks what already exists, because MySQL cannot roll back table
 * changes: a run that stopped part way must be able to run again.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'reconcile_kind' => fn (Blueprint $table) => $table->string('reconcile_kind', 16)->nullable()->after('transfer_id'),
            'reconcile_note' => fn (Blueprint $table) => $table->string('reconcile_note')->nullable()->after('reconcile_kind'),
            'reconciled_at' => fn (Blueprint $table) => $table->timestamp('reconciled_at')->nullable()->after('reconcile_note'),
            'reconciled_by' => fn (Blueprint $table) => $table->unsignedBigInteger('reconciled_by')->nullable()->after('reconciled_at'),
        ] as $column => $add) {
            if (! Schema::hasColumn('banking_transactions', $column)) {
                Schema::table('banking_transactions', $add);
            }
        }

        $hasForeignKey = collect(Schema::getForeignKeys('banking_transactions'))
            ->contains(fn (array $key) => $key['columns'] === ['reconciled_by']);
        if (! $hasForeignKey) {
            Schema::table('banking_transactions', function (Blueprint $table) {
                $table->foreign('reconciled_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('banking_reconciliation_matches')) {
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
    }

    public function down(): void
    {
        Schema::dropIfExists('banking_reconciliation_matches');
        Schema::table('banking_transactions', function (Blueprint $table) {
            $table->dropForeign(['reconciled_by']);
            $table->dropColumn(['reconcile_kind', 'reconcile_note', 'reconciled_at', 'reconciled_by']);
        });
    }
};
