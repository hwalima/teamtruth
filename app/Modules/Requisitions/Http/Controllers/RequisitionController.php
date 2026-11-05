<?php

namespace App\Modules\Requisitions\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\ApprovalWorkflowService;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\Requisition;
use App\Modules\Requisitions\Models\RequisitionAttachment;
use App\Modules\Requisitions\Services\RequisitionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RequisitionController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->assertActiveMember($request->user(), $company);
        $canViewAll = $this->canManage($request->user(), $company);
        $requisitions = Requisition::query()
            ->with('requester:id,name')
            ->when(! $canViewAll, fn ($query) => $query->where('requested_by', $request->user()->id))
            ->latest()
            ->paginate(15)
            ->through(fn (Requisition $requisition): array => [
                'id' => $requisition->id,
                'document_number' => $requisition->document_number,
                'requisition_type' => $requisition->requisition_type,
                'type_label' => Requisition::TYPES[$requisition->requisition_type] ?? $requisition->requisition_type,
                'status' => $requisition->status->value,
                'requester' => $requisition->requester->name,
                'department' => $requisition->department,
                'currency_code' => $requisition->currency_code,
                'estimated_total' => $requisition->estimated_total,
                'created_at' => $requisition->created_at,
            ]);

        return Inertia::render('Erp/Requisitions/Index', [
            'requisitions' => $requisitions,
            'canCreate' => true,
            'canViewAll' => $canViewAll,
            'types' => Requisition::TYPES,
        ]);
    }

    public function create(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->assertActiveMember($request->user(), $company);

        return Inertia::render('Erp/Requisitions/Form', [
            'requisition' => null,
            'types' => Requisition::TYPES,
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
        ]);
    }

    public function store(Request $request, RequisitionService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->assertActiveMember($request->user(), $company);
        $validated = $this->validateRequisition($request);
        $requisition = $service->createDraft(
            $request->user(),
            $this->attributes($validated),
            $validated['lines'],
        );

        return redirect()->route('erp.requisitions.show', $requisition)
            ->with('success', __('Requisition draft created.'));
    }

    public function show(Request $request, Requisition $requisition): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeView($request->user(), $company, $requisition);
        $requisition->load(['requester:id,name,email', 'lines', 'attachments.uploader:id,name']);
        $approval = $requisition->approvalRequests()->latest()->first();

        return Inertia::render('Erp/Requisitions/Show', [
            'requisition' => [
                ...$requisition->only([
                    'id', 'document_number', 'requisition_type', 'status', 'department', 'cost_center',
                    'required_by', 'priority', 'justification', 'currency_code', 'estimated_total',
                    'submitted_at', 'created_at',
                ]),
                'type_label' => Requisition::TYPES[$requisition->requisition_type] ?? $requisition->requisition_type,
                'requester' => $requisition->requester->only(['id', 'name', 'email']),
                'lines' => $requisition->lines->map(fn ($line): array => $line->only([
                    'id', 'item', 'description', 'quantity', 'unit', 'estimated_unit_price',
                    'estimated_total', 'gl_account', 'budget_line',
                ])),
                'attachments' => $requisition->attachments->map(fn ($attachment): array => [
                    'id' => $attachment->id,
                    'original_name' => $attachment->original_name,
                    'size' => $attachment->size,
                    'uploader' => $attachment->uploader->name,
                    'download_url' => route('erp.requisitions.attachments.download', [$requisition, $attachment]),
                ]),
                'approval' => $approval ? [
                    'status' => $approval->status->value,
                    'url' => route('erp.approvals.show', $approval),
                ] : null,
            ],
            'canEdit' => $requisition->isEditableBy($request->user()),
            'canSubmit' => $requisition->isEditableBy($request->user()),
            'canCancel' => (int) $requisition->requested_by === (int) $request->user()->id
                && in_array($requisition->status, [RequisitionStatus::Draft, RequisitionStatus::Returned], true),
        ]);
    }

    public function edit(Request $request, Requisition $requisition): Response
    {
        abort_unless($requisition->isEditableBy($request->user()), 403);
        $requisition->load('lines');

        return Inertia::render('Erp/Requisitions/Form', [
            'requisition' => [
                ...$requisition->only([
                    'id', 'document_number', 'requisition_type', 'department', 'cost_center',
                    'required_by', 'priority', 'justification', 'currency_code',
                ]),
                'lines' => $requisition->lines->map(fn ($line): array => $line->only([
                    'item', 'description', 'quantity', 'unit', 'estimated_unit_price', 'gl_account', 'budget_line',
                ])),
            ],
            'types' => Requisition::TYPES,
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
        ]);
    }

    public function update(Request $request, Requisition $requisition, RequisitionService $service): RedirectResponse
    {
        $validated = $this->validateRequisition($request);
        $service->updateDraft(
            $requisition,
            $request->user(),
            $this->attributes($validated),
            $validated['lines'],
        );

        return redirect()->route('erp.requisitions.show', $requisition)
            ->with('success', __('Requisition saved.'));
    }

    public function submit(Request $request, Requisition $requisition, RequisitionService $service): RedirectResponse
    {
        $service->submit($requisition, $request->user());

        return back()->with('success', __('Requisition submitted for approval.'));
    }

    public function cancel(Request $request, Requisition $requisition): RedirectResponse
    {
        abort_unless(
            (int) $requisition->requested_by === (int) $request->user()->id
            && in_array($requisition->status, [RequisitionStatus::Draft, RequisitionStatus::Returned], true),
            403
        );

        $oldStatus = $requisition->status->value;
        $requisition->status = RequisitionStatus::Cancelled;
        $requisition->save();
        app(AuditLogService::class)->record(
            app(CompanyContext::class)->requireActiveCompany(),
            'requisition.cancelled',
            $requisition,
            ['status' => ['old' => $oldStatus, 'new' => RequisitionStatus::Cancelled->value]],
            actor: $request->user(),
        );

        return redirect()->route('erp.requisitions.index')->with('success', __('Requisition cancelled.'));
    }

    public function upload(Request $request, Requisition $requisition, RequisitionService $service): RedirectResponse
    {
        $validated = $request->validate([
            'attachments' => ['required', 'array', 'min:1', 'max:10'],
            'attachments.*' => ['required', 'file', 'max:10240', 'mimes:pdf,png,jpg,jpeg,doc,docx,xls,xlsx'],
        ]);
        $service->attachFiles($requisition, $request->user(), $validated['attachments']);

        return back()->with('success', __('Attachments added.'));
    }

    public function download(
        Request $request,
        Requisition $requisition,
        RequisitionAttachment $attachment,
    ): StreamedResponse {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeView($request->user(), $company, $requisition);
        abort_unless((int) $attachment->requisition_id === (int) $requisition->id, 404);
        abort_unless(Storage::disk('local')->exists($attachment->path), 404);

        return Storage::disk('local')->download($attachment->path, $attachment->original_name);
    }

    public function downloadPdf(Request $request, Requisition $requisition, DocumentRenderer $renderer): SymfonyResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeView($request->user(), $company, $requisition);
        $requisition->load(['requester:id,name,email', 'lines']);
        $pdf = $renderer->render(
            $requisition,
            'pdf.documents.requisition',
            ['documentType' => Requisition::TYPES[$requisition->requisition_type] ?? $requisition->requisition_type],
        );

        $filename = Str::slug(str_replace(['/', '\\'], '-', $requisition->document_number)).'.pdf';

        return response()->streamDownload(
            static function () use ($pdf): void {
                echo $pdf;
            },
            $filename,
            ['Content-Type' => 'application/pdf'],
        );
    }

    private function validateRequisition(Request $request): array
    {
        return $request->validate([
            'requisition_type' => ['required', Rule::in(array_keys(Requisition::TYPES))],
            'department' => ['nullable', 'string', 'max:120'],
            'cost_center' => ['nullable', 'string', 'max:120'],
            'required_by' => ['nullable', 'date', 'after_or_equal:today'],
            'priority' => ['required', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'justification' => ['required', 'string', 'max:10000'],
            'currency_code' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.item' => ['required', 'string', 'max:255'],
            'lines.*.description' => ['nullable', 'string', 'max:2000'],
            'lines.*.quantity' => ['required', 'numeric', 'regex:/^\d{1,6}(?:\.\d{1,4})?$/', 'gt:0', 'max:999999.9999'],
            'lines.*.unit' => ['required', 'string', 'max:40'],
            'lines.*.estimated_unit_price' => ['required', 'numeric', 'regex:/^\d{1,6}(?:\.\d{1,4})?$/', 'min:0', 'max:999999.9999'],
            'lines.*.gl_account' => ['nullable', 'string', 'max:120'],
            'lines.*.budget_line' => ['nullable', 'string', 'max:120'],
        ]);
    }

    private function attributes(array $validated): array
    {
        return collect($validated)
            ->only([
                'requisition_type', 'department', 'cost_center', 'required_by',
                'priority', 'justification', 'currency_code',
            ])
            ->all();
    }

    private function assertActiveMember(User $user, Company $company): void
    {
        abort_unless($company->activeUsers()->whereKey($user->id)->exists(), 403);
    }

    private function authorizeView(User $user, Company $company, Requisition $requisition): void
    {
        abort_unless((int) $requisition->company_id === (int) $company->id, 404);
        if ($this->canManage($user, $company) || (int) $requisition->requested_by === (int) $user->id) {
            return;
        }

        $approval = $requisition->approvalRequests()->latest()->first();
        $canAct = $approval && app(ApprovalWorkflowService::class)->canAct($approval, $user);
        $hasActed = $approval?->actions()->where('actor_id', $user->id)->exists();
        abort_unless($canAct || $hasActed, 403);
    }

    private function canManage(User $user, Company $company): bool
    {
        return $company->activeUsers()
            ->whereKey($user->id)
            ->whereIn('company_user.role', ['owner', 'admin'])
            ->exists();
    }
}
