<?php

namespace App\Modules\Invoicing\Models;

use App\Models\Currency;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $table = 'inv_customers';

    protected $fillable = [
        'company_id',
        'code',
        'name',
        'tax_no',
        'email',
        'phone',
        'billing_address',
        'shipping_address',
        'payment_term_id',
        'currency_code',
        'credit_limit',
        'is_active',
        'metadata',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'credit_limit' => 'decimal:4',
            'is_active' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function paymentTerm(): BelongsTo
    {
        return $this->belongsTo(PaymentTerm::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function creditNotes(): HasMany
    {
        return $this->hasMany(CreditNote::class);
    }

    public function recurringInvoices(): HasMany
    {
        return $this->hasMany(RecurringInvoice::class);
    }

    public function getCurrency(): ?Currency
    {
        return Currency::where('code', $this->currency_code)->first();
    }

    public function getOutstandingBalance(): string
    {
        $invoiced = $this->invoices()
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->sum('balance_due');

        $credited = $this->creditNotes()
            ->where('status', 'issued')
            ->sum('balance_due');

        return (string) max('0.0000', bcsub((string) $invoiced, (string) $credited, 4));
    }

    public function isOverCreditLimit(): bool
    {
        if ($this->credit_limit <= 0) {
            return false;
        }

        return bccomp($this->getOutstandingBalance(), (string) $this->credit_limit, 4) > 0;
    }
}