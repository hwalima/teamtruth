<?php

use App\Models\User;
use App\Modules\Core\Models\Company;

/*
 * Every HRM index page must render for a company owner, empty company or not.
 */
test('HRM index pages load for a company owner', function (string $routeName) {
    $user = User::factory()->create();
    $company = Company::create([
        'code' => 'HRM',
        'name' => 'HRM Company',
        'default_currency' => 'USD',
    ]);
    $company->users()->attach($user->id, ['role' => 'owner', 'is_active' => true]);

    $this->withoutExceptionHandling();

    $response = $this->actingAs($user)
        ->withSession(['active_erp_company_id' => $company->id])
        ->get(route($routeName))
        ->assertOk();

    $component = $response->viewData('page')['component'];
    expect(resource_path("js/pages/{$component}.tsx"))->toBeFile();
})->with([
    'erp.hrm.employees.index',
    'erp.hrm.employees.create',
    'erp.hrm.leave.requests.index',
    'erp.hrm.leave.requests.create',
    'erp.hrm.leave.balances.index',
    'erp.hrm.leave.types.index',
    'erp.hrm.leave.holidays.index',
    'erp.hrm.contracts.index',
    'erp.hrm.contracts.create',
    'erp.hrm.contracts.templates.index',
    'erp.hrm.organization.departments.index',
    'erp.hrm.organization.positions.index',
    'erp.hrm.organization.grades.index',
    'erp.hrm.organization.cost-centers.index',
    'erp.hrm.disciplinary.index',
    'erp.hrm.disciplinary.create',
    'erp.hrm.self-service.index',
    'erp.hrm.self-service.create',
]);
