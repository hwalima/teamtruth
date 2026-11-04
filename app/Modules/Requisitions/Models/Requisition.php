<?php

namespace App\Modules\Requisitions\Models;

use App\Models\User;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Requisition extends Model
{
    use BelongsToCompany;
    use HasApprovals;

    public const TYPES = [
        'purchase' => 'Purchase',
        'store_issue' => 'Stock / Store Issue',
        'petty_cash' => 'Petty Cash / Cash Advance',
        'travel' => 'Travel',
        'leave' => 'Leave of Absence',
        'maintenance' => 'Maintenance / Fleet Job',
        'it_service' => 'IT / Service Request',
        'payment' => 'Payment Requisition',
    ];

    protected $fillable = [
        'company_id',
        'document_number',
        'requisition_type',
        'status',
        'requested_by',
        'department',
        'cost_center',
        'required_by',
        'priority',
        'justification',
        'currency_code',
        'estimated_total',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => RequisitionStatus::class,
            'required_by' => 'date',
            'submitted_at' => 'datetime',
            'estimated_total' => 'decimal:4',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(RequisitionLine::class)->orderBy('sort_order');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(RequisitionAttachment::class);
    }

    public function syncApprovalStatus(ApprovalStatus $status): void
    {
        $this->status = match ($status) {
            ApprovalStatus::Approved => RequisitionStatus::Approved,
            ApprovalStatus::Rejected => RequisitionStatus::Rejected,
            ApprovalStatus::Returned => RequisitionStatus::Returned,
            ApprovalStatus::Cancelled => RequisitionStatus::Cancelled,
            ApprovalStatus::Pending => RequisitionStatus::InApproval,
        };
        $this->save();
    }

    public function isEditableBy(User $user): bool
    {
        return (int) $this->requested_by === (int) $user->id
            && in_array($this->status, [RequisitionStatus::Draft, RequisitionStatus::Returned], true);
    }
}
