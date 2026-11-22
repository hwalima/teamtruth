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
use Inertia\Inertia;
use Inertia\Response;

/**
 * The banking dashboard. Figures arrive per company, currency and month, in
 * cents, so the page can filter by company, currency and period without
 * asking the server again.
 */
class BankingDashboardController extends Controller
{
    public function __invoke(Request $request, BankingAccess $access): Response
    {
        $user = $request->user();
        $companyIds = $access->companyIds($user);
        abort_if($companyIds === [], 403, 'You do not have banking access in any company.');
        $accounts = BankAccount::query()->with('company:id,code,name')->whereIn('company_id', $companyIds)->get();
        $accountById = $accounts->keyBy('id');

        $months = [];      // "company|currency|Y-m" => in/out/transfers
        $types = [];       // "company|currency|Y-m|type" => debit/credit
        $netByAccountMonth = [];
        $firstMonth = null;

        $rows = BankTransaction::query()
            ->whereIn('account_id', $accounts->pluck('id'))
            ->select(['account_id', 'transaction_date', 'type', 'debit', 'credit', 'transfer_id'])
            ->toBase()
            ->cursor();
        foreach ($rows as $row) {
            $account = $accountById[$row->account_id];
            $month = substr((string) $row->transaction_date, 0, 7);
            $firstMonth = $firstMonth === null || $month < $firstMonth ? $month : $firstMonth;
            $debit = Money::cents($row->debit);
            $credit = Money::cents($row->credit);
            $key = $account->company_id.'|'.$account->currency.'|'.$month;
            $months[$key] ??= ['in' => 0, 'out' => 0, 'transfers_in' => 0, 'transfers_out' => 0];
            $months[$key][$row->transfer_id ? 'transfers_in' : 'in'] += $credit;
            $months[$key][$row->transfer_id ? 'transfers_out' : 'out'] += $debit;
            $netByAccountMonth[$account->id][$month] = ($netByAccountMonth[$account->id][$month] ?? 0) + $credit - $debit;

            $type = trim((string) $row->type) ?: 'Other';
            $typeKey = $key.'|'.$type;
            $types[$typeKey] ??= ['debit' => 0, 'credit' => 0];
            $types[$typeKey]['debit'] += $debit;
            $types[$typeKey]['credit'] += $credit;
        }

        foreach ($accounts as $account) {
            if ($account->opening_date) {
                $m = $account->opening_date->format('Y-m');
                $firstMonth = $firstMonth === null || $m < $firstMonth ? $m : $firstMonth;
            }
        }
        $currentMonth = now()->format('Y-m');
        $firstMonth ??= $currentMonth;
        $monthList = [];
        for ($cursor = CarbonImmutable::parse($firstMonth.'-01'); $cursor->format('Y-m') <= max($currentMonth, $firstMonth); $cursor = $cursor->addMonth()) {
            $monthList[] = $cursor->format('Y-m');
            if (count($monthList) > 240) {
                break;
            }
        }

        // Month-end balance per company and currency: opening balance from the
        // opening month, plus every line up to the end of the month.
        $closing = [];
        foreach ($accounts as $account) {
            $running = 0;
            $openMonth = $account->opening_date?->format('Y-m') ?? $firstMonth;
            $started = false;
            foreach ($monthList as $month) {
                if (! $started && $month >= $openMonth) {
                    $running += Money::cents($account->opening_balance);
                    $started = true;
                }
                $running += $netByAccountMonth[$account->id][$month] ?? 0;
                if ($started || isset($netByAccountMonth[$account->id][$month])) {
                    $key = $account->company_id.'|'.$account->currency.'|'.$month;
                    $closing[$key] = ($closing[$key] ?? 0) + $running;
                }
            }
        }

        $series = [];
        foreach (array_unique([...array_keys($months), ...array_keys($closing)]) as $key) {
            [$company, $currency, $month] = explode('|', $key);
            $series[] = ['company_id' => (int) $company, 'currency' => $currency, 'month' => $month, ...($months[$key] ?? ['in' => 0, 'out' => 0, 'transfers_in' => 0, 'transfers_out' => 0]), 'closing' => $closing[$key] ?? 0];
        }
        usort($series, fn ($a, $b) => [$a['month'], $a['company_id']] <=> [$b['month'], $b['company_id']]);

        $typeRows = [];
        foreach ($types as $key => $values) {
            [$company, $currency, $month, $type] = explode('|', $key, 4);
            $typeRows[] = ['company_id' => (int) $company, 'currency' => $currency, 'month' => $month, 'type' => $type, ...$values];
        }

        $flows = BankTransfer::query()
            ->with(['fromAccount:id,company_id,currency', 'toAccount:id,company_id'])
            ->whereHas('fromAccount', fn ($q) => $q->whereIn('company_id', $companyIds))
            ->get()
            ->groupBy(fn (BankTransfer $t) => $t->fromAccount->company_id.'|'.$t->toAccount->company_id.'|'.$t->fromAccount->currency.'|'.$t->transfer_date->format('Y-m'))
            ->map(function ($group, $key) {
                [$from, $to, $currency, $month] = explode('|', $key);

                return ['from_company_id' => (int) $from, 'to_company_id' => (int) $to, 'currency' => $currency, 'month' => $month, 'amount' => $group->sum(fn ($t) => Money::cents($t->amount)), 'count' => $group->count()];
            })
            ->filter(fn ($f) => $f['from_company_id'] !== $f['to_company_id'])
            ->values();

        $visibleRequests = FundRequest::query()->where(fn ($q) => $q->where('requested_by', $user->id)
            ->orWhereIn('from_company_id', $companyIds)
            ->orWhereIn('to_company_id', $companyIds));
        $approveIds = $access->companyIds($user, 'erp.banking.approve');

        return Inertia::render('Erp/Banking/Dashboard', [
            'companies' => $accounts->pluck('company')->unique('id')->sortBy('name')->map->only(['id', 'code', 'name'])->values(),
            'accounts' => $accounts->map(fn (BankAccount $a) => [
                'id' => $a->id,
                'account_number' => $a->account_number,
                'account_name' => $a->account_name,
                'company_id' => $a->company_id,
                'currency' => $a->currency,
                'status' => $a->status,
                'balance' => Money::cents($a->opening_balance) + array_sum($netByAccountMonth[$a->id] ?? []),
            ])->values(),
            'months' => $monthList,
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
