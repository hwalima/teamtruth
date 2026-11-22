<?php

namespace App\Modules\Hrm\Http\Controllers;

use App\Modules\Hrm\Enums\DisciplinaryStatus;
use App\Modules\Hrm\Enums\SelfServiceRequestStatus;
use App\Modules\Hrm\Enums\SelfServiceRequestType;
use App\Modules\Hrm\Models\Contract;
use App\Modules\Hrm\Models\DisciplinaryCase;
use App\Modules\Hrm\Models\Employee;
use App\Modules\Hrm\Models\SelfServiceRequest;
use App\Modules\Hrm\Services\SelfServiceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SelfServiceController extends HrmController
{
    public function __construct(private SelfServiceService $requests) {}

    public function index(Request $request): Response
    {
        $canManage = $this->allowsErpPermission('erp.hrm.self_service.manage');
        $ownEmployee = $this->ownEmployee($request);
        $filters = $request->only(['search', 'status', 'request_type', 'mine']);
        $onlyMine = ! $canManage || ($filters['mine'] ?? false);

        $requests = SelfServiceRequest::query()
            ->with(['employee:id,employee_number,first_name,middle_name,last_name', 'processedBy:id,name'])
            ->when($onlyMine, fn ($q) => $q->where('employee_id', $ownEmployee?->id ?? 0))
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->whereHas('employee', fn ($e) => $e
                ->where('first_name', 'like', "%{$search}%")
                ->orWhere('last_name', 'like', "%{$search}%")
                ->orWhere('employee_number', 'like', "%{$search}%")))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['request_type'] ?? null, fn ($q, $type) => $q->where('request_type', $type))
            ->orderByRaw('case when status in (?, ?) then 0 else 1 end', [SelfServiceRequestStatus::Pending->value, SelfServiceRequestStatus::InProgress->value])
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Erp/Hrm/SelfService/Index', [
            'company' => $this->company(),
            'requests' => $requests,
            'filters' => $filters,
            'statusOptions' => SelfServiceRequestStatus::options(),
            'typeOptions' => SelfServiceRequestType::options(),
            'canManage' => $canManage,
            'hasEmployeeRecord' => $ownEmployee !== null,
            'myRecords' => $ownEmployee ? $this->myRecords($ownEmployee) : null,
        ]);
    }

    public function create(Request $request): Response
    {
        $employee = $this->ownEmployee($request);

        return Inertia::render('Erp/Hrm/SelfService/Create', [
            'company' => $this->company(),
            'employee' => $employee?->only(['id', 'employee_number', 'first_name', 'middle_name', 'last_name', ...array_keys(SelfServiceService::PROFILE_FIELDS)]),
            'typeOptions' => SelfServiceRequestType::options(),
            'profileFields' => SelfServiceService::PROFILE_FIELDS,
            'requestType' => $request->input('type'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $employee = $this->ownEmployee($request) ?? throw ValidationException::withMessages([
            'request_type' => 'Your user account is not linked to an employee record. Ask HR to link it first.',
        ]);

        $data = $this->validated($request, true);
        $created = $this->requests->createRequest($request->user(), $employee, $data, $request->file('attachments', []));

        return redirect()->route('erp.hrm.self-service.show', $created)->with('success', 'Request sent to HR.');
    }

    public function show(SelfServiceRequest $selfServiceRequest): Response
    {
        $this->authorize('view', $selfServiceRequest);
        $selfServiceRequest->load(['employee:id,employee_number,first_name,middle_name,last_name,user_id', 'processedBy:id,name', 'creator:id,name']);

        return Inertia::render('Erp/Hrm/SelfService/Show', [
            'company' => $this->company(),
            'selfServiceRequest' => $selfServiceRequest,
            'changes' => $this->requests->describeChanges($selfServiceRequest),
            'statusOptions' => SelfServiceRequestStatus::options(),
            'typeOptions' => SelfServiceRequestType::options(),
            'profileFields' => SelfServiceService::PROFILE_FIELDS,
            'canEdit' => $this->allows('update', $selfServiceRequest),
            'canAttach' => $this->allows('attach', $selfServiceRequest),
            'canProcess' => $this->allows('process', $selfServiceRequest),
        ]);
    }

    public function update(Request $request, SelfServiceRequest $selfServiceRequest): RedirectResponse
    {
        $this->authorize('update', $selfServiceRequest);
        $this->requests->updateRequest($request->user(), $selfServiceRequest, $this->validated($request, false));

        return back()->with('success', 'Request updated.');
    }

    public function assign(Request $request, SelfServiceRequest $selfServiceRequest): RedirectResponse
    {
        $this->authorize('process', $selfServiceRequest);
        $this->requests->startProcessing($request->user(), $selfServiceRequest);

        return back()->with('success', 'You are now handling this request.');
    }

    public function review(Request $request, SelfServiceRequest $selfServiceRequest): RedirectResponse
    {
        $this->authorize('process', $selfServiceRequest);
        $data = $request->validate(['decision' => 'required|in:complete,reject', 'notes' => 'nullable|string|max:5000']);
        $done = $this->requests->review($request->user(), $selfServiceRequest, $data['decision'] === 'complete', $data['notes'] ?? null);

        return back()->with('success', $done->status === SelfServiceRequestStatus::Completed ? 'Request completed.' : 'Request rejected.');
    }

    public function cancel(Request $request, SelfServiceRequest $selfServiceRequest): RedirectResponse
    {
        $this->authorize('update', $selfServiceRequest);
        $this->requests->withdraw($selfServiceRequest);

        return redirect()->route('erp.hrm.self-service.index')->with('success', 'Request withdrawn.');
    }

    public function storeDocument(Request $request, SelfServiceRequest $selfServiceRequest): RedirectResponse
    {
        $this->authorize('attach', $selfServiceRequest);
        $request->validate(['file' => 'required|file|max:10240']);
        $this->requests->attach($request->user(), $selfServiceRequest, $request->file('file'));

        return back()->with('success', 'File attached.');
    }

    public function downloadDocument(SelfServiceRequest $selfServiceRequest, int $index): StreamedResponse
    {
        $this->authorize('view', $selfServiceRequest);
        $attachment = $selfServiceRequest->request_data['attachments'][$index] ?? abort(404);

        return Storage::disk('local')->download($attachment['path'], $attachment['name']);
    }

    private function validated(Request $request, bool $creating): array
    {
        $type = $creating ? $request->input('request_type') : $request->route('selfServiceRequest')->request_type->value;

        $rules = [
            'subject' => 'nullable|string|max:255',
            'details' => [Rule::requiredIf(in_array($type, ['other', 'leave_balance_enquiry'], true)), 'nullable', 'string', 'max:5000'],
            'period' => [Rule::requiredIf($type === 'payslip_request'), 'nullable', 'string', 'max:100'],
            'purpose' => [Rule::requiredIf($type === 'certificate_request'), 'nullable', 'string', 'max:255'],
            'changes' => [Rule::requiredIf($type === 'profile_update'), 'nullable', 'array'],
            'changes.personal_email' => 'nullable|email|max:255',
            'changes.marital_status' => ['nullable', Rule::in(EmployeeController::MARITAL_STATUSES)],
            'changes.*' => 'nullable|string|max:255',
        ];
        if ($creating) {
            $rules['request_type'] = ['required', Rule::enum(SelfServiceRequestType::class)];
            $rules['attachments'] = [Rule::requiredIf($type === 'document_upload'), 'nullable', 'array', 'max:5'];
            $rules['attachments.*'] = 'file|max:10240';
        }

        return $request->validate($rules, ['attachments.required' => 'Attach the document you want to give HR.']);
    }

    private function ownEmployee(Request $request): ?Employee
    {
        return Employee::query()->where('user_id', $request->user()->id)->first();
    }

    /** Links to the employee's own HR records, shown on the self-service page. */
    private function myRecords(Employee $employee): array
    {
        return [
            'employee' => $employee->only(['id', 'employee_number', 'first_name', 'middle_name', 'last_name']),
            'contractsToSign' => Contract::query()->where('employee_id', $employee->id)->where('status', 'draft')
                ->whereNull('signed_by_employee_at')->get(['id', 'contract_type', 'start_date']),
            'openCases' => DisciplinaryCase::query()->where('employee_id', $employee->id)
                ->where('status', '!=', DisciplinaryStatus::Closed)->count(),
        ];
    }
}
