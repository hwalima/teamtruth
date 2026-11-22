<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Grade;
use App\Modules\Hrm\Models\Position;
use App\Modules\Hrm\Services\EmployeeService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class PositionController extends OrganizationUnitController
{
    protected function model(): string
    {
        return Position::class;
    }

    protected function page(): string
    {
        return 'Erp/Hrm/Organization/Positions/Index';
    }

    protected function indexRoute(): string
    {
        return 'erp.hrm.organization.positions.index';
    }

    protected function permission(): string
    {
        return 'erp.hrm.position.manage';
    }

    protected function with(): array
    {
        return ['department:id,code,name', 'grade:id,code,name', 'reportsTo:id,code,name'];
    }

    protected function rules(?Model $record): array
    {
        return [
            'department_id' => ['nullable', 'integer', $this->existsInCompany('hrm_departments')],
            'grade_id' => ['nullable', 'integer', $this->existsInCompany('hrm_grades')],
            'reports_to_position_id' => ['nullable', 'integer', $this->existsInCompany('hrm_positions')],
            'headcount_planned' => 'required|integer|min:0|max:100000',
        ];
    }

    protected function validateBusinessRules(array $data, ?Model $record): void
    {
        $this->assertNoCycle($record, $data['reports_to_position_id'] ?? null, 'reports_to_position_id');
    }

    protected function options(): array
    {
        return [
            'departmentOptions' => $this->unitOptions(Department::class),
            'gradeOptions' => $this->unitOptions(Grade::class),
            'positionOptions' => $this->unitOptions(Position::class),
        ];
    }

    protected function inUse(Model $record): ?string
    {
        return match (true) {
            Employee::query()->where('position_id', $record->getKey())->exists() => 'Employees hold this position. Reassign them first.',
            Position::query()->where('reports_to_position_id', $record->getKey())->exists() => 'Other positions report to this one.',
            default => null,
        };
    }

    public function store(Request $request): RedirectResponse
    {
        return $this->storeRecord($request);
    }

    public function update(Request $request, Position $position): RedirectResponse
    {
        return $this->updateRecord($request, $position);
    }

    public function destroy(Position $position): RedirectResponse
    {
        return $this->destroyRecord($position);
    }

    public function assignEmployee(Request $request, Position $position, EmployeeService $employees): RedirectResponse
    {
        $data = $request->validate(['employee_id' => ['required', 'integer', $this->existsInCompany('hrm_employees')]]);
        $employee = Employee::query()->findOrFail($data['employee_id']);

        $employees->updateEmployee($request->user(), $employee, array_filter([
            'position_id' => $position->id,
            'department_id' => $position->department_id ?? $employee->department_id,
            'grade_id' => $position->grade_id ?? $employee->grade_id,
        ]));

        return back()->with('success', 'Employee assigned.');
    }

    public function removeEmployee(Request $request, Position $position, Employee $employee, EmployeeService $employees): RedirectResponse
    {
        abort_unless((int) $employee->position_id === (int) $position->id, 404);
        $employees->updateEmployee($request->user(), $employee, ['position_id' => null]);

        return back()->with('success', 'Employee removed from position.');
    }
}
