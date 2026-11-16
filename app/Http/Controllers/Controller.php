<?php

namespace App\Http\Controllers;

use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;

abstract class Controller
{
    /**
     * Authorize the current user against a company-scoped ERP permission.
     *
     * @throws \Illuminate\Auth\Access\AuthorizationException
     */
    protected function authorizeErpPermission(string $permission): void
    {
        app(ErpRoleService::class)->authorize(
            app(CompanyContext::class)->requireActiveCompany(),
            auth()->user(),
            $permission,
        );
    }

    /**
     * Check whether the current user has a company-scoped ERP permission.
     */
    protected function allowsErpPermission(string $permission): bool
    {
        return app(ErpRoleService::class)->allows(
            app(CompanyContext::class)->requireActiveCompany(),
            auth()->user(),
            $permission,
        );
    }
}
