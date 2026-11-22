<?php

namespace App\Modules\Banking\Services;

use App\Models\User;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankReconciliationMatch;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Banking\Models\Money;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Matches statement lines to the payments already recorded in the books.
 *
 * Money in (a credit on the statement) matches customer receipts; money out (a
 * debit) matches posted vendor payments. A payment must be in the account's
 * company and currency, and it can sit on one statement line only. A line can
 * carry several payments when they add up to the line exactly.
 *
 * Banking spans the group, so payments are read straight from their tables by
 * company_id rather than through the active-company scope.
 */
class ReconciliationService
{
    /** How far apart a payment date and a bank date may be for a suggestion. */
    public const SUGGEST_DAYS = 7;

    public function __construct(
        private AuditLogService $audit,
        private CompanyContext $context,
    ) {}

    public static function direction(BankTransaction $line): string
    {
        return Money::cents($line->credit) > 0 ? 'in' : 'out';
    }

    public static function amountCents(BankTransaction $line): int
    {
        $credit = Money::cents($line->credit);

        return $credit > 0 ? $credit : Money::cents($line->debit);
    }

    /**
     * Recorded payments not yet on any statement line.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function candidates(
        BankAccount $account,
        string $direction,
        ?string $from = null,
        ?string $to = null,
        ?int $amountCents = null,
        ?string $search = null,
        int $limit = 500,
    ): Collection {
        $query = $direction === 'in' ? $this->customerPayments($account) : $this->vendorPayments($account);
        if ($from) {
            $query->whereDate('p.payment_date', '>=', $from);
        }
        if ($to) {
            $query->whereDate('p.payment_date', '<=', $to);
        }
        if ($amountCents !== null) {
            $query->where('p.amount', Money::decimal($amountCents));
        }
        if (filled($search)) {
            $term = '%'.mb_strtolower(trim($search)).'%';
            $number = str_replace([',', ' '], '', trim($search));
            $query->where(function (Builder $q) use ($term, $number) {
                $q->whereRaw('LOWER(partner.name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(doc.document_number) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(COALESCE(p.reference, \'\')) LIKE ?', [$term]);
                if (is_numeric($number)) {
                    $q->orWhere('p.amount', Money::decimal(Money::cents($number)));
                }
            });
        }

        return $query->orderByDesc('p.payment_date')->orderByDesc('p.id')->limit($limit)->get()
            ->map(fn ($row) => $this->presentPayment($row, $direction));
    }

    /**
     * Suggested payments for each unreconciled line: the same amount, within a
     * week of the bank date, best first. A payment whose number or reference
     * appears in the bank description ranks above one that is merely close.
     *
     * @param  Collection<int, BankTransaction>  $lines
     * @return array<int, list<array<string, mixed>>>
     */
    public function suggestions(BankAccount $account, Collection $lines, int $perLine = 3): array
    {
        $open = $lines->filter(fn (BankTransaction $line) => ! $line->isReconciled() && self::amountCents($line) > 0);
        if ($open->isEmpty()) {
            return [];
        }

        $result = [];
        foreach (['in', 'out'] as $direction) {
            $group = $open->filter(fn (BankTransaction $line) => self::direction($line) === $direction);
            if ($group->isEmpty()) {
                continue;
            }
            $from = CarbonImmutable::parse($group->min('transaction_date'))->subDays(self::SUGGEST_DAYS)->toDateString();
            $to = CarbonImmutable::parse($group->max('transaction_date'))->addDays(self::SUGGEST_DAYS)->toDateString();
            $byAmount = $this->candidates($account, $direction, $from, $to, limit: 5000)->groupBy('amount');

            foreach ($group as $line) {
                $result[$line->id] = collect($byAmount->get(self::amountCents($line), []))
                    ->map(fn (array $payment) => $payment + ['score' => $this->score($line, $payment)])
                    ->filter(fn (array $payment) => $payment['score'] !== null)
                    ->sortByDesc('score')
                    ->take($perLine)
                    ->values()
                    ->all();
            }
        }

        return $result;
    }

    /** @param  list<string>  $keys  "customer_payment:12" style keys */
    public function match(User $user, BankTransaction $line, array $keys): void
    {
        $line->loadMissing('account.company');
        $account = $line->account;
        $this->assertOpen($line);

        $keys = array_values(array_unique($keys));
        if ($keys === []) {
            throw ValidationException::withMessages(['payments' => 'Choose at least one payment.']);
        }

        $direction = self::direction($line);
        $type = $direction === 'in' ? BankReconciliationMatch::CUSTOMER_PAYMENT : BankReconciliationMatch::VENDOR_PAYMENT;
        $ids = [];
        foreach ($keys as $key) {
            [$keyType, $id] = array_pad(explode(':', (string) $key, 2), 2, null);
            if ($keyType !== $type || ! ctype_digit((string) $id)) {
                throw ValidationException::withMessages(['payments' => $direction === 'in'
                    ? 'Money in can only be matched to customer receipts.'
                    : 'Money out can only be matched to vendor payments.']);
            }
            $ids[] = (int) $id;
        }

        $query = $direction === 'in' ? $this->customerPayments($account) : $this->vendorPayments($account);
        $payments = $query->whereIn('p.id', $ids)->get();
        if ($payments->count() !== count($ids)) {
            throw ValidationException::withMessages(['payments' => 'One of those payments is already matched, or is not in '.$account->company->name.' in '.$account->currency.'.']);
        }

        $total = $payments->sum(fn ($row) => Money::cents($row->amount));
        if ($total !== self::amountCents($line)) {
            throw ValidationException::withMessages(['payments' => 'The payments add up to '.Money::format($total).', but the bank line is '.Money::format(self::amountCents($line)).'.']);
        }

        DB::transaction(function () use ($user, $line, $account, $payments, $type) {
            foreach ($payments as $row) {
                BankReconciliationMatch::create([
                    'transaction_id' => $line->id,
                    'company_id' => $account->company_id,
                    'matchable_type' => $type,
                    'matchable_id' => $row->id,
                    'amount' => Money::decimal(Money::cents($row->amount)),
                    'created_by' => $user->id,
                ]);
            }
            $line->forceFill(['reconcile_kind' => 'matched', 'reconcile_note' => null, 'reconciled_at' => now(), 'reconciled_by' => $user->id])->save();
            $this->record($account->company, 'banking.reconciliation.matched', $line, [
                'payments' => ['new' => $payments->map(fn ($row) => $row->number)->implode(', ')],
            ], $user);
        });
    }

    /** Lines with no payment behind them, such as bank charges or interest. */
    public function explain(User $user, BankTransaction $line, string $note): void
    {
        $line->loadMissing('account.company');
        $this->assertOpen($line);

        DB::transaction(function () use ($user, $line, $note) {
            $line->forceFill(['reconcile_kind' => 'explained', 'reconcile_note' => trim($note), 'reconciled_at' => now(), 'reconciled_by' => $user->id])->save();
            $this->record($line->account->company, 'banking.reconciliation.explained', $line, ['note' => ['new' => trim($note)]], $user);
        });
    }

    public function undo(User $user, BankTransaction $line): void
    {
        $line->loadMissing('account.company');
        if ($line->reconciled_at === null) {
            throw ValidationException::withMessages(['line' => 'This line is not reconciled.']);
        }

        DB::transaction(function () use ($user, $line) {
            $was = $line->reconcile_kind;
            $line->matches()->delete();
            $line->forceFill(['reconcile_kind' => null, 'reconcile_note' => null, 'reconciled_at' => null, 'reconciled_by' => null])->save();
            $this->record($line->account->company, 'banking.reconciliation.undone', $line, ['reconcile_kind' => ['old' => $was, 'new' => null]], $user);
        });
    }

    /**
     * Applies only the certain matches: a line with exactly one suggested
     * payment, where that payment is suggested for no other open line.
     */
    public function autoMatch(User $user, BankAccount $account): int
    {
        $lines = $account->transactions()->whereNull('reconciled_at')->whereNull('transfer_id')->get();
        $suggestions = $this->suggestions($account, $lines, perLine: 2);

        $claims = [];
        foreach ($suggestions as $lineId => $payments) {
            foreach ($payments as $payment) {
                $claims[$payment['key']][] = $lineId;
            }
        }

        $matched = 0;
        foreach ($suggestions as $lineId => $payments) {
            if (count($payments) !== 1 || count($claims[$payments[0]['key']]) !== 1) {
                continue;
            }
            $this->match($user, $lines->firstWhere('id', $lineId), [$payments[0]['key']]);
            $matched++;
        }

        return $matched;
    }

    /** @return array<string, int> */
    public function summary(BankAccount $account): array
    {
        $base = BankTransaction::query()->where('account_id', $account->id);
        $open = (clone $base)->whereNull('reconciled_at')->whereNull('transfer_id');
        $lines = (clone $base)->count();

        return [
            'lines' => $lines,
            'reconciled' => $lines - (clone $open)->count(),
            'open' => (clone $open)->count(),
            'open_in' => Money::cents((clone $open)->sum('credit')),
            'open_out' => Money::cents((clone $open)->sum('debit')),
            'unbanked_receipts' => $this->customerPayments($account)->count(),
            'unbanked_payments' => $this->vendorPayments($account)->count(),
        ];
    }

    /**
     * Matched payments for the given lines, keyed by line id.
     *
     * @param  list<int>  $lineIds
     * @return array<int, list<array<string, mixed>>>
     */
    public function matchedPayments(BankAccount $account, array $lineIds): array
    {
        if ($lineIds === []) {
            return [];
        }
        $matches = BankReconciliationMatch::query()->whereIn('transaction_id', $lineIds)->get();
        $result = [];
        foreach ([BankReconciliationMatch::CUSTOMER_PAYMENT => 'in', BankReconciliationMatch::VENDOR_PAYMENT => 'out'] as $type => $direction) {
            $group = $matches->where('matchable_type', $type);
            if ($group->isEmpty()) {
                continue;
            }
            $query = $direction === 'in' ? $this->customerPayments($account, unmatchedOnly: false) : $this->vendorPayments($account, unmatchedOnly: false);
            $rows = $query->whereIn('p.id', $group->pluck('matchable_id'))->get()->keyBy('id');
            foreach ($group as $match) {
                if ($row = $rows->get($match->matchable_id)) {
                    $result[$match->transaction_id][] = $this->presentPayment($row, $direction);
                }
            }
        }

        return $result;
    }

    private function customerPayments(BankAccount $account, bool $unmatchedOnly = true): Builder
    {
        $query = DB::table('inv_invoice_payments as p')
            ->join('inv_invoices as doc', 'doc.id', '=', 'p.invoice_id')
            ->leftJoin('inv_customers as partner', 'partner.id', '=', 'doc.customer_id')
            ->where('p.company_id', $account->company_id)
            ->whereNull('p.credit_note_id')
            ->where('p.currency_code', $account->currency)
            ->select(['p.id', 'p.payment_date', 'p.amount', 'p.reference', 'p.payment_method', 'doc.id as document_id', 'doc.document_number as number', 'partner.name as partner']);

        return $unmatchedOnly ? $this->unmatched($query, BankReconciliationMatch::CUSTOMER_PAYMENT) : $query;
    }

    private function vendorPayments(BankAccount $account, bool $unmatchedOnly = true): Builder
    {
        $query = DB::table('purchase_payments as p')
            ->leftJoin('purchase_vendors as partner', 'partner.id', '=', 'p.vendor_id')
            // Joined to itself as "doc" so searches read doc.document_number for both kinds.
            ->join('purchase_payments as doc', 'doc.id', '=', 'p.id')
            ->where('p.company_id', $account->company_id)
            ->where('p.status', 'posted')
            ->where('p.currency_code', $account->currency)
            ->select(['p.id', 'p.payment_date', 'p.amount', 'p.reference', 'p.payment_method', DB::raw('NULL as document_id'), 'p.document_number as number', 'partner.name as partner']);

        return $unmatchedOnly ? $this->unmatched($query, BankReconciliationMatch::VENDOR_PAYMENT) : $query;
    }

    private function unmatched(Builder $query, string $type): Builder
    {
        return $query->whereNotExists(fn (Builder $q) => $q->from('banking_reconciliation_matches as m')
            ->whereColumn('m.matchable_id', 'p.id')
            ->where('m.matchable_type', $type));
    }

    /** @return array<string, mixed> */
    private function presentPayment(object $row, string $direction): array
    {
        $type = $direction === 'in' ? BankReconciliationMatch::CUSTOMER_PAYMENT : BankReconciliationMatch::VENDOR_PAYMENT;

        return [
            'key' => $type.':'.$row->id,
            'type' => $type,
            'id' => (int) $row->id,
            'date' => substr((string) $row->payment_date, 0, 10),
            'amount' => Money::cents($row->amount),
            'number' => $row->number,
            'partner' => $row->partner,
            'reference' => $row->reference,
            'method' => $row->payment_method,
            'document_id' => $row->document_id !== null ? (int) $row->document_id : null,
        ];
    }

    /** Higher is better; null means the dates are too far apart to suggest. */
    private function score(BankTransaction $line, array $payment): ?int
    {
        $days = abs(CarbonImmutable::parse($payment['date'])->diffInDays($line->transaction_date, false));
        if ($days > self::SUGGEST_DAYS) {
            return null;
        }
        $text = mb_strtolower(($line->description ?? '').' '.($line->reference ?? ''));
        $named = collect([$payment['number'], $payment['reference']])
            ->filter(fn ($value) => filled($value) && mb_strlen((string) $value) >= 3)
            ->contains(fn ($value) => str_contains($text, mb_strtolower((string) $value)));

        return ($named ? 100 : 0) + (self::SUGGEST_DAYS - (int) $days) * 10;
    }

    private function assertOpen(BankTransaction $line): void
    {
        if ($line->transfer_id !== null) {
            throw ValidationException::withMessages(['line' => 'Transfers between the group\'s own accounts are already reconciled.']);
        }
        if ($line->reconciled_at !== null) {
            throw ValidationException::withMessages(['line' => 'This line is already reconciled. Undo it first to change it.']);
        }
    }

    /** Audit events belong to the account's company, which may not be the active one. */
    private function record(Company $company, string $event, BankTransaction $line, array $changes, User $user): void
    {
        $previous = $this->context->activeCompany();
        $this->context->setActiveCompany($company);
        try {
            $this->audit->record($company, $event, $line, $changes, [
                'account' => $line->account->account_number,
                'date' => $line->transaction_date->toDateString(),
                'amount' => Money::decimal(self::amountCents($line)),
            ], $user);
        } finally {
            $this->context->setActiveCompany($previous);
        }
    }
}
