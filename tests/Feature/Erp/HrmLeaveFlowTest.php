<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveBalance;
use App\Modules\Hrm\Models\LeaveRequest;
use App\Modules\Hrm\Models\LeaveType;
use App\Modules\Hrm\Models\PublicHoliday;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'LVE', 'name' => 'Leave Company', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
    $this->withoutExceptionHandling();
});

function leavePage($response): string
{
    $component = $response->viewData('page')['component'];
    expect(resource_path("js/pages/{$component}.tsx"))->toBeFile();

    return $component;
}

test('leave can be set up, requested, approved, cancelled and adjusted', function () {
    $this->post(route('erp.hrm.leave.types.store'), [
        'name' => 'Annual leave',
        'code' => 'AL',
        'accrual_type' => 'yearly',
        'accrual_rate' => 22,
        'is_paid' => true,
        'requires_approval' => true,
        'color' => '#22c55e',
    ])->assertRedirect();
    $type = LeaveType::query()->firstOrFail();

    // Wednesday 4 March 2026 is a holiday, so Mon 2 – Fri 6 March is 4 working days.
    $this->post(route('erp.hrm.leave.holidays.store'), ['name' => 'Founders day', 'date' => '2026-03-04', 'is_recurring' => false])->assertRedirect();
    expect(PublicHoliday::query()->count())->toBe(1);
    expect(leavePage($this->get(route('erp.hrm.leave.holidays.index', ['year' => 2026]))->assertOk()))->toBe('Erp/Hrm/Leave/Holidays/Index');

    $this->post(route('erp.hrm.employees.store'), ['first_name' => 'Rudo', 'last_name' => 'Chari', 'status' => 'active', 'hire_date' => '2025-01-06']);
    $employee = Employee::query()->firstOrFail();

    expect(leavePage($this->get(route('erp.hrm.leave.requests.create'))->assertOk()))->toBe('Erp/Hrm/Leave/Requests/Create');

    $this->post(route('erp.hrm.leave.requests.store'), [
        'employee_id' => $employee->id,
        'leave_type_id' => $type->id,
        'start_date' => '2026-03-02',
        'end_date' => '2026-03-06',
        'reason' => 'Family visit',
    ])->assertRedirect();

    $request = LeaveRequest::query()->firstOrFail();
    expect((float) $request->total_days)->toBe(4.0)
        ->and($request->status->value)->toBe('submitted');

    expect(leavePage($this->get(route('erp.hrm.leave.requests.index'))->assertOk()))->toBe('Erp/Hrm/Leave/Requests/Index');
    expect(leavePage($this->get(route('erp.hrm.leave.requests.show', $request))->assertOk()))->toBe('Erp/Hrm/Leave/Requests/Show');

    $this->post(route('erp.hrm.leave.requests.approve', $request))->assertRedirect();
    expect($request->fresh()->status->value)->toBe('approved');

    $balance = LeaveBalance::query()->where('employee_id', $employee->id)->firstOrFail();
    expect((float) $balance->taken)->toBe(4.0)
        ->and($balance->available)->toBe(18.0);

    $this->post(route('erp.hrm.leave.requests.cancel', $request), ['reason' => 'Trip postponed'])->assertRedirect();
    expect($request->fresh()->status->value)->toBe('cancelled')
        ->and((float) $balance->fresh()->taken)->toBe(0.0);

    $this->post(route('erp.hrm.leave.balances.adjust', $balance), ['days' => 2, 'reason' => 'Overtime award'])->assertRedirect();
    expect($balance->fresh()->available)->toBe(24.0);

    expect(leavePage($this->get(route('erp.hrm.leave.balances.index', ['year' => 2026]))->assertOk()))->toBe('Erp/Hrm/Leave/Balances/Index');
});

test('a leave request cannot exceed the available balance', function () {
    $this->withExceptionHandling();
    $this->post(route('erp.hrm.leave.types.store'), ['name' => 'Sick', 'code' => 'SL', 'accrual_type' => 'fixed', 'accrual_rate' => 2, 'requires_approval' => true]);
    $type = LeaveType::query()->firstOrFail();
    $this->post(route('erp.hrm.employees.store'), ['first_name' => 'A', 'last_name' => 'B', 'status' => 'active', 'hire_date' => '2025-01-06']);
    $employee = Employee::query()->firstOrFail();

    $this->post(route('erp.hrm.leave.requests.store'), [
        'employee_id' => $employee->id,
        'leave_type_id' => $type->id,
        'start_date' => '2026-03-02',
        'end_date' => '2026-03-06',
        'reason' => 'Unwell',
    ])->assertSessionHasErrors();

    expect(LeaveRequest::query()->count())->toBe(0);
});
