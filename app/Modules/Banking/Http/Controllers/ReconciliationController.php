<?php

namespace App\Modules\Banking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Banking\Services\BankingAccess;
use App\Modules\Banking\Services\ReconciliationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Matching statement lines to the receipts and payments already recorded. */
class ReconciliationController extends Controller
{
    public function __construct(
        private BankingAccess $access,
        private ReconciliationService $reconciliation,
    ) {}

    /** The menu entry: opens the account with the most lines still to reconcile. */
    public function start(Request $request): RedirectResponse
    {
        $account = BankAccount::query()
            ->whereIn('company_id', $this->access->companyIds($request->user()))
            ->withCount(['transactions as open_lines' => fn ($q) => $q->whereNull('reconciled_at')->whereNull('transfer_id')])
            ->orderByDesc('open_lines')
            ->orderBy('account_number')
            ->first();

        return $account
            ? redirect()->route('erp.banking.reconcile.show', $account)
            : redirect()->route('erp.banking.index')->with('error', 'Open a bank account and import a statement before reconciling.');
    }

    public function show(Request $request, BankAccount $account): Response
    {
        $user = $request->user();
        $this->access->authorize($user, $account);
        $filters = $request->validate([
            'status' => ['nullable', 'in:open,reconciled,all'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'find' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $status = $filters['status'] ?? 'open';
        $account->load(['bank:id,name', 'company:id,code,name']);

        $page = BankTransaction::query()
            ->with('reconciler:id,name')
            ->where('account_id', $account->id)
            ->when($status === 'open', fn ($q) => $q->whereNull('reconciled_at')->whereNull('transfer_id'))
            ->when($status === 'reconciled', fn ($q) => $q->where(fn ($q) => $q->whereNotNull('reconciled_at')->orWhereNotNull('transfer_id')))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate('transaction_date', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate('transaction_date', '<=', $to))
            ->orderByDesc('transaction_date')
            ->orderByDesc('sequence')
            ->paginate(50)
            ->withQueryString();

        $lines = collect($page->items());
        $suggestions = $this->reconciliation->suggestions($account, $lines);
        $matched = $this->reconciliation->matchedPayments($account, $lines->pluck('id')->all());

        return Inertia::render('Erp/Banking/Reconcile', [
            'account' => [
                'id' => $account->id,
                'account_number' => $account->account_number,
                'account_name' => $account->account_name,
                'currency' => $account->currency,
                'bank' => $account->bank->name,
                'company' => $account->company->only(['id', 'code', 'name']),
            ],
            'accounts' => BankAccount::query()
                ->with('company:id,name')
                ->whereIn('company_id', $this->access->companyIds($user))
                ->orderBy('account_number')
                ->get()
                ->map(fn (BankAccount $other) => [
                    'id' => $other->id,
                    'label' => $other->account_number.' · '.$other->account_name.' · '.$other->company->name,
                ]),
            'filters' => ['status' => $status, 'from' => $filters['from'] ?? '', 'to' => $filters['to'] ?? ''],
            'summary' => $this->reconciliation->summary($account),
            'lines' => [
                'data' => $lines->map(fn (BankTransaction $line) => [
                    'id' => $line->id,
                    'date' => $line->transaction_date->toDateString(),
                    'type' => $line->type,
                    'description' => $line->description,
                    'reference' => $line->reference,
                    'direction' => ReconciliationService::direction($line),
                    'amount' => ReconciliationService::amountCents($line),
                    'state' => $line->transfer_id !== null ? 'transfer' : ($line->reconcile_kind ?? 'open'),
                    'note' => $line->reconcile_note,
                    'reconciled_by' => $line->reconciler?->name,
                    'reconciled_at' => $line->reconciled_at?->toDateString(),
                    'matched' => $matched[$line->id] ?? [],
                    'suggestions' => $suggestions[$line->id] ?? [],
                ])->values(),
                'links' => $page->linkCollection(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
            // Asked for by the "Find payment" dialog with a partial reload.
            'search' => Inertia::optional(fn () => $this->search($account, $filters)),
            'canManage' => $this->access->can($user, $account, 'erp.banking.manage'),
        ]);
    }

    public function match(Request $request, BankTransaction $transaction): RedirectResponse
    {
        $this->authorizeLine($request, $transaction);
        $data = $request->validate(['payments' => ['required', 'array', 'min:1', 'max:50'], 'payments.*' => ['string', 'max:64']]);
        $this->reconciliation->match($request->user(), $transaction, $data['payments']);

        return back()->with('success', 'Statement line matched.');
    }

    public function explain(Request $request, BankTransaction $transaction): RedirectResponse
    {
        $this->authorizeLine($request, $transaction);
        $data = $request->validate(['note' => ['required', 'string', 'max:255']]);
        $this->reconciliation->explain($request->user(), $transaction, $data['note']);

        return back()->with('success', 'Statement line marked as explained.');
    }

    public function undo(Request $request, BankTransaction $transaction): RedirectResponse
    {
        $this->authorizeLine($request, $transaction);
        $this->reconciliation->undo($request->user(), $transaction);

        return back()->with('success', 'Reconciliation undone.');
    }

    public function autoMatch(Request $request, BankAccount $account): RedirectResponse
    {
        $this->access->authorize($request->user(), $account, 'erp.banking.manage');
        $count = $this->reconciliation->autoMatch($request->user(), $account);

        return back()->with('success', $count === 0
            ? 'No certain matches found. Lines with more than one possible payment are left for you to choose.'
            : $count.' '.($count === 1 ? 'line' : 'lines').' matched automatically.');
    }

    /** @return array<string, mixed>|null */
    private function search(BankAccount $account, array $filters): ?array
    {
        $line = isset($filters['find'])
            ? BankTransaction::query()->where('account_id', $account->id)->find($filters['find'])
            : null;
        if (! $line) {
            return null;
        }
        $direction = ReconciliationService::direction($line);
        $q = $filters['q'] ?? null;
        // Without a search term, show what was recorded within a month either side of the bank date.
        $date = CarbonImmutable::parse($line->transaction_date);

        return [
            'line_id' => $line->id,
            'q' => $q ?? '',
            'results' => $this->reconciliation->candidates(
                $account,
                $direction,
                filled($q) ? null : $date->subDays(31)->toDateString(),
                filled($q) ? null : $date->addDays(31)->toDateString(),
                search: $q,
                limit: 50,
            )->values(),
        ];
    }

    private function authorizeLine(Request $request, BankTransaction $transaction): void
    {
        $transaction->loadMissing('account.company');
        $this->access->authorize($request->user(), $transaction->account, 'erp.banking.manage');
    }
}
