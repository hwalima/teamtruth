<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('inv_invoices', function (Blueprint $table) {
            if (!Schema::hasColumn('inv_invoices', 'payment_token')) {
                $table->string('payment_token', 64)->nullable()->unique()->after('paid_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inv_invoices', function (Blueprint $table) {
            if (Schema::hasColumn('inv_invoices', 'payment_token')) {
                $table->dropColumn('payment_token');
            }
        });
    }
};