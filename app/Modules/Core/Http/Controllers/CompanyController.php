<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\CompanyService;
use App\Modules\Core\Services\DocumentRenderer;
use App\Modules\Core\Services\ErpRoleService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    public function __construct(
        private CompanyService $companyService,
        private CompanyContext $companyContext,
    ) {}

    public function index(Request $request): Response
    {
        $companies = $this->companiesFor($request);
        $activeId = (int) $request->session()->get('active_erp_company_id');
        $activeCompany = $companies->firstWhere('id', $activeId);

        if (! $activeCompany && $activeId !== 0) {
            $request->session()->forget('active_erp_company_id');
        }

        if (! $activeCompany && $companies->count() === 1) {
            $activeCompany = $companies->first();
            $request->session()->put('active_erp_company_id', $activeCompany->id);
        }

        $this->companyContext->setActiveCompany($activeCompany);
        $roleService = app(ErpRoleService::class);

        return Inertia::render('Erp/Companies/Index', [
            'erpContext' => [
                'activeCompany' => $activeCompany,
                'companies' => $companies,
                'permissions' => $activeCompany
                    ? $roleService->permissionsFor($activeCompany, $request->user())
                    : [],
            ],
            'roles' => $this->roleNamesFor($request, $companies),
            'canCreate' => $request->user()->can('erp.company.create'),
            'canManageMembers' => $activeCompany !== null && $roleService->allows($activeCompany, $request->user(), 'erp.members.manage'),
            'canManageRoles' => $activeCompany !== null && $roleService->allows($activeCompany, $request->user(), 'erp.roles.manage'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->merge([
            'code' => strtoupper(trim((string) $request->input('code', ''))),
        ]);

        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:32',
                'regex:/^[A-Za-z0-9][A-Za-z0-9_-]*$/',
                Rule::unique('companies', 'code'),
            ],
            'name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
        ]);

        $company = $this->companyService->createForUser($request->user(), $validated);
        $request->session()->put('active_erp_company_id', $company->id);

        return redirect()->route('erp.companies.index')
            ->with('success', __('Company created successfully.'));
    }

    public function switch(Request $request, Company $company): RedirectResponse
    {
        abort_unless(
            $company->status === 'active'
            && $company->users()
                ->whereKey($request->user()->getKey())
                ->wherePivot('is_active', true)
                ->exists(),
            403
        );

        $this->companyContext->setActiveCompany($company);
        app(AuditLogService::class)->record(
            $company,
            'company.switched',
            $company,
            metadata: ['user_id' => $request->user()->id],
            actor: $request->user(),
        );
        $request->session()->put('active_erp_company_id', $company->id);
        $request->user()->forceFill(['last_erp_company_id' => $company->id])->saveQuietly();

        // Straight into the company's home, as signing in would.
        return app(ErpRoleService::class)->allows($company, $request->user(), 'erp.dashboard.view')
            ? redirect()->route('erp.dashboard')->with('success', __('Now working in :company.', ['company' => $company->name]))
            : redirect()->route('erp.companies.index')->with('success', __('Active company changed.'));
    }

    public function sampleDocument(): \Symfony\Component\HttpFoundation\Response
    {
        $company = $this->companyContext->requireActiveCompany();
        $contents = app(DocumentRenderer::class)
            ->renderForCompany($company, 'pdf.documents.sample');

        return response($contents)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="company-brand-preview.pdf"');
    }

    /**
     * The name of the person's role in each of their companies, by company id.
     *
     * @return array<int, string>
     */
    private function roleNamesFor(Request $request, Collection $companies): array
    {
        $memberships = DB::table('company_user')
            ->leftJoin('company_erp_roles', 'company_erp_roles.id', '=', 'company_user.erp_role_id')
            ->where('company_user.user_id', $request->user()->getKey())
            ->whereIn('company_user.company_id', $companies->pluck('id'))
            ->get(['company_user.company_id', 'company_user.role', 'company_erp_roles.name']);

        return $memberships->mapWithKeys(fn ($membership): array => [
            (int) $membership->company_id => $membership->name ?? ucwords(str_replace(['-', '_'], ' ', (string) $membership->role)),
        ])->all();
    }

    private function companiesFor(Request $request): Collection
    {
        return Company::query()
            ->where('status', 'active')
            ->whereHas('users', fn ($query) => $query
                ->whereKey($request->user()->getKey())
                ->where('company_user.is_active', true))
            ->orderBy('name')
            ->get(['companies.id', 'companies.code', 'companies.name']);
    }
}
