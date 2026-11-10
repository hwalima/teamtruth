<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Core\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseBlanketOrder extends Model
{
    use BelongsToCompany;
    use HasApprovals;

    protected $fillable = [
        'company_id',
        'document_number',
        'vendor_id',
        'currency_code',
        'max_amount',
        'amount_used',
        'starts_on',
        'ends_on',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'max_amount' => 'decimal:4',
            'amount_used' => 'decimal:4',
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(PurchaseVendor::class, 'vendor_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseBlanketOrderLine::class, 'purchase_blanket_order_id')->orderBy('sort_order');
    }

    public function syncApprovalStatus(ApprovalStatus $status): void
    {
        $this->status = match ($status) {
            ApprovalStatus::Approved => 'active',
            ApprovalStatus::Rejected => 'rejected',
            ApprovalStatus::Returned => 'returned',
            ApprovalStatus::Cancelled => 'cancelled',
            ApprovalStatus::Pending => 'pending_approval',
            default => $this->status,
        };
        $this->save();
    }

    public function isActive(): bool
    {
        return $this->status === 'active'
            && $this->starts_on <= now()->toDateString()
            && $this->ends_on >= now()->toDateString()
            && $this->amount_used < $this->max_amount;
    }

    public function remainingAmount(): string
    {
        $used = (float) $this->amount_used;
        $max = (float) $this->max_amount;
        return number_format(max(0, $max - $used), 4, '.', '');
    }
}