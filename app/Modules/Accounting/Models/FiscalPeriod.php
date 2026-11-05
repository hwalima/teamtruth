<?php

namespace App\Modules\Accounting\Models;

use App\Models\User;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiscalPeriod extends Model
{
    use BelongsToCompany;

    protected $table = 'accounting_fiscal_periods';

    protected $fillable = [
        'company_id',
        'fiscal_year_id',
        'name',
        'starts_on',
        'ends_on',
        'status',
        'locked_by',
        'locked_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'locked_at' => 'datetime',
        ];
    }

    public function fiscalYear(): BelongsTo
    {
        return $this->belongsTo(FiscalYear::class, 'fiscal_year_id');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(JournalEntry::class, 'fiscal_period_id');
    }

    public function locker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }
}
