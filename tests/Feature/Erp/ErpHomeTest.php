<?php

use App\Models\User;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\ApprovalRequest;
use App\Modules\Core\Models\ApprovalWorkflow;
use App\Modules\Core\Models\ApprovalWorkflowStep;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\Requisition;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    app(ErpRoleService::class)->createDefaultRoles($this->company);
});

function memberOf(Company $company, string $slug, ?User $user = null): User
{
    $user ??= User::factory()->create(['name' => 'Alex Sample']);
    $company->users()->attach($user->id, [
        'role' => $slug,
        'erp_role_id' => $company->erpRoles()->where('slug', $slug)->value('id'),
        'is_active' => true,
    ]);

    return $user;
}

test('signing in takes ERP staff to their company home', function () {
    $user = memberOf($this->company, 'finance-clerk');

    $this->post('/login', ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('start', absolute: false));
    $this->get(route('start'))->assertRedirect(route('erp.dashboard'));
    expect(session('active_erp_company_id'))->toBe($this->company->id);
});

test('people outside the ERP keep landing on the project dashboard', function () {
    $this->actingAs(User::factory()->create())->get(route('start'))->assertRedirect(route('dashboard'));
});

test('signing in returns people to the page they were opening', function () {
    $user = memberOf($this->company, 'finance-clerk');

    $this->get(route('erp.approvals.index'))->assertRedirect();
    $this->post('/login', ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('erp.approvals.index'));
});

test('people in several companies go back to the one they used last, or choose', function () {
    $other = Company::create(['code' => 'ACM', 'name' => 'Acme Holdings', 'default_currency' => 'USD']);
    app(ErpRoleService::class)->createDefaultRoles($other);
    $user = memberOf($this->company, 'finance-clerk');
    memberOf($other, 'hr-officer', $user);

    $this->actingAs($user)->get(route('start'))->assertRedirect(route('erp.companies.index'));

    $this->post(route('erp.companies.switch', $other));
    expect($user->fresh()->last_erp_company_id)->toBe($other->id);

    $this->flushSession();
    $this->actingAs($user->fresh())->get(route('start'))->assertRedirect(route('erp.dashboard'));
    expect(session('active_erp_company_id'))->toBe($other->id);
});

test('the home shows my approvals, my requisitions and the figures my role covers', function () {
    $clerk = memberOf($this->company, 'finance-clerk');
    $requester = memberOf($this->company, 'procurement-officer');
    app(CompanyContext::class)->setActiveCompany($this->company);

    $requisition = Requisition::create([
        'document_number' => 'SMP/REQ/2026/00001', 'requisition_type' => 'purchase', 'status' => RequisitionStatus::InApproval,
        'requested_by' => $requester->id, 'department' => 'Stores', 'justification' => 'Spare parts.',
        'currency_code' => 'USD', 'estimated_total' => '120.0000',
    ]);
    $workflow = ApprovalWorkflow::create(['name' => 'Requisitions', 'approvable_type' => Requisition::class, 'currency_code' => 'USD', 'is_active' => true]);
    ApprovalWorkflowStep::create(['workflow_id' => $workflow->id, 'step_order' => 1, 'approver_type' => 'role', 'approver_id' => 'finance-clerk']);
    ApprovalRequest::create([
        'company_id' => $this->company->id, 'approvable_type' => Requisition::class, 'approvable_id' => $requisition->id,
        'workflow_id' => $workflow->id, 'status' => ApprovalStatus::Pending->value, 'current_step' => 1,
        'amount' => '120.0000', 'currency_code' => 'USD', 'requested_by' => $requester->id, 'submitted_at' => now(),
    ]);

    $this->actingAs($clerk)->withSession(['active_erp_company_id' => $this->company->id])
        ->get(route('erp.dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Erp/Dashboard/Index')
            ->where('myWork.approvals.count', 1)
            ->where('myWork.approvals.items.0.reference', 'SMP/REQ/2026/00001')
            ->where('myWork.approvals.items.0.type', 'Requisition')
            ->where('myWork.requisitions.open', 0)
            ->where('tiles', fn ($tiles) => collect($tiles)->pluck('key')->intersect(['bills-due', 'invoices-overdue', 'cash'])->count() === 3
                && ! collect($tiles)->pluck('key')->contains('employees')));

    $this->actingAs($requester)->withSession(['active_erp_company_id' => $this->company->id])
        ->get(route('erp.dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('myWork.approvals.count', 0)
            ->where('myWork.requisitions.open', 1)
            ->where('myWork.requisitions.items.0.status', 'in_approval')
            ->where('tiles', fn ($tiles) => collect($tiles)->pluck('key')->contains('orders-to-receive')
                && ! collect($tiles)->pluck('key')->contains('cash')));
});

test('the HR manager sees people figures and the HR module', function () {
    $this->actingAs(memberOf($this->company, 'hr-manager'))->withSession(['active_erp_company_id' => $this->company->id])
        ->get(route('erp.dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tiles', fn ($tiles) => collect($tiles)->pluck('key')->sort()->values()->all() === ['contracts-ending', 'employees', 'leave-to-approve'])
            ->where('modules', fn ($modules) => collect($modules)->firstWhere('key', 'hrm')['available'] === true));
});

test('the company picker shows my role in each company and opening one goes to its home', function () {
    $other = Company::create(['code' => 'ACM', 'name' => 'Acme Holdings', 'default_currency' => 'USD']);
    app(ErpRoleService::class)->createDefaultRoles($other);
    $user = memberOf($this->company, 'finance-clerk');
    memberOf($other, 'hr-officer', $user);

    $this->actingAs($user)->get(route('erp.companies.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Erp/Companies/Index')
            ->where('erpContext.activeCompany', null)
            ->where("roles.{$this->company->id}", 'Finance Clerk')
            ->where("roles.{$other->id}", 'HR Officer')
            ->where('canCreate', false));

    $this->post(route('erp.companies.switch', $other))->assertRedirect(route('erp.dashboard'));
});
