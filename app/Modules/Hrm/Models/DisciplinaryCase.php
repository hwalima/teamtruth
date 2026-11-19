<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Hrm\Enums\DisciplinaryOutcome;
use App\Modules\Hrm\Enums\DisciplinaryStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DisciplinaryCase extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_disciplinary_cases';

    protected $fillable = [
        'company_id',
        'employee_id',
        'case_number',
        'incident_date',
        'reported_date',
        'reported_by',
        'incident_description',
        'incident_location',
        'witnesses',
        'evidence_attachments',
        'status',
        'outcome',
        'outcome_details',
        'outcome_date',
        'expiry_date',
        'appeal_details',
        'appeal_decision',
        'appeal_date',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'incident_date' => 'date',
            'reported_date' => 'date',
            'witnesses' => 'array',
            'evidence_attachments' => 'array',
            'status' => DisciplinaryStatus::class,
            'outcome' => DisciplinaryOutcome::class,
            'outcome_date' => 'date',
            'expiry_date' => 'date',
            'appeal_date' => 'date',
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

    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(DisciplinaryDocument::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isOpen(): bool
    {
        return in_array($this->status, [
            DisciplinaryStatus::Open,
            DisciplinaryStatus::UnderInvestigation,
            DisciplinaryStatus::NoticeIssued,
            DisciplinaryStatus::HearingScheduled,
            DisciplinaryStatus::HearingCompleted,
            DisciplinaryStatus::Appealed,
        ]);
    }

    public function hasWarning(): bool
    {
        return $this->outcome && $this->outcome->hasExpiry();
    }

    public function isWarningExpired(): bool
    {
        if (!$this->hasWarning() || !$this->expiry_date) {
            return false;
        }
        return $this->expiry_date->isPast();
    }
}