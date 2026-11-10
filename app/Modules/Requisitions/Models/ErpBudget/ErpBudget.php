<?php

namespace App\Modules\Requisitions\Models\ErpBudget;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ErpBudget extends Model
{
    use BelongsToCompany, SoftDeletes;

    protected $table = 'erp_budgets';

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'description',
        'period_type',
        'start_date',
        'end_date',
        'total_amount',
        'currency_code',
        'status',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'total_amount' => 'decimal:4',
        'deleted_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ErpBudgetLine::class, 'budget_id')->orderBy('sort_order');
    }

    public function activeLines(): HasMany
    {
        return $this->lines()->where('is_active', true);
    }

    public function commitments(): HasMany
    {
        return $this->hasMany(ErpBudgetCommitment::class);
    }

    public function getCommittedAmountAttribute(): string
    {
        return $this->activeLines->sum(fn ($line) => $line->committed_amount);
    }

    public function getSpentAmountAttribute(): string
    {
        return $this->activeLines->sum(fn ($line) => $line->spent_amount);
    }

    public function getAvailableAmountAttribute(): string
    {
        $total = $this->total_amount;
        $committed = $this->committed_amount;
        $spent = $this->spent_amount;

        return max('0.0000', $total - $committed - $spent);
    }

    public function getUtilizationPercentageAttribute(): float
    {
        if ($this->total_amount === '0.0000' || $this->total_amount === 0) {
            return 0.0;
        }

        $used = bcadd($this->committed_amount, $this->spent_amount, 4);
        return round((float) bcdiv($used, $this->total_amount, 4) * 100, 2);
    }
}