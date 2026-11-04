<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_workflows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('approvable_type');
            $table->string('currency_code', 3)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'approvable_type', 'is_active']);
        });

        Schema::create('approval_workflow_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('workflow_id')->constrained('approval_workflows')->cascadeOnDelete();
            $table->unsignedSmallInteger('step_order');
            $table->string('approver_type', 32);
            $table->string('approver_id', 100)->nullable();
            $table->decimal('min_amount', 20, 4)->nullable();
            $table->decimal('max_amount', 20, 4)->nullable();
            $table->json('condition_json')->nullable();
            $table->boolean('require_all')->default(false);
            $table->unsignedInteger('sla_hours')->nullable();
            $table->timestamps();

            $table->index(['workflow_id', 'step_order']);
            $table->index(['company_id', 'approver_type', 'approver_id']);
        });

        Schema::create('approval_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('approvable_type');
            $table->unsignedBigInteger('approvable_id');
            $table->foreignId('workflow_id')->constrained('approval_workflows')->restrictOnDelete();
            $table->string('status', 20)->default('pending');
            $table->unsignedSmallInteger('current_step');
            $table->decimal('amount', 20, 4)->default(0);
            $table->string('currency_code', 3)->nullable();
            $table->json('context_json')->nullable();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('submitted_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status', 'current_step']);
            $table->index(['approvable_type', 'approvable_id']);
        });

        Schema::create('approval_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('request_id')->constrained('approval_requests')->cascadeOnDelete();
            $table->foreignId('step_id')->constrained('approval_workflow_steps')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 20);
            $table->text('comment')->nullable();
            $table->timestamp('acted_at');
            $table->json('signature_snapshot')->nullable();
            $table->timestamps();

            $table->index(['request_id', 'step_id', 'actor_id']);
        });

        Schema::create('approval_delegations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'from_user_id', 'to_user_id', 'starts_at', 'ends_at'], 'approval_delegations_active_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_delegations');
        Schema::dropIfExists('approval_actions');
        Schema::dropIfExists('approval_requests');
        Schema::dropIfExists('approval_workflow_steps');
        Schema::dropIfExists('approval_workflows');
    }
};
