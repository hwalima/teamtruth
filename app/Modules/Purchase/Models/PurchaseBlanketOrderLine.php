<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseBlanketOrderLine extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_blanket_order_id',
        'product_id',
        'quantity',
        'unit_price',
        'quantity_delivered',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'quantity_delivered' => 'decimal:4',
        ];
    }

    public function blanketOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseBlanketOrder::class, 'purchase_blanket_order_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Inventory\Models\InventoryProduct::class, 'product_id');
    }

    public function remainingQuantity(): string
    {
        $delivered = (float) $this->quantity_delivered;
        $total = (float) $this->quantity;
        return number_format(max(0, $total - $delivered), 4, '.', '');
    }
}