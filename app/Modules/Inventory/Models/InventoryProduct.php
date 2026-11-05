<?php

namespace App\Modules\Inventory\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryProduct extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'category_id',
        'unit_id',
        'sku',
        'barcode',
        'name',
        'description',
        'type',
        'costing_method',
        'tracking',
        'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(InventoryCategory::class, 'category_id');
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(InventoryUnit::class, 'unit_id');
    }
}
