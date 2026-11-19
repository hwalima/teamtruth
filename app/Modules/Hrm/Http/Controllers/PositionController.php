<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\Grade;
use App\Modules\Hrm\Models\Position;
use App\Modules\Hrm\Services\PositionService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PositionController extends Controller
{
    public function __construct(
        private PositionService $positionService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $filters = $request->only(['search', 'department_id', 'grade_id', 'is_active', 'reports_to_position_id', 'has_vacancy']);

        $positions = $this->positionService->searchPositions($filters, 20);

        $departments = Department::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $grades = Grade::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('level')
            ->get(['id', 'name', 'code']);

        $reportingPositions = Position::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('Erp/Hrm/Organization/Positions/Index', [
            'company' => $company,
            'positions' => $positions,
            'departments' => $departments,
            'grades' => $grades,
            'reportingPositions' => $reportingPositions,
            'filters' => $filters,
        ]);
    }

    public function store(Request $request)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $validated = $request->validate([
            'department_id' => 'required|exists:hrm_departments,id',
            'name' => 'required|string|max:150',
            'code' => 'nullable|string|max:20|unique:hrm_positions,code,NULL,id,company_id,' . $company->id,
            'description' => 'nullable|string',
            'grade_id' => 'required|exists:hrm_grades,id',
            'reports_to_position_id' => 'nullable|exists:hrm_positions,id',
            'headcount_planned' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'metadata' => 'nullable|array',
        ]);

        $position = $this->positionService->createPosition($request->user(), $validated);

        return redirect()->route('erp.hrm.organization.positions.index')
            ->with('success', 'Position created successfully.');
    }

    public function update(Request $request, Position $position)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $position->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'department_id' => 'sometimes|required|exists:hrm_departments,id',
            'name' => 'sometimes|required|string|max:150',
            'code' => 'sometimes|required|string|max:20|unique:hrm_positions,code,' . $position->id . ',id,company_id,' . $company->id,
            'description' => 'nullable|string',
            'grade_id' => 'sometimes|required|exists:hrm_grades,id',
            'reports_to_position_id' => 'nullable|exists:hrm_positions,id',
            'headcount_planned' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'metadata' => 'nullable|array',
        ]);

        $position = $this->positionService->updatePosition($request->user(), $position, $validated);

        return back()->with('success', 'Position updated successfully.');
    }

    public function destroy(Position $position)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $position->company_id !== (int) $company->id) {
            abort(403);
        }

        try {
            $this->positionService->deletePosition($request()->user(), $position);
            return redirect()->route('erp.hrm.organization.positions.index')
                ->with('success', 'Position deleted successfully.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return back()->withErrors($e->errors());
        }
    }

    public function assignEmployee(Request $request, Position $position)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $position->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'employee_id' => 'required|exists:hrm_employees,id',
        ]);

        $employee = $this->positionService->assignEmployee($request->user(), $position, $validated['employee_id']);

        return back()->with('success', 'Employee assigned to position successfully.');
    }

    public function removeEmployee(Request $request, Position $position, Employee $employee)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $position->company_id !== (int) $company->id) {
            abort(403);
        }

        if ($employee->position_id !== $position->id) {
            abort(404);
        }

        $employee = $this->positionService->removeEmployee($request->user(), $position, $employee->id);

        return back()->with('success', 'Employee removed from position successfully.');
    }
}