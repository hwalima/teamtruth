<?php

namespace App\Modules\Accounting\Services;

use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Core\Models\Company;
use Illuminate\Validation\ValidationException;

/**
 * Resolves the default ledger accounts and journals used when other modules
 * (invoicing, purchase, ...) post documents into the general ledger.
 *
 * Defaults follow the group chart of accounts (1xxx assets, 2xxx liabilities,
 * 4xxx income) but fall back to sensible account-type/name matches so a
 * subsidiary with a different chart still works.
 */
class LedgerAccountResolver
{
    public function receivableAccount(Company $company): AccountingAccount
    {
        return $this->findAccount($company, ['code' => '1200'])
            ?? $this->findAccount($company, ['account_type' => 'asset', 'allow_reconciliation' => true])
            ?? throw ValidationException::withMessages([
                'account' => __('No accounts-receivable account is configured for this company.'),
            ]);
    }

    public function payableAccount(Company $company): AccountingAccount
    {
        return $this->findAccount($company, ['code' => '2000'])
            ?? $this->findAccount($company, ['account_type' => 'liability', 'name' => '%payable%'])
            ?? throw ValidationException::withMessages([
                'account' => __('No accounts-payable account is configured for this company.'),
            ]);
    }

    public function revenueAccount(Company $company): AccountingAccount
    {
        return $this->findAccount($company, ['code' => '4000'])
            ?? $this->findAccount($company, ['account_type' => 'income'])
            ?? $this->findAccount($company, ['account_type' => 'revenue'])
            ?? throw ValidationException::withMessages([
                'account' => __('No default revenue account is configured for this company.'),
            ]);
    }

    public function taxPayableAccount(Company $company): AccountingAccount
    {
        return $this->findAccount($company, ['code' => '2200'])
            ?? $this->findAccount($company, ['account_type' => 'liability', 'name' => '%tax%'])
            ?? $this->findAccount($company, ['account_type' => 'liability', 'name' => '%vat%'])
            ?? throw ValidationException::withMessages([
                'account' => __('No tax-payable account is configured for this company.'),
            ]);
    }

    /**
     * Cash/bank account debited when a customer payment is posted.
     */
    public function clearingAccount(Company $company, ?string $paymentMethod): AccountingAccount
    {
        $method = strtolower((string) $paymentMethod);

        if ($method === 'cash') {
            return $this->findAccount($company, ['code' => '1000'])
                ?? $this->findAccount($company, ['account_type' => 'asset', 'name' => '%cash%'])
                ?? throw ValidationException::withMessages([
                    'account' => __('No cash account is configured for this company.'),
                ]);
        }

        $bank = $this->findAccount($company, ['code' => '1010'])
            ?? $this->findAccount($company, ['account_type' => 'asset', 'name' => '%bank%'])
            ?? $this->findAccount($company, ['code' => '1000']);

        if ($bank !== null) {
            return $bank;
        }

        // Fall back to any non-reconciliation asset account.
        return AccountingAccount::query()
            ->where('company_id', $company->getKey())
            ->where('account_type', 'asset')
            ->where('allow_reconciliation', false)
            ->where('is_active', true)
            ->where('is_group', false)
            ->orderBy('code')
            ->first()
            ?? throw ValidationException::withMessages([
                'account' => __('No bank or cash account is configured for this company.'),
            ]);
    }

    public function salesJournal(Company $company): AccountingJournal
    {
        return $this->journal($company, 'sales', 'No active sales journal is configured for this company.');
    }

    public function paymentJournal(Company $company, ?string $paymentMethod): AccountingJournal
    {
        $method = strtolower((string) $paymentMethod);
        $preferred = $method === 'cash' ? ['cash', 'bank'] : ['bank', 'cash', 'general'];

        foreach ($preferred as $type) {
            if ($journal = $this->findJournal($company, $type)) {
                return $journal;
            }
        }

        return $this->findJournal($company, null)
            ?? throw ValidationException::withMessages([
                'journal' => __('No active journal is configured for this company.'),
            ]);
    }

    private function journal(Company $company, string $type, string $message): AccountingJournal
    {
        return $this->findJournal($company, $type)
            ?? throw ValidationException::withMessages(['journal' => __($message)]);
    }

    private function findJournal(Company $company, ?string $type): ?AccountingJournal
    {
        $query = AccountingJournal::query()
            ->where('company_id', $company->getKey())
            ->where('is_active', true)
            ->orderBy('code');

        if ($type !== null) {
            $query->where('journal_type', $type);
        }

        return $query->first();
    }

    private function findAccount(Company $company, array $wheres): ?AccountingAccount
    {
        $query = AccountingAccount::query()
            ->where('company_id', $company->getKey())
            ->where('is_active', true)
            ->where('is_group', false);

        foreach ($wheres as $column => $value) {
            if (str_ends_with($column, 'name') && is_string($value) && str_contains($value, '%')) {
                $query->where($column, 'like', $value);
            } else {
                $query->where($column, $value);
            }
        }

        return $query->orderBy('code')->first();
    }
}
