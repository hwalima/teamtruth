<?php

namespace App\Modules\Banking\Models;

use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An account a bank holds for one company. Not scoped to the active company:
 * banking spans the group, and BankingAccess decides who sees which account.
 */
class BankAccount extends Model
{
    protected $table = 'banking_accounts';

    protected $fillable = [
        'bank_id', 'company_id', 'account_number', 'source_account_number', 'account_name',
        'currency', 'opening_balance', 'opening_date', 'status', 'notes', 'import_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'opening_date' => 'date',
        ];
    }

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class, 'bank_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BankTransaction::class, 'account_id');
    }

    public function nextSequence(): int
    {
        return (int) $this->transactions()->max('sequence') + 1;
    }

    /** Opening balance plus every credit less every debit, in cents. */
    public function balanceCents(): int
    {
        $totals = $this->transactions()->selectRaw('COALESCE(SUM(credit), 0) AS credits, COALESCE(SUM(debit), 0) AS debits')->first();

        return Money::cents($this->opening_balance) + Money::cents($totals->credits) - Money::cents($totals->debits);
    }
}
