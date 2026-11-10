<?php

namespace App\Modules\Requisitions\Models\ErpBudget;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ErpBudgetLine extends Model
{
    use BelongsToCompany;

    protected $table = 'erp_budget_lines';

    protected $fillable = [
        'company_id',
        'budget_id',
        'code',
        'name',
        'description',
        'allocated_amount',
        'currency_code',
        'parent_id',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'allocated_amount' => 'decimal:4',
        'is_active' => 'boolean',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(ErpBudget::class, 'budget_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order');
    }

    public function commitments(): HasMany
    {
        return $this->hasMany(ErpBudgetCommitment::class, 'budget_line_id');
    }

    public function activeCommitments(): HasMany
    {
        return $this->commitments()->whereIn('status', ['reserved', 'confirmed']);
    }

    public function getCommittedAmountAttribute(): string
    {
        return $this->activeCommitments->sum(fn ($c) => $c->amount);
    }

    public function getSpentAmountAttribute(): string
    {
        return $this->commitments()
            ->where('status', 'confirmed')
            ->sum('amount');
    }

    public function getAvailableAmountAttribute(): string
    {
        $allocated = $this->allocated_amount;
        $committed = $this->committed_amount;
        $spent = $this->spent_amount;

        return max('0.0000', $allocated - $committed - $spent);
    }

    public function getUtilizationPercentageAttribute(): float
    {
        if ($this->allocated_amount === '0.0000' || $this->allocated_amount === 0) {
            return 0.0;
        }

        $used = bcadd($this->committed_amount, $this->spent_amount, 4);
        return round((float) bcdiv($used, $this->allocated_amount, 4) * 100, 2);
    }
}