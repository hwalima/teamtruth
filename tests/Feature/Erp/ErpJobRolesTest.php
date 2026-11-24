<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanyErpRole;
use App\Modules\Core\Services\ErpRoleService;

beforeEach(function () {
    $this->company = Company::create(['code' => 'SMP', 'name' => 'Sample Mining', 'default_currency' => 'USD']);
    app(ErpRoleService::class)->createDefaultRoles($this->company);
});

/** A user holding one of the company's ready-made roles. */
function withJobRole(Company $company, string $slug): User
{
    $user = User::factory()->create();
    $company->users()->attach($user->id, [
        'role' => $slug,
        'erp_role_id' => $company->erpRoles()->where('slug', $slug)->value('id'),
        'is_active' => true,
    ]);

    return $user;
}

function erpAllows(Company $company, User $user, string $permission): bool
{
    return app(ErpRoleService::class)->allows($company, $user, $permission);
}

test('every company gets the ready-made job roles', function () {
    expect($this->company->erpRoles()->pluck('name', 'slug')->all())->toMatchArray([
        'hr-manager' => 'HR Manager',
        'hr-officer' => 'HR Officer',
        'stores-manager' => 'Stores Manager',
        'procurement-officer' => 'Procurement Officer',
        'finance-clerk' => 'Finance Clerk',
    ]);
});

test('every default role only holds permissions that exist', function () {
    $known = ErpRoleService::allPermissionKeys();
    foreach (array_keys(ErpRoleService::DEFAULT_ROLES) as $slug) {
        if ($slug === 'owner') {
            continue;
        }
        expect(array_diff(ErpRoleService::defaultPermissions($slug), $known))->toBe([], "Role {$slug} has unknown permissions");
    }
});

test('a company that already has its own role with the same name keeps it', function () {
    $other = Company::create(['code' => 'OTH', 'name' => 'Other Company']);
    CompanyErpRole::create(['company_id' => $other->id, 'name' => 'HR Manager', 'slug' => 'people-lead', 'permissions' => ['erp.dashboard.view']]);

    app(ErpRoleService::class)->createDefaultRoles($other);

    expect($other->erpRoles()->where('name', 'HR Manager')->pluck('slug')->all())->toBe(['people-lead'])
        ->and($other->erpRoles()->where('slug', 'hr-officer')->exists())->toBeTrue();
});

test('the HR manager has all of HR and nothing outside it', function () {
    $user = withJobRole($this->company, 'hr-manager');

    foreach (['erp.hrm.employee.manage', 'erp.hrm.employee.terminate', 'erp.hrm.employee.view_salary', 'erp.hrm.leave.approve', 'erp.hrm.disciplinary.manage', 'erp.hrm.contract.manage'] as $permission) {
        expect(erpAllows($this->company, $user, $permission))->toBeTrue($permission);
    }
    foreach (['erp.accounting.view', 'erp.purchase.view', 'erp.banking.view', 'erp.invoicing.view', 'erp.inventory.view', 'erp.members.manage', 'erp.roles.manage'] as $permission) {
        expect(erpAllows($this->company, $user, $permission))->toBeFalse($permission);
    }
});

test('the HR officer keeps records but cannot see pay, terminate or approve leave', function () {
    $user = withJobRole($this->company, 'hr-officer');

    expect(erpAllows($this->company, $user, 'erp.hrm.employee.manage'))->toBeTrue()
        ->and(erpAllows($this->company, $user, 'erp.hrm.self_service.manage'))->toBeTrue();
    foreach (['erp.hrm.employee.terminate', 'erp.hrm.employee.view_salary', 'erp.hrm.leave.approve', 'erp.hrm.leave.manage', 'erp.hrm.disciplinary.view', 'erp.hrm.contract.manage', 'erp.hrm.department.manage'] as $permission) {
        expect(erpAllows($this->company, $user, $permission))->toBeFalse($permission);
    }

    $this->actingAs($user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->get(route('erp.hrm.employees.index'))->assertOk()->assertInertia(fn ($page) => $page->where('canManage', true)->where('canDelete', false));
    $this->get(route('erp.accounting.index'))->assertForbidden();
});

test('the stores manager runs buying and stock but does not pay vendors', function () {
    $user = withJobRole($this->company, 'stores-manager');

    foreach (['erp.purchase.manage', 'erp.inventory.manage', 'erp.stock.manage', 'erp.requisitions.manage'] as $permission) {
        expect(erpAllows($this->company, $user, $permission))->toBeTrue($permission);
    }
    expect(erpAllows($this->company, $user, 'erp.purchase.bills'))->toBeFalse()
        ->and(erpAllows($this->company, $user, 'erp.hrm.employee.view'))->toBeFalse();

    $this->actingAs($user)->withSession(['active_erp_company_id' => $this->company->id])
        ->get(route('erp.purchase.payments.create'))->assertForbidden();
});

test('the procurement officer buys but cannot change stock setup, approve requisitions or pay', function () {
    $user = withJobRole($this->company, 'procurement-officer');

    expect(erpAllows($this->company, $user, 'erp.purchase.manage'))->toBeTrue();
    foreach (['erp.purchase.bills', 'erp.inventory.manage', 'erp.stock.manage', 'erp.requisitions.manage', 'erp.accounting.view'] as $permission) {
        expect(erpAllows($this->company, $user, $permission))->toBeFalse($permission);
    }

    $this->actingAs($user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->get(route('erp.purchase.index'))->assertOk();
    $this->post(route('erp.purchase.payments.store'), [])->assertForbidden();
});

test('the finance clerk records daily transactions but cannot touch the ledger setup or buy', function () {
    $user = withJobRole($this->company, 'finance-clerk');

    foreach (['erp.invoicing.manage', 'erp.banking.manage', 'erp.purchase.bills'] as $permission) {
        expect(erpAllows($this->company, $user, $permission))->toBeTrue($permission);
    }
    foreach (['erp.accounting.view', 'erp.accounting.manage', 'erp.banking.approve', 'erp.purchase.manage', 'erp.settings.manage'] as $permission) {
        expect(erpAllows($this->company, $user, $permission))->toBeFalse($permission);
    }

    $this->actingAs($user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->get(route('erp.purchase.payments.create'))->assertOk();
    $this->post(route('erp.purchase.rfqs.store'), [])->assertForbidden();
    $this->get(route('erp.accounting.index'))->assertForbidden();
});

test('existing roles keep paying vendors and terminating staff after the split', function () {
    $company = Company::create(['code' => 'OLD', 'name' => 'Older Company']);
    $buyer = CompanyErpRole::create(['company_id' => $company->id, 'name' => 'Buyer', 'slug' => 'buyer', 'permissions' => ['erp.purchase.view', 'erp.purchase.manage']]);
    $people = CompanyErpRole::create(['company_id' => $company->id, 'name' => 'People', 'slug' => 'people', 'permissions' => ['erp.hrm.employee.view', 'erp.hrm.employee.manage']]);
    $finance = CompanyErpRole::create(['company_id' => $company->id, 'name' => 'Finance', 'slug' => 'finance', 'permissions' => ['erp.purchase.view'], 'is_system' => true]);

    (require base_path('app/Modules/Core/Database/Migrations/2026_11_23_000003_add_job_roles_and_split_permissions.php'))->up();

    expect($buyer->fresh()->permissions)->toContain('erp.purchase.bills')
        ->and($people->fresh()->permissions)->toContain('erp.hrm.employee.terminate')
        ->and($finance->fresh()->permissions)->toContain('erp.purchase.bills')
        ->and($company->erpRoles()->where('slug', 'finance-clerk')->exists())->toBeTrue();
});

test('bill and payment buttons only show to people who can record them', function () {
    $this->actingAs(withJobRole($this->company, 'procurement-officer'))->withSession(['active_erp_company_id' => $this->company->id])
        ->get(route('erp.purchase.index'))->assertInertia(fn ($page) => $page->where('canBills', false));

    $this->actingAs(withJobRole($this->company, 'finance-clerk'))->withSession(['active_erp_company_id' => $this->company->id])
        ->get(route('erp.purchase.index'))->assertInertia(fn ($page) => $page->where('canBills', true));
});

test('an approval step can target a company role before anyone holds it', function () {
    \App\Models\Currency::create(['name' => 'US Dollar', 'code' => 'USD', 'symbol' => '$']);
    $owner = withJobRole($this->company, 'owner');
    $this->actingAs($owner)->withSession(['active_erp_company_id' => $this->company->id]);

    $this->get(route('erp.approvals.workflows.index'))->assertInertia(fn ($page) => $page
        ->where('roles', fn ($roles) => collect($roles)->contains(fn ($role) => $role['slug'] === 'finance-clerk' && $role['name'] === 'Finance Clerk' && $role['holders'] === 0)));

    $step = ['approver_type' => 'role', 'min_amount' => null, 'max_amount' => null, 'require_all' => false];
    $workflow = ['name' => 'Bill approval', 'approvable_type' => 'App\Modules\Purchase\Models\PurchaseOrder', 'currency_code' => 'USD', 'is_active' => true];

    $this->post(route('erp.approvals.workflows.store'), [...$workflow, 'steps' => [[...$step, 'approver_id' => 'finance-clerk']]])
        ->assertSessionHasNoErrors();
    $this->post(route('erp.approvals.workflows.store'), [...$workflow, 'steps' => [[...$step, 'approver_id' => 'no-such-role']]])
        ->assertSessionHasErrors('steps');
});
