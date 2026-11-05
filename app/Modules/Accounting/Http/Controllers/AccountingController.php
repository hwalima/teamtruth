<?php

namespace App\Modules\Accounting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Services\AccountingPostingService;
use App\Modules\Accounting\Services\FiscalCalendarService;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AccountingController extends Controller
{
    public function index(Request $request): Response
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeAccess($request, $company);

        return Inertia::render('Erp/Accounting/Index', [
            'company' => $company->only(['id', 'code', 'name', 'default_currency']),
            'currencies' => Currency::query()->orderBy('code')->get(['code', 'name']),
            'accounts' => AccountingAccount::query()
                ->with('parent:id,code,name')
                ->orderBy('code')
                ->get(),
            'journals' => AccountingJournal::query()->orderBy('code')->get(),
            'fiscalYears' => FiscalYear::query()->with('periods')->orderByDesc('starts_on')->limit(20)->get(),
            'entries' => JournalEntry::query()
                ->with(['journal:id,code,name', 'creator:id,name', 'lines.account:id,code,name', 'reversal:id,reversal_of_id,document_number'])
                ->latest('entry_date')
                ->latest('id')
                ->limit(100)
                ->get(),
        ]);
    }

    public function storeAccount(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z0-9._-]+$/', Rule::unique('accounting_accounts', 'code')->where('company_id', $company->id)],
            'name' => ['required', 'string', 'max:160'],
            'account_type' => ['required', Rule::in(['asset', 'liability', 'equity', 'income', 'expense'])],
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists('accounting_accounts', 'id')
                    ->where('company_id', $company->id)
                    ->where('account_type', $request->input('account_type'))
                    ->where('is_group', true)
                    ->where('is_active', true),
            ],
            'is_group' => ['required', 'boolean'],
            'allow_reconciliation' => ['required', 'boolean'],
        ]);
        if ($validated['is_group'] && $validated['allow_reconciliation']) {
            return back()->withErrors(['allow_reconciliation' => __('Group accounts cannot be reconciled.')]);
        }

        $account = AccountingAccount::query()->create([...$validated, 'company_id' => $company->id, 'is_active' => true]);
        app(AuditLogService::class)->record(
            $company,
            'accounting.account.created',
            $account,
            changes: ['after' => $account->only(['code', 'name', 'account_type', 'parent_id', 'is_group', 'allow_reconciliation'])],
            actor: $request->user(),
        );

        return back()->with('success', __('Account created.'));
    }

    public function storeJournal(Request $request): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:24', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('accounting_journals', 'code')->where('company_id', $company->id)],
            'name' => ['required', 'string', 'max:120'],
            'journal_type' => ['required', Rule::in(['sales', 'purchase', 'bank', 'cash', 'general', 'stock', 'payroll'])],
        ]);

        $journal = AccountingJournal::query()->create([...$validated, 'company_id' => $company->id, 'is_active' => true]);
        app(AuditLogService::class)->record(
            $company,
            'accounting.journal.created',
            $journal,
            changes: ['after' => $journal->only(['code', 'name', 'journal_type'])],
            actor: $request->user(),
        );

        return back()->with('success', __('Journal created.'));
    }

    public function storeFiscalYear(Request $request, FiscalCalendarService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('accounting_fiscal_years', 'name')->where('company_id', $company->id)],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
        ]);

        $service->createFiscalYear($request->user(), $validated['name'], $validated['starts_on'], $validated['ends_on']);

        return back()->with('success', __('Fiscal year and monthly periods created.'));
    }

    public function lockPeriod(Request $request, FiscalPeriod $period, FiscalCalendarService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $service->lockPeriod($period, $request->user());

        return back()->with('success', __('Accounting period locked.'));
    }

    public function postJournalEntry(Request $request, AccountingPostingService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'journal_id' => ['required', 'integer', Rule::exists('accounting_journals', 'id')->where('company_id', $company->id)],
            'entry_date' => ['required', 'date'],
            'currency_code' => ['required', 'string', 'size:3', Rule::exists('currencies', 'code')],
            'description' => ['required', 'string', 'max:500'],
            'reference' => ['nullable', 'string', 'max:120'],
            'lines' => ['required', 'array', 'min:2', 'max:100'],
            'lines.*.account_id' => [
                'required',
                'integer',
                Rule::exists('accounting_accounts', 'id')->where('company_id', $company->id)->where('is_group', false)->where('is_active', true),
            ],
            'lines.*.description' => ['nullable', 'string', 'max:255'],
            'lines.*.debit' => ['required', 'numeric', 'min:0', 'regex:/^\d{1,16}(?:\.\d{1,4})?$/'],
            'lines.*.credit' => ['required', 'numeric', 'min:0', 'regex:/^\d{1,16}(?:\.\d{1,4})?$/'],
        ]);

        $entry = $service->postManualEntry($request->user(), $validated, $validated['lines']);

        return back()->with('success', __('Journal entry :number posted.', ['number' => $entry->document_number]));
    }

    public function reverseJournalEntry(Request $request, JournalEntry $entry, AccountingPostingService $service): RedirectResponse
    {
        $company = app(CompanyContext::class)->requireActiveCompany();
        $this->authorizeManagement($request, $company);
        $validated = $request->validate([
            'reversal_date' => ['required', 'date'],
        ]);
        $reversal = $service->reverseEntry($entry, $request->user(), $validated['reversal_date']);

        return back()->with('success', __('Journal entry reversed by :number.', ['number' => $reversal->document_number]));
    }

    private function authorizeAccess(Request $request, Company $company): void
    {
        abort_unless(
            $company->users()
                ->whereKey($request->user()->getKey())
                ->wherePivot('is_active', true)
                ->whereIn('company_user.role', ['owner', 'admin', 'finance'])
                ->exists(),
            403
        );
    }

    private function authorizeManagement(Request $request, Company $company): void
    {
        $this->authorizeAccess($request, $company);
    }
}
