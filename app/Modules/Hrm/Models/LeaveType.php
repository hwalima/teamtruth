<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Hrm\Enums\LeaveAccrualType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeaveType extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_leave_types';

    protected $fillable = [
        'company_id',
        'name',
        'code',
        'description',
        'accrual_type',
        'accrual_rate',
        'max_accrual',
        'carry_over_limit',
        'carry_over_expiry_months',
        'is_paid',
        'requires_approval',
        'requires_document',
        'color',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'accrual_type' => LeaveAccrualType::class,
            'accrual_rate' => 'decimal:2',
            'max_accrual' => 'decimal:2',
            'carry_over_limit' => 'decimal:2',
            'is_paid' => 'boolean',
            'requires_approval' => 'boolean',
            'requires_document' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function balances(): HasMany
    {
        return $this->hasMany(LeaveBalance::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isAccrualBased(): bool
    {
        return $this->accrual_type !== LeaveAccrualType::Fixed;
    }
}