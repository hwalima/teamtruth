<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Data migration from other systems (Odoo first).
 *
 * - data_imports: one uploaded file, its preview and its result.
 * - data_import_rows: every row of the file exactly as it was, so nothing is lost.
 * - external_ids: which local record each outside record became, so re-importing
 *   updates instead of duplicating and later files can find earlier records.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('data_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('source', 30)->default('odoo');
            $table->string('model', 80);
            $table->string('file_name');
            $table->string('file_path');
            $table->string('status', 20)->default('previewed');
            $table->json('options')->nullable();
            $table->json('summary')->nullable();
            $table->json('columns')->nullable();
            $table->unsignedInteger('total_rows')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('imported_at')->nullable();
            $table->timestamps();
            $table->index(['company_id', 'model', 'status']);
        });

        Schema::create('data_import_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('data_import_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->json('data');
            $table->string('action', 20)->nullable();
            $table->json('messages')->nullable();
            $table->string('record_type')->nullable();
            $table->unsignedBigInteger('record_id')->nullable();
            $table->timestamps();
            $table->index(['data_import_id', 'action']);
        });

        Schema::create('external_ids', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('source', 30);
            $table->string('model', 80);
            $table->string('external_id', 191);
            $table->string('record_type');
            $table->unsignedBigInteger('record_id');
            $table->foreignId('data_import_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->unique(['company_id', 'source', 'model', 'external_id'], 'external_ids_lookup_unique');
            $table->index(['record_type', 'record_id']);
        });

        Schema::table('inventory_products', function (Blueprint $table) {
            $table->string('internal_reference', 120)->nullable()->after('barcode');
            $table->decimal('sale_price', 20, 4)->nullable()->after('tracking');
            $table->decimal('cost_price', 20, 4)->nullable()->after('sale_price');
            $table->string('image_path')->nullable()->after('cost_price');
            $table->json('metadata')->nullable()->after('image_path');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_products', function (Blueprint $table) {
            $table->dropColumn(['internal_reference', 'sale_price', 'cost_price', 'image_path', 'metadata']);
        });
        Schema::dropIfExists('external_ids');
        Schema::dropIfExists('data_import_rows');
        Schema::dropIfExists('data_imports');
    }
};
