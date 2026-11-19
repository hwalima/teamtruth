<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Contract;
use App\Modules\Hrm\Models\ContractTemplate;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Services\ContractService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ContractController extends Controller
{
    public function __construct(
        private ContractService $contractService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $filters = $request->only(['search', 'employee_id', 'status', 'contract_type', 'template_id', 'start_date_from', 'start_date_to', 'end_date_from', 'end_date_to']);

        $contracts = $this->contractService->searchContracts($filters, 20);

        $employees = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->with('user')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id']);

        $templates = ContractTemplate::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('Erp/Hrm/Contracts/Index', [
            'company' => $company,
            'contracts' => $contracts,
            'employees' => $employees,
            'templates' => $templates,
            'filters' => $filters,
            'statusOptions' => \App\Modules\Hrm\Enums\ContractStatus::options(),
            'typeOptions' => \App\Modules\Hrm\Enums\ContractType::options(),
        ]);
    }

    public function create(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $employees = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->with('user', 'position', 'grade')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id', 'position_id', 'grade_id', 'employment_type']);

        $templates = ContractTemplate::where('company_id', $company->id)
            ->where('is_active', true)
            ->with('grade')
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'contract_type', 'basic_salary', 'pay_frequency', 'working_hours_per_week', 'overtime_eligible', 'notice_period_days', 'annual_leave_days', 'sick_leave_days', 'grade_id']);

        return Inertia::render('Erp/Hrm/Contracts/Create', [
            'company' => $company,
            'employees' => $employees,
            'templates' => $templates,
            'typeOptions' => \App\Modules\Hrm\Enums\ContractType::options(),
            'statusOptions' => \App\Modules\Hrm\Enums\ContractStatus::options(),
            'payFrequencyOptions' => ['weekly' => 'Weekly', 'bi_weekly' => 'Bi-Weekly', 'monthly' => 'Monthly'],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:hrm_employees,id',
            'template_id' => 'nullable|exists:hrm_contract_templates,id',
            'contract_type' => 'required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractType::cases(), 'value')),
            'status' => 'required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractStatus::cases(), 'value')),
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'probation_end_date' => 'nullable|date|after_or_equal:start_date',
            'basic_salary' => 'nullable|numeric|min:0',
            'currency_code' => 'required|string|size:3|exists:currencies,code',
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
        ]);

        $contract = $this->contractService->createContract($request->user(), $validated);

        return redirect()->route('erp.hrm.contracts.show', $contract)
            ->with('success', 'Contract created successfully.');
    }

    public function show(Contract $contract): Response
    {
        $this->authorize('view', $contract);

        $company = app(CompanyContext::class)->requireActiveCompany();

        $contract->load(['employee.user', 'template', 'employee.position', 'employee.grade']);

        return Inertia::render('Erp/Hrm/Contracts/Show', [
            'company' => $company,
            'contract' => $contract,
            'canUpdate' => $this->allows('update', $contract),
            'canSign' => $this->allows('sign', $contract),
            'canRenew' => $this->allows('renew', $contract),
            'canTerminate' => $this->allows('terminate', $contract),
        ]);
    }

    public function update(Request $request, Contract $contract)
    {
        $this->authorize('update', $contract);

        $validated = $request->validate([
            'contract_type' => 'sometimes|required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractType::cases(), 'value')),
            'status' => 'sometimes|required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractStatus::cases(), 'value')),
            'start_date' => 'sometimes|required|date',
            'end_date' => 'nullable|date',
            'probation_end_date' => 'nullable|date',
            'basic_salary' => 'nullable|numeric|min:0',
            'currency_code' => 'sometimes|required|string|size:3|exists:currencies,code',
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
            'document_path' => 'nullable|string|max:500',
        ]);

        $contract = $this->contractService->updateContract($request->user(), $contract, $validated);

        return back()->with('success', 'Contract updated successfully.');
    }

    public function signByEmployee(Request $request, Contract $contract)
    {
        $this->authorize('sign', $contract);

        $contract = $this->contractService->signByEmployee($request->user(), $contract, $request->ip());

        return back()->with('success', 'Contract signed successfully.');
    }

    public function signByEmployer(Request $request, Contract $contract)
    {
        $this->authorize('sign', $contract);

        $contract = $this->contractService->signByEmployer($request->user(), $contract, $request->ip());

        return back()->with('success', 'Contract signed by employer successfully.');
    }

    public function renew(Request $request, Contract $contract)
    {
        $this->authorize('renew', $contract);

        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'probation_end_date' => 'nullable|date|after_or_equal:start_date',
            'contract_type' => 'nullable|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractType::cases(), 'value')),
            'status' => 'nullable|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractStatus::cases(), 'value')),
            'basic_salary' => 'nullable|numeric|min:0',
        ]);

        $newContract = $this->contractService->renewContract($request->user(), $contract, $validated);

        return redirect()->route('erp.hrm.contracts.show', $newContract)
            ->with('success', 'Contract renewed successfully.');
    }

    public function terminate(Request $request, Contract $contract)
    {
        $this->authorize('terminate', $contract);

        $validated = $request->validate([
            'termination_date' => 'required|date',
            'termination_reason' => 'nullable|string|max:500',
        ]);

        $contract = $this->contractService->terminateContract($request->user(), $contract, $validated);

        return back()->with('success', 'Contract terminated successfully.');
    }
}