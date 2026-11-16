<?php

namespace App\Modules\Invoicing\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentTerm extends Model
{
    use BelongsToCompany;

    protected $table = 'inv_payment_terms';

    protected $fillable = [
        'company_id',
        'code',
        'name',
        'description',
        'net_days',
        'discount_days',
        'discount_percent',
        'is_default',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'net_days' => 'integer',
            'discount_days' => 'integer',
            'discount_percent' => 'decimal:2',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function recurringInvoices(): HasMany
    {
        return $this->hasMany(RecurringInvoice::class);
    }

    public function calculateDueDate(string $invoiceDate): string
    {
        return \Carbon\CarbonImmutable::parse($invoiceDate)->addDays($this->net_days)->toDateString();
    }

    public function calculateDiscountDate(string $invoiceDate): ?string
    {
        if (! $this->discount_days) {
            return null;
        }

        return \Carbon\CarbonImmutable::parse($invoiceDate)->addDays($this->discount_days)->toDateString();
    }

    public function calculateDiscountAmount(string $amount): string
    {
        if (! $this->discount_percent || $this->discount_percent <= 0) {
            return '0.0000';
        }

        $discount = bcmul($amount, bcdiv((string) $this->discount_percent, '100', 10), 4);

        return $discount;
    }
}