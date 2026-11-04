<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('requisitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('document_number', 100);
            $table->string('requisition_type', 40);
            $table->string('status', 24)->default('draft');
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->string('department', 120)->nullable();
            $table->string('cost_center', 120)->nullable();
            $table->date('required_by')->nullable();
            $table->string('priority', 16)->default('normal');
            $table->text('justification');
            $table->string('currency_code', 3);
            $table->decimal('estimated_total', 20, 4)->default(0);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'document_number']);
            $table->index(['company_id', 'status', 'created_at']);
            $table->index(['company_id', 'requisition_type', 'department']);
        });

        Schema::create('requisition_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('requisition_id')->constrained()->cascadeOnDelete();
            $table->string('item', 255);
            $table->text('description')->nullable();
            $table->decimal('quantity', 20, 4);
            $table->string('unit', 40);
            $table->decimal('estimated_unit_price', 20, 4);
            $table->decimal('estimated_total', 20, 4);
            $table->string('gl_account', 120)->nullable();
            $table->string('budget_line', 120)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'requisition_id', 'sort_order']);
        });

        Schema::create('requisition_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('requisition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->string('original_name');
            $table->string('path');
            $table->string('mime_type', 120);
            $table->unsignedBigInteger('size');
            $table->timestamps();

            $table->index(['company_id', 'requisition_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('requisition_attachments');
        Schema::dropIfExists('requisition_lines');
        Schema::dropIfExists('requisitions');
    }
};
