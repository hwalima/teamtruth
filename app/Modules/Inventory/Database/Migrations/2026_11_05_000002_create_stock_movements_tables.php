<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_moves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->string('operation', 24);
            $table->string('status', 20)->default('posted');
            $table->string('reference', 255)->nullable();
            $table->timestamp('moved_at');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'operation', 'moved_at']);
        });

        Schema::create('stock_move_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('stock_move_id')->constrained('stock_moves')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('inventory_products')->restrictOnDelete();
            $table->foreignId('from_location_id')->nullable()->constrained('stock_locations')->restrictOnDelete();
            $table->foreignId('to_location_id')->nullable()->constrained('stock_locations')->restrictOnDelete();
            $table->decimal('quantity', 20, 4);
            $table->string('lot_code', 120)->nullable();
            $table->timestamps();

            $table->index(
                ['company_id', 'product_id', 'from_location_id', 'lot_code'],
                'stock_move_lines_from_lookup',
            );
            $table->index(
                ['company_id', 'product_id', 'to_location_id', 'lot_code'],
                'stock_move_lines_to_lookup',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_move_lines');
        Schema::dropIfExists('stock_moves');
    }
};
