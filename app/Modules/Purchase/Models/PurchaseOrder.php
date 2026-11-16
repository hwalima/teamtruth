<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Enums\ApprovalStatus;
use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Requisitions\Models\Requisition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class PurchaseOrder extends Model
{
    use BelongsToCompany;
    use HasApprovals;

    protected $fillable = [
        'company_id',
        'document_number',
        'vendor_id',
        'quotation_id',
        'source_requisition_id',
        'blanket_order_id',
        'expected_delivery_date',
        'status',
        'currency_code',
        'total',
        'created_by',
        'submitted_at',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:4',
            'expected_delivery_date' => 'date',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(PurchaseVendor::class, 'vendor_id');
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(PurchaseQuotation::class, 'quotation_id');
    }

    public function sourceRequisition(): BelongsTo
    {
        return $this->belongsTo(Requisition::class, 'source_requisition_id');
    }

    public function blanketOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseBlanketOrder::class, 'blanket_order_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseOrderLine::class, 'purchase_order_id');
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(PurchaseReceipt::class, 'purchase_order_id');
    }

    public function syncApprovalStatus(ApprovalStatus $status): void
    {
        DB::transaction(function () use ($status): void {
            $previousStatus = $this->status;
            $this->status = match ($status) {
                ApprovalStatus::Approved => 'approved',
                ApprovalStatus::Rejected => 'rejected',
                ApprovalStatus::Returned => 'returned',
                ApprovalStatus::Cancelled => 'cancelled',
                ApprovalStatus::Pending => 'pending_approval',
            };
            if ($status === ApprovalStatus::Approved) {
                $this->approved_at = now();
            }
            $this->save();

            if (in_array($this->status, ['rejected', 'cancelled'], true)
                && ! in_array($previousStatus, ['rejected', 'cancelled'], true)
                && $this->blanket_order_id) {
                $blanket = PurchaseBlanketOrder::query()->lockForUpdate()->find($this->blanket_order_id);
                if ($blanket) {
                    $blanket->amount_used = \App\Modules\Purchase\Services\PurchaseService::compareDecimals((string) $blanket->amount_used, (string) $this->total) >= 0
                        ? \App\Modules\Purchase\Services\PurchaseService::subtractDecimals((string) $blanket->amount_used, (string) $this->total)
                        : '0.0000';
                    $blanket->save();
                }
            }
        });
    }
}
