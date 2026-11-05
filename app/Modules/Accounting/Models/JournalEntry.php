<?php

namespace App\Modules\Accounting\Models;

use App\Models\User;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use LogicException;

class JournalEntry extends Model
{
    use BelongsToCompany;

    protected $table = 'accounting_journal_entries';

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Posted journal entries are immutable; create a reversing entry instead.'));
        static::deleting(fn () => throw new LogicException('Posted journal entries cannot be deleted; create a reversing entry instead.'));
    }

    protected $fillable = [
        'company_id',
        'journal_id',
        'fiscal_period_id',
        'reversal_of_id',
        'document_number',
        'entry_date',
        'currency_code',
        'exchange_rate',
        'description',
        'reference',
        'debit_total',
        'credit_total',
        'status',
        'created_by',
        'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'exchange_rate' => 'decimal:10',
            'debit_total' => 'decimal:4',
            'credit_total' => 'decimal:4',
            'posted_at' => 'datetime',
        ];
    }

    public function journal(): BelongsTo
    {
        return $this->belongsTo(AccountingJournal::class, 'journal_id');
    }

    public function fiscalPeriod(): BelongsTo
    {
        return $this->belongsTo(FiscalPeriod::class, 'fiscal_period_id');
    }

    public function reversalOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reversal_of_id');
    }

    public function reversal(): HasOne
    {
        return $this->hasOne(self::class, 'reversal_of_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(JournalEntryLine::class, 'journal_entry_id')->orderBy('sort_order');
    }
}
