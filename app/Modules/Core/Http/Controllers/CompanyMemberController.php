<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanyErpRole;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CompanyMemberController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request->user(), $company);
        $owner = $this->owner($company);
        $eligibleUsers = User::query()
            ->where('created_by', $owner->id)
            ->where('status', 'active')
            ->where('is_enable_login', true)
            ->whereNotIn('users.id', $company->activeUsers()->select('users.id'))
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
        $members = $company->users()->orderBy('name')->get(['users.id', 'users.name', 'users.email']);
        $rolesById = $company->erpRoles()->get()->keyBy('id');

        return Inertia::render('Erp/Companies/Members', [
            'company' => $company->only(['id', 'code', 'name']),
            'members' => $members->map(function (User $user) use ($rolesById): array {
                $role = $rolesById->get($user->pivot->erp_role_id);

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->pivot->role,
                    'erp_role_id' => $user->pivot->erp_role_id,
                    'erp_role_name' => $role?->name,
                    'is_active' => (bool) $user->pivot->is_active,
                ];
            }),
            'eligibleUsers' => $eligibleUsers,
            'roles' => $rolesById->values()->map(
                fn (CompanyErpRole $role): array => $role->only(['id', 'name', 'slug']),
            ),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request->user(), $company);
        $owner = $this->owner($company);
        $validated = $request->validate([
            'user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query
                    ->where('created_by', $owner->id)
                    ->where('status', 'active')
                    ->where('is_enable_login', true)),
            ],
            'role_id' => [
                'required',
                'integer',
                Rule::exists('company_erp_roles', 'id')->where('company_id', $company->id),
            ],
        ]);
        $role = CompanyErpRole::query()->findOrFail($validated['role_id']);
        abort_if($role->slug === 'owner', 422, 'The owner role can only be assigned to the company owner.');
        $user = User::query()->findOrFail($validated['user_id']);
        $existingMembership = $company->users()->whereKey($user->id)->first();

        DB::transaction(function () use ($company, $user, $role, $existingMembership, $request): void {
            if ($existingMembership) {
                $company->users()->updateExistingPivot($user->id, [
                    'role' => $role->slug,
                    'erp_role_id' => $role->id,
                    'is_active' => true,
                ]);
            } else {
                $company->users()->attach($user->id, [
                    'role' => $role->slug,
                    'erp_role_id' => $role->id,
                    'is_active' => true,
                ]);
            }

            app(AuditLogService::class)->record(
                $company,
                $existingMembership ? 'company.member.activated' : 'company.member.added',
                $user,
                ['role' => ['new' => $role->slug], 'erp_role_id' => ['new' => $role->id], 'is_active' => ['new' => true]],
                actor: $request->user(),
            );
        });

        return back()->with('success', __('Company member saved.'));
    }

    public function deactivate(Request $request, User $user): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request->user(), $company);
        $membership = $company->users()->whereKey($user->id)->firstOrFail();
        abort_unless($membership->pivot->role !== 'owner', 403, 'The company owner cannot be deactivated.');

        DB::transaction(function () use ($company, $user, $membership, $request): void {
            $company->users()->updateExistingPivot($user->id, ['is_active' => false]);
            app(AuditLogService::class)->record(
                $company,
                'company.member.deactivated',
                $user,
                ['is_active' => ['old' => (bool) $membership->pivot->is_active, 'new' => false]],
                actor: $request->user(),
            );
        });

        return back()->with('success', __('Company member deactivated.'));
    }

    public function updateRole(Request $request, User $user): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request->user(), $company);
        $membership = $company->users()->whereKey($user->id)->firstOrFail();
        abort_unless($membership->pivot->role !== 'owner', 403, 'The company owner role cannot be changed.');
        $validated = $request->validate([
            'role_id' => [
                'required',
                'integer',
                Rule::exists('company_erp_roles', 'id')->where('company_id', $company->id),
            ],
        ]);
        $role = CompanyErpRole::query()->findOrFail($validated['role_id']);
        abort_if($role->slug === 'owner', 422, 'The owner role can only be assigned to the company owner.');

        DB::transaction(function () use ($company, $user, $membership, $role, $request): void {
            $company->users()->updateExistingPivot($user->id, [
                'role' => $role->slug,
                'erp_role_id' => $role->id,
            ]);
            app(AuditLogService::class)->record(
                $company,
                'company.member.role_updated',
                $user,
                changes: [
                    'before' => ['role' => $membership->pivot->role, 'erp_role_id' => $membership->pivot->erp_role_id],
                    'after' => ['role' => $role->slug, 'erp_role_id' => $role->id],
                ],
                actor: $request->user(),
            );
        });

        return back()->with('success', __('Company member role updated.'));
    }

    private function owner(Company $company): User
    {
        $owner = $company->users()->wherePivot('role', 'owner')->first();
        abort_unless($owner, 422, 'Assign an ERP company owner before managing members.');

        return $owner;
    }

    private function authorizeManagement(User $user, Company $company): void
    {
        app(ErpRoleService::class)->authorize($company, $user, 'erp.members.manage');
    }
}
