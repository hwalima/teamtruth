<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_rfqs', function (Blueprint $table) {
            $table->foreignId('source_requisition_id')
                ->nullable()
                ->after('document_number')
                ->constrained('requisitions')
                ->restrictOnDelete();
            $table->unique(['company_id', 'source_requisition_id'], 'purchase_rfqs_company_source_requisition_unique');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_rfqs', function (Blueprint $table) {
            $table->dropUnique('purchase_rfqs_company_source_requisition_unique');
            $table->dropConstrainedForeignId('source_requisition_id');
        });
    }
};
