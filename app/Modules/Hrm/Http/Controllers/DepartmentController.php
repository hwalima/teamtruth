<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Models\CostCenter;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Position;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DepartmentController extends OrganizationUnitController
{
    protected function model(): string
    {
        return Department::class;
    }

    protected function page(): string
    {
        return 'Erp/Hrm/Organization/Departments/Index';
    }

    protected function indexRoute(): string
    {
        return 'erp.hrm.organization.departments.index';
    }

    protected function permission(): string
    {
        return 'erp.hrm.department.manage';
    }

    protected function with(): array
    {
        return ['parent:id,code,name', 'costCenter:id,code,name', 'head:id,first_name,middle_name,last_name'];
    }

    protected function rules(?Model $record): array
    {
        return [
            'parent_id' => ['nullable', 'integer', $this->existsInCompany('hrm_departments')],
            'cost_center_id' => ['nullable', 'integer', $this->existsInCompany('hrm_cost_centers')],
            'head_id' => ['nullable', 'integer', $this->existsInCompany('hrm_employees')],
        ];
    }

    protected function validateBusinessRules(array $data, ?Model $record): void
    {
        $this->assertNoCycle($record, $data['parent_id'] ?? null);
    }

    protected function options(): array
    {
        return [
            'parentOptions' => $this->unitOptions(Department::class),
            'costCenterOptions' => $this->unitOptions(CostCenter::class),
            'employeeOptions' => $this->employeeOptions(),
        ];
    }

    protected function inUse(Model $record): ?string
    {
        return match (true) {
            Department::query()->where('parent_id', $record->getKey())->exists() => 'This department has sub-departments. Move or delete them first.',
            Employee::query()->where('department_id', $record->getKey())->exists() => 'Employees are assigned to this department. Reassign them first.',
            Position::query()->where('department_id', $record->getKey())->exists() => 'Positions belong to this department. Move or delete them first.',
            default => null,
        };
    }

    public function store(Request $request): RedirectResponse
    {
        return $this->storeRecord($request);
    }

    public function update(Request $request, Department $department): RedirectResponse
    {
        return $this->updateRecord($request, $department);
    }

    public function destroy(Department $department): RedirectResponse
    {
        return $this->destroyRecord($department);
    }

    public function move(Request $request, Department $department): RedirectResponse
    {
        $data = $request->validate(['parent_id' => ['nullable', 'integer', $this->existsInCompany('hrm_departments')]]);
        $this->assertNoCycle($department, $data['parent_id'] ?? null);
        $department->update(['parent_id' => $data['parent_id'] ?? null, 'updated_by' => $request->user()->id]);

        return back()->with('success', 'Department moved.');
    }
}
