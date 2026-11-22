<?php

namespace App\Modules\Banking\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One statement line. Imported lines keep their source sheet, row and printed balance. */
class BankTransaction extends Model
{
    protected $table = 'banking_transactions';

    protected $fillable = [
        'account_id', 'transaction_date', 'sequence', 'type', 'description', 'reference',
        'debit', 'credit', 'stated_balance', 'source_sheet', 'source_row', 'import_id', 'transfer_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'sequence' => 'integer',
            'debit' => 'decimal:2',
            'credit' => 'decimal:2',
            'stated_balance' => 'decimal:2',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'account_id');
    }

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(BankTransfer::class, 'transfer_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Entered by hand here, not imported and not part of a transfer. */
    public function isManual(): bool
    {
        return $this->import_id === null && $this->transfer_id === null;
    }
}
