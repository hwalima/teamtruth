<?php

namespace App\Modules\Core\Models;

use App\Models\Currency;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExchangeRate extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'from_currency_id',
        'to_currency_id',
        'rate',
        'effective_at',
        'source',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'rate' => 'decimal:10',
            'effective_at' => 'datetime',
        ];
    }

    public function fromCurrency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'from_currency_id');
    }

    public function toCurrency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'to_currency_id');
    }
}
