<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseVendor extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'code',
        'name',
        'tax_no',
        'email',
        'phone',
        'address',
        'payment_terms_days',
        'currency_code',
        'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'payment_terms_days' => 'integer'];
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(PurchaseQuotation::class, 'vendor_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class, 'vendor_id');
    }
}
