<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Remembers when a purchase order was last emailed to the vendor, and to which address.
 * Each column is checked first so a run that stopped part way can run again.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('purchase_orders', 'sent_at')) {
            Schema::table('purchase_orders', fn (Blueprint $table) => $table->timestamp('sent_at')->nullable()->after('approved_at'));
        }
        if (! Schema::hasColumn('purchase_orders', 'sent_to')) {
            Schema::table('purchase_orders', fn (Blueprint $table) => $table->string('sent_to')->nullable()->after('sent_at'));
        }
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['sent_at', 'sent_to']);
        });
    }
};
