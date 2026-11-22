<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Enums\LeaveRequestStatus;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\LeaveRequest;
use App\Modules\Hrm\Models\LeaveType;
use App\Modules\Hrm\Services\LeaveService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LeaveRequestController extends HrmController
{
    public function __construct(
        private LeaveService $leaveService,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'leave_type_id', 'status', 'date_from', 'date_to']);
        $canSeeAll = $this->allowsErpPermission('erp.hrm.leave.approve') || $this->allowsErpPermission('erp.hrm.leave.manage');
        $ownEmployee = $this->ownEmployee($request);

        $requests = LeaveRequest::query()
            ->with(['employee:id,employee_number,first_name,middle_name,last_name', 'leaveType:id,name,code,color', 'approvedBy:id,name'])
            ->when(! $canSeeAll, fn ($q) => $q->where('employee_id', $ownEmployee?->id ?? 0))
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->whereHas('employee', fn ($e) => $e
                ->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('employee_number', 'like', "%{$search}%")))
            ->when($filters['leave_type_id'] ?? null, fn ($q, $id) => $q->where('leave_type_id', $id))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['date_from'] ?? null, fn ($q, $date) => $q->whereDate('end_date', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($q, $date) => $q->whereDate('start_date', '<=', $date))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Erp/Hrm/Leave/Requests/Index', [
            'company' => $this->company(),
            'requests' => $requests,
            'leaveTypes' => LeaveType::query()->orderBy('name')->get(['id', 'name', 'code']),
            'filters' => $filters,
            'statusOptions' => LeaveRequestStatus::options(),
            'canApprove' => $this->allowsErpPermission('erp.hrm.leave.approve'),
            'canRequest' => $this->allowsErpPermission('erp.hrm.leave.request'),
            'hasEmployeeRecord' => $ownEmployee !== null,
        ]);
    }

    public function create(Request $request): Response
    {
        $canManage = $this->allowsErpPermission('erp.hrm.leave.manage');
        $ownEmployee = $this->ownEmployee($request);

        return Inertia::render('Erp/Hrm/Leave/Requests/Create', [
            'company' => $this->company(),
            'employee' => $ownEmployee?->only(['id', 'employee_number', 'first_name', 'middle_name', 'last_name']),
            'employees' => $canManage
                ? Employee::query()->where('status', '!=', 'terminated')->orderBy('last_name')->get(['id', 'employee_number', 'first_name', 'middle_name', 'last_name'])
                : [],
            'leaveTypes' => LeaveType::query()->where('is_active', true)->orderBy('name')
                ->get(['id', 'name', 'code', 'color', 'description', 'requires_document', 'requires_approval']),
            'balances' => $ownEmployee
                ? $ownEmployee->leaveBalances()->with('leaveType:id,name')->whereDate('period_end', '>=', now()->toDateString())->get()
                : [],
            'canRequestForOthers' => $canManage,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $companyId = $this->company()->id;
        $data = $request->validate([
            'employee_id' => ['nullable', 'integer', Rule::exists('hrm_employees', 'id')->where('company_id', $companyId)],
            'leave_type_id' => ['required', 'integer', Rule::exists('hrm_leave_types', 'id')->where('company_id', $companyId)],
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'required|string|max:2000',
            'attachment' => 'nullable|file|max:10240',
        ]);

        $employee = $this->resolveEmployee($request, $data['employee_id'] ?? null);

        if ($request->hasFile('attachment')) {
            $data['attachment_path'] = $request->file('attachment')->store("hrm/{$companyId}/leave", 'local');
        }

        $leaveRequest = $this->leaveService->createLeaveRequest($request->user(), $employee, $data);

        return redirect()->route('erp.hrm.leave.requests.show', $leaveRequest)
            ->with('success', 'Leave request submitted.');
    }

    public function show(LeaveRequest $leaveRequest): Response
    {
        $this->authorize('view', $leaveRequest);

        $leaveRequest->load([
            'employee:id,employee_number,first_name,middle_name,last_name,user_id',
            'leaveType:id,name,code,color,requires_approval',
            'approvedBy:id,name',
            'ledgerEntries' => fn ($q) => $q->latest(),
        ]);

        $balance = $leaveRequest->employee
            ? $this->leaveService->balanceFor($leaveRequest->employee, $leaveRequest->leaveType, $leaveRequest->start_date->toDateString())
            : null;

        $open = in_array($leaveRequest->status, [LeaveRequestStatus::Submitted, LeaveRequestStatus::InApproval], true);

        return Inertia::render('Erp/Hrm/Leave/Requests/Show', [
            'company' => $this->company(),
            'leaveRequest' => $leaveRequest,
            'balance' => $balance,
            'canApprove' => $open && $this->allows('approve', $leaveRequest),
            'canCancel' => in_array($leaveRequest->status, LeaveService::OPEN_STATUSES, true) && $this->allows('cancel', $leaveRequest),
        ]);
    }

    public function approve(Request $request, LeaveRequest $leaveRequest): RedirectResponse
    {
        $this->authorize('approve', $leaveRequest);
        $this->leaveService->approveLeaveRequest($request->user(), $leaveRequest);

        return back()->with('success', 'Leave request approved.');
    }

    public function reject(Request $request, LeaveRequest $leaveRequest): RedirectResponse
    {
        $this->authorize('reject', $leaveRequest);
        $data = $request->validate(['reason' => 'required|string|max:1000']);
        $this->leaveService->rejectLeaveRequest($request->user(), $leaveRequest, $data['reason']);

        return back()->with('success', 'Leave request rejected.');
    }

    public function cancel(Request $request, LeaveRequest $leaveRequest): RedirectResponse
    {
        $this->authorize('cancel', $leaveRequest);
        $data = $request->validate(['reason' => 'nullable|string|max:1000']);
        $this->leaveService->cancelLeaveRequest($request->user(), $leaveRequest, $data['reason'] ?? null);

        return back()->with('success', 'Leave request cancelled.');
    }

    private function ownEmployee(Request $request): ?Employee
    {
        return Employee::query()->where('user_id', $request->user()->id)->first();
    }

    /** Managers may file leave for anyone; everyone else files for themselves. */
    private function resolveEmployee(Request $request, ?int $employeeId): Employee
    {
        if ($employeeId && $this->allowsErpPermission('erp.hrm.leave.manage')) {
            return Employee::query()->findOrFail($employeeId);
        }

        return $this->ownEmployee($request) ?? throw ValidationException::withMessages([
            'employee_id' => 'Your user account is not linked to an employee record. Ask HR to link it first.',
        ]);
    }
}
