<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Customer codes were unique across every company. They only need to be
 * unique within a company, which the (company_id, code) index already enforces.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasIndex('inv_customers', 'inv_customers_code_unique')) {
            Schema::table('inv_customers', function (Blueprint $table) {
                $table->dropUnique('inv_customers_code_unique');
            });
        }
    }

    public function down(): void
    {
        // Not restored: putting it back would fail once two companies share a code.
    }
};
