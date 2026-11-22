<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Models\CostCenter;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CostCenterController extends OrganizationUnitController
{
    protected function model(): string
    {
        return CostCenter::class;
    }

    protected function page(): string
    {
        return 'Erp/Hrm/Organization/CostCenters/Index';
    }

    protected function indexRoute(): string
    {
        return 'erp.hrm.organization.cost-centers.index';
    }

    protected function permission(): string
    {
        return 'erp.hrm.cost_center.manage';
    }

    protected function with(): array
    {
        return ['parent:id,code,name', 'budgetOwner:id,first_name,middle_name,last_name'];
    }

    protected function rules(?Model $record): array
    {
        return [
            'parent_id' => ['nullable', 'integer', $this->existsInCompany('hrm_cost_centers')],
            'budget_owner_id' => ['nullable', 'integer', $this->existsInCompany('hrm_employees')],
        ];
    }

    protected function validateBusinessRules(array $data, ?Model $record): void
    {
        $this->assertNoCycle($record, $data['parent_id'] ?? null);
    }

    protected function options(): array
    {
        return [
            'parentOptions' => $this->unitOptions(CostCenter::class),
            'employeeOptions' => $this->employeeOptions(),
        ];
    }

    protected function inUse(Model $record): ?string
    {
        return match (true) {
            CostCenter::query()->where('parent_id', $record->getKey())->exists() => 'This cost center has child cost centers.',
            Department::query()->where('cost_center_id', $record->getKey())->exists() => 'Departments use this cost center.',
            Employee::query()->where('cost_center_id', $record->getKey())->exists() => 'Employees use this cost center.',
            default => null,
        };
    }

    public function store(Request $request): RedirectResponse
    {
        return $this->storeRecord($request);
    }

    public function update(Request $request, CostCenter $costCenter): RedirectResponse
    {
        return $this->updateRecord($request, $costCenter);
    }

    public function destroy(CostCenter $costCenter): RedirectResponse
    {
        return $this->destroyRecord($costCenter);
    }
}
