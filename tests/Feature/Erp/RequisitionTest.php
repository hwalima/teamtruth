<?php

use App\Models\Currency;
use App\Models\Permission;
use App\Models\User;
use App\Modules\Core\Enums\ApprovalActionType;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\ApprovalWorkflow;
use App\Modules\Core\Models\ApprovalWorkflowStep;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanyErpRole;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\Requisition;
use Illuminate\Support\Facades\DB;

function createRequisitionCompany(string $code, User ...$members): Company
{
    $company = Company::create(['code' => $code, 'name' => "{$code} Holdings"]);
    foreach ($members as $member) {
        $company->users()->attach($member->id, [
            'role' => $member->id === $members[0]->id ? 'owner' : 'finance',
            'is_active' => true,
        ]);
    }

    return $company;
}

function setRequisitionCompany(Company $company): void
{
    app(CompanyContext::class)->setActiveCompany($company);
}

test('company members can create requisitions with accurate line totals', function () {
    $requester = User::factory()->create();
    $company = createRequisitionCompany('REQ-A', $requester);
    setRequisitionCompany($company);
    Currency::create(['name' => 'US Dollar', 'code' => 'USD', 'symbol' => '$']);

    $this->actingAs($requester)
        ->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.requisitions.store'), [
            'requisition_type' => 'purchase',
            'department' => 'Finance',
            'cost_center' => 'HQ',
            'required_by' => now()->addWeek()->toDateString(),
            'priority' => 'normal',
            'justification' => 'Replace damaged equipment.',
            'currency_code' => 'USD',
            'lines' => [
                [
                    'item' => 'Paper',
                    'description' => '',
                    'quantity' => '0.1',
                    'unit' => 'box',
                    'estimated_unit_price' => '0.1',
                    'gl_account' => '6100',
                    'budget_line' => 'Office',
                ],
                [
                    'item' => 'Printer',
                    'description' => '',
                    'quantity' => '2.5',
                    'unit' => 'each',
                    'estimated_unit_price' => '3.10',
                    'gl_account' => '',
                    'budget_line' => '',
                ],
            ],
        ])
        ->assertRedirect();

    $requisition = Requisition::query()->with('lines')->firstOrFail();
    expect($requisition->company_id)->toBe($company->id)
        ->and($requisition->status)->toBe(RequisitionStatus::Draft)
        ->and($requisition->document_number)->toBe('REQ-A/REQ/'.now()->format('Y').'/00001')
        ->and($requisition->estimated_total)->toBe('7.7600')
        ->and($requisition->lines[0]->estimated_total)->toBe('0.0100')
        ->and($requisition->lines[1]->estimated_total)->toBe('7.7500');
});

test('requisitions are isolated by company and only visible to the requester or company managers', function () {
    $requester = User::factory()->create();
    $otherMember = User::factory()->create();
    $companyA = createRequisitionCompany('REQ-A', $requester);
    $companyB = createRequisitionCompany('REQ-B', $otherMember);
    setRequisitionCompany($companyA);
    $requisition = Requisition::create([
        'document_number' => 'REQ-A/REQ/2026/00001',
        'requisition_type' => 'purchase',
        'status' => RequisitionStatus::Draft,
        'requested_by' => $requester->id,
        'justification' => 'Office supplies.',
        'currency_code' => 'USD',
        'estimated_total' => '10.0000',
    ]);
    app(CompanyContext::class)->setActiveCompany(null);

    $this->actingAs($otherMember)
        ->withSession(['active_erp_company_id' => $companyB->id])
        ->get(route('erp.requisitions.show', $requisition->id))
        ->assertNotFound();
});

test('requisition pdf downloads use a safe filename for slash-delimited document numbers', function () {
    $requester = User::factory()->create();
    $company = createRequisitionCompany('REQ-A', $requester);
    setRequisitionCompany($company);
    $requisition = Requisition::create([
        'document_number' => 'REQ-A/REQ/2026/00001',
        'requisition_type' => 'purchase',
        'status' => RequisitionStatus::Draft,
        'requested_by' => $requester->id,
        'justification' => 'Office supplies.',
        'currency_code' => 'USD',
        'estimated_total' => '10.0000',
    ]);

    $response = $this->actingAs($requester)
        ->withSession(['active_erp_company_id' => $company->id])
        ->get(route('erp.requisitions.pdf', $requisition));

    $response->assertOk();
    expect($response->headers->get('content-disposition'))
        ->toContain('req-a-req-2026-00001.pdf');
});

test('submitted requisitions progress through approval and adopt the decision status', function () {
    $requester = User::factory()->create();
    $approver = User::factory()->create();
    $company = createRequisitionCompany('REQ-A', $requester, $approver);
    setRequisitionCompany($company);
    Currency::create(['name' => 'US Dollar', 'code' => 'USD', 'symbol' => '$']);
    app(ErpRoleService::class)->createDefaultRoles($company);
    // Assign finance ERP role to approver
    $financeRole = CompanyErpRole::where('company_id', $company->id)
        ->where('slug', 'finance')
        ->firstOrFail();
    DB::table('company_user')
        ->where('company_id', $company->id)
        ->where('user_id', $approver->id)
        ->update(['erp_role_id' => $financeRole->id]);
    $workflow = ApprovalWorkflow::create([
        'name' => 'Requisition approvals',
        'approvable_type' => Requisition::class,
        'is_active' => true,
    ]);
    ApprovalWorkflowStep::create([
        'workflow_id' => $workflow->id,
        'step_order' => 1,
        'approver_type' => 'role',
        'approver_id' => 'finance',
        'require_all' => false,
    ]);
    $requisition = Requisition::create([
        'document_number' => 'REQ-A/REQ/2026/00001',
        'requisition_type' => 'purchase',
        'status' => RequisitionStatus::Draft,
        'requested_by' => $requester->id,
        'justification' => 'Office supplies.',
        'currency_code' => 'USD',
        'estimated_total' => '10.0000',
    ]);
    $requisition->lines()->create([
        'item' => 'Paper',
        'quantity' => '1.0000',
        'unit' => 'box',
        'estimated_unit_price' => '10.0000',
        'estimated_total' => '10.0000',
        'sort_order' => 1,
    ]);
    $this->actingAs($requester)->withSession(['active_erp_company_id' => $company->id]);

    $this->post(route('erp.requisitions.submit', $requisition))->assertRedirect();
    expect($requisition->fresh()->status)->toBe(RequisitionStatus::InApproval);
    $approval = $requisition->approvalRequests()->firstOrFail();
    expect($approval->status)->toBe(ApprovalStatus::Pending);

    $this->actingAs($approver)->withSession(['active_erp_company_id' => $company->id])
        ->post(route('erp.approvals.act', $approval), [
            'action' => ApprovalActionType::Approve->value,
        ])
        ->assertRedirect();

    expect($approval->fresh()->status)->toBe(ApprovalStatus::Approved)
        ->and($requisition->fresh()->status)->toBe(RequisitionStatus::Approved);
});
