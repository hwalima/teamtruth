<?php

namespace App\Modules\Sales\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Inventory\Models\StockLocation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryLine extends Model
{
    use BelongsToCompany;

    protected $table = 'sal_delivery_lines';

    protected $fillable = ['company_id', 'delivery_id', 'sales_order_line_id', 'stock_move_id', 'from_location_id', 'quantity', 'lot_code'];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:4'];
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class);
    }

    public function orderLine(): BelongsTo
    {
        return $this->belongsTo(SalesOrderLine::class, 'sales_order_line_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(StockLocation::class, 'from_location_id');
    }
}
