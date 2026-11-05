<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseQuotationLine extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_quotation_id',
        'purchase_rfq_line_id',
        'quantity',
        'unit_price',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'line_total' => 'decimal:4',
        ];
    }

    public function rfqLine(): BelongsTo
    {
        return $this->belongsTo(PurchaseRFQLine::class, 'purchase_rfq_line_id');
    }
}
