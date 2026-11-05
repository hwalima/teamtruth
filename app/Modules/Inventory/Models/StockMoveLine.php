<?php

namespace App\Modules\Inventory\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMoveLine extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'stock_move_id',
        'product_id',
        'from_location_id',
        'to_location_id',
        'quantity',
        'lot_code',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:4'];
    }

    public function stockMove(): BelongsTo
    {
        return $this->belongsTo(StockMove::class, 'stock_move_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(InventoryProduct::class, 'product_id');
    }

    public function sourceLocation(): BelongsTo
    {
        return $this->belongsTo(StockLocation::class, 'from_location_id');
    }

    public function destinationLocation(): BelongsTo
    {
        return $this->belongsTo(StockLocation::class, 'to_location_id');
    }
}
