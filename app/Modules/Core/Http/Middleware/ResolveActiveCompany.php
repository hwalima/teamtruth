<?php

namespace App\Modules\Core\Http\Middleware;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveActiveCompany
{
    public function __construct(private CompanyContext $companyContext) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        abort_unless($user, 401);

        $companies = Company::query()
            ->where('status', 'active')
            ->whereHas('users', fn ($query) => $query
                ->whereKey($user->getKey())
                ->where('company_user.is_active', true))
            ->orderBy('name')
            ->get();

        $selectedId = $request->session()->get('active_erp_company_id');

        if ($selectedId === null && $companies->count() === 1) {
            $company = $companies->first();
            $request->session()->put('active_erp_company_id', $company->id);
        } else {
            $company = $companies->firstWhere('id', (int) $selectedId);
        }

        if (! $company) {
            $request->session()->forget('active_erp_company_id');
            abort(403, 'Select an active company you belong to before accessing ERP records.');
        }

        $this->companyContext->setActiveCompany($company);

        return $next($request);
    }
}
