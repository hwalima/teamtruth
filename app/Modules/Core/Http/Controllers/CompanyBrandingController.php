<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class CompanyBrandingController extends Controller
{
    public function edit(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $company->load('branding');

        return Inertia::render('Erp/Settings/Branding', [
            'company' => $company->only([
                'id',
                'name',
                'legal_name',
                'registration_no',
                'tax_no',
                'vat_no',
                'address',
                'phone',
                'email',
                'website',
                'default_currency',
            ]),
            'branding' => [
                'logo_url' => $company->branding?->logo_path
                    ? Storage::disk('public')->url($company->branding->logo_path)
                    : null,
                'primary_color' => $company->branding?->primary_color,
                'secondary_color' => $company->branding?->secondary_color,
                'accent_color' => $company->branding?->accent_color,
                'letterhead_footer_text' => $company->branding?->letterhead_footer_text,
            ],
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'registration_no' => ['nullable', 'string', 'max:255'],
            'tax_no' => ['nullable', 'string', 'max:255'],
            'vat_no' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:5000'],
            'phone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'website' => ['nullable', 'url', 'max:255'],
            'default_currency' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'primary_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'secondary_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'accent_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'letterhead_footer_text' => ['nullable', 'string', 'max:2000'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,gif', 'max:2048'],
        ]);

        $companyFields = array_intersect_key($validated, array_flip([
            'name',
            'legal_name',
            'registration_no',
            'tax_no',
            'vat_no',
            'address',
            'phone',
            'email',
            'website',
            'default_currency',
        ]));
        $brandingFields = array_intersect_key($validated, array_flip([
            'primary_color',
            'secondary_color',
            'accent_color',
            'letterhead_footer_text',
        ]));
        $newLogoPath = null;
        if ($request->hasFile('logo')) {
            $newLogoPath = $request->file('logo')->store("erp/companies/{$company->id}/branding", 'public');
            if (! $newLogoPath) {
                throw new \RuntimeException('The company logo could not be stored.');
            }
        }

        $company->loadMissing('branding');
        $before = [
            'company' => $company->only(array_keys($companyFields)),
            'branding' => $company->branding?->only(array_keys($brandingFields)) ?? [],
        ];

        try {
            DB::transaction(function () use ($company, $companyFields, $brandingFields, $newLogoPath, $before, $request): void {
                $company->fill($companyFields);
                $company->save();

                $branding = $company->branding()->firstOrNew();
                $branding->fill($brandingFields);
                if ($newLogoPath) {
                    $branding->logo_path = $newLogoPath;
                }
                $branding->save();

                app(AuditLogService::class)->record(
                    $company,
                    'company.settings.updated',
                    $company,
                    changes: [
                        'before' => $before,
                        'after' => [
                            'company' => $company->only(array_keys($companyFields)),
                            'branding' => $branding->only(array_keys($brandingFields)),
                            'logo_updated' => $newLogoPath !== null,
                        ],
                    ],
                    actor: $request->user(),
                );
            });
        } catch (Throwable $exception) {
            if ($newLogoPath) {
                Storage::disk('public')->delete($newLogoPath);
            }

            throw $exception;
        }

        return back()->with('success', __('Company settings updated.'));
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
