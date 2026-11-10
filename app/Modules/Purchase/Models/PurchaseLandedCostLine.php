<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseLandedCostLine extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_landed_cost_id',
        'product_id',
        'account_id',
        'name',
        'amount',
        'split_method',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
        ];
    }

    public function landedCost(): BelongsTo
    {
        return $this->belongsTo(PurchaseLandedCost::class, 'purchase_landed_cost_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Inventory\Models\InventoryProduct::class, 'product_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\AccountingAccount::class, 'account_id');
    }
}