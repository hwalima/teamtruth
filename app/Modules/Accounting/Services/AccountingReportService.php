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

    /**
     * @return array{
     *     from: string,
     *     to: string,
     *     income: array<int, array{accountId: int, code: string, name: string, debit: string, credit: string, amount: string}>,
     *     expenses: array<int, array{accountId: int, code: string, name: string, debit: string, credit: string, amount: string}>,
     *     incomeTotal: string,
     *     expenseTotal: string,
     *     netProfit: string
     * }
     */
    public function profitAndLoss(Company $company, string $from, string $to): array
    {
        $activity = DB::table('accounting_journal_entry_lines as lines')
            ->join('accounting_journal_entries as entries', 'entries.id', '=', 'lines.journal_entry_id')
            ->join('accounting_accounts as accounts', 'accounts.id', '=', 'lines.account_id')
            ->where('lines.company_id', $company->id)
            ->where('entries.company_id', $company->id)
            ->where('accounts.company_id', $company->id)
            ->where('entries.status', 'posted')
            ->whereBetween('entries.entry_date', [$from, $to])
            ->where('accounts.is_group', false)
            ->whereIn('accounts.account_type', ['income', 'expense'])
            ->groupBy('accounts.id', 'accounts.code', 'accounts.name', 'accounts.account_type')
            ->orderBy('accounts.code')
            ->selectRaw('SUM(lines.debit) as debit_total')
            ->selectRaw('SUM(lines.credit) as credit_total')
            ->addSelect([
                'accounts.id as account_id',
                'accounts.code',
                'accounts.name',
                'accounts.account_type',
            ])
            ->get()
            ->map(function (object $account): array {
                $debit = self::normalizeAmount($account->debit_total);
                $credit = self::normalizeAmount($account->credit_total);
                $amount = $account->account_type === 'income'
                    ? self::addSigned($credit, self::negate($debit))
                    : self::addSigned($debit, self::negate($credit));

                return [
                    'accountId' => (int) $account->account_id,
                    'code' => $account->code,
                    'name' => $account->name,
                    'type' => $account->account_type,
                    'debit' => self::formatScaled($debit),
                    'credit' => self::formatScaled($credit),
                    'amount' => self::formatSigned($amount),
                    '_amount' => $amount,
                ];
            })
            ->all();

        $income = array_values(array_filter(
            $activity,
            fn (array $account): bool => $account['type'] === 'income',
        ));
        $expenses = array_values(array_filter(
            $activity,
            fn (array $account): bool => $account['type'] === 'expense',
        ));
        $incomeTotal = '0';
        foreach ($income as $account) {
            $incomeTotal = self::addSigned($incomeTotal, $account['_amount']);
        }
        $expenseTotal = '0';
        foreach ($expenses as $account) {
            $expenseTotal = self::addSigned($expenseTotal, $account['_amount']);
        }

        $clean = fn (array $rows): array => array_map(function (array $row): array {
            unset($row['type'], $row['_amount']);

            return $row;
        }, $rows);

        return [
            'from' => $from,
            'to' => $to,
            'income' => $clean($income),
            'expenses' => $clean($expenses),
            'incomeTotal' => self::formatSigned($incomeTotal),
            'expenseTotal' => self::formatSigned($expenseTotal),
            'netProfit' => self::formatSigned(self::addSigned($incomeTotal, self::negate($expenseTotal))),
        ];
    }

    /**
     * @return array{
     *     from: string,
     *     to: string,
     *     accountId: int|null,
     *     accounts: array<int, array{
     *         accountId: int,
     *         code: string,
     *         name: string,
     *         openingBalance: string,
     *         debitTotal: string,
     *         creditTotal: string,
     *         closingBalance: string,
     *         lines: array<int, array{
     *             date: string,
     *             documentNumber: string,
     *             journalCode: string,
     *             description: string,
     *             reference: string|null,
     *             debit: string,
     *             credit: string,
     *             balance: string
     *         }>
     *     }>
     * }
     */
    public function generalLedger(Company $company, string $from, string $to, ?int $accountId = null): array
    {
        $accounts = [];
        $accountQuery = DB::table('accounting_accounts')
            ->where('company_id', $company->id)
            ->where('is_group', false)
            ->when($accountId !== null, fn ($query) => $query->where('id', $accountId));

        $selectedAccounts = $accountQuery->get(['id', 'code', 'name']);
        foreach ($selectedAccounts as $account) {
            $accounts[(int) $account->id] = self::emptyLedgerAccount($account);
        }

        $openingBalances = DB::table('accounting_journal_entry_lines as lines')
            ->join('accounting_journal_entries as entries', 'entries.id', '=', 'lines.journal_entry_id')
            ->join('accounting_accounts as accounts', 'accounts.id', '=', 'lines.account_id')
            ->where('lines.company_id', $company->id)
            ->where('entries.company_id', $company->id)
            ->where('accounts.company_id', $company->id)
            ->where('entries.status', 'posted')
            ->where('entries.entry_date', '<', $from)
            ->where('accounts.is_group', false)
            ->when($accountId !== null, fn ($query) => $query->where('accounts.id', $accountId))
            ->groupBy('accounts.id', 'accounts.code', 'accounts.name')
            ->select(['accounts.id as account_id', 'accounts.code', 'accounts.name'])
            ->selectRaw('SUM(lines.debit) as debit_total')
            ->selectRaw('SUM(lines.credit) as credit_total')
            ->get();

        foreach ($openingBalances as $opening) {
            $id = (int) $opening->account_id;
            $accounts[$id] ??= self::emptyLedgerAccount($opening);
            $accounts[$id]['opening'] = self::signedDifference($opening->debit_total, $opening->credit_total);
            $accounts[$id]['balance'] = $accounts[$id]['opening'];
        }

        $activity = DB::table('accounting_journal_entry_lines as lines')
            ->join('accounting_journal_entries as entries', 'entries.id', '=', 'lines.journal_entry_id')
            ->join('accounting_journals as journals', 'journals.id', '=', 'entries.journal_id')
            ->join('accounting_accounts as accounts', 'accounts.id', '=', 'lines.account_id')
            ->where('lines.company_id', $company->id)
            ->where('entries.company_id', $company->id)
            ->where('journals.company_id', $company->id)
            ->where('accounts.company_id', $company->id)
            ->where('entries.status', 'posted')
            ->whereBetween('entries.entry_date', [$from, $to])
            ->where('accounts.is_group', false)
            ->when($accountId !== null, fn ($query) => $query->where('accounts.id', $accountId))
            ->orderBy('entries.entry_date')
            ->orderBy('entries.id')
            ->orderBy('lines.id')
            ->get([
                'accounts.id as account_id',
                'accounts.code',
                'accounts.name',
                'entries.entry_date',
                'entries.document_number',
                'entries.description as entry_description',
                'entries.reference',
                'journals.code as journal_code',
                'lines.description as line_description',
                'lines.debit',
                'lines.credit',
            ]);

        foreach ($activity as $line) {
            $id = (int) $line->account_id;
            $accounts[$id] ??= self::emptyLedgerAccount($line);
            $account = &$accounts[$id];
            $debit = self::formatAmount($line->debit);
            $credit = self::formatAmount($line->credit);
            $account['balance'] = self::addSigned(
                self::addSigned($account['balance'], self::normalizeAmount($debit)),
                self::negate(self::normalizeAmount($credit)),
            );
            $account['debit_total'] = self::addAmount($account['debit_total'], $debit);
            $account['credit_total'] = self::addAmount($account['credit_total'], $credit);
            $account['lines'][] = [
                'date' => $line->entry_date,
                'documentNumber' => $line->document_number,
                'journalCode' => $line->journal_code,
                'description' => $line->line_description ?: $line->entry_description,
                'reference' => $line->reference,
                'debit' => $debit,
                'credit' => $credit,
                'balance' => self::formatSigned($account['balance']),
            ];
            unset($account);
        }

        $reportAccounts = array_values(array_filter(
            $accounts,
            fn (array $account): bool => $accountId !== null || $account['opening'] !== '0' || $account['lines'] !== [],
        ));
        usort($reportAccounts, fn (array $left, array $right): int => strcmp($left['code'], $right['code']));

        return [
            'from' => $from,
            'to' => $to,
            'accountId' => $accountId,
            'accounts' => array_map(fn (array $account): array => [
                'accountId' => $account['accountId'],
                'code' => $account['code'],
                'name' => $account['name'],
                'openingBalance' => self::formatSigned($account['opening']),
                'debitTotal' => $account['debit_total'],
                'creditTotal' => $account['credit_total'],
                'closingBalance' => self::formatSigned($account['balance']),
                'lines' => $account['lines'],
            ], $reportAccounts),
        ];
    }

    private static function emptyLedgerAccount(object $account): array
    {
        return [
            'accountId' => (int) ($account->account_id ?? $account->id),
            'code' => $account->code,
            'name' => $account->name,
            'opening' => '0',
            'balance' => '0',
            'debit_total' => '0.0000',
            'credit_total' => '0.0000',
            'lines' => [],
        ];
    }

    private static function signedDifference(string|int|float|null $left, string|int|float|null $right): string
    {
        return self::addSigned(self::normalizeAmount($left), self::negate(self::normalizeAmount($right)));
    }

    private static function addAmount(string $left, string $right): string
    {
        return self::formatScaled(self::addUnsigned(self::normalizeAmount($left), self::normalizeAmount($right)));
    }

    private static function normalizeAmount(string|int|float|null $amount): string
    {
        $value = (string) ($amount ?? '0');
        if (! preg_match('/^\d+(?:\.\d{1,4})?$/', $value)) {
            throw new \UnexpectedValueException('The database returned an invalid accounting balance.');
        }

        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');

        return ltrim($whole.str_pad($fraction, 4, '0'), '0') ?: '0';
    }

    private static function addSigned(string $left, string $right): string
    {
        $leftNegative = str_starts_with($left, '-');
        $rightNegative = str_starts_with($right, '-');
        $leftDigits = $leftNegative ? substr($left, 1) : $left;
        $rightDigits = $rightNegative ? substr($right, 1) : $right;

        if ($leftNegative === $rightNegative) {
            $sum = self::addUnsigned($leftDigits, $rightDigits);

            return $leftNegative && $sum !== '0' ? '-'.$sum : $sum;
        }

        $comparison = self::compareUnsigned($leftDigits, $rightDigits);
        if ($comparison === 0) {
            return '0';
        }

        $difference = $comparison > 0
            ? self::subtractUnsigned($leftDigits, $rightDigits)
            : self::subtractUnsigned($rightDigits, $leftDigits);
        $negative = $comparison > 0 ? $leftNegative : $rightNegative;

        return $negative ? '-'.$difference : $difference;
    }

    private static function negate(string $amount): string
    {
        if ($amount === '0') {
            return '0';
        }

        return str_starts_with($amount, '-') ? substr($amount, 1) : '-'.$amount;
    }

    private static function addUnsigned(string $left, string $right): string
    {
        $length = max(strlen($left), strlen($right));
        $left = str_split(str_pad($left, $length, '0', STR_PAD_LEFT));
        $right = str_split(str_pad($right, $length, '0', STR_PAD_LEFT));
        $sum = '';
        $carry = 0;
        for ($index = $length - 1; $index >= 0; $index--) {
            $digit = (int) $left[$index] + (int) $right[$index] + $carry;
            $sum = (string) ($digit % 10).$sum;
            $carry = intdiv($digit, 10);
        }
        if ($carry > 0) {
            $sum = $carry.$sum;
        }

        return ltrim($sum, '0') ?: '0';
    }

    private static function subtractUnsigned(string $left, string $right): string
    {
        $length = max(strlen($left), strlen($right));
        $left = str_split(str_pad($left, $length, '0', STR_PAD_LEFT));
        $right = str_split(str_pad($right, $length, '0', STR_PAD_LEFT));
        $difference = '';
        $borrow = 0;
        for ($index = $length - 1; $index >= 0; $index--) {
            $digit = (int) $left[$index] - (int) $right[$index] - $borrow;
            $borrow = $digit < 0 ? 1 : 0;
            $difference = (string) ($digit < 0 ? $digit + 10 : $digit).$difference;
        }

        return ltrim($difference, '0') ?: '0';
    }

    private static function compareUnsigned(string $left, string $right): int
    {
        $left = ltrim($left, '0') ?: '0';
        $right = ltrim($right, '0') ?: '0';
        if (strlen($left) !== strlen($right)) {
            return strlen($left) <=> strlen($right);
        }

        return strcmp($left, $right) <=> 0;
    }

    private static function formatSigned(string $amount): string
    {
        $negative = str_starts_with($amount, '-');
        $formatted = self::formatScaled($negative ? substr($amount, 1) : $amount);

        return $negative && $formatted !== '0.0000' ? '-'.$formatted : $formatted;
    }

    private static function formatScaled(string $digits): string
    {
        $digits = str_pad(ltrim($digits, '0') ?: '0', 5, '0', STR_PAD_LEFT);

        return substr($digits, 0, -4).'.'.substr($digits, -4);
    }

    private static function formatAmount(string|int|float|null $amount): string
    {
        $value = (string) ($amount ?? '0');
        if (! preg_match('/^\d+(?:\.\d{1,4})?$/', $value)) {
            throw new \UnexpectedValueException('The database returned an invalid accounting balance.');
        }

        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');

        return (ltrim($whole, '0') ?: '0').'.'.str_pad(substr($fraction, 0, 4), 4, '0');
    }
}
