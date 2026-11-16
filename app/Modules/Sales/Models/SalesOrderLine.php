<?php

namespace App\Modules\Sales\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Company;
use App\Modules\Inventory\Models\InventoryProduct;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesOrderLine extends Model
{
    use BelongsToCompany;

    protected $table = 'sal_sales_order_lines';

    protected $fillable = [
        'company_id',
        'sales_order_id',
        'product_id',
        'description',
        'quantity',
        'delivered_quantity',
        'invoiced_quantity',
        'unit_price',
        'discount',
        'tax_rate',
        'total',
        'notes',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'delivered_quantity' => 'decimal:4',
            'invoiced_quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'discount' => 'decimal:4',
            'tax_rate' => 'decimal:4',
            'total' => 'decimal:4',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(InventoryProduct::class);
    }
}
