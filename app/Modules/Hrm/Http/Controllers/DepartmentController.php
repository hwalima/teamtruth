<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\CostCenter;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Services\DepartmentService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DepartmentController extends Controller
{
    public function __construct(
        private DepartmentService $departmentService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $filters = $request->only(['search', 'parent_id', 'is_active', 'manager_id']);

        $departments = $this->departmentService->searchDepartments($filters, 20);

        $managers = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->with('user')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id']);

        $costCenters = CostCenter::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('Erp/Hrm/Organization/Departments/Index', [
            'company' => $company,
            'departments' => $departments,
            'managers' => $managers,
            'costCenters' => $costCenters,
            'filters' => $filters,
            'parentOptions' => Department::where('company_id', $company->id)
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'code']),
        ]);
    }

    public function store(Request $request)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $validated = $request->validate([
            'parent_id' => 'nullable|exists:hrm_departments,id',
            'name' => 'required|string|max:150',
            'code' => 'nullable|string|max:20|unique:hrm_departments,code,NULL,id,company_id,' . $company->id,
            'description' => 'nullable|string',
            'manager_id' => 'nullable|exists:hrm_employees,id',
            'cost_center_id' => 'nullable|exists:hrm_cost_centers,id',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'metadata' => 'nullable|array',
        ]);

        $department = $this->departmentService->createDepartment($request->user(), $validated);

        return redirect()->route('erp.hrm.organization.departments.index')
            ->with('success', 'Department created successfully.');
    }

    public function update(Request $request, Department $department)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $department->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'parent_id' => 'nullable|exists:hrm_departments,id',
            'name' => 'sometimes|required|string|max:150',
            'code' => 'sometimes|required|string|max:20|unique:hrm_departments,code,' . $department->id . ',id,company_id,' . $company->id,
            'description' => 'nullable|string',
            'manager_id' => 'nullable|exists:hrm_employees,id',
            'cost_center_id' => 'nullable|exists:hrm_cost_centers,id',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'metadata' => 'nullable|array',
        ]);

        $department = $this->departmentService->updateDepartment($request->user(), $department, $validated);

        return back()->with('success', 'Department updated successfully.');
    }

    public function destroy(Department $department)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $department->company_id !== (int) $company->id) {
            abort(403);
        }

        try {
            $this->departmentService->deleteDepartment($request()->user(), $department);
            return redirect()->route('erp.hrm.organization.departments.index')
                ->with('success', 'Department deleted successfully.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return back()->withErrors($e->errors());
        }
    }

    public function move(Request $request, Department $department)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $department->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'parent_id' => 'nullable|exists:hrm_departments,id',
        ]);

        $department = $this->departmentService->moveDepartment($request->user(), $department, $validated['parent_id']);

        return back()->with('success', 'Department moved successfully.');
    }
}