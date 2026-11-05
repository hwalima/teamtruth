<?php

namespace App\Modules\Core\Http\Middleware;

use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireErpPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        app(ErpRoleService::class)->authorize($company, $request->user(), $permission);

        return $next($request);
    }
}
