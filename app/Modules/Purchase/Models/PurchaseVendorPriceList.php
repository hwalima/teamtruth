<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseVendorPriceList extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'vendor_id',
        'product_id',
        'min_quantity',
        'price',
        'currency_code',
        'valid_from',
        'valid_to',
    ];

    protected function casts(): array
    {
        return [
            'min_quantity' => 'decimal:4',
            'price' => 'decimal:4',
            'valid_from' => 'date',
            'valid_to' => 'date',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(PurchaseVendor::class, 'vendor_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Inventory\Models\InventoryProduct::class, 'product_id');
    }
}