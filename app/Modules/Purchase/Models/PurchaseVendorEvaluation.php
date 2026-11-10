<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseVendorEvaluation extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'vendor_id',
        'period_year',
        'period_month',
        'on_time_delivery_rate',
        'price_variance',
        'rejection_rate',
        'total_orders',
        'on_time_orders',
        'total_receipts',
        'rejected_receipts',
    ];

    protected function casts(): array
    {
        return [
            'on_time_delivery_rate' => 'decimal:2',
            'price_variance' => 'decimal:2',
            'rejection_rate' => 'decimal:2',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(PurchaseVendor::class, 'vendor_id');
    }
}