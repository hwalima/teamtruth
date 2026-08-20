<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ict_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 20)->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->text('steps_to_reproduce')->nullable();
            $table->enum('status', ['open', 'in_progress', 'pending', 'resolved', 'closed'])->default('open');
            $table->enum('priority', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->enum('category', [
                'hardware', 'software', 'network', 'access_security',
                'email_communication', 'server_infrastructure', 'mobile_devices',
                'av_conferencing', 'other',
            ])->default('other');
            $table->string('subsidiary')->nullable();
            $table->string('department')->nullable();
            $table->string('location')->nullable();
            $table->foreignId('reported_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('workspace_id')->nullable()->constrained('workspaces')->cascadeOnDelete();
            $table->text('resolution_notes')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->timestamp('first_response_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'status']);
            $table->index(['assigned_to', 'status']);
            $table->index(['reported_by']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ict_tickets');
    }
};
