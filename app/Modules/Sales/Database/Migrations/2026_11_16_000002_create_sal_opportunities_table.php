<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sal_opportunities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('lead_id')->nullable()->constrained('sal_leads')->restrictOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('inv_customers')->restrictOnDelete();
            $table->string('title', 255);
            $table->decimal('expected_value', 20, 4)->default(0);
            $table->unsignedSmallInteger('probability')->default(0);
            $table->string('status', 20)->default('open');
            $table->date('close_date')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'status', 'created_at']);
            $table->index(['company_id', 'assigned_to']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sal_opportunities');
    }
};
