<?php

namespace App\Modules\Inventory\Models;

use App\Models\User;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockMove extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'document_number',
        'operation',
        'status',
        'reference',
        'moved_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return ['moved_at' => 'datetime'];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(StockMoveLine::class, 'stock_move_id');
    }
}
