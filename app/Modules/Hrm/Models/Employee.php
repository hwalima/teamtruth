<?php

namespace App\Modules\Hrm\Models;

use App\Models\User;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Hrm\Enums\ContractStatus;
use App\Modules\Hrm\Enums\EmployeeStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use BelongsToCompany, HasFactory, SoftDeletes;

    protected $table = 'hrm_employees';

    protected $fillable = [
        'company_id',
        'user_id',
        'employee_number',
        'first_name',
        'last_name',
        'middle_name',
        'gender',
        'date_of_birth',
        'national_id',
        'passport_number',
        'marital_status',
        'nationality',
        'personal_email',
        'personal_phone',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relation',
        'bank_name',
        'bank_account_name',
        'bank_account_number',
        'bank_branch',
        'tax_number',
        'nssa_number',
        'profile_photo_path',
        'status',
        'hire_date',
        'termination_date',
        'termination_reason',
        'line_manager_id',
        'department_id',
        'position_id',
        'grade_id',
        'cost_center_id',
        'created_by',
        'updated_by',
    ];

    protected $appends = ['full_name'];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'hire_date' => 'date',
            'termination_date' => 'date',
            'status' => EmployeeStatus::class,
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lineManager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'line_manager_id');
    }

    public function subordinates(): HasMany
    {
        return $this->hasMany(self::class, 'line_manager_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class);
    }

    public function transfers(): HasMany
    {
        return $this->hasMany(EmployeeTransfer::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function leaveBalances(): HasMany
    {
        return $this->hasMany(LeaveBalance::class);
    }

    public function leaveRequests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }

    public function currentContract(): HasOne
    {
        return $this->hasOne(Contract::class)
            ->where('status', ContractStatus::Active)
            ->latest('start_date');
    }

    public function disciplinaryCases(): HasMany
    {
        return $this->hasMany(DisciplinaryCase::class);
    }

    public function selfServiceRequests(): HasMany
    {
        return $this->hasMany(SelfServiceRequest::class);
    }

    public function getFullNameAttribute(): string
    {
        return implode(' ', array_filter([$this->first_name, $this->middle_name, $this->last_name], fn ($part) => filled($part)));
    }

    /**
     * HR history that deleting the employee would wipe out (those tables
     * cascade). An employee with any of it is terminated instead.
     *
     * @return list<string>
     */
    public function historyLabels(): array
    {
        $labels = [];
        foreach ([
            'contracts' => 'contracts',
            'leaveRequests' => 'leave requests',
            'disciplinaryCases' => 'disciplinary cases',
            'selfServiceRequests' => 'self-service requests',
            'documents' => 'documents',
            'transfers' => 'transfers',
        ] as $relation => $label) {
            if ($this->{$relation}()->exists()) {
                $labels[] = $label;
            }
        }

        return $labels;
    }

    public function canBeTerminated(): bool
    {
        return $this->status !== EmployeeStatus::Terminated;
    }

    public function scopeActive($query)
    {
        return $query->where('status', EmployeeStatus::Active);
    }

    public function scopeInDepartment($query, int $departmentId)
    {
        return $query->where('department_id', $departmentId);
    }

    public function scopeInPosition($query, int $positionId)
    {
        return $query->where('position_id', $positionId);
    }

    public function scopeManagedBy($query, int $managerId)
    {
        return $query->where('line_manager_id', $managerId);
    }
}
