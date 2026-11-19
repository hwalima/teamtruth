<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Hrm\Enums\ContractStatus;
use App\Modules\Hrm\Enums\ContractType;
use App\Modules\Hrm\Enums\PayFrequency;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contract extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_contracts';

    protected $fillable = [
        'company_id',
        'employee_id',
        'contract_type',
        'start_date',
        'end_date',
        'probation_end_date',
        'basic_salary',
        'currency_code',
        'pay_frequency',
        'working_hours_per_week',
        'shift_pattern_id',
        'template_id',
        'status',
        'signed_by_employee_at',
        'signed_by_employer_at',
        'employee_signature_path',
        'employer_signature_path',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'contract_type' => ContractType::class,
            'start_date' => 'date',
            'end_date' => 'date',
            'probation_end_date' => 'date',
            'basic_salary' => 'decimal:4',
            'pay_frequency' => PayFrequency::class,
            'working_hours_per_week' => 'decimal:2',
            'status' => ContractStatus::class,
            'signed_by_employee_at' => 'datetime',
            'signed_by_employer_at' => 'datetime',
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

    public function template(): BelongsTo
    {
        return $this->belongsTo(ContractTemplate::class, 'template_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isActive(): bool
    {
        return $this->status === ContractStatus::Active
            && $this->start_date->isPast()
            && (!$this->end_date || $this->end_date->isFuture());
    }

    public function isExpiringSoon(int $days = 30): bool
    {
        if (!$this->end_date) {
            return false;
        }
        return $this->end_date->diffInDays(now()) <= $days;
    }

    public function isProbation(): bool
    {
        return $this->contract_type === ContractType::Probation
            && $this->probation_end_date
            && $this->probation_end_date->isFuture();
    }
}