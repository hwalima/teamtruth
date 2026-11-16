<?php

namespace App\Modules\Invoicing\Models;

use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class InvoicePayment extends Model
{
    use BelongsToCompany;

    protected $table = 'inv_invoice_payments';

    protected $fillable = [
        'company_id',
        'invoice_id',
        'credit_note_id',
        'payment_date',
        'currency_code',
        'exchange_rate',
        'amount',
        'base_amount',
        'payment_method',
        'reference',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'exchange_rate' => 'decimal:10',
            'amount' => 'decimal:4',
            'base_amount' => 'decimal:4',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function creditNote(): BelongsTo
    {
        return $this->belongsTo(CreditNote::class);
    }

    /**
     * The ledger entry posted for this payment (created via the InvoicePaymentRecorded event).
     * Null for credit-note allocations, which move no cash.
     */
    public function journalEntry(): MorphOne
    {
        return $this->morphOne(JournalEntry::class, 'source');
    }

    public function isCreditNotePayment(): bool
    {
        return $this->credit_note_id !== null;
    }
}