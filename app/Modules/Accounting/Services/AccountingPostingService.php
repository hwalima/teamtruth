<?php

namespace App\Modules\Accounting\Services;

use App\Models\Currency;
use App\Models\User;
use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalEntryLine;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Core\Services\ExchangeRateService;
use App\Modules\Core\Services\SequenceService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AccountingPostingService
{
    public function reverseEntry(JournalEntry $originalEntry, User $actor, string $reversalDate): JournalEntry
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $originalEntry, $actor, $reversalDate): JournalEntry {
            $originalEntry = JournalEntry::query()->lockForUpdate()->with('lines')->findOrFail($originalEntry->id);
            if ($originalEntry->reversal_of_id !== null) {
                throw ValidationException::withMessages(['entry' => __('A reversal entry cannot itself be reversed.')]);
            }
            if ($originalEntry->status !== 'posted') {
                throw ValidationException::withMessages(['entry' => __('Only posted journal entries can be reversed.')]);
            }
            if ($originalEntry->reversal()->exists()) {
                throw ValidationException::withMessages(['entry' => __('This journal entry has already been reversed.')]);
            }

            $entryDate = CarbonImmutable::parse($reversalDate)->startOfDay();
            $period = FiscalPeriod::query()
                ->whereDate('starts_on', '<=', $entryDate->toDateString())
                ->whereDate('ends_on', '>=', $entryDate->toDateString())
                ->lockForUpdate()
                ->first();
            if (! $period || $period->status !== 'open') {
                throw ValidationException::withMessages([
                    'reversal_date' => __('The reversal date must fall within an open accounting period.'),
                ]);
            }

            $reversal = JournalEntry::query()->create([
                'company_id' => $company->id,
                'journal_id' => $originalEntry->journal_id,
                'fiscal_period_id' => $period->id,
                'reversal_of_id' => $originalEntry->id,
                'document_number' => app(SequenceService::class)->next($company, 'journal_entry'),
                'entry_date' => $entryDate->toDateString(),
                'currency_code' => $originalEntry->currency_code,
                'exchange_rate' => $originalEntry->exchange_rate,
                'description' => 'Reversal: '.$originalEntry->description,
                'reference' => $originalEntry->document_number,
                'debit_total' => $originalEntry->credit_total,
                'credit_total' => $originalEntry->debit_total,
                'status' => 'posted',
                'created_by' => $actor->id,
                'posted_at' => now(),
            ]);
            $reversal->lines()->createMany($originalEntry->lines->map(
                fn (JournalEntryLine $line): array => [
                    'company_id' => $company->id,
                    'account_id' => $line->account_id,
                    'description' => $line->description,
                    'currency_debit' => $line->currency_credit,
                    'currency_credit' => $line->currency_debit,
                    'debit' => $line->credit,
                    'credit' => $line->debit,
                    'sort_order' => $line->sort_order,
                ],
            )->all());
            app(AuditLogService::class)->record(
                $company,
                'accounting.journal_entry.reversed',
                $reversal,
                changes: ['after' => [
                    'reversal_of_id' => $originalEntry->id,
                    'reversal_of_document_number' => $originalEntry->document_number,
                    'document_number' => $reversal->document_number,
                    'entry_date' => $entryDate->toDateString(),
                ]],
                actor: $actor,
            );

            return $reversal->load(['journal', 'lines.account']);
        });
    }

    public function postManualEntry(User $actor, array $data, array $lines): JournalEntry
    {
        $company = app(CompanyContext::class)->requireActiveCompany();

        return DB::transaction(function () use ($company, $actor, $data, $lines): JournalEntry {
            $entryDate = CarbonImmutable::parse($data['entry_date'])->startOfDay();
            $journal = AccountingJournal::query()->lockForUpdate()->findOrFail($data['journal_id']);
            if (! $journal->is_active) {
                throw ValidationException::withMessages(['journal_id' => __('Select an active journal.')]);
            }

            $period = FiscalPeriod::query()
                ->whereDate('starts_on', '<=', $entryDate->toDateString())
                ->whereDate('ends_on', '>=', $entryDate->toDateString())
                ->lockForUpdate()
                ->first();
            if (! $period || $period->status !== 'open') {
                throw ValidationException::withMessages([
                    'entry_date' => __('The journal entry date must fall within an open accounting period.'),
                ]);
            }

            $currencyCode = strtoupper($data['currency_code']);
            if (! Currency::query()->where('code', $currencyCode)->exists()) {
                throw ValidationException::withMessages(['currency_code' => __('Select a valid currency.')]);
            }
            $exchangeRate = $currencyCode === strtoupper($company->default_currency)
                ? '1.0000000000'
                : app(ExchangeRateService::class)
                    ->rateFor($currencyCode, $company->default_currency, $entryDate)
                    ?->rate;
            if ($exchangeRate === null) {
                throw ValidationException::withMessages([
                    'currency_code' => __('No exchange rate is recorded for :currency to :base on or before the entry date.', [
                        'currency' => $currencyCode,
                        'base' => $company->default_currency,
                    ]),
                ]);
            }

            $accountIds = collect($lines)->pluck('account_id')->map(fn ($id): int => (int) $id);
            $accounts = AccountingAccount::query()
                ->whereIn('id', $accountIds)
                ->where('is_active', true)
                ->where('is_group', false)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            if ($accounts->count() !== $accountIds->unique()->count()) {
                throw ValidationException::withMessages(['lines' => __('Choose active posting accounts in this company.')]);
            }

            $debitTotal = '0.0000';
            $creditTotal = '0.0000';
            $postedLines = [];
            foreach (array_values($lines) as $index => $line) {
                $debit = self::normalizeAmount((string) $line['debit'], $index, 'debit');
                $credit = self::normalizeAmount((string) $line['credit'], $index, 'credit');
                if ((self::compare($debit, '0.0000') > 0) === (self::compare($credit, '0.0000') > 0)) {
                    throw ValidationException::withMessages([
                        "lines.{$index}.debit" => __('Enter either a debit or a credit for each journal line, but not both.'),
                    ]);
                }
                $baseDebit = self::multiplyRate($debit, (string) $exchangeRate);
                $baseCredit = self::multiplyRate($credit, (string) $exchangeRate);
                $debitTotal = self::add($debitTotal, $baseDebit);
                $creditTotal = self::add($creditTotal, $baseCredit);
                $postedLines[] = [
                    'company_id' => $company->id,
                    'account_id' => (int) $line['account_id'],
                    'description' => $line['description'] ?? null,
                    'currency_debit' => $debit,
                    'currency_credit' => $credit,
                    'debit' => $baseDebit,
                    'credit' => $baseCredit,
                    'sort_order' => $index + 1,
                ];
            }
            if (self::compare($debitTotal, '0.0000') <= 0 || self::compare($debitTotal, $creditTotal) !== 0) {
                throw ValidationException::withMessages([
                    'lines' => __('Journal entry debits and credits must be equal and greater than zero in the company currency.'),
                ]);
            }

            $entry = JournalEntry::query()->create([
                'company_id' => $company->id,
                'journal_id' => $journal->id,
                'fiscal_period_id' => $period->id,
                'document_number' => app(SequenceService::class)->next($company, 'journal_entry'),
                'entry_date' => $entryDate->toDateString(),
                'currency_code' => $currencyCode,
                'exchange_rate' => $exchangeRate,
                'description' => $data['description'],
                'reference' => $data['reference'] ?? null,
                'debit_total' => $debitTotal,
                'credit_total' => $creditTotal,
                'status' => 'posted',
                'created_by' => $actor->id,
                'posted_at' => now(),
            ]);
            $entry->lines()->createMany($postedLines);
            app(AuditLogService::class)->record(
                $company,
                'accounting.journal_entry.posted',
                $entry,
                changes: ['after' => [
                    'document_number' => $entry->document_number,
                    'journal_id' => $journal->id,
                    'entry_date' => $entryDate->toDateString(),
                    'currency_code' => $currencyCode,
                    'exchange_rate' => $exchangeRate,
                    'debit_total' => $debitTotal,
                    'credit_total' => $creditTotal,
                    'line_count' => count($postedLines),
                ]],
                actor: $actor,
            );

            return $entry->load(['journal', 'lines.account']);
        });
    }

    private static function normalizeAmount(string $amount, int $line, string $field): string
    {
        if (! preg_match('/^\d{1,16}(?:\.\d{1,4})?$/', $amount)) {
            throw ValidationException::withMessages([
                "lines.{$line}.{$field}" => __('Enter a non-negative amount with up to 16 whole and 4 decimal digits.'),
            ]);
        }

        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');

        return ltrim($whole, '0') !== '' ? ltrim($whole, '0').'.'.str_pad($fraction, 4, '0') : '0.'.str_pad($fraction, 4, '0');
    }

    private static function multiplyRate(string $amount, string $rate): string
    {
        $amountDigits = self::digits($amount, 4);
        $rateDigits = self::digits($rate, 10);
        $product = array_fill(0, strlen($amountDigits) + strlen($rateDigits), 0);
        for ($left = strlen($amountDigits) - 1; $left >= 0; $left--) {
            for ($right = strlen($rateDigits) - 1; $right >= 0; $right--) {
                $product[$left + $right + 1] += (int) $amountDigits[$left] * (int) $rateDigits[$right];
            }
        }
        for ($index = count($product) - 1; $index > 0; $index--) {
            $product[$index - 1] += intdiv($product[$index], 10);
            $product[$index] %= 10;
        }
        $raw = ltrim(implode('', $product), '0') ?: '0';
        $raw = str_pad($raw, 11, '0', STR_PAD_LEFT);
        $discarded = substr($raw, -10);
        $scaled = substr($raw, 0, -10);
        if ((int) $discarded[0] >= 5) {
            $scaled = self::increment($scaled);
        }
        $scaled = ltrim($scaled, '0') ?: '0';
        if (strlen($scaled) > 20) {
            throw ValidationException::withMessages(['lines' => __('The converted journal amount exceeds the supported account balance.')]);
        }
        $scaled = str_pad($scaled, 5, '0', STR_PAD_LEFT);

        return substr($scaled, 0, -4).'.'.substr($scaled, -4);
    }

    private static function digits(string $amount, int $scale): string
    {
        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');

        return ltrim($whole.str_pad(substr($fraction, 0, $scale), $scale, '0'), '0') ?: '0';
    }

    private static function add(string $left, string $right): string
    {
        $left = self::digits($left, 4);
        $right = self::digits($right, 4);
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
        if ($carry) {
            $sum = $carry.$sum;
        }
        if (strlen(ltrim($sum, '0') ?: '0') > 20) {
            throw ValidationException::withMessages(['lines' => __('The journal total exceeds the supported amount.')]);
        }

        return self::format($sum, 4);
    }

    private static function compare(string $left, string $right): int
    {
        $left = self::digits($left, 4);
        $right = self::digits($right, 4);
        $length = max(strlen($left), strlen($right));

        return strcmp(
            str_pad($left, $length, '0', STR_PAD_LEFT),
            str_pad($right, $length, '0', STR_PAD_LEFT),
        ) <=> 0;
    }

    private static function format(string $digits, int $scale): string
    {
        $digits = str_pad(ltrim($digits, '0') ?: '0', $scale + 1, '0', STR_PAD_LEFT);

        return substr($digits, 0, -$scale).'.'.substr($digits, -$scale);
    }

    private static function increment(string $digits): string
    {
        $digits = str_split($digits);
        for ($index = count($digits) - 1; $index >= 0; $index--) {
            if ($digits[$index] !== '9') {
                $digits[$index] = (string) ((int) $digits[$index] + 1);

                return implode('', $digits);
            }
            $digits[$index] = '0';
        }

        return '1'.implode('', $digits);
    }
}
