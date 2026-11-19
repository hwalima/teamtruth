<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Hrm\Enums\SelfServiceRequestStatus;
use App\Modules\Hrm\Enums\SelfServiceRequestType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SelfServiceRequest extends Model
{
    use BelongsToCompany, HasFactory;

    protected $table = 'hrm_self_service_requests';

    protected $fillable = [
        'company_id',
        'employee_id',
        'request_type',
        'request_data',
        'status',
        'processed_by',
        'processed_at',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'request_type' => SelfServiceRequestType::class,
            'request_data' => 'array',
            'status' => SelfServiceRequestStatus::class,
            'processed_at' => 'datetime',
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

    public function processedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isPending(): bool
    {
        return $this->status === SelfServiceRequestStatus::Pending;
    }

    public function isCompleted(): bool
    {
        return $this->status === SelfServiceRequestStatus::Completed;
    }
}