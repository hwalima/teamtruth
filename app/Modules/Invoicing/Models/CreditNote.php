<?php

namespace App\Modules\Invoicing\Models;

use App\Models\Currency;
use App\Modules\Accounting\Models\AccountingJournal;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class CreditNote extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $table = 'inv_credit_notes';

    protected $fillable = [
        'company_id',
        'document_number',
        'customer_id',
        'original_invoice_id',
        'status',
        'credit_note_date',
        'currency_code',
        'exchange_rate',
        'subtotal',
        'tax_amount',
        'total_amount',
        'applied_amount',
        'balance_due',
        'reason',
        'notes',
        'journal_id',
        'fiscal_period_id',
        'issued_at',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'credit_note_date' => 'date',
            'exchange_rate' => 'decimal:10',
            'subtotal' => 'decimal:4',
            'tax_amount' => 'decimal:4',
            'total_amount' => 'decimal:4',
            'applied_amount' => 'decimal:4',
            'balance_due' => 'decimal:4',
            'issued_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function originalInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'original_invoice_id');
    }

    public function journal(): BelongsTo
    {
        return $this->belongsTo(AccountingJournal::class);
    }

    public function fiscalPeriod(): BelongsTo
    {
        return $this->belongsTo(FiscalPeriod::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(CreditNoteLine::class)->orderBy('sort_order');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class, 'credit_note_id');
    }

    public function fiscalDocuments(): MorphMany
    {
        return $this->morphMany(FiscalDocument::class, 'document');
    }

    /**
     * The ledger entry posted for this credit note (created via the CreditNoteIssued event).
     */
    public function journalEntry(): MorphOne
    {
        return $this->morphOne(JournalEntry::class, 'source');
    }

    public function getCurrency(): ?Currency
    {
        return Currency::where('code', $this->currency_code)->first();
    }

    public function isPosted(): bool
    {
        return $this->journalEntry()->exists() && $this->journalEntry->status === 'posted';
    }

    public function canBeEdited(): bool
    {
        return $this->status === 'draft';
    }

    public function canBeIssued(): bool
    {
        return $this->status === 'draft';
    }

    public function canBeCancelled(): bool
    {
        return in_array($this->status, ['draft', 'issued']) && ! $this->isPosted();
    }

    public function getStatusColor(): string
    {
        return match ($this->status) {
            'draft' => 'gray',
            'issued' => 'blue',
            'applied' => 'green',
            'cancelled' => 'gray',
            default => 'gray',
        };
    }

    public function getStatusLabel(): string
    {
        return match ($this->status) {
            'draft' => 'Draft',
            'issued' => 'Issued',
            'applied' => 'Applied',
            'cancelled' => 'Cancelled',
            default => ucfirst($this->status),
        };
    }

    public function recalculateTotals(): self
    {
        $subtotal = '0.0000';
        $taxAmount = '0.0000';

        foreach ($this->lines as $line) {
            // line_total is gross (net + tax); the subtotal is net of tax.
            $subtotal = bcadd($subtotal, bcsub($line->line_total, $line->tax_amount, 4), 4);
            $taxAmount = bcadd($taxAmount, $line->tax_amount, 4);
        }

        $totalAmount = bcadd($subtotal, $taxAmount, 4);
        $balanceDue = bcsub($totalAmount, $this->applied_amount, 4);

        $this->subtotal = $subtotal;
        $this->tax_amount = $taxAmount;
        $this->total_amount = $totalAmount;
        $this->balance_due = max('0.0000', $balanceDue);

        return $this;
    }
}