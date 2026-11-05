<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\CompanyService;
use App\Modules\Core\Services\DocumentRenderer;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        return Inertia::render('Erp/Companies/Index', [
            'erpContext' => [
                'activeCompany' => $activeCompany,
                'companies' => $companies,
            ],
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

        return back()->with('success', __('Active company changed.'));
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
