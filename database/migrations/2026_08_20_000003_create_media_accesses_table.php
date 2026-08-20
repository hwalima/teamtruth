<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_accesses', function (Blueprint $table) {
            $table->id();
            $table->string('resource_type', 10); // 'folder' or 'file'
            $table->unsignedBigInteger('resource_id');
            $table->string('email');
            $table->foreignId('granted_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['resource_type', 'resource_id', 'email']);
            $table->index(['resource_type', 'resource_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_accesses');
    }
};
