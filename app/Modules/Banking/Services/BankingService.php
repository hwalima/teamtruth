<?php

namespace App\Modules\Banking\Services;

use App\Models\User;
use App\Modules\Banking\Models\Bank;
use App\Modules\Banking\Models\BankAccount;
use App\Modules\Banking\Models\BankTransaction;
use App\Modules\Banking\Models\BankTransfer;
use App\Modules\Banking\Models\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Accounts, hand-entered lines and transfers between group companies. */
class BankingService
{
    public function __construct(private BankingAccess $access) {}

    public function createAccount(User $user, array $data): BankAccount
    {
        $this->assertCompany($user, (int) $data['company_id']);
        $bank = Bank::query()->firstOrCreate(['name' => trim($data['bank_name'])]);

        return BankAccount::query()->create([
            'bank_id' => $bank->id,
            'company_id' => $data['company_id'],
            'account_number' => filled($data['account_number'] ?? null) ? trim($data['account_number']) : $this->nextAccountNumber(),
            'account_name' => trim($data['account_name']),
            'currency' => strtoupper($data['currency'] ?? 'USD'),
            'opening_balance' => Money::decimal(Money::cents($data['opening_balance'] ?? 0)),
            'opening_date' => $data['opening_date'] ?? now()->toDateString(),
            'status' => 'active',
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    /** Names, status and notes. The opening balance stays as imported once lines exist. */
    public function updateAccount(User $user, BankAccount $account, array $data): BankAccount
    {
        $this->access->authorize($user, $account, 'erp.banking.manage');
        $hasLines = $account->transactions()->exists();
        $changes = [
            'account_name' => trim($data['account_name']),
            'status' => $data['status'],
            'notes' => $data['notes'] ?? null,
            'currency' => strtoupper($data['currency'] ?? $account->currency),
        ];
        if (! $hasLines) {
            $changes['opening_balance'] = Money::decimal(Money::cents($data['opening_balance'] ?? 0));
            $changes['opening_date'] = $data['opening_date'] ?? $account->opening_date;
        } elseif (array_key_exists('opening_balance', $data) && Money::cents($data['opening_balance']) !== Money::cents($account->opening_balance)) {
            throw ValidationException::withMessages(['opening_balance' => 'The opening balance cannot change once the account has lines: every balance on the statement depends on it.']);
        }
        $account->update($changes);

        return $account->refresh();
    }

    public function deleteAccount(User $user, BankAccount $account): void
    {
        $this->access->authorize($user, $account, 'erp.banking.manage');
        if ($account->transactions()->exists()) {
            throw ValidationException::withMessages(['account' => "Account {$account->account_number} has lines on it, so it cannot be deleted. Close it instead."]);
        }
        $account->delete();
    }

    public function recordTransaction(User $user, BankAccount $account, array $data): BankTransaction
    {
        $this->access->authorize($user, $account, 'erp.banking.manage');
        $amount = Money::cents($data['amount']);
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'Enter an amount above zero.']);
        }
        $isCredit = $data['direction'] === 'credit';

        return DB::transaction(fn () => BankTransaction::query()->create([
            'account_id' => $account->id,
            'transaction_date' => $data['transaction_date'],
            'sequence' => $account->nextSequence(),
            'type' => filled($data['type'] ?? null) ? trim($data['type']) : ($isCredit ? 'Cash Dep' : 'Cash Wdl'),
            'description' => $data['description'] ?? null,
            'reference' => $data['reference'] ?? null,
            'debit' => Money::decimal($isCredit ? 0 : $amount),
            'credit' => Money::decimal($isCredit ? $amount : 0),
            'created_by' => $user->id,
        ]));
    }

    /** Only lines entered here: imported lines go with their import, transfers with the transfer. */
    public function deleteTransaction(User $user, BankTransaction $line): void
    {
        $this->access->authorize($user, $line->account, 'erp.banking.manage');
        if (! $line->isManual()) {
            throw ValidationException::withMessages([
                'transaction' => $line->transfer_id
                    ? 'This line is part of a transfer. Delete the transfer to remove both sides.'
                    : 'Imported lines stay as the statement had them. Undo the import to remove them.',
            ]);
        }
        $line->delete();
    }

    public function transfer(User $user, array $data): BankTransfer
    {
        $from = BankAccount::query()->with('company:id,name')->findOrFail($data['from_account_id']);
        $to = BankAccount::query()->with('company:id,name')->findOrFail($data['to_account_id']);
        $this->access->authorize($user, $from, 'erp.banking.manage');
        $this->access->authorize($user, $to, 'erp.banking.manage');
        if ($from->is($to)) {
            throw ValidationException::withMessages(['to_account_id' => 'Choose a different account to transfer to.']);
        }
        if ($from->status !== 'active' || $to->status !== 'active') {
            throw ValidationException::withMessages(['from_account_id' => 'Both accounts must be active.']);
        }
        $amount = Money::cents($data['amount']);
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'Enter an amount above zero.']);
        }

        return DB::transaction(function () use ($user, $data, $from, $to, $amount) {
            $transfer = BankTransfer::query()->create([
                'from_account_id' => $from->id,
                'to_account_id' => $to->id,
                'transfer_date' => $data['transfer_date'],
                'amount' => Money::decimal($amount),
                'description' => $data['description'] ?? null,
                'reference' => $data['reference'] ?? null,
                'created_by' => $user->id,
            ]);
            $note = filled($data['description'] ?? null) ? ' · '.$data['description'] : '';

            foreach ([[$from, $to, 'debit', 'Transfer out', 'to'], [$to, $from, 'credit', 'Transfer in', 'from']] as [$account, $other, $side, $type, $word]) {
                BankTransaction::query()->create([
                    'account_id' => $account->id,
                    'transaction_date' => $data['transfer_date'],
                    'sequence' => $account->nextSequence(),
                    'type' => $type,
                    'description' => "Transfer {$word} {$other->company->name} ({$other->account_number}){$note}",
                    'reference' => $data['reference'] ?? null,
                    'debit' => Money::decimal($side === 'debit' ? $amount : 0),
                    'credit' => Money::decimal($side === 'credit' ? $amount : 0),
                    'transfer_id' => $transfer->id,
                    'created_by' => $user->id,
                ]);
            }

            return $transfer;
        });
    }

    public function deleteTransfer(User $user, BankTransfer $transfer): void
    {
        $this->access->authorize($user, $transfer->fromAccount, 'erp.banking.manage');
        $this->access->authorize($user, $transfer->toAccount, 'erp.banking.manage');
        DB::transaction(function () use ($transfer): void {
            $transfer->transactions()->delete();
            $transfer->delete();
        });
    }

    public function nextAccountNumber(): string
    {
        $max = BankAccount::query()->pluck('account_number')->filter(fn ($n) => ctype_digit((string) $n))->map(fn ($n) => (int) $n)->max();

        return (string) (($max ?? 100100) + 1);
    }

    private function assertCompany(User $user, int $companyId): void
    {
        if (! in_array($companyId, $this->access->companyIds($user, 'erp.banking.manage'), true)) {
            throw ValidationException::withMessages(['company_id' => 'Choose a company you manage banking for.']);
        }
    }
}
