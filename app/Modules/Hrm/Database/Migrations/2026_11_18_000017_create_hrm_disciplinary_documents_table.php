<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hrm_disciplinary_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('disciplinary_case_id')->constrained('hrm_disciplinary_cases')->cascadeOnDelete();
            $table->enum('document_type', ['incident_report', 'notice', 'hearing_record', 'witness_statement', 'evidence', 'outcome_letter', 'appeal']);
            $table->string('title');
            $table->string('file_path');
            $table->string('file_mime')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'disciplinary_case_id']);
            $table->index(['company_id', 'document_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hrm_disciplinary_documents');
    }
};