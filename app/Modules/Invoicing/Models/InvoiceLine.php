<?php

namespace App\Modules\Invoicing\Models;

use App\Modules\Accounting\Models\AccountingAccount;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceLine extends Model
{
    use BelongsToCompany;

    protected $table = 'inv_invoice_lines';

    protected $fillable = [
        'company_id',
        'invoice_id',
        'product_id',
        'account_id',
        'name',
        'description',
        'quantity',
        'unit',
        'unit_price',
        'discount_percent',
        'discount_amount',
        'tax_rate',
        'tax_amount',
        'line_total',
        'sort_order',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'discount_percent' => 'decimal:2',
            'discount_amount' => 'decimal:4',
            'tax_rate' => 'decimal:2',
            'tax_amount' => 'decimal:4',
            'line_total' => 'decimal:4',
            'sort_order' => 'integer',
            'metadata' => 'array',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Inventory\Models\InventoryProduct::class, 'product_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AccountingAccount::class);
    }

    public function recalculate(): self
    {
        $subtotal = bcmul((string) $this->quantity, (string) $this->unit_price, 4);
        $discountAmount = '0.0000';
        if ($this->discount_percent > 0) {
            $discountAmount = bcmul($subtotal, bcdiv((string) $this->discount_percent, '100', 10), 4);
        }
        $taxableAmount = bcsub($subtotal, $discountAmount, 4);
        $taxAmount = '0.0000';
        if ($this->tax_rate > 0) {
            $taxAmount = bcmul($taxableAmount, bcdiv((string) $this->tax_rate, '100', 10), 4);
        }
        $lineTotal = bcadd($taxableAmount, $taxAmount, 4);

        $this->discount_amount = $discountAmount;
        $this->tax_amount = $taxAmount;
        $this->line_total = $lineTotal;

        return $this;
    }
}