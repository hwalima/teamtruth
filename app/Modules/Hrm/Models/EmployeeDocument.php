<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Hrm\Enums\EmployeeDocumentType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeDocument extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_employee_documents';

    protected $fillable = [
        'company_id',
        'employee_id',
        'document_type',
        'document_number',
        'title',
        'description',
        'file_path',
        'file_mime',
        'file_size',
        'issued_date',
        'expiry_date',
        'is_expired_alert_sent',
        'alert_before_days',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'document_type' => EmployeeDocumentType::class,
            'issued_date' => 'date',
            'expiry_date' => 'date',
            'is_expired_alert_sent' => 'boolean',
            'file_size' => 'integer',
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isExpired(): bool
    {
        return $this->expiry_date && $this->expiry_date->isPast();
    }

    public function isExpiringSoon(): bool
    {
        if (!$this->expiry_date) {
            return false;
        }
        return $this->expiry_date->diffInDays(now()) <= $this->alert_before_days;
    }
}