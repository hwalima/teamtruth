<?php

namespace App\Modules\Core\Services;

use App\Models\User;
use App\Modules\Core\Enums\ApprovalActionType;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\ApprovalAction;
use App\Modules\Core\Models\ApprovalDelegation;
use App\Modules\Core\Models\ApprovalRequest;
use App\Modules\Core\Models\ApprovalWorkflow;
use App\Modules\Core\Models\ApprovalWorkflowStep;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanySignatory;
use Carbon\CarbonInterface;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use LogicException;

class ApprovalWorkflowService
{
    public function submit(
        Model $approvable,
        User $requester,
        string $amount = '0',
        ?string $currencyCode = null,
        array $context = [],
    ): ApprovalRequest {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->assertBelongsToCompany($approvable, $company);

        if (! preg_match('/^\d{1,16}(?:\.\d{1,4})?$/', $amount)) {
            throw new InvalidArgumentException('Approval amounts must be non-negative decimal strings with at most 4 decimal places.');
        }

        return DB::transaction(function () use ($approvable, $requester, $amount, $currencyCode, $context, $company): ApprovalRequest {
            $workflow = ApprovalWorkflow::query()
                ->where('approvable_type', $approvable::class)
                ->where('is_active', true)
                ->orderBy('id')
                ->first();

            if (! $workflow) {
                throw new LogicException('No active approval workflow is configured for this document type.');
            }

            $hasAmountThresholds = $workflow->steps()
                ->where(fn ($query) => $query->whereNotNull('min_amount')->orWhereNotNull('max_amount'))
                ->exists();
            if ($hasAmountThresholds && (! $workflow->currency_code || strtoupper((string) $currencyCode) !== $workflow->currency_code)) {
                throw new LogicException('The approval amount must use the workflow threshold currency.');
            }

            $steps = $this->applicableSteps($workflow, $amount, $context);
            if ($steps->isEmpty()) {
                throw new LogicException('No approval steps apply to this amount and document context.');
            }

            $this->assertCompanyMember($requester, $company);
            foreach ($steps as $step) {
                if ($this->eligibleUserIds($step, $company, (int) $requester->id)->isEmpty()) {
                    throw new LogicException("Approval step {$step->id} has no eligible approver other than the requester.");
                }
            }

            if (ApprovalRequest::query()
                ->where('approvable_type', $approvable::class)
                ->where('approvable_id', $approvable->getKey())
                ->where('status', ApprovalStatus::Pending->value)
                ->exists()) {
                throw new LogicException('This document already has a pending approval request.');
            }

            $request = ApprovalRequest::create([
                'company_id' => $company->id,
                'approvable_type' => $approvable::class,
                'approvable_id' => $approvable->getKey(),
                'workflow_id' => $workflow->id,
                'status' => ApprovalStatus::Pending,
                'current_step' => (int) $steps->min('step_order'),
                'amount' => $amount,
                'currency_code' => $currencyCode ? strtoupper($currencyCode) : null,
                'context_json' => $context,
                'requested_by' => $requester->getKey(),
                'submitted_at' => now(),
            ]);

            app(AuditLogService::class)->record(
                $company,
                'approval.submitted',
                $request,
                ['status' => ['new' => ApprovalStatus::Pending->value]],
                metadata: ['workflow_id' => $workflow->id],
                actor: $requester,
            );

            return $request;
        });
    }

    public function act(
        ApprovalRequest $approvalRequest,
        User $actor,
        ApprovalActionType $action,
        ?string $comment = null,
        ?array $signatureSnapshot = null,
    ): ApprovalRequest {
        if (! in_array($action, [ApprovalActionType::Approve, ApprovalActionType::Reject, ApprovalActionType::Return, ApprovalActionType::Comment], true)) {
            throw new InvalidArgumentException('Use the delegation method to delegate an approval.');
        }

        if (in_array($action, [ApprovalActionType::Reject, ApprovalActionType::Return], true) && trim((string) $comment) === '') {
            throw ValidationException::withMessages(['comment' => 'A comment is required for rejection or return.']);
        }

        return DB::transaction(function () use ($approvalRequest, $actor, $action, $comment, $signatureSnapshot): ApprovalRequest {
            $request = ApprovalRequest::query()->lockForUpdate()->findOrFail($approvalRequest->getKey());

            if ($request->status !== ApprovalStatus::Pending) {
                throw new LogicException('Only pending approval requests can receive actions.');
            }

            $company = app(CompanyContext::class)->requireActiveCompany();
            $this->assertCompanyMember($actor, $company);
            $steps = $this->applicableSteps(
                $request->workflow,
                (string) $request->amount,
                $request->context_json ?? [],
            )->where('step_order', $request->current_step)->values();

            $step = $steps->first(fn (ApprovalWorkflowStep $candidate): bool => $this->isEligible(
                $candidate,
                $actor,
                $company,
                (int) $request->requested_by,
            ));
            if (! $step) {
                throw new AuthorizationException('You are not an approver for the current step.');
            }

            if ($request->actions()
                ->where('step_id', $step->id)
                ->where('actor_id', $actor->id)
                ->whereIn('action', [
                    ApprovalActionType::Approve->value,
                    ApprovalActionType::Reject->value,
                    ApprovalActionType::Return->value,
                ])
                ->exists()) {
                throw new LogicException('You have already acted on this approval step.');
            }

            ApprovalAction::create([
                'company_id' => $company->id,
                'request_id' => $request->id,
                'step_id' => $step->id,
                'actor_id' => $actor->id,
                'action' => $action,
                'comment' => $comment,
                'acted_at' => now(),
                'signature_snapshot' => $signatureSnapshot ?? $this->signatureSnapshot($actor, $company),
            ]);
            app(AuditLogService::class)->record(
                $company,
                'approval.actioned',
                $request,
                ['action' => ['new' => $action->value]],
                metadata: ['step_id' => $step->id, 'comment' => $comment],
                actor: $actor,
            );

            if ($action === ApprovalActionType::Reject || $action === ApprovalActionType::Return) {
                $request->status = $action === ApprovalActionType::Reject
                    ? ApprovalStatus::Rejected
                    : ApprovalStatus::Returned;
                $request->completed_at = now();
                $request->save();
                app(AuditLogService::class)->record(
                    $company,
                    'approval.status_changed',
                    $request,
                    ['status' => [
                        'old' => ApprovalStatus::Pending->value,
                        'new' => $request->status->value,
                    ]],
                    actor: $actor,
                );

                return $request->fresh();
            }

            if ($action === ApprovalActionType::Comment) {
                return $request->fresh();
            }

            $this->advanceIfComplete($request, $steps, $actor);

            return $request->fresh();
        });
    }

    public function delegate(
        ApprovalRequest $approvalRequest,
        User $from,
        User $to,
        CarbonInterface $startsAt,
        CarbonInterface $endsAt,
    ): ApprovalDelegation {
        if ($startsAt->greaterThanOrEqualTo($endsAt) || $endsAt->lessThanOrEqualTo(now())) {
            throw new InvalidArgumentException('The delegation end time must be in the future and after its start time.');
        }

        return DB::transaction(function () use ($approvalRequest, $from, $to, $startsAt, $endsAt): ApprovalDelegation {
            $request = ApprovalRequest::query()->lockForUpdate()->findOrFail($approvalRequest->getKey());
            if ($request->status !== ApprovalStatus::Pending) {
                throw new LogicException('Only pending approvals can be delegated.');
            }

            $company = app(CompanyContext::class)->requireActiveCompany();
            $this->assertCompanyMember($from, $company);
            $this->assertCompanyMember($to, $company);
            $steps = $this->applicableSteps(
                $request->workflow,
                (string) $request->amount,
                $request->context_json ?? [],
            )->where('step_order', $request->current_step);
            $step = $steps->first(fn (ApprovalWorkflowStep $candidate): bool => $this->isEligible(
                $candidate,
                $from,
                $company,
                (int) $request->requested_by,
            ));

            if (! $step || $from->is($to) || (int) $request->requested_by === (int) $to->id) {
                throw new AuthorizationException('Only a current approver can delegate to another company member.');
            }

            $delegation = ApprovalDelegation::create([
                'company_id' => $company->id,
                'from_user_id' => $from->id,
                'to_user_id' => $to->id,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'created_by' => $from->id,
            ]);
            app(AuditLogService::class)->record(
                $company,
                'approval.delegated',
                $request,
                [],
                metadata: [
                    'to_user_id' => $to->id,
                    'starts_at' => $startsAt->toISOString(),
                    'ends_at' => $endsAt->toISOString(),
                ],
                actor: $from,
            );

            ApprovalAction::create([
                'company_id' => $company->id,
                'request_id' => $request->id,
                'step_id' => $step->id,
                'actor_id' => $from->id,
                'action' => ApprovalActionType::Delegate,
                'comment' => sprintf('Delegated to user %d until %s.', $to->id, $endsAt->toISOString()),
                'acted_at' => now(),
            ]);

            return $delegation;
        });
    }

    public function canAct(ApprovalRequest $request, User $actor): bool
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        if ($request->status !== ApprovalStatus::Pending
            || (int) $request->company_id !== (int) $company->id
            || ! $company->activeUsers()->whereKey($actor->getKey())->exists()) {
            return false;
        }

        $steps = $this->applicableSteps(
            $request->workflow,
            (string) $request->amount,
            $request->context_json ?? [],
        )->where('step_order', $request->current_step);

        foreach ($steps as $step) {
            if (! $this->isEligible($step, $actor, $company, (int) $request->requested_by)) {
                continue;
            }

            if ($request->actions()
                ->where('step_id', $step->id)
                ->where('actor_id', $actor->id)
                ->whereIn('action', [
                    ApprovalActionType::Approve->value,
                    ApprovalActionType::Reject->value,
                    ApprovalActionType::Return->value,
                ])
                ->exists()) {
                continue;
            }

            return true;
        }

        return false;
    }

    private function applicableSteps(ApprovalWorkflow $workflow, string $amount, array $context): Collection
    {
        return $workflow->steps()
            ->where(fn ($query) => $query->whereNull('min_amount')->orWhere('min_amount', '<=', $amount))
            ->where(fn ($query) => $query->whereNull('max_amount')->orWhere('max_amount', '>=', $amount))
            ->get()
            ->filter(function (ApprovalWorkflowStep $step) use ($context): bool {
                foreach ($step->condition_json ?? [] as $key => $value) {
                    if (! array_key_exists($key, $context) || $context[$key] != $value) {
                        return false;
                    }
                }

                return true;
            })
            ->values();
    }

    private function advanceIfComplete(ApprovalRequest $request, Collection $currentSteps, User $actor): void
    {
        foreach ($currentSteps as $step) {
            $eligibleIds = $this->eligibleUserIds(
                $step,
                app(CompanyContext::class)->requireActiveCompany(),
                (int) $request->requested_by,
            );
            if ($eligibleIds->isEmpty()) {
                throw new LogicException("Approval step {$step->id} has no active approvers.");
            }

            $approvedActions = $request->actions()
                ->where('step_id', $step->id)
                ->where('action', ApprovalActionType::Approve->value)
                ->get(['actor_id', 'acted_at']);
            $approvedIds = $approvedActions->flatMap(function (ApprovalAction $action) use ($eligibleIds): array {
                $actorId = (int) $action->actor_id;
                if ($eligibleIds->contains($actorId)) {
                    return [$actorId];
                }

                return ApprovalDelegation::query()
                    ->where('to_user_id', $actorId)
                    ->whereIn('from_user_id', $eligibleIds)
                    ->where('starts_at', '<=', $action->acted_at)
                    ->where('ends_at', '>', $action->acted_at)
                    ->pluck('from_user_id')
                    ->map(fn ($id): int => (int) $id)
                    ->all();
            })->unique();

            $stepComplete = $step->require_all
                ? $eligibleIds->diff($approvedIds)->isEmpty()
                : $approvedIds->isNotEmpty();

            if (! $stepComplete) {
                return;
            }
        }

        $allSteps = $this->applicableSteps(
            $request->workflow,
            (string) $request->amount,
            $request->context_json ?? [],
        );
        $nextStep = $allSteps->where('step_order', '>', $request->current_step)->min('step_order');

        $previousStep = $request->current_step;
        if ($nextStep === null) {
            $request->status = ApprovalStatus::Approved;
            $request->completed_at = now();
        } else {
            $request->current_step = (int) $nextStep;
        }

        $request->save();

        app(AuditLogService::class)->record(
            app(CompanyContext::class)->requireActiveCompany(),
            $nextStep === null ? 'approval.status_changed' : 'approval.step_advanced',
            $request,
            $nextStep === null
                ? ['status' => ['old' => ApprovalStatus::Pending->value, 'new' => ApprovalStatus::Approved->value]]
                : ['current_step' => ['old' => $previousStep, 'new' => (int) $nextStep]],
            actor: $actor,
        );
    }

    private function isEligible(
        ApprovalWorkflowStep $step,
        User $user,
        Company $company,
        ?int $excludedUserId = null,
    ): bool {
        $eligibleIds = $this->eligibleUserIds($step, $company, $excludedUserId);

        if (ApprovalDelegation::query()
            ->where('company_id', $company->id)
            ->whereIn('from_user_id', $eligibleIds)
            ->where('to_user_id', $user->id)
            ->where('starts_at', '<=', now())
            ->where('ends_at', '>', now())
            ->exists()) {
            return true;
        }

        return $eligibleIds->contains((int) $user->id);
    }

    private function eligibleUserIds(
        ApprovalWorkflowStep $step,
        Company $company,
        ?int $excludedUserId = null,
    ): Collection {
        $members = $company->activeUsers()->select('users.id', 'company_user.role');

        $userIds = match ($step->approver_type) {
            'user' => $members->where('users.id', (int) $step->approver_id)->pluck('users.id')->map(fn ($id): int => (int) $id),
            'role' => $members->wherePivot('role', (string) $step->approver_id)->pluck('users.id')->map(fn ($id): int => (int) $id),
            default => throw new LogicException("Unsupported approver type '{$step->approver_type}'."),
        };

        return $excludedUserId === null
            ? $userIds
            : $userIds->reject(fn (int $id): bool => $id === $excludedUserId)->values();
    }

    private function assertBelongsToCompany(Model $approvable, Company $company): void
    {
        if ((int) $approvable->getAttribute('company_id') !== (int) $company->id) {
            throw new AuthorizationException('The document does not belong to the active company.');
        }
    }

    private function assertCompanyMember(User $user, Company $company): void
    {
        if (! $company->activeUsers()->whereKey($user->getKey())->exists()) {
            throw new AuthorizationException('The user is not an active member of this company.');
        }
    }

    private function signatureSnapshot(User $actor, Company $company): array
    {
        $signatory = CompanySignatory::query()
            ->where('company_id', $company->id)
            ->where('user_id', $actor->id)
            ->where('is_active', true)
            ->first();

        return [
            'user_id' => $actor->id,
            'name' => $signatory?->name ?? $actor->name,
            'title' => $signatory?->title,
            'signature_image_path' => $signatory?->signature_image_path,
        ];
    }
}
