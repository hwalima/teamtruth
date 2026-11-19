<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hrm_contract_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->enum('contract_type', ['permanent', 'fixed_term', 'probation', 'casual', 'apprenticeship']);
            $table->text('description')->nullable();
            $table->json('template_content')->nullable(); // merge fields definition
            $table->string('file_path')->nullable(); // Blade template path
            $table->boolean('is_default')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'contract_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hrm_contract_templates');
    }
};