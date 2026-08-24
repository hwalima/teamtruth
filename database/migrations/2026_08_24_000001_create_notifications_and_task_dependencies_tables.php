<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // In-app notifications table
        if (!Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('type');
                $table->morphs('notifiable');
                $table->text('data');
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
                $table->index(['notifiable_id', 'notifiable_type', 'read_at']);
            });
        }

        // Task dependencies table
        if (!Schema::hasTable('task_dependencies')) {
            Schema::create('task_dependencies', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
                $table->foreignId('depends_on_id')->constrained('tasks')->onDelete('cascade');
                $table->enum('type', ['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'])
                    ->default('finish_to_start');
                $table->timestamps();
                $table->unique(['task_id', 'depends_on_id']);
                $table->index('depends_on_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('task_dependencies');
        Schema::dropIfExists('notifications');
    }
};
