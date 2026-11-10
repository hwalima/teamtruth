<?php

namespace App\Modules\Purchase\Models;

use App\Modules\Core\Models\Concerns\BelongsToCompany;
use App\Modules\Core\Models\Concerns\HasApprovals;
use App\Modules\Core\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchasePayment extends Model
{
    use BelongsToCompany;
    use HasApprovals;

    protected $fillable = [
        'company_id',
        'document_number',
        'vendor_id',
        'journal_id',
        'payment_method',
        'currency_code',
        'exchange_rate',
        'amount',
        'payment_date',
        'reference',
        'status',
        'created_by',
        'posted_by',
        'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'exchange_rate' => 'decimal:10',
            'amount' => 'decimal:4',
            'payment_date' => 'date',
            'posted_at' => 'datetime',
        ];
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(PurchaseVendor::class, 'vendor_id');
    }

    public function journal(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\AccountingJournal::class, 'journal_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PurchasePaymentAllocation::class, 'purchase_payment_id');
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