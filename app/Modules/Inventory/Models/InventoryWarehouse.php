<?php

namespace App\Modules\Inventory\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryWarehouse extends Model
{
    use BelongsToCompany;

    protected $fillable = ['company_id', 'code', 'name', 'address', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function locations(): HasMany
    {
        return $this->hasMany(StockLocation::class, 'warehouse_id');
    }
}
