<?php

use App\Models\Permission;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanyErpRole;
use App\Modules\Core\Services\ErpRoleService;

function companyWithErpRole(User $user, string $code, array $permissions): Company
{
    $company = Company::create(['code' => $code, 'name' => "{$code} Company"]);
    $role = CompanyErpRole::create([
        'company_id' => $company->id,
        'name' => 'Custom',
        'slug' => 'custom',
        'permissions' => $permissions,
    ]);
    $company->users()->attach($user->id, [
        'role' => $role->slug,
        'erp_role_id' => $role->id,
        'is_active' => true,
    ]);

    return $company;
}

test('company ERP permissions control direct module access', function () {
    $user = User::factory()->create();
    $company = companyWithErpRole($user, 'ROLE1', ['erp.dashboard.view']);

    $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->get(route('erp.accounting.index'))
        ->assertForbidden();
});

test('the company owner retains access and can manage ERP roles', function () {
    $user = User::factory()->create();
    $company = Company::create(['code' => 'ROLE2', 'name' => 'Role Owner Company']);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($user)->withSession(['active_erp_company_id' => $company->id]);

    expect(app(ErpRoleService::class)->allows($company, $user, 'erp.roles.manage'))->toBeTrue();

    $this->get(route('erp.settings.roles.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Erp/Settings/Roles'));
});

test('company role permissions are isolated between companies', function () {
    $user = User::factory()->create();
    $firstCompany = companyWithErpRole($user, 'ROLE3', ['erp.inventory.view']);
    $secondCompany = Company::create(['code' => 'ROLE4', 'name' => 'Second Role Company']);
    $secondRole = CompanyErpRole::create([
        'company_id' => $secondCompany->id,
        'name' => 'Restricted',
        'slug' => 'restricted',
        'permissions' => ['erp.dashboard.view'],
    ]);
    $secondCompany->users()->attach($user->id, [
        'role' => $secondRole->slug,
        'erp_role_id' => $secondRole->id,
        'is_active' => true,
    ]);

    $this->actingAs($user)->withSession(['active_erp_company_id' => $firstCompany->id])
        ->get(route('erp.inventory.setup'))
        ->assertOk();
    $this->withSession(['active_erp_company_id' => $secondCompany->id])
        ->get(route('erp.inventory.setup'))
        ->assertForbidden();
});

test('company permissions can restrict the existing project management module', function () {
    $user = User::factory()->create();
    $company = companyWithErpRole($user, 'ROLE5', ['erp.dashboard.view']);
    $user->givePermissionTo(Permission::create([
        'name' => 'dashboard_view',
        'guard_name' => 'web',
        'module' => 'dashboard',
    ]));

    $response = $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->get(route('dashboard'));

    \Log::info('Dashboard test response', ['status' => $response->getStatusCode(), 'headers' => $response->headers->all()]);

    $response->assertForbidden();
});
