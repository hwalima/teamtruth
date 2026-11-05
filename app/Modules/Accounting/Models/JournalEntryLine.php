<?php

namespace App\Modules\Accounting\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class JournalEntryLine extends Model
{
    use BelongsToCompany;

    protected $table = 'accounting_journal_entry_lines';

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Lines on posted journal entries are immutable.'));
        static::deleting(fn () => throw new LogicException('Lines on posted journal entries cannot be deleted.'));
    }

    protected $fillable = [
        'company_id',
        'journal_entry_id',
        'account_id',
        'description',
        'currency_debit',
        'currency_credit',
        'debit',
        'credit',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'currency_debit' => 'decimal:4',
            'currency_credit' => 'decimal:4',
            'debit' => 'decimal:4',
            'credit' => 'decimal:4',
            'sort_order' => 'integer',
        ];
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class, 'account_id');
    }
}
