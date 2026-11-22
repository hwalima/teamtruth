<?php

namespace App\Modules\Banking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Banking\Models\BankTransfer;
use App\Modules\Banking\Models\FundRequest;
use App\Modules\Banking\Models\Money;
use App\Modules\Banking\Services\BankingAccess;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The banking dashboard. The period (a preset, one month or custom dates) is
 * worked out here; figures arrive per company, currency and bucket (a day for
 * ranges up to two months, otherwise a month), in cents, so the page can filter
 * by company and currency without asking the server again.
 */
class BankingDashboardController extends Controller
{
    public const PRESETS = ['1m', '3m', '6m', '12m', 'ytd', 'all', 'month', 'custom'];

    public function __invoke(Request $request, BankingAccess $access): Response
    {
        $user = $request->user();
        $companies = $access->companies($user);
        abort_if($companies->isEmpty(), 403, 'You do not have banking access in any company.');
        $companyIds = $access->companyIds($user);

        $input = $request->validate([
            'preset' => ['nullable', Rule::in(self::PRESETS)],
            'month' => ['nullable', 'date_format:Y-m'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $accounts = BankAccount::query()->whereIn('company_id', $companyIds)->get();
        $accountById = $accounts->keyBy('id');
        $today = CarbonImmutable::today();
        $earliest = collect([
            BankTransaction::query()->whereIn('account_id', $accounts->pluck('id'))->min('transaction_date'),
            $accounts->min('opening_date'),
        ])->filter()->map(fn ($date) => CarbonImmutable::parse(substr((string) $date, 0, 10)))->min() ?? $today;

        $preset = $input['preset'] ?? '12m';
        [$from, $to] = match ($preset) {
            '1m' => [$today->subDays(29), $today],
            '3m' => [$today->startOfMonth()->subMonthsNoOverflow(2), $today],
            '6m' => [$today->startOfMonth()->subMonthsNoOverflow(5), $today],
            'ytd' => [$today->startOfYear(), $today],
            'all' => [$earliest->min($today), $today],
            'month' => [
                CarbonImmutable::parse(($input['month'] ?? $today->format('Y-m')).'-01'),
                CarbonImmutable::parse(($input['month'] ?? $today->format('Y-m')).'-01')->endOfMonth()->startOfDay(),
            ],
            'custom' => [
                isset($input['from']) ? CarbonImmutable::parse($input['from']) : $today->subDays(29),
                isset($input['to']) ? CarbonImmutable::parse($input['to']) : $today,
            ],
            default => [$today->startOfMonth()->subMonthsNoOverflow(11), $today],
        };
        $byDay = $from->diffInDays($to) < 62;
        $bucketOf = fn (string $date) => $byDay ? substr($date, 0, 10) : substr($date, 0, 7);
        $fromKey = $from->toDateString();
        $toKey = $to->toDateString();

        $buckets = [];
        for ($cursor = $byDay ? $from : $from->startOfMonth(); $cursor->lte($to) && count($buckets) < 400; $cursor = $byDay ? $cursor->addDay() : $cursor->addMonthNoOverflow()) {
            $buckets[] = $byDay ? $cursor->toDateString() : $cursor->format('Y-m');
        }

        $flowsIn = [];     // "company|currency|bucket" => in/out/transfers
        $types = [];       // "company|currency|type" => debit/credit
        $netByAccountBucket = [];
        $before = [];      // account => net movement before the period
        $balanceNow = [];  // account => net movement of every line

        $rows = BankTransaction::query()
            ->whereIn('account_id', $accounts->pluck('id'))
            ->select(['account_id', 'transaction_date', 'type', 'debit', 'credit', 'transfer_id'])
            ->toBase()
            ->cursor();
        foreach ($rows as $row) {
            $account = $accountById[$row->account_id];
            $date = substr((string) $row->transaction_date, 0, 10);
            $debit = Money::cents($row->debit);
            $credit = Money::cents($row->credit);
            $balanceNow[$account->id] = ($balanceNow[$account->id] ?? 0) + $credit - $debit;
            if ($date < $fromKey) {
                $before[$account->id] = ($before[$account->id] ?? 0) + $credit - $debit;

                continue;
            }
            if ($date > $toKey) {
                continue;
            }
            $bucket = $bucketOf($date);
            $key = $account->company_id.'|'.$account->currency.'|'.$bucket;
            $flowsIn[$key] ??= ['in' => 0, 'out' => 0, 'transfers_in' => 0, 'transfers_out' => 0];
            $flowsIn[$key][$row->transfer_id ? 'transfers_in' : 'in'] += $credit;
            $flowsIn[$key][$row->transfer_id ? 'transfers_out' : 'out'] += $debit;
            $netByAccountBucket[$account->id][$bucket] = ($netByAccountBucket[$account->id][$bucket] ?? 0) + $credit - $debit;

            $typeKey = $account->company_id.'|'.$account->currency.'|'.(trim((string) $row->type) ?: 'Other');
            $types[$typeKey] ??= ['debit' => 0, 'credit' => 0];
            $types[$typeKey]['debit'] += $debit;
            $types[$typeKey]['credit'] += $credit;
        }

        // Balance at the end of each bucket: opening balance once the account
        // is open, plus every line up to the end of the bucket.
        $closing = [];
        foreach ($accounts as $account) {
            $opening = Money::cents($account->opening_balance);
            $openedOn = $account->opening_date?->toDateString();
            $running = ($before[$account->id] ?? 0) + ($openedOn === null || $openedOn < $fromKey ? $opening : 0);
            $openBucket = $openedOn !== null && $openedOn >= $fromKey && $openedOn <= $toKey ? $bucketOf($openedOn) : null;
            foreach ($buckets as $bucket) {
                if ($bucket === $openBucket) {
                    $running += $opening;
                }
                $running += $netByAccountBucket[$account->id][$bucket] ?? 0;
                $key = $account->company_id.'|'.$account->currency.'|'.$bucket;
                $closing[$key] = ($closing[$key] ?? 0) + $running;
            }
        }

        $series = [];
        foreach (array_unique([...array_keys($flowsIn), ...array_keys($closing)]) as $key) {
            [$company, $currency, $bucket] = explode('|', $key);
            $series[] = ['company_id' => (int) $company, 'currency' => $currency, 'bucket' => $bucket, ...($flowsIn[$key] ?? ['in' => 0, 'out' => 0, 'transfers_in' => 0, 'transfers_out' => 0]), 'closing' => $closing[$key] ?? 0];
        }
        usort($series, fn ($a, $b) => [$a['bucket'], $a['company_id']] <=> [$b['bucket'], $b['company_id']]);

        $typeRows = [];
        foreach ($types as $key => $values) {
            [$company, $currency, $type] = explode('|', $key, 3);
            $typeRows[] = ['company_id' => (int) $company, 'currency' => $currency, 'type' => $type, ...$values];
        }

        $flows = BankTransfer::query()
            ->with(['fromAccount:id,company_id,currency', 'toAccount:id,company_id'])
            ->whereHas('fromAccount', fn ($q) => $q->whereIn('company_id', $companyIds))
            ->whereBetween('transfer_date', [$fromKey, $toKey])
            ->get()
            ->groupBy(fn (BankTransfer $t) => $t->fromAccount->company_id.'|'.$t->toAccount->company_id.'|'.$t->fromAccount->currency)
            ->map(function ($group, $key) {
                [$from, $to, $currency] = explode('|', $key);

                return ['from_company_id' => (int) $from, 'to_company_id' => (int) $to, 'currency' => $currency, 'amount' => $group->sum(fn ($t) => Money::cents($t->amount)), 'count' => $group->count()];
            })
            ->filter(fn ($f) => $f['from_company_id'] !== $f['to_company_id'])
            ->values();

        $visibleRequests = FundRequest::query()->where(fn ($q) => $q->where('requested_by', $user->id)
            ->orWhereIn('from_company_id', $companyIds)
            ->orWhereIn('to_company_id', $companyIds));
        $approveIds = $access->companyIds($user, 'erp.banking.approve');

        return Inertia::render('Erp/Banking/Dashboard', [
            'companies' => $companies->map->only(['id', 'code', 'name'])->values(),
            'accounts' => $accounts->map(fn (BankAccount $a) => [
                'id' => $a->id,
                'account_number' => $a->account_number,
                'account_name' => $a->account_name,
                'company_id' => $a->company_id,
                'currency' => $a->currency,
                'status' => $a->status,
                'balance' => Money::cents($a->opening_balance) + ($balanceNow[$a->id] ?? 0),
            ])->values(),
            'range' => [
                'preset' => $preset,
                'from' => $fromKey,
                'to' => $toKey,
                'month' => $preset === 'month' ? $from->format('Y-m') : null,
                'granularity' => $byDay ? 'day' : 'month',
                'earliest' => $earliest->toDateString(),
            ],
            'buckets' => $buckets,
            'series' => $series,
            'types' => $typeRows,
            'flows' => $flows,
            'requests' => [
                'by_status' => (clone $visibleRequests)->selectRaw('status, currency, count(*) as n, sum(amount) as total')->groupBy('status', 'currency')->get()
                    ->map(fn ($r) => ['status' => $r->status, 'currency' => $r->currency, 'count' => (int) $r->n, 'total' => Money::cents($r->total)])->values(),
                'awaiting_me' => FundRequest::query()->where('status', FundRequest::PENDING)->whereIn('from_company_id', $approveIds)->where('requested_by', '!=', $user->id)->count(),
                'recent' => (clone $visibleRequests)->with(['fromCompany:id,name', 'toCompany:id,name'])->latest('requested_at')->latest('id')->limit(6)->get()
                    ->map(fn (FundRequest $fr) => [
                        'id' => $fr->id,
                        'reference' => $fr->reference,
                        'amount' => Money::cents($fr->amount),
                        'currency' => $fr->currency,
                        'status' => $fr->status,
                        'from' => $fr->fromCompany->name,
                        'to' => $fr->toCompany->name,
                        'from_company_id' => $fr->from_company_id,
                        'to_company_id' => $fr->to_company_id,
                        'requested_at' => $fr->requested_at->toIso8601String(),
                        'requester' => $fr->requester_name,
                        'approver' => $fr->approver_name,
                    ])->values(),
            ],
        ]);
    }
}
