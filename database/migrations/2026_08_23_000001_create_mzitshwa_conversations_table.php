<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mzitshwa_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('title', 200)->default('New conversation');
            $table->string('context', 50)->default('general');
            $table->boolean('pinned')->default(false);
            $table->timestamps();
        });

        Schema::create('mzitshwa_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('mzitshwa_conversations')->cascadeOnDelete();
            $table->enum('role', ['user', 'assistant', 'action']);
            $table->text('content');
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mzitshwa_messages');
        Schema::dropIfExists('mzitshwa_conversations');
    }
};
