<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Department;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\EmployeeDocument;
use App\Modules\Hrm\Models\Grade;
use App\Modules\Hrm\Models\Position;
use App\Modules\Hrm\Services\EmployeeService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeController extends Controller
{
    public function __construct(
        private EmployeeService $employeeService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $filters = $request->only(['search', 'department_id', 'position_id', 'employment_status', 'employment_type', 'grade_id', 'cost_center_id']);

        $employees = $this->employeeService->searchEmployees($filters, 20);

        $departments = Department::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $positions = Position::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $grades = Grade::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('level')
            ->get(['id', 'name', 'code']);

        $costCenters = \App\Modules\Hrm\Models\CostCenter::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return Inertia::render('Erp/Hrm/Employees/Index', [
            'company' => $company,
            'employees' => $employees,
            'departments' => $departments,
            'positions' => $positions,
            'grades' => $grades,
            'costCenters' => $costCenters,
            'filters' => $filters,
            'statusOptions' => \App\Modules\Hrm\Enums\EmploymentStatus::options(),
            'typeOptions' => \App\Modules\Hrm\Enums\ContractType::options(),
        ]);
    }

    public function create(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $departments = Department::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $positions = Position::where('company_id', $company->id)
            ->where('is_active', true)
            ->with('department')
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'department_id', 'grade_id']);

        $grades = Grade::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('level')
            ->get(['id', 'name', 'code', 'min_salary', 'max_salary', 'currency_code']);

        $costCenters = \App\Modules\Hrm\Models\CostCenter::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $managers = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->with('user')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id']);

        $users = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))
            ->whereDoesntHave('employee', fn ($q) => $q->where('company_id', $company->id))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return Inertia::render('Erp/Hrm/Employees/Create', [
            'company' => $company,
            'departments' => $departments,
            'positions' => $positions,
            'grades' => $grades,
            'costCenters' => $costCenters,
            'managers' => $managers,
            'users' => $users,
            'genderOptions' => \App\Modules\Hrm\Enums\Gender::options(),
            'statusOptions' => \App\Modules\Hrm\Enums\EmploymentStatus::options(),
            'typeOptions' => \App\Modules\Hrm\Enums\ContractType::options(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'gender' => 'required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\Gender::cases(), 'value')),
            'date_of_birth' => 'nullable|date|before:today',
            'national_id' => 'nullable|string|max:50',
            'passport_number' => 'nullable|string|max:50',
            'phone' => 'nullable|string|max:30',
            'personal_email' => 'nullable|email|max:150',
            'work_email' => 'nullable|email|max:150',
            'address' => 'nullable|string',
            'emergency_contact_name' => 'nullable|string|max:150',
            'emergency_contact_phone' => 'nullable|string|max:30',
            'emergency_contact_relationship' => 'nullable|string|max:50',
            'bank_name' => 'nullable|string|max:150',
            'bank_account_name' => 'nullable|string|max:150',
            'bank_account_number' => 'nullable|string|max:50',
            'bank_branch' => 'nullable|string|max:150',
            'bank_swift_code' => 'nullable|string|max:20',
            'tax_number' => 'nullable|string|max:50',
            'social_security_number' => 'nullable|string|max:50',
            'pension_number' => 'nullable|string|max:50',
            'department_id' => 'nullable|exists:hrm_departments,id',
            'position_id' => 'nullable|exists:hrm_positions,id',
            'grade_id' => 'nullable|exists:hrm_grades,id',
            'cost_center_id' => 'nullable|exists:hrm_cost_centers,id',
            'manager_id' => 'nullable|exists:hrm_employees,id',
            'user_id' => 'nullable|exists:users,id',
            'employment_status' => 'required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\EmploymentStatus::cases(), 'value')),
            'employment_type' => 'required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractType::cases(), 'value')),
            'hire_date' => 'required|date',
            'probation_end_date' => 'nullable|date|after_or_equal:hire_date',
            'confirmation_date' => 'nullable|date|after_or_equal:hire_date',
            'notice_period_days' => 'nullable|integer|min:0',
            'annual_leave_entitlement' => 'nullable|numeric|min:0|max:365',
            'work_schedule' => 'nullable|array',
            'overtime_eligible' => 'nullable|boolean',
        ]);

        $employee = $this->employeeService->createEmployee($request->user(), $validated);

        return redirect()->route('erp.hrm.employees.show', $employee)
            ->with('success', 'Employee created successfully.');
    }

    public function show(Employee $employee): Response
    {
        $this->authorize('view', $employee);

        $employee = $this->employeeService->getEmployeeWithRelations($employee->id);

        $company = app(CompanyContext::class)->requireActiveCompany();

        return Inertia::render('Erp/Hrm/Employees/Show', [
            'company' => $company,
            'employee' => $employee,
            'canUpdate' => $this->allows('update', $employee),
            'canTerminate' => $this->allows('terminate', $employee),
            'canRehire' => $this->allows('rehire', $employee),
            'canManageDocuments' => $this->allows('manageDocuments', $employee),
            'canManageContracts' => $this->allows('manageContracts', $employee),
            'canViewSalary' => $this->allows('viewSalary', $employee),
        ]);
    }

    public function edit(Employee $employee): Response
    {
        $this->authorize('update', $employee);

        $company = app(CompanyContext::class)->requireActiveCompany();

        $departments = Department::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $positions = Position::where('company_id', $company->id)
            ->where('is_active', true)
            ->with('department')
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'department_id', 'grade_id']);

        $grades = Grade::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('level')
            ->get(['id', 'name', 'code', 'min_salary', 'max_salary', 'currency_code']);

        $costCenters = \App\Modules\Hrm\Models\CostCenter::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $managers = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->where('id', '!=', $employee->id)
            ->with('user')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id']);

        $users = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))
            ->where(function ($q) use ($employee) {
                $q->whereDoesntHave('employee', fn ($q2) => $q2->where('company_id', $employee->company_id))
                    ->orWhereHas('employee', fn ($q2) => $q2->where('id', $employee->id));
            })
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        $employee->load(['user', 'department', 'position', 'grade', 'costCenter', 'manager']);

        return Inertia::render('Erp/Hrm/Employees/Edit', [
            'company' => $company,
            'employee' => $employee,
            'departments' => $departments,
            'positions' => $positions,
            'grades' => $grades,
            'costCenters' => $costCenters,
            'managers' => $managers,
            'users' => $users,
            'genderOptions' => \App\Modules\Hrm\Enums\Gender::options(),
            'statusOptions' => \App\Modules\Hrm\Enums\EmploymentStatus::options(),
            'typeOptions' => \App\Modules\Hrm\Enums\ContractType::options(),
        ]);
    }

    public function update(Request $request, Employee $employee)
    {
        $this->authorize('update', $employee);

        $validated = $request->validate([
            'first_name' => 'sometimes|required|string|max:100',
            'last_name' => 'sometimes|required|string|max:100',
            'gender' => 'sometimes|required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\Gender::cases(), 'value')),
            'date_of_birth' => 'nullable|date|before:today',
            'national_id' => 'nullable|string|max:50',
            'passport_number' => 'nullable|string|max:50',
            'phone' => 'nullable|string|max:30',
            'personal_email' => 'nullable|email|max:150',
            'work_email' => 'nullable|email|max:150',
            'address' => 'nullable|string',
            'emergency_contact_name' => 'nullable|string|max:150',
            'emergency_contact_phone' => 'nullable|string|max:30',
            'emergency_contact_relationship' => 'nullable|string|max:50',
            'bank_name' => 'nullable|string|max:150',
            'bank_account_name' => 'nullable|string|max:150',
            'bank_account_number' => 'nullable|string|max:50',
            'bank_branch' => 'nullable|string|max:150',
            'bank_swift_code' => 'nullable|string|max:20',
            'tax_number' => 'nullable|string|max:50',
            'social_security_number' => 'nullable|string|max:50',
            'pension_number' => 'nullable|string|max:50',
            'department_id' => 'nullable|exists:hrm_departments,id',
            'position_id' => 'nullable|exists:hrm_positions,id',
            'grade_id' => 'nullable|exists:hrm_grades,id',
            'cost_center_id' => 'nullable|exists:hrm_cost_centers,id',
            'manager_id' => 'nullable|exists:hrm_employees,id',
            'user_id' => 'nullable|exists:users,id',
            'employment_status' => 'sometimes|required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\EmploymentStatus::cases(), 'value')),
            'employment_type' => 'sometimes|required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\ContractType::cases(), 'value')),
            'hire_date' => 'sometimes|required|date',
            'probation_end_date' => 'nullable|date',
            'confirmation_date' => 'nullable|date',
            'termination_date' => 'nullable|date',
            'termination_reason' => 'nullable|string',
            'notice_period_days' => 'nullable|integer|min:0',
            'annual_leave_entitlement' => 'nullable|numeric|min:0|max:365',
            'work_schedule' => 'nullable|array',
            'overtime_eligible' => 'nullable|boolean',
        ]);

        $employee = $this->employeeService->updateEmployee($request->user(), $employee, $validated);

        return redirect()->route('erp.hrm.employees.show', $employee)
            ->with('success', 'Employee updated successfully.');
    }

    public function terminate(Request $request, Employee $employee)
    {
        $this->authorize('terminate', $employee);

        $validated = $request->validate([
            'termination_date' => 'required|date',
            'termination_reason' => 'nullable|string|max:500',
        ]);

        $employee = $this->employeeService->terminateEmployee($request->user(), $employee, $validated);

        return redirect()->route('erp.hrm.employees.show', $employee)
            ->with('success', 'Employee terminated successfully.');
    }

    public function rehire(Request $request, Employee $employee)
    {
        $this->authorize('rehire', $employee);

        $validated = $request->validate([
            'rehire_date' => 'required|date',
        ]);

        $employee = $this->employeeService->rehireEmployee($request->user(), $employee, $validated);

        return redirect()->route('erp.hrm.employees.show', $employee)
            ->with('success', 'Employee rehired successfully.');
    }

    public function storeDocument(Request $request, Employee $employee)
    {
        $this->authorize('manageDocuments', $employee);

        $validated = $request->validate([
            'document_type' => 'required|string|max:50',
            'name' => 'required|string|max:150',
            'file_path' => 'required|string|max:500',
            'file_size' => 'nullable|integer|min:0',
            'mime_type' => 'nullable|string|max:100',
            'issued_at' => 'nullable|date',
            'expires_at' => 'nullable|date',
            'is_verified' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        $document = $this->employeeService->uploadDocument($request->user(), $employee, $validated);

        return back()->with('success', 'Document uploaded successfully.');
    }

    public function destroyDocument(Request $request, Employee $employee, EmployeeDocument $document)
    {
        $this->authorize('manageDocuments', $employee);

        $this->employeeService->deleteDocument($request->user(), $document);

        return back()->with('success', 'Document deleted successfully.');
    }
}