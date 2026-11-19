<?php

namespace App\Modules\Hrm\Models;

use App\Modules\Core\Models\ApprovalRequest;
use App\Modules\Core\Models\Company;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Hrm\Enums\LeaveRequestStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeaveRequest extends Model
{
    use BelongsToCompany, HasApprovals, HasFactory;

    protected $table = 'hrm_leave_requests';

    protected $fillable = [
        'company_id',
        'employee_id',
        'leave_type_id',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'total_days',
        'reason',
        'status',
        'approved_by',
        'approved_at',
        'rejection_reason',
        'attachment_path',
        'approval_request_id',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'start_time' => 'datetime:H:i',
            'end_time' => 'datetime:H:i',
            'total_days' => 'decimal:2',
            'status' => LeaveRequestStatus::class,
            'approved_at' => 'datetime',
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

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'approval_request_id');
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LeaveLedger::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isPendingApproval(): bool
    {
        return $this->status === LeaveRequestStatus::Submitted || $this->status === LeaveRequestStatus::InApproval;
    }

    public function isApproved(): bool
    {
        return $this->status === LeaveRequestStatus::Approved;
    }

    public function isRejected(): bool
    {
        return $this->status === LeaveRequestStatus::Rejected;
    }

    public function getDateRangeAttribute(): string
    {
        if ($this->start_date->equalTo($this->end_date)) {
            return $this->start_date->format('M d, Y');
        }
        return $this->start_date->format('M d') . ' - ' . $this->end_date->format('M d, Y');
    }
}