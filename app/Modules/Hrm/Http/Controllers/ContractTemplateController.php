<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\ContractTemplate;
use App\Modules\Hrm\Models\Grade;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ContractTemplateController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $templates = ContractTemplate::where('company_id', $company->id)
            ->with('grade')
            ->orderBy('name')
            ->paginate(20);

        $grades = Grade::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('level')
            ->get(['id', 'name', 'code', 'min_salary', 'max_salary', 'currency_code']);

        return Inertia::render('Erp/Hrm/Contracts/Templates/Index', [
            'company' => $company,
            'templates' => $templates,
            'grades' => $grades,
            'typeOptions' => \App\Modules\Hrm\Enums\ContractType::options(),
            'payFrequencyOptions' => ['weekly' => 'Weekly', 'bi_weekly' => 'Bi-Weekly', 'monthly' => 'Monthly'],
        ]);
    }

    public function store(Request $request)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => 'required|string|max:20|unique:hrm_contract_templates,code,NULL,id,company_id,' . $company->id,
            'contract_type' => 'required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractType::cases(), 'value')),
            'description' => 'nullable|string',
            'grade_id' => 'nullable|exists:hrm_grades,id',
            'basic_salary' => 'nullable|numeric|min:0',
            'pay_frequency' => 'required|in:weekly,bi_weekly,monthly',
            'working_hours_per_week' => 'nullable|numeric|min:1|max:80',
            'overtime_eligible' => 'nullable|boolean',
            'notice_period_days' => 'nullable|integer|min:0',
            'annual_leave_days' => 'nullable|numeric|min:0|max:365',
            'sick_leave_days' => 'nullable|numeric|min:0|max:365',
            'benefits' => 'nullable|array',
            'allowances' => 'nullable|array',
            'deductions' => 'nullable|array',
            'special_conditions' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        ContractTemplate::create(array_merge($validated, [
            'company_id' => $company->id,
        ]));

        return redirect()->route('erp.hrm.contracts.templates.index')
            ->with('success', 'Contract template created successfully.');
    }

    public function update(Request $request, ContractTemplate $template)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $template->company_id !== (int) $company->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'code' => 'sometimes|required|string|max:20|unique:hrm_contract_templates,code,' . $template->id . ',id,company_id,' . $company->id,
            'contract_type' => 'sometimes|required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractType::cases(), 'value')),
            'description' => 'nullable|string',
            'grade_id' => 'nullable|exists:hrm_grades,id',
            'basic_salary' => 'nullable|numeric|min:0',
            'pay_frequency' => 'sometimes|required|in:weekly,bi_weekly,monthly',
            'working_hours_per_week' => 'nullable|numeric|min:1|max:80',
            'overtime_eligible' => 'nullable|boolean',
            'notice_period_days' => 'nullable|integer|min:0',
            'annual_leave_days' => 'nullable|numeric|min:0|max:365',
            'sick_leave_days' => 'nullable|numeric|min:0|max:365',
            'benefits' => 'nullable|array',
            'allowances' => 'nullable|array',
            'deductions' => 'nullable|array',
            'special_conditions' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $template->update($validated);

        return back()->with('success', 'Contract template updated successfully.');
    }

    public function destroy(ContractTemplate $template)
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        if ((int) $template->company_id !== (int) $company->id) {
            abort(403);
        }

        // Check if template is used by contracts
        if ($template->contracts()->exists()) {
            return back()->withErrors(['template' => 'Cannot delete template used by existing contracts.']);
        }

        $template->delete();

        return redirect()->route('erp.hrm.contracts.templates.index')
            ->with('success', 'Contract template deleted successfully.');
    }
}