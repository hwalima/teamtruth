<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Grade;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GradeController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $grades = Grade::where('company_id', $company->id)
            ->orderBy('level')
            ->paginate(20);

        return Inertia::render('Erp/Hrm/Organization/Grades/Index', [
            'company' => $company,
            'grades' => $grades,
        ]);
    }

    public function store(Request $request)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:10|unique:hrm_grades,code,NULL,id,company_id,' . $company->id,
            'level' => 'required|integer|min:1|max:50|unique:hrm_grades,level,NULL,id,company_id,' . $company->id,
            'min_salary' => 'nullable|numeric|min:0',
            'max_salary' => 'nullable|numeric|min:0',
            'currency_code' => 'required|string|size:3|exists:currencies,code',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        // Validate salary range
        if ($validated['min_salary'] && $validated['max_salary'] && $validated['min_salary'] > $validated['max_salary']) {
            return back()->withErrors(['max_salary' => 'Maximum salary must be greater than minimum salary.']);
        }

        Grade::create(array_merge($validated, [
            'company_id' => $company->id,
        ]));

        return redirect()->route('erp.hrm.organization.grades.index')
            ->with('success', 'Grade created successfully.');
    }

    public function update(Request $request, Grade $grade)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $grade->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'code' => 'sometimes|required|string|max:10|unique:hrm_grades,code,' . $grade->id . ',id,company_id,' . $company->id,
            'level' => 'sometimes|required|integer|min:1|max:50|unique:hrm_grades,level,' . $grade->id . ',id,company_id,' . $company->id,
            'min_salary' => 'nullable|numeric|min:0',
            'max_salary' => 'nullable|numeric|min:0',
            'currency_code' => 'sometimes|required|string|size:3|exists:currencies,code',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        // Validate salary range
        $minSalary = $validated['min_salary'] ?? $grade->min_salary;
        $maxSalary = $validated['max_salary'] ?? $grade->max_salary;
        if ($minSalary && $maxSalary && $minSalary > $maxSalary) {
            return back()->withErrors(['max_salary' => 'Maximum salary must be greater than minimum salary.']);
        }

        $grade->update($validated);

        return back()->with('success', 'Grade updated successfully.');
    }

    public function destroy(Grade $grade)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $grade->company_id !== (int) $company->id) {
            abort(403);
        }

        // Check if grade is used
        if (\App\Modules\Hrm\Models\Position::where('grade_id', $grade->id)->exists()
            || \App\Modules\Hrm\Models\Employee::where('grade_id', $grade->id)->exists()
            || \App\Modules\Hrm\Models\ContractTemplate::where('grade_id', $grade->id)->exists()) {
            return back()->withErrors(['grade' => 'Cannot delete grade in use by positions, employees, or contract templates.']);
        }

        $grade->delete();

        return redirect()->route('erp.hrm.organization.grades.index')
            ->with('success', 'Grade deleted successfully.');
    }
}