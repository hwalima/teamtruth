<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Inventory\Models\InventoryProduct;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseRFQLine extends Model
{
    use BelongsToCompany;

    protected $table = 'purchase_rfq_lines';

    protected $fillable = ['company_id', 'purchase_rfq_id', 'product_id', 'quantity', 'sort_order'];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:4'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(InventoryProduct::class, 'product_id');
    }
}
