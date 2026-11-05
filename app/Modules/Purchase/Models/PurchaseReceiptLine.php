<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Inventory\Models\StockMove;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseReceiptLine extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_receipt_id',
        'purchase_order_line_id',
        'stock_move_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:4'];
    }

    public function stockMove(): BelongsTo
    {
        return $this->belongsTo(StockMove::class, 'stock_move_id');
    }
}
