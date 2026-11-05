<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\CompanyErpRole;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CompanyErpRoleController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.roles.manage');

        return Inertia::render('Erp/Settings/Roles', [
            'company' => $company->only(['id', 'code', 'name']),
            'roles' => $company->erpRoles()->withCount('members')->get(),
            'permissionGroups' => ErpRoleService::permissionCatalog(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.roles.manage');
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('company_erp_roles', 'name')->where('company_id', $company->id)],
            'permissions' => ['present', 'array'],
            'permissions.*' => ['required', 'string', Rule::in(ErpRoleService::assignablePermissionKeys(false))],
        ]);
        $slug = Str::slug($validated['name']);
        validator(['slug' => $slug], [
            'slug' => ['required', 'max:96', Rule::unique('company_erp_roles', 'slug')->where('company_id', $company->id)],
        ])->validate();

        $role = CompanyErpRole::query()->create([
            'company_id' => $company->id,
            'name' => $validated['name'],
            'slug' => $slug,
            'permissions' => array_values(array_unique($validated['permissions'])),
            'is_system' => false,
        ]);
        app(AuditLogService::class)->record(
            $company,
            'company.erp_role.created',
            $role,
            changes: ['after' => ['name' => $role->name, 'slug' => $role->slug, 'permissions' => $role->permissions]],
            actor: $request->user(),
        );

        return back()->with('success', __('ERP role created.'));
    }

    public function update(Request $request, CompanyErpRole $role): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), 'erp.roles.manage');
        abort_unless((int) $role->company_id === (int) $company->id, 404);
        abort_if($role->slug === 'owner', 403, 'The owner role cannot be modified.');

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:80',
                Rule::unique('company_erp_roles', 'name')->where('company_id', $company->id)->ignore($role->id),
            ],
            'permissions' => ['present', 'array'],
            'permissions.*' => [
                'required',
                'string',
                Rule::in(ErpRoleService::assignablePermissionKeys($role->slug === 'admin')),
            ],
        ]);
        $before = ['name' => $role->name, 'permissions' => $role->permissions];
        $role->update([
            'name' => $validated['name'],
            'permissions' => array_values(array_unique($validated['permissions'])),
        ]);
        app(AuditLogService::class)->record(
            $company,
            'company.erp_role.updated',
            $role,
            changes: ['before' => $before, 'after' => ['name' => $role->name, 'permissions' => $role->permissions]],
            actor: $request->user(),
        );

        return back()->with('success', __('ERP role updated.'));
    }
}
