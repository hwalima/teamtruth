<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Enums\ContractStatus;
use App\Modules\Hrm\Enums\ContractType;
use App\Modules\Hrm\Enums\EmployeeStatus;
use App\Modules\Hrm\Enums\PayFrequency;
use App\Modules\Hrm\Models\Contract;
use App\Modules\Hrm\Models\ContractTemplate;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Services\ContractService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ContractController extends HrmController
{
    public function __construct(private ContractService $contracts) {}

    public function index(Request $request): Response
    {
        $this->contracts->expireEndedContracts();
        $filters = $request->only(['search', 'status', 'contract_type', 'expiring']);

        $contracts = Contract::query()
            ->with(['employee:id,employee_number,first_name,middle_name,last_name', 'template:id,name'])
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->whereHas('employee', fn ($e) => $e
                ->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('employee_number', 'like', "%{$search}%")))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['contract_type'] ?? null, fn ($q, $type) => $q->where('contract_type', $type))
            ->when($filters['expiring'] ?? null, fn ($q) => $q->where('status', ContractStatus::Active)
                ->whereNotNull('end_date')->whereDate('end_date', '<=', today()->addDays(60)))
            ->latest('start_date')
            ->paginate(20)
            ->withQueryString();

        if (! $this->allowsErpPermission('erp.hrm.employee.view_salary')) {
            $contracts->getCollection()->each->makeHidden('basic_salary');
        }

        return Inertia::render('Erp/Hrm/Contracts/Index', [
            'company' => $this->company(),
            'contracts' => $contracts,
            'filters' => $filters,
            'statusOptions' => ContractStatus::options(),
            'typeOptions' => ContractType::options(),
            'expiringCount' => Contract::query()->where('status', ContractStatus::Active)->whereNotNull('end_date')
                ->whereDate('end_date', '<=', today()->addDays(60))->count(),
            'canManage' => $this->allowsErpPermission('erp.hrm.contract.manage'),
        ]);
    }

    public function create(Request $request): Response
    {
        $company = $this->company();

        return Inertia::render('Erp/Hrm/Contracts/Create', [
            'company' => $company,
            'employees' => Employee::query()
                ->where('status', '!=', EmployeeStatus::Terminated)
                ->orderBy('first_name')->orderBy('last_name')
                ->get(['id', 'employee_number', 'first_name', 'middle_name', 'last_name']),
            'templates' => ContractTemplate::query()->orderBy('name')->get(['id', 'name', 'contract_type', 'is_default']),
            'typeOptions' => ContractType::options(),
            'payFrequencyOptions' => PayFrequency::options(),
            'defaultCurrency' => $company->default_currency ?? 'USD',
            'employeeId' => $request->integer('employee_id') ?: null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $contract = $this->contracts->createContract($request->user(), $this->validated($request, true));

        return redirect()->route('erp.hrm.contracts.show', $contract)->with('success', 'Contract drafted. It becomes active once both sides sign.');
    }

    public function show(Contract $contract): Response
    {
        $this->authorize('view', $contract);
        $contract->load(['employee.position:id,name', 'employee.department:id,name', 'template', 'creator:id,name', 'company']);

        $canManage = $this->allows('update', $contract);
        if (! $canManage && ! $this->allowsErpPermission('erp.hrm.employee.view_salary') && $contract->employee?->user_id !== auth()->id()) {
            $contract->makeHidden('basic_salary');
        }

        $history = Contract::query()
            ->where('employee_id', $contract->employee_id)
            ->where('id', '!=', $contract->id)
            ->latest('start_date')
            ->get(['id', 'contract_type', 'start_date', 'end_date', 'status']);

        return Inertia::render('Erp/Hrm/Contracts/Show', [
            'company' => $this->company(),
            'contract' => $contract->makeHidden('company'),
            'document' => $this->contracts->renderDocument($contract),
            'history' => $history,
            'templates' => ContractTemplate::query()->orderBy('name')->get(['id', 'name', 'contract_type']),
            'typeOptions' => ContractType::options(),
            'statusOptions' => ContractStatus::options(),
            'payFrequencyOptions' => PayFrequency::options(),
            'canManage' => $canManage,
            'canSignAsEmployee' => $this->allows('signAsEmployee', $contract),
            'canSignAsEmployer' => $this->allows('signAsEmployer', $contract),
        ]);
    }

    public function update(Request $request, Contract $contract): RedirectResponse
    {
        $this->authorize('update', $contract);
        $this->contracts->updateContract($request->user(), $contract, $this->validated($request, false));

        return back()->with('success', 'Contract updated.');
    }

    public function signByEmployee(Request $request, Contract $contract): RedirectResponse
    {
        $this->authorize('signAsEmployee', $contract);
        $contract = $this->contracts->signByEmployee($request->user(), $contract);

        return back()->with('success', $contract->status === ContractStatus::Active ? 'Contract signed and now active.' : 'Contract signed. Waiting for the employer to sign.');
    }

    public function signByEmployer(Request $request, Contract $contract): RedirectResponse
    {
        $this->authorize('signAsEmployer', $contract);
        $contract = $this->contracts->signByEmployer($request->user(), $contract);

        return back()->with('success', $contract->status === ContractStatus::Active ? 'Contract signed and now active.' : 'Contract signed. Waiting for the employee to sign.');
    }

    public function renew(Request $request, Contract $contract): RedirectResponse
    {
        $this->authorize('update', $contract);

        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'contract_type' => ['nullable', Rule::enum(ContractType::class)],
            'basic_salary' => 'nullable|numeric|min:0',
        ]);

        $successor = $this->contracts->renewContract($request->user(), $contract, $validated);

        return redirect()->route('erp.hrm.contracts.show', $successor)->with('success', 'Renewal drafted. Both sides need to sign it.');
    }

    public function terminate(Request $request, Contract $contract): RedirectResponse
    {
        $this->authorize('update', $contract);
        $validated = $request->validate(['termination_date' => 'required|date']);
        $this->contracts->terminateContract($request->user(), $contract, $validated);

        return back()->with('success', 'Contract terminated.');
    }

    private function validated(Request $request, bool $creating): array
    {
        $companyId = $this->company()->id;

        $data = $request->validate([
            'employee_id' => [$creating ? 'required' : 'prohibited', 'integer', Rule::exists('hrm_employees', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'template_id' => ['nullable', 'integer', Rule::exists('hrm_contract_templates', 'id')->where('company_id', $companyId)],
            'contract_type' => ['required', Rule::enum(ContractType::class)],
            'start_date' => 'required|date',
            'end_date' => [Rule::requiredIf(fn () => $request->input('contract_type') === ContractType::FixedTerm->value), 'nullable', 'date', 'after_or_equal:start_date'],
            'probation_end_date' => 'nullable|date|after_or_equal:start_date',
            'basic_salary' => 'nullable|numeric|min:0',
            'currency_code' => 'required|string|size:3',
            'pay_frequency' => ['required', Rule::enum(PayFrequency::class)],
            'working_hours_per_week' => 'nullable|numeric|min:1|max:100',
        ], [
            'end_date.required' => 'A fixed-term contract needs an end date.',
        ]);

        $data['currency_code'] = strtoupper($data['currency_code']);

        return $data;
    }
}
