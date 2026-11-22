<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fund requests: money moved out of a company's account to another company
 * only after that company's manager approves. The requester's and approver's
 * names, titles, signatures and times are fixed on the request when they act,
 * so later changes to a person's details never alter a past approval.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('banking_fund_requests', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 32)->nullable()->unique();
            $table->foreignId('from_account_id')->constrained('banking_accounts')->restrictOnDelete();
            $table->foreignId('to_account_id')->constrained('banking_accounts')->restrictOnDelete();
            $table->foreignId('from_company_id')->constrained('companies')->restrictOnDelete();
            $table->foreignId('to_company_id')->constrained('companies')->restrictOnDelete();
            $table->decimal('amount', 18, 2);
            $table->string('currency', 3);
            $table->text('purpose');
            $table->string('status', 16)->default('pending')->index();

            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('requested_at');
            $table->string('requester_name');
            $table->string('requester_title')->nullable();
            $table->string('requester_signature_path')->nullable();

            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('approver_name')->nullable();
            $table->string('approver_title')->nullable();
            $table->string('approver_signature_path')->nullable();
            $table->text('decision_note')->nullable();

            $table->foreignId('transfer_id')->nullable()->constrained('banking_transfers')->nullOnDelete();
            $table->foreignId('transferred_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('transferred_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['from_company_id', 'status']);
            $table->index(['to_company_id', 'status']);
        });

        // Company managers and admins approve fund requests out of their company.
        DB::table('company_erp_roles')->whereIn('slug', ['admin', 'manager'])->orderBy('id')->each(function ($role): void {
            $permissions = json_decode((string) $role->permissions, true) ?: [];
            if (in_array('*', $permissions, true) || in_array('erp.banking.approve', $permissions, true)) {
                return;
            }
            $permissions[] = 'erp.banking.approve';
            DB::table('company_erp_roles')->where('id', $role->id)->update(['permissions' => json_encode(array_values($permissions))]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banking_fund_requests');
    }
};
