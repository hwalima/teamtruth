<?php

namespace App\Modules\Requisitions\Models\ErpBudget;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpBudgetCommitment extends Model
{
    use BelongsToCompany;

    protected $table = 'erp_budget_commitments';

    protected $fillable = [
        'company_id',
        'budget_line_id',
        'commitment_type',
        'commitment_id',
        'amount',
        'currency_code',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:4',
    ];

    public function budgetLine(): BelongsTo
    {
        return $this->belongsTo(ErpBudgetLine::class, 'budget_line_id');
    }

    public function isConfirmed(): bool
    {
        return $this->status === 'confirmed';
    }

    public function isReserved(): bool
    {
        return $this->status === 'reserved';
    }

    public function confirm(): void
    {
        $this->status = 'confirmed';
        $this->save();
    }

    public function release(): void
    {
        $this->status = 'released';
        $this->save();
    }

    public function cancel(): void
    {
        $this->status = 'cancelled';
        $this->save();
    }
}