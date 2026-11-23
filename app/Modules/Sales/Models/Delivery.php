<?php

namespace App\Modules\Sales\Models;

use App\Models\User;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Goods sent to the customer against a sales order; one delivery can cover several order lines. */
class Delivery extends Model
{
    use BelongsToCompany;

    protected $table = 'sal_deliveries';

    protected $fillable = ['company_id', 'sales_order_id', 'document_number', 'delivered_by', 'delivered_at', 'notes'];

    protected function casts(): array
    {
        return ['delivered_at' => 'datetime'];
    }

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function deliveredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delivered_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(DeliveryLine::class);
    }
}
