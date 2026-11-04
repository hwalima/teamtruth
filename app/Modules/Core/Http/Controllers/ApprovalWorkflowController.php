<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Models\User;
use App\Modules\Core\Models\ApprovalRequest;
use App\Modules\Core\Models\ApprovalWorkflow;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ApprovalWorkflowController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);

        return Inertia::render('Erp/Approvals/Workflows', [
            'workflows' => ApprovalWorkflow::query()->with('steps')->latest()->get()
                ->map(function (ApprovalWorkflow $workflow): array {
                    return [
                        ...$workflow->toArray(),
                        'has_requests' => ApprovalRequest::query()
                            ->where('workflow_id', $workflow->id)
                            ->exists(),
                    ];
                }),
            'members' => $company->activeUsers()->orderBy('name')->get(['users.id', 'users.name', 'users.email'])
                ->map(fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->pivot->role,
                ]),
            'roles' => $company->activeUsers()->pluck('company_user.role')->unique()->values(),
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        [$workflowData, $steps] = $this->validated($request, $company);

        DB::transaction(function () use ($company, $request, $workflowData, $steps): void {
            if ($workflowData['is_active']) {
                $this->deactivateOtherWorkflows(
                    $company,
                    $workflowData['approvable_type'],
                    null,
                    $request->user(),
                );
            }

            $workflow = ApprovalWorkflow::create([
                ...$workflowData,
                'company_id' => $company->id,
            ]);
            $workflow->steps()->createMany($steps);
            app(AuditLogService::class)->record(
                $company,
                'approval.workflow.created',
                $workflow,
                ['after' => ['name' => $workflow->name, 'approvable_type' => $workflow->approvable_type, 'steps' => $steps]],
                actor: $request->user(),
            );
        });

        return back()->with('success', __('Approval workflow created.'));
    }

    public function update(Request $request, ApprovalWorkflow $workflow): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        if (ApprovalRequest::query()->where('workflow_id', $workflow->id)->exists()) {
            throw ValidationException::withMessages([
                'workflow' => __('This workflow cannot be changed after approval requests have been submitted. Create a new workflow version instead.'),
            ]);
        }
        [$workflowData, $steps] = $this->validated($request, $company);
        $before = [
            'name' => $workflow->name,
            'approvable_type' => $workflow->approvable_type,
            'currency_code' => $workflow->currency_code,
            'is_active' => $workflow->is_active,
            'steps' => $workflow->steps->map(fn ($step) => $step->only([
                'step_order',
                'approver_type',
                'approver_id',
                'min_amount',
                'max_amount',
                'condition_json',
                'require_all',
                'sla_hours',
            ]))->all(),
        ];

        DB::transaction(function () use ($company, $request, $workflow, $workflowData, $steps, $before): void {
            if ($workflowData['is_active']) {
                $this->deactivateOtherWorkflows(
                    $company,
                    $workflowData['approvable_type'],
                    (int) $workflow->id,
                    $request->user(),
                );
            }

            $workflow->fill($workflowData)->save();
            $workflow->steps()->delete();
            $workflow->steps()->createMany($steps);
            app(AuditLogService::class)->record(
                $company,
                'approval.workflow.updated',
                $workflow,
                ['before' => $before, 'after' => [...$workflowData, 'steps' => $steps]],
                actor: $request->user(),
            );
        });

        return back()->with('success', __('Approval workflow updated.'));
    }

    public function destroy(Request $request, ApprovalWorkflow $workflow): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        if (ApprovalRequest::query()->where('workflow_id', $workflow->id)->exists()) {
            throw ValidationException::withMessages([
                'workflow' => __('This workflow cannot be deleted after approval requests have been submitted.'),
            ]);
        }

        DB::transaction(function () use ($company, $request, $workflow): void {
            app(AuditLogService::class)->record(
                $company,
                'approval.workflow.deleted',
                $workflow,
                ['before' => ['name' => $workflow->name, 'approvable_type' => $workflow->approvable_type]],
                actor: $request->user(),
            );
            $workflow->delete();
        });

        return back()->with('success', __('Approval workflow deleted.'));
    }

    private function validated(Request $request, Company $company): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'approvable_type' => ['required', 'string', 'max:255'],
            'currency_code' => ['nullable', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'is_active' => ['required', 'boolean'],
            'steps' => ['required', 'array', 'min:1', 'max:20'],
            'steps.*.approver_type' => ['required', Rule::in(['user', 'role'])],
            'steps.*.approver_id' => ['required', 'string', 'max:100'],
            'steps.*.min_amount' => ['nullable', 'numeric', 'regex:/^\d{1,16}(?:\.\d{1,4})?$/', 'min:0', 'max:9999999999999999.9999'],
            'steps.*.max_amount' => ['nullable', 'numeric', 'regex:/^\d{1,16}(?:\.\d{1,4})?$/', 'min:0', 'max:9999999999999999.9999'],
            'steps.*.condition_json' => ['nullable', 'array', 'max:20'],
            'steps.*.condition_json.*' => ['nullable', 'string', 'max:255'],
            'steps.*.require_all' => ['required', 'boolean'],
            'steps.*.sla_hours' => ['nullable', 'integer', 'min:1', 'max:8760'],
        ]);

        $hasThreshold = collect($validated['steps'])->contains(
            fn (array $step): bool => ($step['min_amount'] ?? null) !== null || ($step['max_amount'] ?? null) !== null
        );
        if ($hasThreshold && empty($validated['currency_code'])) {
            throw ValidationException::withMessages([
                'currency_code' => __('Select a workflow currency when setting amount thresholds.'),
            ]);
        }

        $steps = [];
        foreach (array_values($validated['steps']) as $index => $step) {
            if (isset($step['min_amount'], $step['max_amount'])
                && $this->compareAmounts((string) $step['min_amount'], (string) $step['max_amount']) > 0) {
                throw ValidationException::withMessages([
                    'steps' => __('A step minimum amount cannot exceed its maximum amount.'),
                ]);
            }

            if ($step['approver_type'] === 'user') {
                $eligible = $company->activeUsers()->whereKey((int) $step['approver_id'])->exists();
            } else {
                $eligible = $company->activeUsers()->wherePivot('role', $step['approver_id'])->exists();
            }
            if (! $eligible) {
                throw ValidationException::withMessages([
                    'steps' => __('Each approval step must target an active company user or membership role.'),
                ]);
            }

            $steps[] = [
                'step_order' => $index + 1,
                'approver_type' => $step['approver_type'],
                'approver_id' => $step['approver_id'],
                'min_amount' => $step['min_amount'] ?? null,
                'max_amount' => $step['max_amount'] ?? null,
                'condition_json' => array_filter($step['condition_json'] ?? [], fn ($value) => $value !== null && $value !== ''),
                'require_all' => $step['require_all'],
                'sla_hours' => $step['sla_hours'] ?? null,
            ];
        }

        return [
            [
                'name' => $validated['name'],
                'approvable_type' => $validated['approvable_type'],
                'currency_code' => empty($validated['currency_code']) ? null : strtoupper($validated['currency_code']),
                'is_active' => $validated['is_active'],
            ],
            $steps,
        ];
    }

    private function compareAmounts(string $left, string $right): int
    {
        [$leftWhole, $leftFraction] = array_pad(explode('.', $left, 2), 2, '');
        [$rightWhole, $rightFraction] = array_pad(explode('.', $right, 2), 2, '');
        $leftWhole = ltrim($leftWhole, '0') ?: '0';
        $rightWhole = ltrim($rightWhole, '0') ?: '0';
        if (strlen($leftWhole) !== strlen($rightWhole)) {
            return strlen($leftWhole) <=> strlen($rightWhole);
        }
        $wholeComparison = strcmp($leftWhole, $rightWhole);
        if ($wholeComparison !== 0) {
            return $wholeComparison <=> 0;
        }

        return strcmp(str_pad($leftFraction, 4, '0'), str_pad($rightFraction, 4, '0')) <=> 0;
    }

    private function deactivateOtherWorkflows(
        Company $company,
        string $approvableType,
        ?int $exceptId,
        User $actor,
    ): void {
        $workflows = ApprovalWorkflow::query()
            ->where('approvable_type', $approvableType)
            ->where('is_active', true)
            ->when($exceptId !== null, fn ($query) => $query->whereKeyNot($exceptId))
            ->get();

        foreach ($workflows as $workflow) {
            $workflow->is_active = false;
            $workflow->save();
            app(AuditLogService::class)->record(
                $company,
                'approval.workflow.deactivated',
                $workflow,
                ['is_active' => ['old' => true, 'new' => false]],
                actor: $actor,
            );
        }
    }

    private function authorizeManagement(Request $request, Company $company): void
    {
        abort_unless(
            $company->users()
                ->whereKey($request->user()->getKey())
                ->wherePivot('is_active', true)
                ->whereIn('company_user.role', ['owner', 'admin'])
                ->exists(),
            403
        );
    }
}
