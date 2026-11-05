<?php

namespace App\Modules\Core\Http\Middleware;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\ErpRoleService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireErpModulePermission
{
    private const MODULE_PERMISSIONS = [
        'dashboard' => 'erp.project_management.view',
        'workspace' => 'erp.project_management.view',
        'invitation' => 'erp.project_management.view',
        'project' => 'erp.project_management.view',
        'task' => 'erp.project_management.view',
        'todo' => 'erp.project_management.view',
        'workload' => 'erp.project_management.view',
        'timesheet' => 'erp.project_management.view',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $route = $request->route();
        $permission = $this->permissionFor(
            (string) $route?->getName(),
            (string) $route?->uri(),
        );
        $companyId = $request->session()->get('active_erp_company_id');

        if ($permission && $companyId) {
            $company = Company::query()
                ->whereKey($companyId)
                ->where('status', 'active')
                ->whereHas('users', fn ($query) => $query
                    ->whereKey($request->user()->getKey())
                    ->where('company_user.is_active', true))
                ->first();

            if ($company) {
                app(ErpRoleService::class)->authorize($company, $request->user(), $permission);
            }
        }

        return $next($request);
    }

    private function permissionFor(string $routeName, string $routeUri): ?string
    {
        foreach (self::MODULE_PERMISSIONS as $prefix => $permission) {
            if ($routeName === $prefix || str_starts_with($routeName, $prefix)) {
                return $permission;
            }
        }

        $routeUri = preg_replace('#^api/#', '', $routeUri) ?? $routeUri;
        foreach (array_keys(self::MODULE_PERMISSIONS) as $prefix) {
            if (str_starts_with($routeUri, $prefix)) {
                return self::MODULE_PERMISSIONS[$prefix];
            }
        }

        return null;
    }
}
