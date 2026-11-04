<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\CompanySignatory;
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

class CompanySignatoryController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);

        return Inertia::render('Erp/Settings/Signatories', [
            'signatories' => $company->signatories()->with('user:id,name,email')->get()
                ->map(fn (CompanySignatory $signatory): array => [
                    ...$signatory->toArray(),
                    'signature_url' => $signatory->signature_image_path
                        ? Storage::disk('public')->url($signatory->signature_image_path)
                        : null,
                    'stamp_url' => $signatory->stamp_image_path
                        ? Storage::disk('public')->url($signatory->stamp_image_path)
                        : null,
                ]),
            'members' => $company->activeUsers()->orderBy('name')->get(['users.id', 'users.name', 'users.email']),
            'documentTypes' => [
                ['value' => '', 'label' => 'All document types'],
                ['value' => 'invoice', 'label' => 'Invoice'],
                ['value' => 'purchase_order', 'label' => 'Purchase order'],
                ['value' => 'requisition', 'label' => 'Requisition'],
                ['value' => 'quotation', 'label' => 'Quotation'],
                ['value' => 'payslip', 'label' => 'Payslip'],
                ['value' => 'contract', 'label' => 'Contract'],
                ['value' => 'receipt', 'label' => 'Receipt'],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $this->validated($request, $company);
        $paths = $this->storeImages($request, $company);

        try {
            DB::transaction(function () use ($company, $request, $validated, $paths): void {
                $signatory = $company->signatories()->create([
                    ...$validated,
                    ...$paths,
                ]);
                app(AuditLogService::class)->record(
                    $company,
                    'company.signatory.created',
                    $signatory,
                    ['after' => $this->auditValues($signatory)],
                    actor: $request->user(),
                );
            });
        } catch (Throwable $exception) {
            $this->deleteImages($paths);
            throw $exception;
        }

        return back()->with('success', __('Signatory created.'));
    }

    public function update(Request $request, int $signatoryId): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $signatory = $company->signatories()->findOrFail($signatoryId);
        $validated = $this->validated($request, $company);
        $paths = $this->storeImages($request, $company);
        $before = $this->auditValues($signatory);

        try {
            DB::transaction(function () use ($company, $request, $signatory, $validated, $paths, $before): void {
                $signatory->fill($validated);
                foreach ($paths as $field => $path) {
                    if ($path !== null) {
                        $signatory->{$field} = $path;
                    }
                }
                $signatory->save();
                app(AuditLogService::class)->record(
                    $company,
                    'company.signatory.updated',
                    $signatory,
                    ['before' => $before, 'after' => $this->auditValues($signatory)],
                    actor: $request->user(),
                );
            });
        } catch (Throwable $exception) {
            $this->deleteImages($paths);
            throw $exception;
        }

        return back()->with('success', __('Signatory updated.'));
    }

    public function destroy(Request $request, int $signatoryId): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $signatory = $company->signatories()->findOrFail($signatoryId);
        $before = $this->auditValues($signatory);
        DB::transaction(function () use ($company, $request, $signatory, $before): void {
            app(AuditLogService::class)->record(
                $company,
                'company.signatory.deleted',
                $signatory,
                ['before' => $before],
                actor: $request->user(),
            );
            $signatory->delete();
        });

        return back()->with('success', __('Signatory deleted.'));
    }

    private function validated(Request $request, Company $company): array
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'integer', Rule::exists('company_user', 'user_id')->where('company_id', $company->id)->where('is_active', true)],
            'name' => ['required', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'applies_to_document_type' => ['nullable', 'string', 'max:100'],
            'approval_level' => ['nullable', 'string', 'max:100'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:100000'],
            'signature' => ['nullable', 'image', 'mimes:jpg,jpeg,png,gif', 'max:2048'],
            'stamp' => ['nullable', 'image', 'mimes:jpg,jpeg,png,gif', 'max:2048'],
        ]);
        if (empty($validated['applies_to_document_type'])) {
            $validated['applies_to_document_type'] = null;
        }

        return array_intersect_key($validated, array_flip([
            'user_id',
            'name',
            'title',
            'applies_to_document_type',
            'approval_level',
            'is_active',
            'sort_order',
        ]));
    }

    private function storeImages(Request $request, Company $company): array
    {
        $paths = [];
        foreach (['signature' => 'signature_image_path', 'stamp' => 'stamp_image_path'] as $input => $field) {
            if (! $request->hasFile($input)) {
                continue;
            }
            $path = $request->file($input)->store("erp/companies/{$company->id}/signatories", 'public');
            if (! $path) {
                $this->deleteImages($paths);
                throw new \RuntimeException("The signatory {$input} image could not be stored.");
            }
            $paths[$field] = $path;
        }

        return $paths;
    }

    private function deleteImages(array $paths): void
    {
        foreach ($paths as $path) {
            if ($path) {
                Storage::disk('public')->delete($path);
            }
        }
    }

    private function auditValues(CompanySignatory $signatory): array
    {
        return $signatory->only([
            'user_id',
            'name',
            'title',
            'signature_image_path',
            'stamp_image_path',
            'applies_to_document_type',
            'approval_level',
            'is_active',
            'sort_order',
        ]);
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
