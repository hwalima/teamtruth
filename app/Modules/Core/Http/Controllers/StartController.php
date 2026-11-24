<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Where a person lands after signing in: the ERP home of the company they last
 * worked in, the company picker when they belong to several and have not chosen
 * one yet, or the project dashboard when they are not in any ERP company.
 */
class StartController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $user = $request->user();
        if (in_array($user->type, ['superadmin', 'super admin'], true)) {
            return redirect()->route('dashboard');
        }

        $companies = Company::query()
            ->where('status', 'active')
            ->whereHas('users', fn ($query) => $query
                ->whereKey($user->getKey())
                ->where('company_user.is_active', true))
            ->orderBy('name')
            ->get();

        if ($companies->isEmpty()) {
            return redirect()->route('dashboard');
        }

        $company = $companies->firstWhere('id', (int) $request->session()->get('active_erp_company_id'))
            ?? $companies->firstWhere('id', (int) $user->last_erp_company_id)
            ?? ($companies->count() === 1 ? $companies->first() : null);

        if (! $company) {
            return redirect()->route('erp.companies.index');
        }

        $request->session()->put('active_erp_company_id', $company->id);
        app(CompanyContext::class)->setActiveCompany($company);

        return app(ErpRoleService::class)->allows($company, $user, 'erp.dashboard.view')
            ? redirect()->route('erp.dashboard')
            : redirect()->route('dashboard');
    }
}
