<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\SelfServiceRequest;
use App\Modules\Hrm\Models\User;
use App\Modules\Hrm\Services\SelfServiceService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SelfServiceController extends Controller
{
    public function __construct(
        private SelfServiceService $selfServiceService,
    ) {}

    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        // Check if user is HR/Admin (can see all) or employee (sees own)
        if ($request->user()->can('erp.hrm.self_service.manage')) {
            $filters = $request->only(['search', 'employee_id', 'request_type', 'status', 'priority', 'assigned_to', 'created_from', 'created_to']);
            $requests = $this->selfServiceService->searchRequests($filters, 20);

            $employees = Employee::where('company_id', $company->id)
                ->where('employment_status', 'active')
                ->with('user')
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get(['id', 'employee_number', 'first_name', 'last_name', 'user_id']);

            $reviewers = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['hr', 'admin', 'manager']))
                ->orderBy('name')
                ->get(['id', 'name', 'email']);

            $statistics = $this->selfServiceService->getRequestStatistics();

            return Inertia::render('Erp/Hrm/SelfService/Index', [
                'company' => $company,
                'requests' => $requests,
                'employees' => $employees,
                'reviewers' => $reviewers,
                'filters' => $filters,
                'statistics' => $statistics,
                'statusOptions' => \App\Modules\Hrm\Enums\SelfServiceRequestStatus::options(),
                'typeOptions' => \App\Modules\Hrm\Enums\SelfServiceRequestType::options(),
                'priorityOptions' => ['low' => 'Low', 'normal' => 'Normal', 'high' => 'High', 'urgent' => 'Urgent'],
                'canManage' => true,
            ]);
        } else {
            // Employee view - only their requests
            $employee = Employee::where('company_id', $company->id)->where('user_id', $request->user()->id)->firstOrFail();
            $filters = $request->only(['status', 'request_type']);
            $requests = $this->selfServiceService->getEmployeeRequests($employee->id, $filters, 20);

            return Inertia::render('Erp/Hrm/SelfService/MyRequests', [
                'company' => $company,
                'requests' => $requests,
                'filters' => $filters,
                'employee' => $employee->load('user'),
                'statusOptions' => \App\Modules\Hrm\Enums\SelfServiceRequestStatus::options(),
                'typeOptions' => \App\Modules\Hrm\Enums\SelfServiceRequestType::options(),
                'canManage' => false,
            ]);
        }
    }

    public function create(): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return Inertia::render('Erp/Hrm/SelfService/Create', [
            'company' => $company,
            'typeOptions' => \App\Modules\Hrm\Enums\SelfServiceRequestType::options(),
            'priorityOptions' => ['low' => 'Low', 'normal' => 'Normal', 'high' => 'High', 'urgent' => 'Urgent'],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'nullable|exists:hrm_employees,id',
            'request_type' => 'required|in:' . implode(',', array_column(\App\Modules\Hrm\Enums\SelfServiceRequestType::cases(), 'value')),
            'title' => 'nullable|string|max:200',
            'description' => 'nullable|string',
            'request_data' => 'nullable|array',
            'supporting_documents' => 'nullable|array',
            'priority' => 'nullable|in:low,normal,high,urgent',
        ]);

        $selfServiceRequest = $this->selfServiceService->createRequest($request->user(), $validated);

        return redirect()->route('erp.hrm.self-service.index')
            ->with('success', 'Request submitted successfully.');
    }

    public function show(SelfServiceRequest $request): Response
    {
        $this->authorize('view', $request);

        $company = app(CompanyContext::class)->requireActiveCompany();

        $request->load(['employee.user', 'assignedTo', 'reviewedBy', 'resolvedBy']);

        $canReview = $this->allows('review', $request);
        $canCancel = $this->allows('cancel', $request);

        return Inertia::render('Erp/Hrm/SelfService/Show', [
            'company' => $company,
            'request' => $request,
            'canReview' => $canReview,
            'canCancel' => $canCancel,
            'actionOptions' => ['approve' => 'Approve', 'reject' => 'Reject', 'request_info' => 'Request More Info'],
        ]);
    }

    public function update(Request $request, SelfServiceRequest $selfServiceRequest)
    {
        $this->authorize('update', $selfServiceRequest);

        $validated = $request->validate([
            'title' => 'nullable|string|max:200',
            'description' => 'nullable|string',
            'request_data' => 'nullable|array',
            'supporting_documents' => 'nullable|array',
            'priority' => 'nullable|in:low,normal,high,urgent',
        ]);

        $selfServiceRequest = $this->selfServiceService->updateRequest($request->user(), $selfServiceRequest, $validated);

        return back()->with('success', 'Request updated successfully.');
    }

    public function assign(Request $request, SelfServiceRequest $selfServiceRequest)
    {
        $this->authorize('review', $selfServiceRequest);

        $validated = $request->validate([
            'assigned_to' => 'required|exists:users,id',
        ]);

        $selfServiceRequest = $this->selfServiceService->assignRequest($request->user(), $selfServiceRequest, $validated['assigned_to']);

        return back()->with('success', 'Request assigned successfully.');
    }

    public function review(Request $request, SelfServiceRequest $selfServiceRequest)
    {
        $this->authorize('review', $selfServiceRequest);

        $validated = $request->validate([
            'action' => 'required|in:approve,reject,request_info',
            'notes' => 'nullable|string|max:1000',
            'resolution' => 'nullable|string|max:1000',
        ]);

        $selfServiceRequest = $this->selfServiceService->reviewRequest($request->user(), $selfServiceRequest, $validated);

        $messages = [
            'approve' => 'Request approved successfully.',
            'reject' => 'Request rejected.',
            'request_info' => 'More information requested.',
        ];

        return back()->with('success', $messages[$validated['action']]);
    }

    public function cancel(Request $request, SelfServiceRequest $selfServiceRequest)
    {
        $this->authorize('cancel', $selfServiceRequest);

        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $selfServiceRequest = $this->selfServiceService->cancelRequest($request->user(), $selfServiceRequest, $validated['reason']);

        return back()->with('success', 'Request cancelled successfully.');
    }

    public function storeDocument(Request $request, SelfServiceRequest $selfServiceRequest)
    {
        $this->authorize('update', $selfServiceRequest);

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'file_path' => 'required|string|max:500',
            'file_size' => 'nullable|integer|min:0',
            'mime_type' => 'nullable|string|max:100',
        ]);

        $selfServiceRequest = $this->selfServiceService->uploadDocument($request->user(), $selfServiceRequest, $validated);

        return back()->with('success', 'Document uploaded successfully.');
    }
}