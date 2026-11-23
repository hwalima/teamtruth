<?php

namespace App\Modules\Banking\Services;

use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Banking\Models\Money;
use Carbon\CarbonImmutable;

/**
 * A bank statement for any period: the balance brought forward, every line in
 * order with its running balance, the totals, and the closing balance. Lines
 * whose source printed a different balance are listed for reconciliation.
 */
class StatementService
{
    /** @return array<string, mixed> */
    public function statement(BankAccount $account, ?string $from = null, ?string $to = null): array
    {
        $first = $account->opening_date?->toDateString()
            ?? $account->transactions()->min('transaction_date');
        $last = $account->transactions()->max('transaction_date');
        $from = $from ?: ($first ? CarbonImmutable::parse($first)->toDateString() : now()->toDateString());
        // Up to today by default; later only when lines are dated in the future.
        $today = now()->toDateString();
        $to = $to ?: max($today, $last ? CarbonImmutable::parse($last)->toDateString() : $today);
        if ($to < $from) {
            [$from, $to] = [$to, $from];
        }

        $before = $account->transactions()
            ->where('transaction_date', '<', $from)
            ->selectRaw('COALESCE(SUM(credit), 0) AS credits, COALESCE(SUM(debit), 0) AS debits')
            ->first();
        $opening = Money::cents($account->opening_balance) + Money::cents($before->credits) - Money::cents($before->debits);

        $balance = $opening;
        $debits = 0;
        $credits = 0;
        $lines = [];
        $differences = [];

        $account->transactions()
            ->with('transfer.fromAccount.company:id,name', 'transfer.toAccount.company:id,name')
            ->whereBetween('transaction_date', [$from, $to])
            ->orderBy('transaction_date')
            ->orderBy('sequence')
            ->orderBy('id')
            ->each(function (BankTransaction $line) use (&$balance, &$debits, &$credits, &$lines, &$differences): void {
                $debit = Money::cents($line->debit);
                $credit = Money::cents($line->credit);
                $balance += $credit - $debit;
                $debits += $debit;
                $credits += $credit;
                $stated = $line->stated_balance === null ? null : Money::cents($line->stated_balance);

                $lines[] = [
                    'id' => $line->id,
                    'date' => $line->transaction_date->toDateString(),
                    'type' => $line->type,
                    'description' => $line->description,
                    'reference' => $line->reference,
                    'debit' => $debit,
                    'credit' => $credit,
                    'balance' => $balance,
                    'stated_balance' => $stated,
                    'source' => $line->source_sheet !== null ? trim($line->source_sheet).' row '.$line->source_row : null,
                    'kind' => $line->transfer_id ? 'transfer' : ($line->import_id ? 'imported' : 'manual'),
                    'transfer_id' => $line->transfer_id,
                ];

                // Only lines whose balance the source printed differently. Once a
                // sheet's balance has gone wrong every later line differs too, so
                // the note gives the difference on each.
                if ($stated !== null && $stated !== $balance) {
                    $differences[] = [
                        'date' => $line->transaction_date->toDateString(),
                        'description' => $line->description,
                        'source' => trim((string) $line->source_sheet).' row '.$line->source_row,
                        'stated_balance' => $stated,
                        'balance' => $balance,
                        'difference' => $stated - $balance,
                    ];
                }
            }, 500);

        return [
            'from' => $from,
            'to' => $to,
            'opening' => $opening,
            'lines' => $lines,
            'debits' => $debits,
            'credits' => $credits,
            'closing' => $balance,
            'count' => count($lines),
            'differences' => $differences,
        ];
    }
}
