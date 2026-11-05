<?php

namespace App\Modules\Accounting\Services;

use App\Modules\Core\Models\Company;
use Illuminate\Support\Facades\DB;

class AccountingReportService
{
    /**
     * @return array{
     *     asOf: string,
     *     rows: array<int, array{accountId: int, code: string, name: string, accountType: string, debit: string, credit: string}>,
     *     totalDebit: string,
     *     totalCredit: string
     * }
     */
    public function trialBalance(Company $company, string $asOf): array
    {
        $accountTotals = DB::table('accounting_journal_entry_lines as lines')
            ->join('accounting_journal_entries as entries', 'entries.id', '=', 'lines.journal_entry_id')
            ->where('lines.company_id', $company->id)
            ->where('entries.company_id', $company->id)
            ->where('entries.status', 'posted')
            ->where('entries.entry_date', '<=', $asOf)
            ->groupBy('lines.account_id')
            ->select('lines.account_id')
            ->selectRaw('SUM(lines.debit) as debit_total')
            ->selectRaw('SUM(lines.credit) as credit_total');

        $balances = DB::table('accounting_accounts as accounts')
            ->joinSub($accountTotals, 'activity', 'activity.account_id', '=', 'accounts.id')
            ->where('accounts.company_id', $company->id)
            ->where('accounts.is_group', false)
            ->whereRaw('activity.debit_total <> activity.credit_total')
            ->select([
                'accounts.id as account_id',
                'accounts.code',
                'accounts.name',
                'accounts.account_type',
            ])
            ->selectRaw(
                'CASE WHEN activity.debit_total > activity.credit_total THEN activity.debit_total - activity.credit_total ELSE 0 END as debit_balance',
            )
            ->selectRaw(
                'CASE WHEN activity.credit_total > activity.debit_total THEN activity.credit_total - activity.debit_total ELSE 0 END as credit_balance',
            );

        $rows = (clone $balances)
            ->orderBy('accounts.code')
            ->get()
            ->map(fn (object $row): array => [
                'accountId' => (int) $row->account_id,
                'code' => $row->code,
                'name' => $row->name,
                'accountType' => $row->account_type,
                'debit' => self::formatAmount($row->debit_balance),
                'credit' => self::formatAmount($row->credit_balance),
            ])
            ->all();

        $totals = DB::query()
            ->fromSub($balances, 'balances')
            ->selectRaw('COALESCE(SUM(debit_balance), 0) as total_debit')
            ->selectRaw('COALESCE(SUM(credit_balance), 0) as total_credit')
            ->first();

        return [
            'asOf' => $asOf,
            'rows' => $rows,
            'totalDebit' => self::formatAmount($totals?->total_debit),
            'totalCredit' => self::formatAmount($totals?->total_credit),
        ];
    }

    private static function formatAmount(string|int|float|null $amount): string
    {
        $value = (string) ($amount ?? '0');
        if (! preg_match('/^\d+(?:\.\d+)?$/', $value)) {
            throw new \UnexpectedValueException('The database returned an invalid accounting balance.');
        }

        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');

        return (ltrim($whole, '0') ?: '0').'.'.str_pad(substr($fraction, 0, 4), 4, '0');
    }
}
