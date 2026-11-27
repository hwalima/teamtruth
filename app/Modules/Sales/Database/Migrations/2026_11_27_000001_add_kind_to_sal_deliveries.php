<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** A delivery record is either goods sent to the customer or goods the customer sent back. Safe to run again. */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('sal_deliveries', 'kind')) {
            Schema::table('sal_deliveries', function (Blueprint $table) {
                $table->string('kind', 20)->default('delivery')->after('sales_order_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('sal_deliveries', 'kind')) {
            Schema::table('sal_deliveries', function (Blueprint $table) {
                $table->dropColumn('kind');
            });
        }
    }
};
