<?php

namespace App\Modules\Requisitions\Models;

use App\Models\Project;
use App\Models\User;
use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Requisitions\Enums\RequisitionStatus;
use App\Modules\Requisitions\Models\ErpBudget\ErpBudget;
use App\Modules\Requisitions\Services\BudgetService;
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
        'project_id',
        'budget_id',
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

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function budget(): BelongsTo
    {
        return $this->belongsTo(ErpBudget::class, 'budget_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(RequisitionLine::class)->orderBy('sort_order');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(RequisitionAttachment::class);
    }

    public function syncApprovalStatus(ApprovalStatus $status, ?User $actor = null): void
    {
        $oldStatus = $this->status;
        $newStatus = match ($status) {
            ApprovalStatus::Approved => RequisitionStatus::Approved,
            ApprovalStatus::Rejected => RequisitionStatus::Rejected,
            ApprovalStatus::Returned => RequisitionStatus::Returned,
            ApprovalStatus::Cancelled => RequisitionStatus::Cancelled,
            ApprovalStatus::Pending => RequisitionStatus::InApproval,
        };

        // Handle budget based on approval outcome
        if ($actor) {
            $budgetService = app(BudgetService::class);

            if ($status === ApprovalStatus::Approved) {
                // Confirm budget reservation when approved
                $budgetService->confirmBudgetReservation($this, $actor);
            } elseif (in_array($status, [ApprovalStatus::Rejected, ApprovalStatus::Returned, ApprovalStatus::Cancelled], true)) {
                // Release budget reservation when rejected, returned, or cancelled
                $budgetService->releaseBudgetReservation($this, $actor);
            }
        }

        $this->status = $newStatus;
        $this->save();
    }

    public function isEditableBy(User $user): bool
    {
        return (int) $this->requested_by === (int) $user->id
            && in_array($this->status, [RequisitionStatus::Draft, RequisitionStatus::Returned], true);
    }
}
