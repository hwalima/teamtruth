<?php

namespace App\Modules\Hrm\Services;

use App\Models\User;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Hrm\Enums\SelfServiceRequestStatus;
use App\Modules\Hrm\Enums\SelfServiceRequestType;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\SelfServiceRequest;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SelfServiceService
{
    public function __construct(
        private CompanyContext $companyContext,
    ) {}

    /**
     * Create a self-service request
     */
    public function createRequest(User $actor, array $data): SelfServiceRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        // Determine employee - from actor's employee record or explicitly provided (for admin creating on behalf)
        $employee = $data['employee_id']
            ? Employee::where('company_id', $company->id)->findOrFail($data['employee_id'])
            : Employee::where('company_id', $company->id)->where('user_id', $actor->id)->firstOrFail();

        $requestType = SelfServiceRequestType::tryFrom($data['request_type']);
        if (! $requestType) {
            throw ValidationException::withMessages(['request_type' => 'Invalid request type.']);
        }

        return DB::transaction(function () use ($company, $actor, $employee, $data, $requestType) {
            // Validate request type specific requirements
            $this->validateRequestData($requestType, $data);

            // Check for duplicate pending requests of same type
            $duplicate = SelfServiceRequest::where('employee_id', $employee->id)
                ->where('request_type', $requestType)
                ->whereIn('status', [SelfServiceRequestStatus::Pending, SelfServiceRequestStatus::UnderReview])
                ->exists();

            if ($duplicate && $requestType !== SelfServiceRequestType::GeneralInquiry) {
                throw ValidationException::withMessages([
                    'request_type' => 'You already have a pending request of this type.',
                ]);
            }

            // Generate request number
            $requestNumber = $this->generateRequestNumber($company);

            $request = SelfServiceRequest::query()->create([
                'company_id' => $company->id,
                'employee_id' => $employee->id,
                'request_number' => $requestNumber,
                'request_type' => $requestType,
                'title' => $data['title'] ?? $this->getDefaultTitle($requestType),
                'description' => $data['description'] ?? null,
                'request_data' => $data['request_data'] ?? [],
                'supporting_documents' => $data['supporting_documents'] ?? [],
                'status' => SelfServiceRequestStatus::Pending,
                'priority' => $data['priority'] ?? 'normal',
                'assigned_to' => $data['assigned_to'] ?? null,
                'reviewed_by' => null,
                'reviewed_at' => null,
                'review_notes' => null,
                'resolution' => null,
                'resolved_at' => null,
                'resolved_by' => null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
            ]);

            return $request->load(['employee.user', 'assignedTo', 'reviewedBy', 'resolvedBy']);
        });
    }

    /**
     * Update a self-service request (by employee before review)
     */
    public function updateRequest(User $actor, SelfServiceRequest $request, array $data): SelfServiceRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $request->company_id !== (int) $company->id) {
            throw new AuthorizationException('Request belongs to a different company.');
        }

        // Employee can only update their own pending requests
        $employee = Employee::where('company_id', $company->id)->where('user_id', $actor->id)->first();
        if ($request->employee_id !== $employee?->id && ! $actor->can('manage all self-service requests')) {
            throw new AuthorizationException('You can only update your own requests.');
        }

        if (! in_array($request->status, [SelfServiceRequestStatus::Pending, SelfServiceRequestStatus::UnderReview])) {
            throw ValidationException::withMessages(['request' => 'Only pending or under review requests can be updated.']);
        }

        $request->update(array_merge($data, ['updated_by' => $actor->id]));

        return $request->fresh()->load(['employee.user', 'assignedTo', 'reviewedBy', 'resolvedBy']);
    }

    /**
     * Assign request to reviewer
     */
    public function assignRequest(User $actor, SelfServiceRequest $request, int $assignedToId): SelfServiceRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $request->company_id !== (int) $company->id) {
            throw new AuthorizationException('Request belongs to a different company.');
        }

        if (! $actor->can('manage all self-service requests')) {
            throw new AuthorizationException('You are not authorized to assign requests.');
        }

        $assignee = User::whereHas('companies', fn ($q) => $q->where('company_id', $company->id))
            ->where('id', $assignedToId)
            ->firstOrFail();

        $request->update([
            'status' => SelfServiceRequestStatus::UnderReview,
            'assigned_to' => $assignedToId,
            'updated_by' => $actor->id,
        ]);

        return $request->fresh()->load(['employee.user', 'assignedTo', 'reviewedBy', 'resolvedBy']);
    }

    /**
     * Review request (approve/reject/request more info)
     */
    public function reviewRequest(User $actor, SelfServiceRequest $request, array $data): SelfServiceRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $request->company_id !== (int) $company->id) {
            throw new AuthorizationException('Request belongs to a different company.');
        }

        if (! $actor->can('manage all self-service requests')) {
            throw new AuthorizationException('You are not authorized to review requests.');
        }

        $action = $data['action']; // 'approve', 'reject', 'request_info'
        $notes = $data['notes'] ?? null;

        if (! in_array($action, ['approve', 'reject', 'request_info'])) {
            throw ValidationException::withMessages(['action' => 'Invalid action.']);
        }

        return DB::transaction(function () use ($actor, $request, $action, $notes) {
            $request = SelfServiceRequest::query()->lockForUpdate()->findOrFail($request->id);

            if (! in_array($request->status, [SelfServiceRequestStatus::Pending, SelfServiceRequestStatus::UnderReview])) {
                throw ValidationException::withMessages(['request' => 'Request is not in a reviewable state.']);
            }

            switch ($action) {
                case 'approve':
                    $request->update([
                        'status' => SelfServiceRequestStatus::Approved,
                        'reviewed_by' => $actor->id,
                        'reviewed_at' => now(),
                        'review_notes' => $notes,
                        'resolution' => $data['resolution'] ?? 'Request approved',
                        'resolved_at' => now(),
                        'resolved_by' => $actor->id,
                        'updated_by' => $actor->id,
                    ]);
                    $this->executeApprovalActions($request->fresh(), $actor);
                    break;

                case 'reject':
                    $request->update([
                        'status' => SelfServiceRequestStatus::Rejected,
                        'reviewed_by' => $actor->id,
                        'reviewed_at' => now(),
                        'review_notes' => $notes,
                        'resolution' => $data['resolution'] ?? 'Request rejected',
                        'resolved_at' => now(),
                        'resolved_by' => $actor->id,
                        'updated_by' => $actor->id,
                    ]);
                    break;

                case 'request_info':
                    $request->update([
                        'status' => SelfServiceRequestStatus::Pending,
                        'reviewed_by' => $actor->id,
                        'reviewed_at' => now(),
                        'review_notes' => $notes,
                        'updated_by' => $actor->id,
                    ]);
                    break;
            }

            return $request->fresh()->load(['employee.user', 'assignedTo', 'reviewedBy', 'resolvedBy']);
        });
    }

    /**
     * Cancel request (by employee)
     */
    public function cancelRequest(User $actor, SelfServiceRequest $request, string $reason): SelfServiceRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $request->company_id !== (int) $company->id) {
            throw new AuthorizationException('Request belongs to a different company.');
        }

        $employee = Employee::where('company_id', $company->id)->where('user_id', $actor->id)->first();
        if ($request->employee_id !== $employee?->id && ! $actor->can('manage all self-service requests')) {
            throw new AuthorizationException('You can only cancel your own requests.');
        }

        if (! in_array($request->status, [SelfServiceRequestStatus::Pending, SelfServiceRequestStatus::UnderReview])) {
            throw ValidationException::withMessages(['request' => 'Only pending or under review requests can be cancelled.']);
        }

        $request->update([
            'status' => SelfServiceRequestStatus::Cancelled,
            'review_notes' => $reason,
            'resolution' => 'Cancelled by employee: ' . $reason,
            'resolved_at' => now(),
            'resolved_by' => $actor->id,
            'updated_by' => $actor->id,
        ]);

        return $request->fresh()->load(['employee.user', 'assignedTo', 'reviewedBy', 'resolvedBy']);
    }

    /**
     * Upload supporting document
     */
    public function uploadDocument(User $actor, SelfServiceRequest $request, array $data): SelfServiceRequest
    {
        $company = $this->companyContext->requireActiveCompany();

        if ((int) $request->company_id !== (int) $company->id) {
            throw new AuthorizationException('Request belongs to a different company.');
        }

        $employee = Employee::where('company_id', $company->id)->where('user_id', $actor->id)->first();
        if ($request->employee_id !== $employee?->id && ! $actor->can('manage all self-service requests')) {
            throw new AuthorizationException('You can only upload documents to your own requests.');
        }

        $documents = $request->supporting_documents ?? [];
        $documents[] = [
            'name' => $data['name'],
            'file_path' => $data['file_path'],
            'file_size' => $data['file_size'] ?? null,
            'mime_type' => $data['mime_type'] ?? null,
            'uploaded_at' => now()->toISOString(),
            'uploaded_by' => $actor->id,
        ];

        $request->update([
            'supporting_documents' => $documents,
            'updated_by' => $actor->id,
        ]);

        return $request->fresh()->load(['employee.user', 'assignedTo', 'reviewedBy', 'resolvedBy']);
    }

    /**
     * Get employee's self-service requests
     */
    public function getEmployeeRequests(int $employeeId, array $filters = [], int $perPage = 15)
    {
        $company = $this->companyContext->requireActiveCompany();

        $query = SelfServiceRequest::where('company_id', $company->id)
            ->where('employee_id', $employeeId)
            ->with(['assignedTo', 'reviewedBy', 'resolvedBy']);

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['request_type'])) {
            $query->where('request_type', $filters['request_type']);
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }

    /**
     * Search all self-service requests (admin/HR view)
     */
    public function searchRequests(array $filters, int $perPage = 15)
    {
        $company = $this->companyContext->requireActiveCompany();

        $query = SelfServiceRequest::where('company_id', $company->id)
            ->with(['employee.user', 'assignedTo', 'reviewedBy', 'resolvedBy']);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('request_number', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('employee', fn ($q2) => $q2->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('employee_number', 'like', "%{$search}%"));
            });
        }

        if (! empty($filters['employee_id'])) {
            $query->where('employee_id', $filters['employee_id']);
        }

        if (! empty($filters['request_type'])) {
            $query->where('request_type', $filters['request_type']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['priority'])) {
            $query->where('priority', $filters['priority']);
        }

        if (! empty($filters['assigned_to'])) {
            $query->where('assigned_to', $filters['assigned_to']);
        }

        if (! empty($filters['created_from'])) {
            $query->whereDate('created_at', '>=', $filters['created_from']);
        }

        if (! empty($filters['created_to'])) {
            $query->whereDate('created_at', '<=', $filters['created_to']);
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }

    /**
     * Get pending requests for review
     */
    public function getPendingForReview(int $reviewerId = null, int $perPage = 15)
    {
        $company = $this->companyContext->requireActiveCompany();

        $query = SelfServiceRequest::where('company_id', $company->id)
            ->whereIn('status', [SelfServiceRequestStatus::Pending, SelfServiceRequestStatus::UnderReview])
            ->with(['employee.user', 'assignedTo']);

        if ($reviewerId) {
            $query->where(function ($q) use ($reviewerId) {
                $q->where('assigned_to', $reviewerId)
                    ->orWhereNull('assigned_to');
            });
        }

        return $query->orderBy('priority', 'desc')
            ->orderBy('created_at')
            ->paginate($perPage);
    }

    /**
     * Get request statistics
     */
    public function getRequestStatistics(): array
    {
        $company = $this->companyContext->requireActiveCompany();

        $total = SelfServiceRequest::where('company_id', $company->id)->count();
        $pending = SelfServiceRequest::where('company_id', $company->id)->where('status', SelfServiceRequestStatus::Pending)->count();
        $underReview = SelfServiceRequest::where('company_id', $company->id)->where('status', SelfServiceRequestStatus::UnderReview)->count();
        $approved = SelfServiceRequest::where('company_id', $company->id)->where('status', SelfServiceRequestStatus::Approved)->count();
        $rejected = SelfServiceRequest::where('company_id', $company->id)->where('status', SelfServiceRequestStatus::Rejected)->count();
        $cancelled = SelfServiceRequest::where('company_id', $company->id)->where('status', SelfServiceRequestStatus::Cancelled)->count();

        $byType = [];
        foreach (SelfServiceRequestType::cases() as $type) {
            $byType[$type->value] = SelfServiceRequest::where('company_id', $company->id)
                ->where('request_type', $type)
                ->count();
        }

        $avgResolutionTime = SelfServiceRequest::where('company_id', $company->id)
            ->whereNotNull('resolved_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours')
            ->value('avg_hours');

        return [
            'total' => $total,
            'pending' => $pending,
            'under_review' => $underReview,
            'approved' => $approved,
            'rejected' => $rejected,
            'cancelled' => $cancelled,
            'by_type' => $byType,
            'avg_resolution_hours' => $avgResolutionTime ? round($avgResolutionTime, 1) : null,
        ];
    }

    /**
     * Validate request data based on type
     */
    private function validateRequestData(SelfServiceRequestType $type, array $data): void
    {
        $requiredFields = match ($type) {
            SelfServiceRequestType::PersonalInfoUpdate => ['request_data'],
            SelfServiceRequestType::BankDetailsUpdate => ['request_data'],
            SelfServiceRequestType::AddressUpdate => ['request_data'],
            SelfServiceRequestType::EmergencyContactUpdate => ['request_data'],
            SelfServiceRequestType::DocumentRequest => ['request_data'],
            SelfServiceRequestType::LeaveBalanceInquiry => [],
            SelfServiceRequestType::PayslipRequest => ['request_data'],
            SelfServiceRequestType::TaxCertificateRequest => [],
            SelfServiceRequestType::EmploymentVerification => ['request_data'],
            SelfServiceRequestType::GeneralInquiry => ['description'],
            SelfServiceRequestType::Grievance => ['description'],
            SelfServiceRequestType::Suggestion => ['description'],
            SelfServiceRequestType::TrainingRequest => ['request_data'],
            SelfServiceRequestType::EquipmentRequest => ['request_data'],
            SelfServiceRequestType::AccessRequest => ['request_data'],
            default => [],
        };

        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                throw ValidationException::withMessages([$field => "This field is required for {$type->value} requests."]);
            }
        }

        // Specific validations
        if ($type === SelfServiceRequestType::BankDetailsUpdate) {
            $requestData = $data['request_data'] ?? [];
            $requiredBankFields = ['bank_name', 'account_number', 'account_name'];
            foreach ($requiredBankFields as $field) {
                if (empty($requestData[$field])) {
                    throw ValidationException::withMessages(["request_data.{$field}" => "Bank {$field} is required."]);
                }
            }
        }

        if ($type === SelfServiceRequestType::PayslipRequest) {
            $requestData = $data['request_data'] ?? [];
            if (empty($requestData['period_start']) || empty($requestData['period_end'])) {
                throw ValidationException::withMessages(['request_data' => 'Pay period start and end dates are required.']);
            }
        }
    }

    /**
     * Execute actions upon request approval
     */
    private function executeApprovalActions(SelfServiceRequest $request, User $actor): void
    {
        $employee = $request->employee;
        $requestData = $request->request_data ?? [];

        switch ($request->request_type) {
            case SelfServiceRequestType::PersonalInfoUpdate:
                $employee->update(array_merge($requestData, ['updated_by' => $actor->id]));
                break;

            case SelfServiceRequestType::BankDetailsUpdate:
                $employee->update(array_merge($requestData, ['updated_by' => $actor->id]));
                break;

            case SelfServiceRequestType::AddressUpdate:
                $employee->update(array_merge($requestData, ['updated_by' => $actor->id]));
                break;

            case SelfServiceRequestType::EmergencyContactUpdate:
                $employee->update(array_merge($requestData, ['updated_by' => $actor->id]));
                break;

            case SelfServiceRequestType::DocumentRequest:
                // Document generation would be handled by a separate service
                break;

            case SelfServiceRequestType::TrainingRequest:
                // Create training record
                break;

            case SelfServiceRequestType::EquipmentRequest:
                // Create equipment allocation
                break;

            case SelfServiceRequestType::AccessRequest:
                // Grant system access
                break;
        }
    }

    /**
     * Get default title for request type
     */
    private function getDefaultTitle(SelfServiceRequestType $type): string
    {
        return match ($type) {
            SelfServiceRequestType::PersonalInfoUpdate => 'Personal Information Update',
            SelfServiceRequestType::BankDetailsUpdate => 'Bank Details Update',
            SelfServiceRequestType::AddressUpdate => 'Address Update',
            SelfServiceRequestType::EmergencyContactUpdate => 'Emergency Contact Update',
            SelfServiceRequestType::DocumentRequest => 'Document Request',
            SelfServiceRequestType::LeaveBalanceInquiry => 'Leave Balance Inquiry',
            SelfServiceRequestType::PayslipRequest => 'Payslip Request',
            SelfServiceRequestType::TaxCertificateRequest => 'Tax Certificate Request',
            SelfServiceRequestType::EmploymentVerification => 'Employment Verification Letter',
            SelfServiceRequestType::GeneralInquiry => 'General Inquiry',
            SelfServiceRequestType::Grievance => 'Grievance Submission',
            SelfServiceRequestType::Suggestion => 'Suggestion/Feedback',
            SelfServiceRequestType::TrainingRequest => 'Training Request',
            SelfServiceRequestType::EquipmentRequest => 'Equipment Request',
            SelfServiceRequestType::AccessRequest => 'System Access Request',
            default => 'Self-Service Request',
        };
    }

    /**
     * Generate unique request number
     */
    private function generateRequestNumber(\App\Modules\Core\Models\Company $company): string
    {
        $prefix = 'SSR';
        $lastNumber = SelfServiceRequest::where('company_id', $company->id)
            ->where('request_number', 'like', $prefix . '-%')
            ->latest('request_number')
            ->value('request_number');

        if ($lastNumber) {
            $num = (int) substr($lastNumber, strlen($prefix) + 1) + 1;
        } else {
            $num = 1;
        }

        return sprintf('%s-%05d', $prefix, $num);
    }
}