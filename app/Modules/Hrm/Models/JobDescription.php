<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobDescription extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_job_descriptions';

    protected $fillable = [
        'company_id',
        'position_id',
        'version',
        'purpose',
        'key_duties',
        'kpis',
        'qualifications',
        'experience_required',
        'skills_required',
        'reporting_line',
        'status',
        'published_at',
        'acknowledged_by_employee_at',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'key_duties' => 'array',
            'kpis' => 'array',
            'published_at' => 'datetime',
            'acknowledged_by_employee_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published' && $this->published_at && $this->published_at->isPast();
    }

    public function getMergeFieldsAttribute(): array
    {
        return [
            'position_name' => $this->position?->name,
            'department_name' => $this->position?->department?->name,
            'grade_name' => $this->position?->grade?->name,
            'reports_to' => $this->position?->reportsTo?->name,
            'key_duties' => $this->key_duties ? implode("\n", $this->key_duties) : '',
            'kpis' => $this->kpis ? implode("\n", $this->kpis) : '',
            'qualifications' => $this->qualifications,
            'experience_required' => $this->experience_required,
            'skills_required' => $this->skills_required,
            'reporting_line' => $this->reporting_line,
        ];
    }
}