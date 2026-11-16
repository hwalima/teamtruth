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
use Illuminate\Support\Str;

class Invoice extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $table = 'inv_invoices';

    protected $fillable = [
        'company_id',
        'document_number',
        'customer_id',
        'status',
        'type',
        'invoice_date',
        'due_date',
        'currency_code',
        'exchange_rate',
        'subtotal',
        'tax_amount',
        'discount_amount',
        'total_amount',
        'paid_amount',
        'balance_due',
        'journal_id',
        'fiscal_period_id',
        'notes',
        'terms',
        'footer_notes',
        'sent_at',
        'paid_at',
        'payment_token',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
            'due_date' => 'date',
            'exchange_rate' => 'decimal:10',
            'subtotal' => 'decimal:4',
            'tax_amount' => 'decimal:4',
            'discount_amount' => 'decimal:4',
            'total_amount' => 'decimal:4',
            'paid_amount' => 'decimal:4',
            'balance_due' => 'decimal:4',
            'sent_at' => 'datetime',
            'paid_at' => 'datetime',
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
        return $this->hasMany(InvoiceLine::class)->orderBy('sort_order');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class);
    }

    public function creditNotes(): HasMany
    {
        return $this->hasMany(CreditNote::class, 'original_invoice_id');
    }

    public function fiscalDocuments(): MorphMany
    {
        return $this->morphMany(FiscalDocument::class, 'document');
    }

    public function notifications(): MorphMany
    {
        return $this->morphMany(\Illuminate\Notifications\DatabaseNotification::class, 'notifiable');
    }

    /**
     * The ledger entry posted for this invoice (created via the InvoicePosted event).
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
        return in_array($this->status, ['draft', 'proforma']);
    }

    public function canBeSent(): bool
    {
        return $this->status === 'draft';
    }

    public function canBePosted(): bool
    {
        return $this->status === 'sent' && ! $this->isPosted();
    }

    public function canBeCancelled(): bool
    {
        return in_array($this->status, ['draft', 'sent']) && ! $this->isPosted();
    }

    public function isOverdue(): bool
    {
        if (! $this->due_date) {
            return false;
        }

        return $this->status !== 'paid'
            && $this->status !== 'cancelled'
            && \Carbon\CarbonImmutable::parse($this->due_date)->isPast();
    }

    public function getStatusColor(): string
    {
        return match ($this->status) {
            'draft' => 'gray',
            'proforma' => 'blue',
            'sent' => 'yellow',
            'partial_paid' => 'orange',
            'paid' => 'green',
            'overdue' => 'red',
            'cancelled' => 'gray',
            default => 'gray',
        };
    }

    public function getStatusLabel(): string
    {
        return match ($this->status) {
            'draft' => 'Draft',
            'proforma' => 'Proforma',
            'sent' => 'Sent',
            'partial_paid' => 'Partially Paid',
            'paid' => 'Paid',
            'overdue' => 'Overdue',
            'cancelled' => 'Cancelled',
            default => ucfirst($this->status),
        };
    }

    public function recalculateTotals(): self
    {
        $subtotal = '0.0000';
        $taxAmount = '0.0000';
        $discountAmount = '0.0000';

        foreach ($this->lines as $line) {
            // line_total is gross (net + tax); the subtotal is net of tax.
            $subtotal = bcadd($subtotal, bcsub($line->line_total, $line->tax_amount, 4), 4);
            $taxAmount = bcadd($taxAmount, $line->tax_amount, 4);
            $discountAmount = bcadd($discountAmount, $line->discount_amount, 4);
        }

        $totalAmount = bcadd($subtotal, $taxAmount, 4);
        $balanceDue = bcsub($totalAmount, $this->paid_amount, 4);

        $this->subtotal = $subtotal;
        $this->tax_amount = $taxAmount;
        $this->discount_amount = $discountAmount;
        $this->total_amount = $totalAmount;
        $this->balance_due = max('0.0000', $balanceDue);

        return $this;
    }

    /**
     * Get or generate a secure payment token for public payment links.
     */
    public function getPaymentToken(): string
    {
        if (! $this->payment_token) {
            $this->payment_token = Str::random(64);
            $this->saveQuietly();
        }

        return $this->payment_token;
    }

    /**
     * Regenerate the payment token.
     */
    public function regeneratePaymentToken(): string
    {
        $this->payment_token = Str::random(64);
        $this->save();

        return $this->payment_token;
    }
}