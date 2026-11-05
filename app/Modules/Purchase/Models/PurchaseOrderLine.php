<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Inventory\Models\InventoryProduct;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderLine extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_order_id',
        'product_id',
        'quantity',
        'received_quantity',
        'unit_price',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'received_quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'line_total' => 'decimal:4',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(InventoryProduct::class, 'product_id');
    }
}
