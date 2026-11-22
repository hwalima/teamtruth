<?php

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Hrm\Models\CostCenter;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Grade;
use App\Modules\Hrm\Models\Position;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->company = Company::create(['code' => 'ORG', 'name' => 'Org Company', 'default_currency' => 'USD']);
    $this->company->users()->attach($this->user->id, ['role' => 'owner', 'is_active' => true]);
    $this->actingAs($this->user)->withSession(['active_erp_company_id' => $this->company->id]);
});

test('organization units can be created, listed, updated and deleted', function () {
    $this->withoutExceptionHandling();

    $this->post(route('erp.hrm.organization.cost-centers.store'), ['code' => 'CC1', 'name' => 'Head Office', 'is_active' => true])->assertRedirect();
    $costCenter = CostCenter::query()->firstOrFail();

    $this->post(route('erp.hrm.organization.departments.store'), ['code' => 'OPS', 'name' => 'Operations', 'cost_center_id' => $costCenter->id, 'is_active' => true])->assertRedirect();
    $department = Department::query()->firstOrFail();

    $this->post(route('erp.hrm.organization.grades.store'), ['code' => 'G1', 'name' => 'Grade 1', 'level' => 1, 'min_salary' => 500, 'max_salary' => 900, 'currency_code' => 'usd', 'is_active' => true])->assertRedirect();
    $grade = Grade::query()->firstOrFail();
    expect($grade->currency_code)->toBe('USD');

    $this->post(route('erp.hrm.organization.positions.store'), ['code' => 'SUP', 'name' => 'Supervisor', 'department_id' => $department->id, 'grade_id' => $grade->id, 'headcount_planned' => 2, 'is_active' => true])->assertRedirect();
    $position = Position::query()->firstOrFail();

    foreach (['departments', 'positions', 'grades', 'cost-centers'] as $page) {
        $this->get(route("erp.hrm.organization.{$page}.index"))->assertOk();
    }

    $this->put(route('erp.hrm.organization.departments.update', $department), ['code' => 'OPS', 'name' => 'Operations & Logistics', 'cost_center_id' => null, 'is_active' => false])->assertRedirect();
    expect($department->fresh())->name->toBe('Operations & Logistics')->is_active->toBeFalse();

    $this->post(route('erp.hrm.employees.store'), ['first_name' => 'A', 'last_name' => 'B', 'status' => 'active', 'hire_date' => '2026-01-01']);
    $employee = Employee::query()->firstOrFail();
    $this->post(route('erp.hrm.organization.positions.assign', $position), ['employee_id' => $employee->id])->assertRedirect();
    expect($employee->fresh()->position_id)->toBe($position->id)
        ->and($position->fresh()->headcount_current)->toBe(1);

    $this->delete(route('erp.hrm.organization.cost-centers.destroy', $costCenter))->assertRedirect();
    $this->delete(route('erp.hrm.organization.positions.remove', [$position, $employee]))->assertRedirect();
    expect($position->fresh()->headcount_current)->toBe(0);
    $this->delete(route('erp.hrm.organization.positions.destroy', $position))->assertRedirect();
    expect(Position::query()->count())->toBe(0);
});

test('a used department cannot be deleted and codes are unique', function () {
    $this->post(route('erp.hrm.organization.departments.store'), ['code' => 'OPS', 'name' => 'Operations']);
    $this->post(route('erp.hrm.organization.departments.store'), ['code' => 'OPS', 'name' => 'Duplicate'])->assertSessionHasErrors('code');

    $department = Department::query()->firstOrFail();
    $this->post(route('erp.hrm.organization.departments.store'), ['code' => 'SUB', 'name' => 'Sub', 'parent_id' => $department->id]);

    $this->delete(route('erp.hrm.organization.departments.destroy', $department))->assertSessionHasErrors('record');
    expect(Department::query()->count())->toBe(2);

    $child = Department::query()->where('code', 'SUB')->firstOrFail();
    $this->put(route('erp.hrm.organization.departments.update', $department), ['code' => 'OPS', 'name' => 'Operations', 'parent_id' => $child->id])
        ->assertSessionHasErrors('parent_id');
});
