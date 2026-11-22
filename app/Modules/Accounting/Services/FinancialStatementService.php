<?php

namespace App\Modules\Accounting\Services;

use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Core\Models\Company;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * The balance sheet (from the ledger) and the aged receivables and payables
 * (from open customer invoices and vendor bills).
 *
 * Amounts are decimal strings with four places, worked out with bcmath.
 */
class FinancialStatementService
{
    private const SCALE = 4;

    /** Ageing buckets: key => [label, first day overdue, last day overdue (null = no limit)]. */
    public const BUCKETS = [
        'current' => ['Not yet due', null, 0],
        'days_1_30' => ['1–30 days', 1, 30],
        'days_31_60' => ['31–60 days', 31, 60],
        'days_61_90' => ['61–90 days', 61, 90],
        'over_90' => ['Over 90 days', 91, null],
    ];

    /** Invoice states that are real, issued debts. */
    private const ISSUED_INVOICES = ['sent', 'paid', 'overdue', 'partial_paid'];

    /** Bill states once a bill is approved (it stays "approved" after it is posted and paid). */
    private const APPROVED_BILLS = ['approved', 'partially_paid', 'paid'];

    /**
     * @return array{
     *     asOf: string,
     *     yearStart: string,
     *     assets: list<array{accountId: int|null, code: string, name: string, amount: string}>,
     *     liabilities: list<array{accountId: int|null, code: string, name: string, amount: string}>,
     *     equity: list<array{accountId: int|null, code: string, name: string, amount: string}>,
     *     totalAssets: string,
     *     totalLiabilities: string,
     *     totalEquity: string,
     *     totalLiabilitiesAndEquity: string,
     *     difference: string
     * }
     */
    public function balanceSheet(Company $company, string $asOf): array
    {
        $yearStart = $this->yearStart($company, $asOf);

        $balances = $this->postedLines($company)
            ->where('entries.entry_date', '<=', $asOf)
            ->whereIn('accounts.account_type', ['asset', 'liability', 'equity'])
            ->groupBy('accounts.id', 'accounts.code', 'accounts.name', 'accounts.account_type')
            ->orderBy('accounts.code')
            ->select(['accounts.id', 'accounts.code', 'accounts.name', 'accounts.account_type'])
            ->selectRaw('COALESCE(SUM(lines.debit), 0) as debit_total, COALESCE(SUM(lines.credit), 0) as credit_total')
            ->get();

        $sections = ['asset' => [], 'liability' => [], 'equity' => []];
        foreach ($balances as $row) {
            $debit = self::dec($row->debit_total);
            $credit = self::dec($row->credit_total);
            // Assets are debit balances; liabilities and equity are credit balances.
            $amount = $row->account_type === 'asset' ? bcsub($debit, $credit, self::SCALE) : bcsub($credit, $debit, self::SCALE);
            if (bccomp($amount, '0', self::SCALE) === 0) {
                continue;
            }
            $sections[$row->account_type][] = ['accountId' => (int) $row->id, 'code' => $row->code, 'name' => $row->name, 'amount' => $amount];
        }

        // Income less expenses has not been closed into equity yet, so it is shown there in two lines.
        $earlier = $this->profit($company, null, CarbonImmutable::parse($yearStart)->subDay()->toDateString());
        $thisYear = $this->profit($company, $yearStart, $asOf);
        if (bccomp($earlier, '0', self::SCALE) !== 0) {
            $sections['equity'][] = ['accountId' => null, 'code' => '', 'name' => 'Retained earnings (earlier years)', 'amount' => $earlier];
        }
        if (bccomp($thisYear, '0', self::SCALE) !== 0) {
            $sections['equity'][] = ['accountId' => null, 'code' => '', 'name' => bccomp($thisYear, '0', self::SCALE) < 0 ? 'Loss for the year to date' : 'Profit for the year to date', 'amount' => $thisYear];
        }

        $totalAssets = self::sum(array_column($sections['asset'], 'amount'));
        $totalLiabilities = self::sum(array_column($sections['liability'], 'amount'));
        $totalEquity = self::sum(array_column($sections['equity'], 'amount'));
        $liabilitiesAndEquity = bcadd($totalLiabilities, $totalEquity, self::SCALE);

        return [
            'asOf' => $asOf,
            'yearStart' => $yearStart,
            'assets' => $sections['asset'],
            'liabilities' => $sections['liability'],
            'equity' => $sections['equity'],
            'totalAssets' => $totalAssets,
            'totalLiabilities' => $totalLiabilities,
            'totalEquity' => $totalEquity,
            'totalLiabilitiesAndEquity' => $liabilitiesAndEquity,
            'difference' => bcsub($totalAssets, $liabilitiesAndEquity, self::SCALE),
        ];
    }

    /** What customers owed on the given date, by how long it has been overdue. */
    public function agedReceivables(Company $company, string $asOf): array
    {
        $paid = DB::table('inv_invoice_payments')
            ->where('company_id', $company->id)
            ->where('payment_date', '<=', $asOf)
            ->groupBy('invoice_id')
            ->select('invoice_id')
            ->selectRaw('SUM(amount) as paid');

        $documents = DB::table('inv_invoices as invoices')
            ->join('inv_customers as customers', 'customers.id', '=', 'invoices.customer_id')
            ->leftJoinSub($paid, 'paid', 'paid.invoice_id', '=', 'invoices.id')
            ->where('invoices.company_id', $company->id)
            ->where(fn ($query) => $query->where('invoices.type', 'invoice')->orWhereNull('invoices.type'))
            ->whereIn('invoices.status', self::ISSUED_INVOICES)
            ->where('invoices.invoice_date', '<=', $asOf)
            ->get([
                'invoices.id', 'invoices.document_number', 'invoices.invoice_date as document_date', 'invoices.due_date',
                'invoices.currency_code', 'invoices.total_amount', 'paid.paid',
                'customers.id as partner_id', 'customers.name as partner_name',
            ]);

        $applied = DB::table('inv_invoice_payments')
            ->where('company_id', $company->id)
            ->whereNotNull('credit_note_id')
            ->where('payment_date', '<=', $asOf)
            ->groupBy('credit_note_id')
            ->select('credit_note_id')
            ->selectRaw('SUM(amount) as applied');

        $credits = DB::table('inv_credit_notes as notes')
            ->join('inv_customers as customers', 'customers.id', '=', 'notes.customer_id')
            ->leftJoinSub($applied, 'applied', 'applied.credit_note_id', '=', 'notes.id')
            ->where('notes.company_id', $company->id)
            ->whereIn('notes.status', ['issued', 'applied'])
            ->where('notes.credit_note_date', '<=', $asOf)
            ->get(['notes.currency_code', 'notes.total_amount', 'applied.applied', 'customers.id as partner_id', 'customers.name as partner_name']);

        return $this->aged($asOf, $documents, $credits);
    }

    /** What was owed to vendors on the given date, by how long it has been overdue. */
    public function agedPayables(Company $company, string $asOf): array
    {
        $paid = DB::table('purchase_payment_allocations as allocations')
            ->join('purchase_payments as payments', 'payments.id', '=', 'allocations.purchase_payment_id')
            ->where('payments.company_id', $company->id)
            ->where('payments.status', 'posted')
            ->where('payments.payment_date', '<=', $asOf)
            ->groupBy('allocations.purchase_bill_id')
            ->select('allocations.purchase_bill_id')
            ->selectRaw('SUM(allocations.amount) as paid');

        $documents = DB::table('purchase_bills as bills')
            ->join('purchase_vendors as vendors', 'vendors.id', '=', 'bills.vendor_id')
            ->leftJoinSub($paid, 'paid', 'paid.purchase_bill_id', '=', 'bills.id')
            ->where('bills.company_id', $company->id)
            ->whereIn('bills.status', self::APPROVED_BILLS)
            ->where('bills.bill_date', '<=', $asOf)
            ->get([
                'bills.id', 'bills.document_number', 'bills.bill_date as document_date', 'bills.due_date',
                'bills.currency_code', 'bills.total_amount', 'paid.paid',
                'vendors.id as partner_id', 'vendors.name as partner_name',
            ]);

        return $this->aged($asOf, $documents, collect());
    }

    /**
     * @param  iterable<object>  $documents  open documents with total_amount and paid
     * @param  iterable<object>  $credits  unused credits with total_amount and applied
     * @return array{
     *     asOf: string,
     *     buckets: array<string, string>,
     *     partners: list<array<string, mixed>>,
     *     totals: list<array<string, mixed>>
     * }
     */
    private function aged(string $asOf, iterable $documents, iterable $credits): array
    {
        $date = CarbonImmutable::parse($asOf);
        $partners = [];
        $row = function (object $source) use (&$partners): string {
            $key = $source->partner_id.'|'.$source->currency_code;
            $partners[$key] ??= [
                'partnerId' => (int) $source->partner_id,
                'partner' => $source->partner_name,
                'currency' => $source->currency_code,
                ...array_fill_keys(array_keys(self::BUCKETS), '0.0000'),
                'credits' => '0.0000',
                'total' => '0.0000',
                'documents' => [],
            ];

            return $key;
        };

        foreach ($documents as $document) {
            $outstanding = bcsub(self::dec($document->total_amount), self::dec($document->paid), self::SCALE);
            if (bccomp($outstanding, '0', self::SCALE) <= 0) {
                continue;
            }
            $due = CarbonImmutable::parse($document->due_date ?? $document->document_date);
            $daysOverdue = $due->lessThan($date) ? (int) $due->diffInDays($date) : 0;
            $bucket = self::bucketFor($daysOverdue);

            $key = $row($document);
            $partners[$key][$bucket] = bcadd($partners[$key][$bucket], $outstanding, self::SCALE);
            $partners[$key]['total'] = bcadd($partners[$key]['total'], $outstanding, self::SCALE);
            $partners[$key]['documents'][] = [
                'id' => (int) $document->id,
                'number' => $document->document_number,
                'date' => CarbonImmutable::parse($document->document_date)->toDateString(),
                'dueDate' => $document->due_date ? CarbonImmutable::parse($document->due_date)->toDateString() : null,
                'daysOverdue' => $daysOverdue,
                'bucket' => $bucket,
                'outstanding' => $outstanding,
            ];
        }

        foreach ($credits as $credit) {
            $unused = bcsub(self::dec($credit->total_amount), self::dec($credit->applied), self::SCALE);
            if (bccomp($unused, '0', self::SCALE) <= 0) {
                continue;
            }
            $key = $row($credit);
            $partners[$key]['credits'] = bcsub($partners[$key]['credits'], $unused, self::SCALE);
            $partners[$key]['total'] = bcsub($partners[$key]['total'], $unused, self::SCALE);
        }

        $partners = array_values(array_filter($partners, fn (array $partner) => bccomp($partner['total'], '0', self::SCALE) !== 0 || $partner['documents'] !== []));
        usort($partners, fn (array $a, array $b) => [$a['currency'], -(float) $a['total'], $a['partner']] <=> [$b['currency'], -(float) $b['total'], $b['partner']]);
        foreach ($partners as &$partner) {
            usort($partner['documents'], fn (array $a, array $b) => $b['daysOverdue'] <=> $a['daysOverdue']);
        }
        unset($partner);

        $totals = [];
        foreach ($partners as $partner) {
            $totals[$partner['currency']] ??= ['currency' => $partner['currency'], ...array_fill_keys([...array_keys(self::BUCKETS), 'credits', 'total'], '0.0000'), 'partners' => 0];
            foreach ([...array_keys(self::BUCKETS), 'credits', 'total'] as $column) {
                $totals[$partner['currency']][$column] = bcadd($totals[$partner['currency']][$column], $partner[$column], self::SCALE);
            }
            $totals[$partner['currency']]['partners']++;
        }
        ksort($totals);

        return [
            'asOf' => $asOf,
            'buckets' => array_map(fn (array $bucket) => $bucket[0], self::BUCKETS),
            'partners' => $partners,
            'totals' => array_values($totals),
        ];
    }

    private static function bucketFor(int $daysOverdue): string
    {
        foreach (self::BUCKETS as $key => [, $from, $to]) {
            if (($from === null || $daysOverdue >= $from) && ($to === null || $daysOverdue <= $to)) {
                return $key;
            }
        }

        return 'over_90';
    }

    /** Income less expenses between two dates (either end may be open). */
    private function profit(Company $company, ?string $from, string $to): string
    {
        $row = $this->postedLines($company)
            ->when($from !== null, fn ($query) => $query->where('entries.entry_date', '>=', $from))
            ->where('entries.entry_date', '<=', $to)
            ->whereIn('accounts.account_type', ['income', 'expense'])
            ->selectRaw('COALESCE(SUM(lines.credit), 0) - COALESCE(SUM(lines.debit), 0) as profit')
            ->first();

        return self::dec($row?->profit);
    }

    /** The first day of the financial year that contains the date. */
    private function yearStart(Company $company, string $asOf): string
    {
        $year = FiscalYear::query()
            ->where('company_id', $company->id)
            ->whereDate('starts_on', '<=', $asOf)
            ->whereDate('ends_on', '>=', $asOf)
            ->orderByDesc('starts_on')
            ->first();

        return $year?->starts_on?->toDateString() ?? CarbonImmutable::parse($asOf)->startOfYear()->toDateString();
    }

    private function postedLines(Company $company)
    {
        return DB::table('accounting_journal_entry_lines as lines')
            ->join('accounting_journal_entries as entries', 'entries.id', '=', 'lines.journal_entry_id')
            ->join('accounting_accounts as accounts', 'accounts.id', '=', 'lines.account_id')
            ->where('lines.company_id', $company->id)
            ->where('entries.company_id', $company->id)
            ->where('entries.status', 'posted')
            ->where('accounts.is_group', false);
    }

    /** @param  list<string>  $amounts */
    private static function sum(array $amounts): string
    {
        return array_reduce($amounts, fn (string $total, string $amount) => bcadd($total, $amount, self::SCALE), '0.0000');
    }

    private static function dec(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '0.0000';
        }

        return bcadd(is_float($value) ? number_format($value, self::SCALE, '.', '') : (string) $value, '0', self::SCALE);
    }
}
