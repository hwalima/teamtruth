<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Notes and terms printed on the quotation, and when it was last emailed to the customer. */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['notes' => 'text', 'terms' => 'text', 'sent_at' => 'timestamp', 'sent_to' => 'string'] as $column => $type) {
            if (! Schema::hasColumn('sal_quotations', $column)) {
                Schema::table('sal_quotations', function (Blueprint $table) use ($column, $type) {
                    $table->{$type}($column)->nullable();
                });
            }
        }
    }

    public function down(): void
    {
        foreach (['notes', 'terms', 'sent_at', 'sent_to'] as $column) {
            if (Schema::hasColumn('sal_quotations', $column)) {
                Schema::table('sal_quotations', fn (Blueprint $table) => $table->dropColumn($column));
            }
        }
    }
};
