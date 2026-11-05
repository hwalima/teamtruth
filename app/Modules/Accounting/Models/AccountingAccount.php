<?php

namespace App\Modules\Accounting\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountingAccount extends Model
{
    use BelongsToCompany;

    protected $fillable = [
        'company_id',
        'parent_id',
        'code',
        'name',
        'account_type',
        'is_group',
        'allow_reconciliation',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_group' => 'boolean',
            'allow_reconciliation' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(JournalEntryLine::class, 'account_id');
    }
}
