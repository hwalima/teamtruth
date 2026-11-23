<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Models\User;
use App\Modules\Hrm\Enums\EmployeeDocumentType;
use App\Modules\Hrm\Enums\EmployeeStatus;
use App\Modules\Hrm\Enums\Gender;
use App\Modules\Hrm\Models\CostCenter;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\EmployeeDocument;
use App\Modules\Hrm\Models\Grade;
use App\Modules\Hrm\Models\Position;
use App\Modules\Hrm\Services\EmployeeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeController extends HrmController
{
    public const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'];

    public function __construct(
        private EmployeeService $employeeService,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'department_id', 'position_id', 'status', 'grade_id', 'cost_center_id']);

        return Inertia::render('Erp/Hrm/Employees/Index', [
            'company' => $this->company(),
            'employees' => $this->employeeService->searchEmployees($filters, 20),
            'departments' => Department::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'positions' => Position::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'filters' => $filters,
            'statusOptions' => EmployeeStatus::options(),
            'canManage' => $this->allowsErpPermission('erp.hrm.employee.manage'),
            'canDelete' => $this->allowsErpPermission('erp.hrm.employee.terminate'),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Erp/Hrm/Employees/Create', $this->formData(null));
    }

    public function store(Request $request): RedirectResponse
    {
        $employee = $this->employeeService->createEmployee($request->user(), $this->validateEmployee($request, null));

        return redirect()->route('erp.hrm.employees.show', $employee)
            ->with('success', 'Employee created successfully.');
    }

    public function show(Employee $employee): Response
    {
        $this->authorize('view', $employee);

        $employee = $this->employeeService->getEmployeeWithRelations($employee->id);
        $canViewSalary = $this->allows('viewSalary', $employee);

        if (! $canViewSalary) {
            $employee->setRelation('contracts', $employee->contracts->each->makeHidden('basic_salary'));
        }

        return Inertia::render('Erp/Hrm/Employees/Show', [
            'company' => $this->company(),
            'employee' => $employee,
            'documentTypeOptions' => EmployeeDocumentType::options(),
            'canUpdate' => $this->allows('update', $employee),
            'canTerminate' => $this->allows('terminate', $employee),
            'canDelete' => $this->allows('delete', $employee),
            'canManageDocuments' => $this->allows('manageDocuments', $employee),
            'canManageContracts' => $this->allows('manageContracts', $employee),
            'canViewSalary' => $canViewSalary,
        ]);
    }

    public function edit(Employee $employee): Response
    {
        $this->authorize('update', $employee);

        return Inertia::render('Erp/Hrm/Employees/Edit', $this->formData($employee));
    }

    public function update(Request $request, Employee $employee): RedirectResponse
    {
        $this->authorize('update', $employee);

        $employee = $this->employeeService->updateEmployee($request->user(), $employee, $this->validateEmployee($request, $employee));

        return redirect()->route('erp.hrm.employees.show', $employee)
            ->with('success', 'Employee updated successfully.');
    }

    public function terminate(Request $request, Employee $employee): RedirectResponse
    {
        $this->authorize('terminate', $employee);

        $validated = $request->validate([
            'termination_date' => 'required|date',
            'termination_reason' => 'nullable|string|max:2000',
        ]);

        $this->employeeService->terminateEmployee($request->user(), $employee, $validated);

        return back()->with('success', 'Employee terminated.');
    }

    public function destroy(Request $request, Employee $employee): RedirectResponse
    {
        $this->authorize('delete', $employee);

        try {
            $this->employeeService->deleteEmployee($request->user(), $employee);
        } catch (ValidationException $e) {
            return back()->with('error', collect($e->errors())->flatten()->first());
        }

        return redirect()->route('erp.hrm.employees.index')->with('success', $employee->full_name.' was deleted.');
    }

    public function rehire(Request $request, Employee $employee): RedirectResponse
    {
        $this->authorize('rehire', $employee);

        $validated = $request->validate(['rehire_date' => 'required|date']);

        $this->employeeService->rehireEmployee($request->user(), $employee, $validated);

        return back()->with('success', 'Employee rehired.');
    }

    public function storeDocument(Request $request, Employee $employee): RedirectResponse
    {
        $this->authorize('manageDocuments', $employee);

        $validated = $request->validate([
            'document_type' => ['required', Rule::enum(EmployeeDocumentType::class)],
            'title' => 'required|string|max:255',
            'document_number' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:2000',
            'issued_date' => 'nullable|date',
            'expiry_date' => 'nullable|date|after_or_equal:issued_date',
            'file' => 'required|file|max:10240',
        ]);

        $file = $request->file('file');
        $validated['file_path'] = $file->store('hrm/'.$this->company()->id.'/employees/'.$employee->id, 'local');
        $validated['file_mime'] = $file->getClientMimeType();
        $validated['file_size'] = $file->getSize();

        $this->employeeService->uploadDocument($request->user(), $employee, $validated);

        return back()->with('success', 'Document uploaded.');
    }

    public function destroyDocument(Request $request, Employee $employee, EmployeeDocument $document): RedirectResponse
    {
        $this->authorize('manageDocuments', $employee);
        abort_unless((int) $document->employee_id === (int) $employee->id, 404);

        Storage::disk('local')->delete($document->file_path);
        $this->employeeService->deleteDocument($request->user(), $document);

        return back()->with('success', 'Document deleted.');
    }

    private function validateEmployee(Request $request, ?Employee $employee): array
    {
        $companyId = $this->company()->id;
        $inCompany = fn (string $table) => Rule::exists($table, 'id')->where('company_id', $companyId);

        return $request->validate([
            'user_id' => ['nullable', 'integer', Rule::exists('company_user', 'user_id')->where('company_id', $companyId)],
            'first_name' => 'required|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'required|string|max:255',
            'gender' => ['nullable', Rule::enum(Gender::class)],
            'date_of_birth' => 'nullable|date|before:today',
            'marital_status' => ['nullable', Rule::in(self::MARITAL_STATUSES)],
            'nationality' => 'nullable|string|max:255',
            'national_id' => 'nullable|string|max:255',
            'passport_number' => 'nullable|string|max:255',
            'personal_email' => 'nullable|email|max:255',
            'personal_phone' => 'nullable|string|max:255',
            'emergency_contact_name' => 'nullable|string|max:255',
            'emergency_contact_phone' => 'nullable|string|max:255',
            'emergency_contact_relation' => 'nullable|string|max:255',
            'bank_name' => 'nullable|string|max:255',
            'bank_account_name' => 'nullable|string|max:255',
            'bank_account_number' => 'nullable|string|max:255',
            'bank_branch' => 'nullable|string|max:255',
            'tax_number' => 'nullable|string|max:255',
            'nssa_number' => 'nullable|string|max:255',
            'status' => ['required', Rule::enum(EmployeeStatus::class)],
            'hire_date' => 'required|date',
            'line_manager_id' => ['nullable', 'integer', $inCompany('hrm_employees'), Rule::notIn(array_filter([$employee?->id]))],
            'department_id' => ['nullable', 'integer', $inCompany('hrm_departments')],
            'position_id' => ['nullable', 'integer', $inCompany('hrm_positions')],
            'grade_id' => ['nullable', 'integer', $inCompany('hrm_grades')],
            'cost_center_id' => ['nullable', 'integer', $inCompany('hrm_cost_centers')],
        ]);
    }

    private function formData(?Employee $employee): array
    {
        $company = $this->company();

        $users = User::query()
            ->whereHas('companies', fn ($q) => $q->whereKey($company->id))
            ->whereNotIn('id', Employee::query()
                ->whereNotNull('user_id')
                ->when($employee, fn ($q) => $q->whereKeyNot($employee->id))
                ->pluck('user_id'))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return [
            'company' => $company,
            'employee' => $employee,
            'departments' => Department::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'positions' => Position::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'department_id', 'grade_id']),
            'grades' => Grade::query()->where('is_active', true)->orderBy('level')->get(['id', 'name', 'code']),
            'costCenters' => CostCenter::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'code']),
            'managers' => Employee::query()
                ->where('status', '!=', EmployeeStatus::Terminated->value)
                ->when($employee, fn ($q) => $q->whereKeyNot($employee->id))
                ->orderBy('last_name')->orderBy('first_name')
                ->get(['id', 'employee_number', 'first_name', 'middle_name', 'last_name']),
            'users' => $users,
            'genderOptions' => Gender::options(),
            'statusOptions' => EmployeeStatus::options(),
            'maritalStatusOptions' => array_combine(self::MARITAL_STATUSES, array_map('ucfirst', self::MARITAL_STATUSES)),
        ];
    }
}
