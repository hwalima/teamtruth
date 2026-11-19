<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\CostCenter;
use App\Modules\Hrm\Models\Employee;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CostCenterController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $costCenters = CostCenter::where('company_id', $company->id)
            ->with(['budgetOwner.user', 'parent', 'children' => fn ($q) => $q->where('is_active', true)])
            ->whereNull('parent_id')
            ->orderBy('code')
            ->get();

        $budgetOwners = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->with('user')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id']);

        return Inertia::render('Erp/Hrm/Organization/CostCenters/Index', [
            'company' => $company,
            'costCenters' => $costCenters,
            'budgetOwners' => $budgetOwners,
        ]);
    }

    public function store(Request $request)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $validated = $request->validate([
            'parent_id' => 'nullable|exists:hrm_cost_centers,id',
            'name' => 'required|string|max:150',
            'code' => 'required|string|max:20|unique:hrm_cost_centers,code,NULL,id,company_id,' . $company->id,
            'description' => 'nullable|string',
            'budget_owner_id' => 'nullable|exists:hrm_employees,id',
            'is_active' => 'nullable|boolean',
        ]);

        CostCenter::create(array_merge($validated, [
            'company_id' => $company->id,
        ]));

        return redirect()->route('erp.hrm.organization.cost-centers.index')
            ->with('success', 'Cost center created successfully.');
    }

    public function update(Request $request, CostCenter $costCenter)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $costCenter->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'parent_id' => 'nullable|exists:hrm_cost_centers,id',
            'name' => 'sometimes|required|string|max:150',
            'code' => 'sometimes|required|string|max:20|unique:hrm_cost_centers,code,' . $costCenter->id . ',id,company_id,' . $company->id,
            'description' => 'nullable|string',
            'budget_owner_id' => 'nullable|exists:hrm_employees,id',
            'is_active' => 'nullable|boolean',
        ]);

        // Prevent circular reference
        if ($validated['parent_id'] ?? false) {
            if ($validated['parent_id'] === $costCenter->id) {
                return back()->withErrors(['parent_id' => 'A cost center cannot be its own parent.']);
            }
            // Check for circular reference in hierarchy
            $currentId = $validated['parent_id'];
            while ($currentId) {
                if ($currentId === $costCenter->id) {
                    return back()->withErrors(['parent_id' => 'This would create a circular reference.']);
                }
                $parent = CostCenter::where('id', $currentId)->value('parent_id');
                $currentId = $parent ?? 0;
            }
        }

        $costCenter->update($validated);

        return back()->with('success', 'Cost center updated successfully.');
    }

    public function destroy(CostCenter $costCenter)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $costCenter->company_id !== (int) $company->id) {
            abort(403);
        }

        // Check for children
        if ($costCenter->children()->where('is_active', true)->exists()) {
            return back()->withErrors(['costCenter' => 'Cannot delete cost center with active children.']);
        }

        // Check for employees
        if (\App\Modules\Hrm\Models\Employee::where('cost_center_id', $costCenter->id)->exists()) {
            return back()->withErrors(['costCenter' => 'Cannot delete cost center assigned to employees.']);
        }

        // Check for departments
        if (\App\Modules\Hrm\Models\Department::where('cost_center_id', $costCenter->id)->exists()) {
            return back()->withErrors(['costCenter' => 'Cannot delete cost center assigned to departments.']);
        }

        $costCenter->delete();

        return redirect()->route('erp.hrm.organization.cost-centers.index')
            ->with('success', 'Cost center deleted successfully.');
    }
}