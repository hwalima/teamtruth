<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Core\Enums\ApprovalActionType;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\ApprovalDelegation;
use App\Modules\Core\Models\ApprovalRequest;
use App\Modules\Core\Services\ApprovalWorkflowService;
use App\Modules\Core\Services\CompanyContext;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ApprovalController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $actor = $request->user();
        $service = app(ApprovalWorkflowService::class);
        $delegatedFromIds = ApprovalDelegation::query()
            ->where('to_user_id', $actor->id)
            ->where('starts_at', '<=', now())
            ->where('ends_at', '>', now())
            ->pluck('from_user_id')
            ->map(fn ($id): int => (int) $id);
        $candidateUserIds = $delegatedFromIds->push((int) $actor->id)->unique()->values();
        $candidateRoles = $company->activeUsers()
            ->whereIn('users.id', $candidateUserIds)
            ->pluck('company_user.role')
            ->unique()
            ->values();
        $pending = ApprovalRequest::query()
            ->where('status', ApprovalStatus::Pending->value)
            ->whereHas('workflow.steps', function ($steps) use ($candidateUserIds, $candidateRoles): void {
                $steps->whereColumn('approval_workflow_steps.step_order', 'approval_requests.current_step')
                    ->where(fn ($query) => $query
                        ->whereNull('approval_workflow_steps.min_amount')
                        ->orWhereColumn('approval_workflow_steps.min_amount', '<=', 'approval_requests.amount'))
                    ->where(fn ($query) => $query
                        ->whereNull('approval_workflow_steps.max_amount')
                        ->orWhereColumn('approval_workflow_steps.max_amount', '>=', 'approval_requests.amount'))
                    ->where(function ($query) use ($candidateUserIds, $candidateRoles): void {
                        $query->where(fn ($direct) => $direct
                            ->where('approver_type', 'user')
                            ->whereIn('approver_id', $candidateUserIds))
                            ->orWhere(fn ($role) => $role
                                ->where('approver_type', 'role')
                                ->whereIn('approver_id', $candidateRoles));
                    });
            })
            ->with(['workflow.steps', 'requester:id,name', 'actions.actor:id,name', 'actions.step'])
            ->orderBy('submitted_at')
            ->get()
            ->filter(fn (ApprovalRequest $approval): bool => $service->canAct($approval, $actor))
            ->values();

        return Inertia::render('Erp/Approvals/Inbox', [
            'approvals' => $this->paginate($pending, $request),
            'counts' => [
                'pending' => $pending->count(),
                'submitted' => ApprovalRequest::query()
                    ->where('requested_by', $actor->id)
                    ->where('status', ApprovalStatus::Pending->value)
                    ->count(),
            ],
        ]);
    }

    public function show(Request $request, ApprovalRequest $approvalRequest): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $approvalRequest->load([
            'workflow.steps',
            'requester:id,name,email',
            'actions.actor:id,name,email',
            'actions.step',
            'approvable',
        ]);
        $actor = $request->user();
        $canAct = app(ApprovalWorkflowService::class)->canAct($approvalRequest, $actor);
        $canView = $canAct
            || (int) $approvalRequest->requested_by === (int) $actor->id
            || $approvalRequest->actions->contains(fn ($action): bool => (int) $action->actor_id === (int) $actor->id);
        abort_unless($canView, 403);

        $approvable = $approvalRequest->approvable;
        $documentSummary = null;
        if ($approvable) {
            $documentSummary = [
                'type' => class_basename($approvable),
                'id' => $approvable->getKey(),
                'reference' => $approvable->getAttribute('document_number')
                    ?? $approvable->getAttribute('number')
                    ?? $approvable->getAttribute('title')
                    ?? $approvable->getAttribute('name'),
            ];
        }

        return Inertia::render('Erp/Approvals/Show', [
            'approval' => [
                'id' => $approvalRequest->id,
                'status' => $approvalRequest->status->value,
                'current_step' => $approvalRequest->current_step,
                'amount' => $approvalRequest->amount,
                'currency_code' => $approvalRequest->currency_code,
                'context' => $approvalRequest->context_json ?? [],
                'submitted_at' => $approvalRequest->submitted_at,
                'completed_at' => $approvalRequest->completed_at,
                'workflow' => [
                    'name' => $approvalRequest->workflow->name,
                    'steps' => $approvalRequest->workflow->steps->map(fn ($step): array => [
                        'step_order' => $step->step_order,
                        'approver_type' => $step->approver_type,
                        'approver_id' => $step->approver_id,
                        'min_amount' => $step->min_amount,
                        'max_amount' => $step->max_amount,
                        'condition_json' => $step->condition_json ?? [],
                        'require_all' => $step->require_all,
                        'sla_hours' => $step->sla_hours,
                    ]),
                ],
                'requester' => $approvalRequest->requester->only(['id', 'name', 'email']),
                'document' => $documentSummary,
                'actions' => $approvalRequest->actions->map(fn ($action): array => [
                    'id' => $action->id,
                    'action' => $action->action->value,
                    'comment' => $action->comment,
                    'acted_at' => $action->acted_at,
                    'actor' => $action->actor->only(['id', 'name']),
                    'step_order' => $action->step->step_order,
                    'signature' => $action->signature_snapshot,
                ]),
            ],
            'canAct' => $canAct,
            'members' => $company->activeUsers()
                ->whereNotIn('users.id', [$actor->id, $approvalRequest->requested_by])
                ->orderBy('name')
                ->get(['users.id', 'users.name', 'users.email']),
        ]);
    }

    public function act(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $validated = $request->validate([
            'action' => ['required', Rule::in([
                ApprovalActionType::Approve->value,
                ApprovalActionType::Reject->value,
                ApprovalActionType::Return->value,
                ApprovalActionType::Comment->value,
            ])],
            'comment' => ['nullable', 'string', 'max:5000'],
        ]);

        app(ApprovalWorkflowService::class)->act(
            $approvalRequest,
            $request->user(),
            ApprovalActionType::from($validated['action']),
            $validated['comment'] ?? null,
        );

        return back()->with('success', __('Approval action recorded.'));
    }

    public function delegate(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $validated = $request->validate([
            'to_user_id' => [
                'required',
                'integer',
                Rule::exists('company_user', 'user_id')->where('company_id', $company->id)->where('is_active', true),
            ],
            'starts_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'ends_at' => ['required', 'date_format:Y-m-d\TH:i', 'after:starts_at'],
        ]);
        $recipient = User::query()->findOrFail($validated['to_user_id']);

        app(ApprovalWorkflowService::class)->delegate(
            $approvalRequest,
            $request->user(),
            $recipient,
            Carbon::createFromFormat('!Y-m-d\TH:i', $validated['starts_at']),
            Carbon::createFromFormat('!Y-m-d\TH:i', $validated['ends_at']),
        );

        return back()->with('success', __('Approval delegated.'));
    }

    private function paginate(Collection $items, Request $request): LengthAwarePaginator
    {
        $perPage = 25;
        $page = max(1, LengthAwarePaginator::resolveCurrentPage());
        $pageItems = $items->forPage($page, $perPage)->values();

        return new LengthAwarePaginator(
            $pageItems,
            $items->count(),
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ],
        );
    }
}
