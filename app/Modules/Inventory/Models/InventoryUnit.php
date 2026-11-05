<?php

namespace App\Modules\Inventory\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryUnit extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'name',
        'abbreviation',
        'category',
        'factor_to_base',
        'is_base',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'factor_to_base' => 'decimal:8',
            'is_base' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function products(): HasMany
    {
        return $this->hasMany(InventoryProduct::class, 'unit_id');
    }
}
