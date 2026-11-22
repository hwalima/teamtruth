<?php

namespace App\Modules\Banking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Banking\Models\Bank;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Banking\Models\BankTransfer;
use App\Modules\Banking\Models\Money;
use App\Modules\Banking\Services\BankingAccess;
use App\Modules\Banking\Services\BankingService;
use App\Modules\Banking\Services\FundRequestService;
use App\Modules\Banking\Services\StatementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class BankingController extends Controller
{
    public function __construct(
        private BankingAccess $access,
        private BankingService $banking,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $companyIds = $this->access->companyIds($user);
        $manageIds = $this->access->companyIds($user, 'erp.banking.manage');

        $accounts = BankAccount::query()
            ->with(['bank:id,name', 'company:id,code,name'])
            ->withCount('transactions')
            ->withSum('transactions as credits', 'credit')
            ->withSum('transactions as debits', 'debit')
            ->withMax('transactions as last_date', 'transaction_date')
            ->whereIn('company_id', $companyIds)
            ->orderBy('account_number')
            ->get()
            ->map(fn (BankAccount $account) => [
                'id' => $account->id,
                'account_number' => $account->account_number,
                'source_account_number' => $account->source_account_number,
                'account_name' => $account->account_name,
                'currency' => $account->currency,
                'status' => $account->status,
                'notes' => $account->notes,
                'bank' => $account->bank->name,
                'company' => $account->company->only(['id', 'code', 'name']),
                'opening_balance' => Money::cents($account->opening_balance),
                'opening_date' => $account->opening_date?->toDateString(),
                'lines' => $account->transactions_count,
                'balance' => Money::cents($account->opening_balance) + Money::cents($account->credits) - Money::cents($account->debits),
                'last_date' => $account->last_date ? substr((string) $account->last_date, 0, 10) : null,
                'can_manage' => in_array((int) $account->company_id, $manageIds, true),
            ]);

        $transfers = BankTransfer::query()
            ->with(['fromAccount.company:id,name', 'toAccount.company:id,name', 'creator:id,name'])
            ->whereHas('fromAccount', fn ($q) => $q->whereIn('company_id', $companyIds))
            ->orWhereHas('toAccount', fn ($q) => $q->whereIn('company_id', $companyIds))
            ->latest('transfer_date')
            ->latest('id')
            ->limit(15)
            ->get()
            ->map(fn (BankTransfer $transfer) => [
                'id' => $transfer->id,
                'date' => $transfer->transfer_date->toDateString(),
                'amount' => Money::cents($transfer->amount),
                'description' => $transfer->description,
                'reference' => $transfer->reference,
                'from' => $transfer->fromAccount->account_number.' · '.$transfer->fromAccount->company->name,
                'to' => $transfer->toAccount->account_number.' · '.$transfer->toAccount->company->name,
                'by' => $transfer->creator?->name,
                'can_delete' => in_array((int) $transfer->fromAccount->company_id, $manageIds, true)
                    && in_array((int) $transfer->toAccount->company_id, $manageIds, true),
            ]);

        return Inertia::render('Erp/Banking/Index', [
            'accounts' => $accounts,
            'transfers' => $transfers,
            'companies' => $this->access->companies($user, 'erp.banking.manage')->map->only(['id', 'code', 'name', 'default_currency'])->values(),
            'banks' => Bank::query()->orderBy('name')->pluck('name'),
            'nextAccountNumber' => $this->banking->nextAccountNumber(),
            'canManage' => $manageIds !== [],
            'savedSignatureUrl' => $this->savedSignatureUrl($user),
        ]);
    }

    public function show(Request $request, BankAccount $account, StatementService $statements): Response
    {
        $user = $request->user();
        $this->access->authorize($user, $account);
        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $account->load(['bank:id,name', 'company:id,code,name']);
        $canManage = $this->access->can($user, $account, 'erp.banking.manage');

        return Inertia::render('Erp/Banking/Accounts/Show', [
            'account' => [
                'id' => $account->id,
                'account_number' => $account->account_number,
                'source_account_number' => $account->source_account_number,
                'account_name' => $account->account_name,
                'currency' => $account->currency,
                'status' => $account->status,
                'bank' => $account->bank->name,
                'company' => $account->company->only(['id', 'code', 'name']),
                'opening_balance' => Money::cents($account->opening_balance),
                'opening_date' => $account->opening_date?->toDateString(),
            ],
            'statement' => $statements->statement($account, $filters['from'] ?? null, $filters['to'] ?? null),
            'filters' => array_filter($filters),
            'canManage' => $canManage,
            'transferAccounts' => $canManage ? $this->transferAccounts($user, $account) : [],
            'savedSignatureUrl' => $canManage ? $this->savedSignatureUrl($user, $account) : null,
        ]);
    }

    public function storeAccount(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'company_id' => ['required', 'integer'],
            'bank_name' => ['required', 'string', 'max:255'],
            'account_name' => ['required', 'string', 'max:255'],
            'account_number' => ['nullable', 'string', 'max:32', Rule::unique('banking_accounts', 'account_number')],
            'currency' => ['required', 'string', 'size:3'],
            'opening_balance' => ['nullable', 'numeric'],
            'opening_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $account = $this->banking->createAccount($request->user(), $data);

        return redirect()->route('erp.banking.accounts.show', $account)->with('success', "Account {$account->account_number} opened.");
    }

    public function updateAccount(Request $request, BankAccount $account): RedirectResponse
    {
        $data = $request->validate([
            'account_name' => ['required', 'string', 'max:255'],
            'currency' => ['required', 'string', 'size:3'],
            'status' => ['required', Rule::in(['active', 'closed'])],
            'opening_balance' => ['nullable', 'numeric'],
            'opening_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $this->banking->updateAccount($request->user(), $account, $data);

        return back()->with('success', "Account {$account->account_number} updated.");
    }

    public function destroyAccount(Request $request, BankAccount $account): RedirectResponse
    {
        try {
            $this->banking->deleteAccount($request->user(), $account);
        } catch (ValidationException $exception) {
            return back()->with('error', collect($exception->errors())->flatten()->first());
        }

        return redirect()->route('erp.banking.index')->with('success', "Account {$account->account_number} deleted.");
    }

    public function storeTransaction(Request $request, BankAccount $account): RedirectResponse
    {
        $data = $request->validate([
            'direction' => ['required', Rule::in(['credit', 'debit'])],
            'transaction_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'type' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string', 'max:500'],
            'reference' => ['nullable', 'string', 'max:64'],
        ]);
        $this->banking->recordTransaction($request->user(), $account, $data);

        return back()->with('success', $data['direction'] === 'credit' ? 'Deposit recorded.' : 'Withdrawal recorded.');
    }

    public function destroyTransaction(Request $request, BankTransaction $transaction): RedirectResponse
    {
        try {
            $this->banking->deleteTransaction($request->user(), $transaction);
        } catch (ValidationException $exception) {
            return back()->with('error', collect($exception->errors())->flatten()->first());
        }

        return back()->with('success', 'Line deleted.');
    }

    public function storeTransfer(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'from_account_id' => ['required', 'integer', 'exists:banking_accounts,id'],
            'to_account_id' => ['required', 'integer', 'exists:banking_accounts,id', 'different:from_account_id'],
            'transfer_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'description' => ['nullable', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:64'],
        ]);
        $transfer = $this->banking->transfer($request->user(), $data);

        return back()->with('success', 'Transferred '.Money::format(Money::cents($transfer->amount)).'.');
    }

    public function destroyTransfer(Request $request, BankTransfer $transfer): RedirectResponse
    {
        $this->banking->deleteTransfer($request->user(), $transfer);

        return back()->with('success', 'Transfer deleted from both statements.');
    }

    /** @return list<array{id: int, label: string, company: string}> */
    private function savedSignatureUrl($user, ?BankAccount $account = null): ?string
    {
        $path = app(FundRequestService::class)->savedSignaturePath($user, $account?->company);

        return $path ? Storage::disk('public')->url($path) : null;
    }

    private function transferAccounts($user, ?BankAccount $except = null): array
    {
        return BankAccount::query()
            ->with('company:id,name')
            ->whereIn('company_id', $this->access->companyIds($user, 'erp.banking.manage'))
            ->where('status', 'active')
            ->when($except, fn ($q) => $q->whereKeyNot($except->id))
            ->orderBy('account_number')
            ->get()
            ->map(fn (BankAccount $a) => ['id' => $a->id, 'label' => $a->account_number.' · '.$a->account_name, 'company' => $a->company->name, 'company_id' => $a->company_id, 'currency' => $a->currency])
            ->all();
    }
}
