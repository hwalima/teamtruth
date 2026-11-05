<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('name', 100);
            $table->string('abbreviation', 20);
            $table->string('category', 30)->default('quantity');
            $table->decimal('factor_to_base', 20, 8)->default(1);
            $table->boolean('is_base')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'abbreviation']);
        });

        Schema::create('inventory_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('inventory_categories')->restrictOnDelete();
            $table->string('name', 120);
            $table->string('description', 1000)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });

        Schema::create('inventory_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('inventory_categories')->restrictOnDelete();
            $table->foreignId('unit_id')->constrained('inventory_units')->restrictOnDelete();
            $table->string('sku', 80);
            $table->string('barcode', 120)->nullable();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('type', 20)->default('storable');
            $table->string('costing_method', 20)->default('average');
            $table->string('tracking', 20)->default('none');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'sku']);
            $table->unique(['company_id', 'barcode']);
            $table->index(['company_id', 'type', 'is_active']);
        });

        Schema::create('inventory_warehouses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('code', 40);
            $table->string('name', 160);
            $table->string('address', 1000)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code']);
        });

        Schema::create('stock_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained('inventory_warehouses')->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('stock_locations')->restrictOnDelete();
            $table->string('code', 40);
            $table->string('name', 160);
            $table->string('usage', 24)->default('internal');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['warehouse_id', 'code']);
            $table->index(['company_id', 'warehouse_id', 'usage']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_locations');
        Schema::dropIfExists('inventory_warehouses');
        Schema::dropIfExists('inventory_products');
        Schema::dropIfExists('inventory_categories');
        Schema::dropIfExists('inventory_units');
    }
};
