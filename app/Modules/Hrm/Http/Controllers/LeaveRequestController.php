<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveRequest;
use App\Modules\Hrm\Models\LeaveType;
use App\Modules\Hrm\Services\LeaveService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LeaveRequestController extends Controller
{
    public function __construct(
        private LeaveService $leaveService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $query = LeaveRequest::where('company_id', $company->id)
            ->with(['employee.user', 'leaveType', 'approvedBy'])
            ->orderBy('created_at', 'desc');

        // Filter by employee if not admin
        $employee = Employee::where('company_id', $company->id)->where('user_id', $request->user()->id)->first();
        if ($employee && ! $request->user()->can('erp.hrm.leave.approve')) {
            $query->where('employee_id', $employee->id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('employee', fn ($q2) => $q2->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_number', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('leave_type_id')) {
            $query->where('leave_type_id', $request->leave_type_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('employee_id') && $request->user()->can('erp.hrm.leave.approve')) {
            $query->where('employee_id', $request->employee_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('start_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('end_date', '<=', $request->date_to);
        }

        $requests = $query->paginate(20)->withQueryString();

        $leaveTypes = LeaveType::where('company_id', $company->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $employees = Employee::where('company_id', $company->id)
            ->where('employment_status', 'active')
            ->with('user')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id']);

        return Inertia::render('Erp/Hrm/Leave/Requests/Index', [
            'company' => $company,
            'requests' => $requests,
            'leaveTypes' => $leaveTypes,
            'employees' => $employees,
            'filters' => $request->only(['search', 'leave_type_id', 'status', 'employee_id', 'date_from', 'date_to']),
            'statusOptions' => \App\Modules\Hrm\Enums\LeaveStatus::options(),
            'canApprove' => $request->user()->can('erp.hrm.leave.approve'),
        ]);
    }

    public function create(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        $employee = Employee::where('company_id', $company->id)->where('user_id', $request()->user()->id)->firstOrFail();

        $leaveTypes = LeaveType::where('company_id', $company->id)
            ->where('is_active', true)
            ->where(function ($q) use ($employee) {
                // Filter by gender
                if ($employee->gender) {
                    $q->where(function ($q2) use ($employee) {
                        $q2->whereNull('gender_restriction')
                            ->orWhere('gender_restriction', $employee->gender->value);
                    });
                }

                // Filter by employment type
                $q->where(function ($q2) use ($employee) {
                    $q2->whereNull('employment_types')
                        ->orWhereJsonContains('employment_types', $employee->employment_type->value);
                });
            })
            ->orderBy('name')
            ->get();

        return Inertia::render('Erp/Hrm/Leave/Requests/Create', [
            'company' => $company,
            'employee' => $employee,
            'leaveTypes' => $leaveTypes,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'nullable|exists:hrm_employees,id',
            'leave_type_id' => 'required|exists:hrm_leave_types,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'nullable|string|max:1000',
            'attachment_path' => 'nullable|string|max:500',
            'contact_during_leave' => 'nullable|string|max:200',
            'handover_notes' => 'nullable|string|max:1000',
        ]);

        $leaveRequest = $this->leaveService->createLeaveRequest($request->user(), $validated);

        return redirect()->route('erp.hrm.leave.requests.index')
            ->with('success', 'Leave request submitted successfully.');
    }

    public function show(LeaveRequest $leaveRequest): Response
    {
        $this->authorize('view', $leaveRequest);

        $company = app(CompanyContext::class)->requireActiveCompany();

        $leaveRequest->load(['employee.user', 'leaveType', 'approvedBy', 'ledgerEntries.leaveBalance']);

        return Inertia::render('Erp/Hrm/Leave/Requests/Show', [
            'company' => $company,
            'leaveRequest' => $leaveRequest,
            'canApprove' => $this->allows('approve', $leaveRequest),
            'canReject' => $this->allows('reject', $leaveRequest),
            'canCancel' => $this->allows('cancel', $leaveRequest),
        ]);
    }

    public function approve(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorize('approve', $leaveRequest);

        $validated = $request->validate([
            'notes' => 'nullable|string|max:500',
        ]);

        $leaveRequest = $this->leaveService->approveLeaveRequest($request->user(), $leaveRequest, $validated['notes'] ?? null);

        return back()->with('success', 'Leave request approved successfully.');
    }

    public function reject(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorize('reject', $leaveRequest);

        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $leaveRequest = $this->leaveService->rejectLeaveRequest($request->user(), $leaveRequest, $validated['reason']);

        return back()->with('success', 'Leave request rejected.');
    }

    public function cancel(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorize('cancel', $leaveRequest);

        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $leaveRequest = $this->leaveService->cancelLeaveRequest($request->user(), $leaveRequest, $validated['reason']);

        return back()->with('success', 'Leave request cancelled.');
    }
}