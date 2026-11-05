<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Requisitions\Models\Requisition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseRFQ extends Model
{
    use BelongsToCompany;

    protected $table = 'purchase_rfqs';

    protected $fillable = [
        'company_id',
        'document_number',
        'source_requisition_id',
        'status',
        'currency_code',
        'reference',
        'created_by',
    ];

    public function sourceRequisition(): BelongsTo
    {
        return $this->belongsTo(Requisition::class, 'source_requisition_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseRFQLine::class, 'purchase_rfq_id')->orderBy('id');
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(PurchaseQuotation::class, 'purchase_rfq_id')->orderBy('total');
    }
}
