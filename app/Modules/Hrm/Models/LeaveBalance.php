<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeaveBalance extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_leave_balances';

    protected $fillable = [
        'company_id',
        'employee_id',
        'leave_type_id',
        'period_start',
        'period_end',
        'brought_forward',
        'accrued',
        'taken',
        'carried_over',
        'adjusted',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'brought_forward' => 'decimal:2',
            'accrued' => 'decimal:2',
            'taken' => 'decimal:2',
            'carried_over' => 'decimal:2',
            'adjusted' => 'decimal:2',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LeaveLedger::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getAvailableAttribute(): float
    {
        return $this->brought_forward + $this->accrued + $this->carried_over + $this->adjusted - $this->taken;
    }

    public function getTotalEntitlementAttribute(): float
    {
        return $this->brought_forward + $this->accrued + $this->carried_over + $this->adjusted;
    }
}