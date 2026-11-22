<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Hrm\Models\Contract;
use App\Modules\Hrm\Models\ContractTemplate;
use App\Modules\Hrm\Models\Employee;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'CON', 'name' => 'Contract Company', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->withoutExceptionHandling();
});

function contractPage($response): string
{
    $component = $response->viewData('page')['component'];
    expect(resource_path("js/pages/{$component}.tsx"))->toBeFile();

    return $component;
}

test('a contract is drafted from a template, signed by both sides, renewed and terminated', function () {
    $this->post(route('erp.hrm.contracts.templates.store'), [
        'name' => 'Standard permanent',
        'contract_type' => 'permanent',
        'body' => 'This contract is between {{company_name}} and {{employee_name}}, starting {{start_date}}.',
        'is_default' => true,
    ])->assertRedirect();
    $template = ContractTemplate::query()->firstOrFail();
    expect(contractPage($this->get(route('erp.hrm.contracts.templates.index'))->assertOk()))->toBe('Erp/Hrm/Contracts/Templates/Index');

    // The employee logs in with their own account.
    $staff = User::factory()->create();
    $this->company->users()->attach($staff->id, ['role' => 'member', 'is_active' => true]);
    $this->post(route('erp.hrm.employees.store'), ['first_name' => 'Farai', 'last_name' => 'Dube', 'status' => 'active', 'hire_date' => '2026-01-05', 'user_id' => $staff->id])->assertRedirect();
    $employee = Employee::query()->firstOrFail();

    expect(contractPage($this->get(route('erp.hrm.contracts.create'))->assertOk()))->toBe('Erp/Hrm/Contracts/Create');

    $this->post(route('erp.hrm.contracts.store'), [
        'employee_id' => $employee->id,
        'template_id' => $template->id,
        'contract_type' => 'permanent',
        'start_date' => '2026-01-05',
        'basic_salary' => 1200,
        'currency_code' => 'usd',
        'pay_frequency' => 'monthly',
        'working_hours_per_week' => 40,
    ])->assertRedirect();

    $contract = Contract::query()->firstOrFail();
    expect($contract->status->value)->toBe('draft')->and($contract->currency_code)->toBe('USD');

    $show = $this->get(route('erp.hrm.contracts.show', $contract))->assertOk();
    expect(contractPage($show))->toBe('Erp/Hrm/Contracts/Show')
        ->and($show->viewData('page')['props']['document'])->toContain('Contract Company and Farai Dube');

    $this->put(route('erp.hrm.contracts.update', $contract), [
        'contract_type' => 'permanent', 'start_date' => '2026-01-05', 'basic_salary' => 1300,
        'currency_code' => 'USD', 'pay_frequency' => 'monthly', 'template_id' => $template->id,
    ])->assertRedirect();
    expect((float) $contract->fresh()->basic_salary)->toBe(1300.0);

    $this->post(route('erp.hrm.contracts.sign.employer', $contract))->assertRedirect();
    expect($contract->fresh()->status->value)->toBe('draft');

    // HR cannot sign as the employee.
    $this->withExceptionHandling();
    $this->post(route('erp.hrm.contracts.sign.employee', $contract))->assertForbidden();
    $this->withoutExceptionHandling();

    $this->actingAs($staff);
    $this->get(route('erp.hrm.contracts.show', $contract))->assertOk();
    $this->post(route('erp.hrm.contracts.sign.employee', $contract))->assertRedirect();
    expect($contract->fresh()->status->value)->toBe('active');

    $this->actingAs($this->user);
    $this->get(route('erp.hrm.contracts.index'))->assertOk();
    expect(contractPage($this->get(route('erp.hrm.contracts.index'))))->toBe('Erp/Hrm/Contracts/Index');

    $this->post(route('erp.hrm.contracts.renew', $contract), ['start_date' => '2027-01-05', 'basic_salary' => 1500])->assertRedirect();
    $renewal = Contract::query()->latest('id')->firstOrFail();
    expect($contract->fresh()->status->value)->toBe('renewed')
        ->and($renewal->status->value)->toBe('draft')
        ->and((float) $renewal->basic_salary)->toBe(1500.0)
        ->and($renewal->template_id)->toBe($template->id);

    $this->post(route('erp.hrm.contracts.terminate', $renewal), ['termination_date' => '2027-03-31'])->assertRedirect();
    expect($renewal->fresh()->status->value)->toBe('terminated');

    $this->withExceptionHandling();
    $this->delete(route('erp.hrm.contracts.templates.destroy', $template))->assertSessionHasErrors('record');
});

test('a fixed-term contract needs an end date', function () {
    $this->withExceptionHandling();
    $this->post(route('erp.hrm.employees.store'), ['first_name' => 'A', 'last_name' => 'B', 'status' => 'active', 'hire_date' => '2026-01-05']);

    $this->post(route('erp.hrm.contracts.store'), [
        'employee_id' => Employee::query()->value('id'),
        'contract_type' => 'fixed_term',
        'start_date' => '2026-01-05',
        'currency_code' => 'USD',
        'pay_frequency' => 'monthly',
    ])->assertSessionHasErrors('end_date');
});
