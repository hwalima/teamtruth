<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseQuotation extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'purchase_rfq_id',
        'vendor_id',
        'vendor_reference',
        'status',
        'total',
    ];

    protected function casts(): array
    {
        return ['total' => 'decimal:4'];
    }

    public function rfq(): BelongsTo
    {
        return $this->belongsTo(PurchaseRFQ::class, 'purchase_rfq_id');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(PurchaseVendor::class, 'vendor_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseQuotationLine::class, 'purchase_quotation_id');
    }
}
