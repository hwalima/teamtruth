<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('task_activities')) {
            Schema::create('task_activities', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
                $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
                $table->string('type'); // status_changed, assigned, progress_updated, priority_changed, comment_added
                $table->string('field')->nullable();
                $table->string('old_value')->nullable();
                $table->string('new_value')->nullable();
                $table->text('description')->nullable();
                $table->timestamps();

                $table->index(['task_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('task_activities');
    }
};
