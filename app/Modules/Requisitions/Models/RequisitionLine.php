<?php

namespace App\Modules\Requisitions\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequisitionLine extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'requisition_id',
        'item',
        'description',
        'quantity',
        'unit',
        'estimated_unit_price',
        'estimated_total',
        'gl_account',
        'budget_line',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'estimated_unit_price' => 'decimal:4',
            'estimated_total' => 'decimal:4',
            'sort_order' => 'integer',
        ];
    }

    public function requisition(): BelongsTo
    {
        return $this->belongsTo(Requisition::class);
    }
}
