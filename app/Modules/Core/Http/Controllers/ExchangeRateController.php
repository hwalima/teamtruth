<?php

namespace App\Modules\Core\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\ExchangeRate;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ExchangeRateService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ExchangeRateController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);

        return Inertia::render('Erp/Settings/ExchangeRates', [
            'rates' => ExchangeRate::query()
                ->with(['fromCurrency:id,code,name', 'toCurrency:id,code,name'])
                ->orderByDesc('effective_at')
                ->paginate(25)
                ->withQueryString(),
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
            'defaultCurrency' => $company->default_currency,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);

        $validated = $request->validate([
            'from_currency' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'to_currency' => [
                'required',
                'string',
                'size:3',
                'different:from_currency',
                Rule::exists('currencies', 'code'),
            ],
            'rate' => ['required', 'regex:/^\d{1,10}(?:\.\d{1,10})?$/', 'gt:0'],
            'effective_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'source' => ['nullable', 'string', 'max:255'],
        ]);

        $fromCode = strtoupper($validated['from_currency']);
        $toCode = strtoupper($validated['to_currency']);
        $effectiveAt = Carbon::createFromFormat('!Y-m-d\TH:i', $validated['effective_at']);
        $fromCurrency = Currency::query()->where('code', $fromCode)->firstOrFail();
        $toCurrency = Currency::query()->where('code', $toCode)->firstOrFail();

        DB::transaction(function () use ($company, $request, $validated, $fromCode, $toCode, $effectiveAt, $fromCurrency, $toCurrency): void {
            $existingRate = ExchangeRate::query()
                ->where('from_currency_id', $fromCurrency->id)
                ->where('to_currency_id', $toCurrency->id)
                ->where('effective_at', $effectiveAt)
                ->first();

            $rate = app(ExchangeRateService::class)->record(
                $fromCode,
                $toCode,
                $validated['rate'],
                $effectiveAt,
                $request->user()->getKey(),
                $validated['source'] ?? null,
            );

            app(AuditLogService::class)->record(
                $company,
                $existingRate ? 'exchange_rate.updated' : 'exchange_rate.created',
                $rate,
                changes: [
                    'before' => $existingRate?->only(['rate', 'effective_at', 'source']),
                    'after' => $rate->only(['rate', 'effective_at', 'source']),
                ],
                actor: $request->user(),
            );
        });

        return back()->with('success', __('Exchange rate saved.'));
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
