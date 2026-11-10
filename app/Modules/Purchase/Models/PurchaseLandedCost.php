<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Core\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseLandedCost extends Model
{
    use BelongsToCompany;
    use HasApprovals;

    protected $fillable = [
        'company_id',
        'document_number',
        'purchase_receipt_id',
        'vendor_id',
        'currency_code',
        'total_amount',
        'status',
        'created_by',
        'posted_by',
        'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:4',
            'posted_at' => 'datetime',
        ];
    }

    public function purchaseReceipt(): BelongsTo
    {
        return $this->belongsTo(PurchaseReceipt::class, 'purchase_receipt_id');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(PurchaseVendor::class, 'vendor_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseLandedCostLine::class, 'purchase_landed_cost_id');
    }

    public function syncApprovalStatus(ApprovalStatus $status): void
    {
        $this->status = match ($status) {
            ApprovalStatus::Approved => 'posted',
            ApprovalStatus::Rejected => 'rejected',
            ApprovalStatus::Returned => 'returned',
            ApprovalStatus::Cancelled => 'cancelled',
            ApprovalStatus::Pending => 'pending_approval',
            default => $this->status,
        };
        if ($status === ApprovalStatus::Approved) {
            $this->posted_at = now();
        }
        $this->save();
    }

    public function isEditable(): bool
    {
        return in_array($this->status, ['draft', 'pending_approval', 'returned'], true);
    }
}