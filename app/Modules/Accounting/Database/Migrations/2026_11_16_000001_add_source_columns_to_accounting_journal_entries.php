<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounting_journal_entries', function (Blueprint $table) {
            if (! Schema::hasColumn('accounting_journal_entries', 'source_type')) {
                $table->string('source_type')->nullable()->after('reversal_of_id');
            }
            if (! Schema::hasColumn('accounting_journal_entries', 'source_id')) {
                $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
            }
            $table->index(
                ['company_id', 'source_type', 'source_id'],
                'accounting_entries_source_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::table('accounting_journal_entries', function (Blueprint $table) {
            $table->dropIndex('accounting_entries_source_idx');
            if (Schema::hasColumn('accounting_journal_entries', 'source_id')) {
                $table->dropColumn('source_id');
            }
            if (Schema::hasColumn('accounting_journal_entries', 'source_type')) {
                $table->dropColumn('source_type');
            }
        });
    }
};
