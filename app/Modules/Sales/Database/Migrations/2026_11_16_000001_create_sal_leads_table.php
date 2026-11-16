<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sal_leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('name', 255);
            $table->string('contact_person', 255)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('phone', 100)->nullable();
            $table->string('source', 100)->nullable();
            $table->string('status', 20)->default('new');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->restrictOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'status', 'created_at']);
            $table->index(['company_id', 'assigned_to']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sal_leads');
    }
};
